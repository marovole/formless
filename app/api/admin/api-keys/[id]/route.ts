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
import type { TypedSupabaseClient, ApiKeyUpdate } from '@/lib/supabase/types';

/**
 * 更新请求体接口
 */
interface UpdateApiKeyRequest {
  daily_limit?: number;
  priority?: number;
  is_active?: boolean;
  model_name?: string | null;
}

/**
 * 验证并构建更新对象
 */
function buildUpdateObject(body: UpdateApiKeyRequest): ApiKeyUpdate {
  const updateObj: ApiKeyUpdate = {};

  if ('daily_limit' in body) {
    if (typeof body.daily_limit !== 'number' || body.daily_limit < 0 || !Number.isInteger(body.daily_limit)) {
      throw new Error('daily_limit 必须是非负整数');
    }
    updateObj.daily_limit = body.daily_limit;
  }

  if ('priority' in body) {
    if (typeof body.priority !== 'number' || body.priority < 0 || !Number.isInteger(body.priority)) {
      throw new Error('priority 必须是非负整数');
    }
    updateObj.priority = body.priority;
  }

  if ('is_active' in body) {
    if (typeof body.is_active !== 'boolean') {
      throw new Error('is_active 必须是布尔值');
    }
    updateObj.is_active = body.is_active;
  }

  if ('model_name' in body) {
    if (body.model_name !== null && typeof body.model_name !== 'string') {
      throw new Error('model_name 必须是字符串或null');
    }
    updateObj.model_name = body.model_name;
  }

  return updateObj;
}

/**
 * 更新API密钥 (管理员)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证检查
    await requireAuth(request);

    const { id } = await params;
    const body = (await request.json()) as UpdateApiKeyRequest;

    // 验证并构建更新对象
    const updateObj = buildUpdateObject(body);

    // 检查是否有更新内容
    if (Object.keys(updateObj).length === 0) {
      return validationErrorResponse('没有提供任何要更新的字段');
    }

    const supabase = getSupabaseAdminClient();

    // Note: Type assertion needed due to Supabase type generation issue - this file will be removed in Convex migration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedApiKey, error } = await (supabase.from('api_keys') as any)
      .update(updateObj)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('更新API密钥失败', { error, id });
      throw new Error('更新API密钥失败');
    }

    if (!updatedApiKey) {
      return notFoundResponse('API密钥');
    }

    logger.info('API密钥更新成功', {
      id: updatedApiKey.id,
      provider: updatedApiKey.provider,
      updates: Object.keys(updateObj),
    });

    return successResponse({ api_key: updatedApiKey });
  } catch (error) {
    if (error instanceof Error && error.message.includes('必须')) {
      return validationErrorResponse(error.message);
    }
    return handleApiError(error, '更新API密钥API错误');
  }
}

/**
 * 删除API密钥 (管理员)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 认证检查
    await requireAuth(request);

    const { id } = await params;

    const supabase = getSupabaseAdminClient();

    // 先获取要删除的密钥信息（用于日志）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: apiKeyToDelete } = await (supabase.from('api_keys') as any)
      .select('provider, model_name')
      .eq('id', id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('api_keys') as any).delete().eq('id', id);

    if (error) {
      logger.error('删除API密钥失败', { error, id });
      throw new Error('删除API密钥失败');
    }

    if (!apiKeyToDelete) {
      return notFoundResponse('API密钥');
    }

    logger.info('API密钥删除成功', {
      id,
      provider: apiKeyToDelete.provider,
      model_name: apiKeyToDelete.model_name,
    });

    return successResponse({ success: true, deleted_id: id });
  } catch (error) {
    return handleApiError(error, '删除API密钥API错误');
  }
}
