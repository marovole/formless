import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/middleware';
import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { Id, Doc } from '@/convex/_generated/dataModel';
import {
  successResponse,
  validationErrorResponse,
  handleApiError,
} from '@/lib/api/responses';
import { logger } from '@/lib/logger';

type PromptRole = 'formless_elder' | 'memory_extractor' | 'system';
type Language = 'zh' | 'en';

interface PromptCreateRequest {
  name: string;
  role: PromptRole;
  language?: Language;
  content: string;
  description?: string;
  is_active?: boolean;
}

interface PromptUpdateRequestBody {
  id: string;
  name?: string;
  content?: string;
  description?: string;
  is_active?: boolean;
}

/**
 * 获取Prompt列表 (管理员)
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const convex = getConvexClient();
    const rawPrompts = await convex.query(api.prompts.list, {});

    // Map _id to id for frontend compatibility
    const prompts = rawPrompts.map((p: Doc<"prompts">) => ({
      id: p._id,
      name: p.name,
      role: p.role,
      language: p.language,
      content: p.content,
      version: p.version,
      is_active: p.is_active,
      description: p.description,
    }));

    return successResponse({ prompts });
  } catch (error) {
    logger.error('获取Prompt列表失败', { error });
    return handleApiError(error, '获取Prompt列表API错误');
  }
}

/**
 * 创建新Prompt (管理员)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    const body = (await request.json()) as PromptCreateRequest;

    // 验证必填字段
    if (!body.name || !body.role || !body.content) {
      return validationErrorResponse('name、role 和 content 是必填项');
    }

    // 验证role
    const validRoles: PromptRole[] = ['formless_elder', 'memory_extractor', 'system'];
    if (!validRoles.includes(body.role)) {
      return validationErrorResponse(`无效的role: ${body.role}`, { validRoles });
    }

    // 验证language
    const language = body.language || 'zh';
    const validLanguages: Language[] = ['zh', 'en'];
    if (!validLanguages.includes(language)) {
      return validationErrorResponse(`无效的language: ${language}`, { validLanguages });
    }

    const convex = getConvexClient();
    const newId = await convex.mutation(api.prompts.create, {
      name: body.name,
      role: body.role,
      language,
      content: body.content,
      description: body.description,
      is_active: body.is_active,
    });

    const newPrompt = await convex.query(api.prompts.getById, { id: newId });

    logger.info('Prompt创建成功', {
      id: newId,
      name: body.name,
      role: body.role,
      language,
    });

    return successResponse({ prompt: newPrompt }, 201);
  } catch (error) {
    logger.error('创建Prompt失败', { error });
    return handleApiError(error, '创建Prompt API错误');
  }
}

/**
 * 更新Prompt (管理员)
 * 如果内容改变，版本号自动递增
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAuth(request);

    const body = (await request.json()) as PromptUpdateRequestBody;
    const { id, ...updates } = body;

    if (!id) {
      return validationErrorResponse('id 是必填项');
    }

    if (Object.keys(updates).length === 0) {
      return validationErrorResponse('没有提供任何要更新的字段');
    }

    const convex = getConvexClient();

    // 检查是否存在
    const existing = await convex.query(api.prompts.getById, { id: id as Id<"prompts"> });
    if (!existing) {
      return NextResponse.json({ error: 'Prompt不存在' }, { status: 404 });
    }

    await convex.mutation(api.prompts.update, {
      id: id as Id<"prompts">,
      ...updates,
    });

    logger.info('Prompt更新成功', {
      id,
      name: existing.name,
      updates: Object.keys(updates),
    });

    return successResponse({ id, ...updates });
  } catch (error) {
    logger.error('更新Prompt失败', { error });
    return handleApiError(error, '更新Prompt API错误');
  }
}

/**
 * 删除Prompt (管理员)
 */
export async function DELETE(request: NextRequest) {
  try {
    await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return validationErrorResponse('id 是必填项');
    }

    const convex = getConvexClient();

    // 检查是否存在
    const existing = await convex.query(api.prompts.getById, { id: id as Id<"prompts"> });
    if (!existing) {
      return NextResponse.json({ error: 'Prompt不存在' }, { status: 404 });
    }

    await convex.mutation(api.prompts.deletePrompt, {
      id: id as Id<"prompts">,
    });

    logger.info('Prompt删除成功', {
      id,
      name: existing.name,
      role: existing.role,
      language: existing.language,
    });

    return successResponse({ success: true, deleted_id: id });
  } catch (error) {
    logger.error('删除Prompt失败', { error });
    return handleApiError(error, '删除Prompt API错误');
  }
}
