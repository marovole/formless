import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/middleware';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import {
  successResponse,
  validationErrorResponse,
  notFoundResponse,
  handleApiError,
} from '@/lib/api/responses';
import { logger } from '@/lib/logger';
import type { TypedSupabaseClient, PromptInsert, PromptUpdate } from '@/lib/supabase/types';

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
 * 支持按role和language筛选
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const supabase = getSupabaseAdminClient() as TypedSupabaseClient;
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') as PromptRole | null;
    const language = searchParams.get('language') as Language | null;

    let query = supabase
      .from('prompts')
      .select('*')
      .order('role', { ascending: true })
      .order('language', { ascending: true });

    if (role) {
      const validRoles: PromptRole[] = ['formless_elder', 'memory_extractor', 'system'];
      if (!validRoles.includes(role)) {
        return validationErrorResponse(`无效的role: ${role}`, { validRoles });
      }
      query = query.eq('role', role);
    }

    if (language) {
      const validLanguages: Language[] = ['zh', 'en'];
      if (!validLanguages.includes(language)) {
        return validationErrorResponse(`无效的language: ${language}`, { validLanguages });
      }
      query = query.eq('language', language);
    }

    const { data: prompts, error } = await query;

    if (error) {
      logger.error('获取Prompt列表失败', { error, role, language });
      throw new Error('获取Prompt列表失败');
    }

    return successResponse({ prompts: prompts || [] });
  } catch (error) {
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

    const insertData: PromptInsert = {
      name: body.name,
      role: body.role,
      language,
      content: body.content,
      description: body.description || null,
      is_active: body.is_active ?? true,
      version: 1,
    };

    const supabase = getSupabaseAdminClient() as TypedSupabaseClient;

    const { data: newPrompt, error } = await supabase
      .from('prompts')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      logger.error('创建Prompt失败', { error, name: body.name, role: body.role });
      throw new Error('创建Prompt失败');
    }

    logger.info('Prompt创建成功', {
      id: newPrompt.id,
      name: newPrompt.name,
      role: newPrompt.role,
      language: newPrompt.language,
    });

    return successResponse({ prompt: newPrompt }, 201);
  } catch (error) {
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

    const supabase = getSupabaseAdminClient() as TypedSupabaseClient;

    // 如果内容改变，版本号递增
    let version: number | undefined;
    if (updates.content) {
      const { data: existing, error: fetchError } = await supabase
        .from('prompts')
        .select('version')
        .eq('id', id)
        .single();

      if (fetchError) {
        logger.error('获取Prompt版本失败', { error: fetchError, id });
      } else if (existing) {
        version = (existing.version || 0) + 1;
      }
    }

    const updateData: PromptUpdate = {
      ...updates,
      version,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedPrompt, error } = await supabase
      .from('prompts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('更新Prompt失败', { error, id });
      throw new Error('更新Prompt失败');
    }

    if (!updatedPrompt) {
      return notFoundResponse('Prompt');
    }

    logger.info('Prompt更新成功', {
      id: updatedPrompt.id,
      name: updatedPrompt.name,
      version: updatedPrompt.version,
      updates: Object.keys(updates),
    });

    return successResponse({ prompt: updatedPrompt });
  } catch (error) {
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

    const supabase = getSupabaseAdminClient() as TypedSupabaseClient;

    // 先获取要删除的Prompt信息（用于日志）
    const { data: promptToDelete } = await supabase
      .from('prompts')
      .select('name, role, language')
      .eq('id', id)
      .single();

    const { error } = await supabase.from('prompts').delete().eq('id', id);

    if (error) {
      logger.error('删除Prompt失败', { error, id });
      throw new Error('删除Prompt失败');
    }

    if (!promptToDelete) {
      return notFoundResponse('Prompt');
    }

    logger.info('Prompt删除成功', {
      id,
      name: promptToDelete.name,
      role: promptToDelete.role,
      language: promptToDelete.language,
    });

    return successResponse({ success: true, deleted_id: id });
  } catch (error) {
    return handleApiError(error, '删除Prompt API错误');
  }
}
