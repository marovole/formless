import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/middleware';
import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import {
  successResponse,
  validationErrorResponse,
  handleApiError,
} from '@/lib/api/responses';
import { logger } from '@/lib/logger';

/**
 * 更新请求体接口
 */
interface UpdatePromptRequest {
  content?: string;
  is_active?: boolean;
  description?: string | null;
}

/**
 * 验证并构建更新对象
 */
function buildUpdateObject(body: UpdatePromptRequest) {
  const updates: {
    content?: string;
    is_active?: boolean;
    description?: string | null;
  } = {};

  if ('content' in body) {
    if (typeof body.content !== 'string' || body.content.trim() === '') {
      throw new Error('content 必须是非空字符串');
    }
    updates.content = body.content;
  }

  if ('is_active' in body) {
    if (typeof body.is_active !== 'boolean') {
      throw new Error('is_active 必须是布尔值');
    }
    updates.is_active = body.is_active;
  }

  if ('description' in body) {
    if (body.description !== null && typeof body.description !== 'string') {
      throw new Error('description 必须是字符串或null');
    }
    updates.description = body.description;
  }

  return updates;
}

/**
 * 更新Prompt (管理员)
 * 如果内容改变，版本号自动递增
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);

    const { id } = await params;
    const body = (await request.json()) as UpdatePromptRequest;

    // 验证并构建更新对象
    const updates = buildUpdateObject(body);

    // 检查是否有更新内容
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
    if (error instanceof Error && error.message.includes('必须')) {
      return validationErrorResponse(error.message);
    }
    logger.error('更新Prompt失败', { error });
    return handleApiError(error, '更新Prompt API错误');
  }
}
