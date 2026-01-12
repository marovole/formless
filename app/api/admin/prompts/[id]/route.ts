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
import type { TypedSupabaseClient, PromptUpdate } from '@/lib/supabase/types';

/**
 * 更新请求体接口
 */
interface UpdatePromptRequest {
  content?: string;
  is_active?: boolean;
  description?: string | null;
  version?: number;
}

/**
 * 验证并构建更新对象
 */
function buildUpdateObject(body: UpdatePromptRequest): PromptUpdate {
  const updateObj: PromptUpdate = {};

  if ('content' in body) {
    if (typeof body.content !== 'string' || body.content.trim() === '') {
      throw new Error('content 必须是非空字符串');
    }
    updateObj.content = body.content;
  }

  if ('is_active' in body) {
    if (typeof body.is_active !== 'boolean') {
      throw new Error('is_active 必须是布尔值');
    }
    updateObj.is_active = body.is_active;
  }

  if ('description' in body) {
    if (body.description !== null && typeof body.description !== 'string') {
      throw new Error('description 必须是字符串或null');
    }
    updateObj.description = body.description;
  }

  return updateObj;
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
    const updateObj = buildUpdateObject(body);

    // 检查是否有更新内容
    if (Object.keys(updateObj).length === 0) {
      return validationErrorResponse('没有提供任何要更新的字段');
    }

    const supabase = getSupabaseAdminClient();

    // 如果内容改变，版本号递增
    if (updateObj.content) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing, error: fetchError } = await (supabase.from('prompts') as any)
        .select('version')
        .eq('id', id)
        .single();

      if (fetchError) {
        logger.error('获取Prompt版本失败', { error: fetchError, id });
      } else if (existing) {
        updateObj.version = (existing.version || 0) + 1;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedPrompt, error } = await (supabase.from('prompts') as any)
      .update(updateObj)
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
      updates: Object.keys(updateObj),
    });

    return successResponse({ prompt: updatedPrompt });
  } catch (error) {
    if (error instanceof Error && error.message.includes('必须')) {
      return validationErrorResponse(error.message);
    }
    return handleApiError(error, '更新Prompt API错误');
  }
}
