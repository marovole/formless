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
interface UpdateApiKeyRequest {
  daily_limit?: number;
  priority?: number;
  is_active?: boolean;
  model_name?: string | null;
}

/**
 * 验证并构建更新对象
 */
function buildUpdateObject(body: UpdateApiKeyRequest) {
  const updates: {
    daily_limit?: number;
    priority?: number;
    is_active?: boolean;
    model_name?: string | null;
  } = {};

  if ('daily_limit' in body) {
    if (typeof body.daily_limit !== 'number' || body.daily_limit < 0 || !Number.isInteger(body.daily_limit)) {
      throw new Error('daily_limit 必须是非负整数');
    }
    updates.daily_limit = body.daily_limit;
  }

  if ('priority' in body) {
    if (typeof body.priority !== 'number' || body.priority < 0 || !Number.isInteger(body.priority)) {
      throw new Error('priority 必须是非负整数');
    }
    updates.priority = body.priority;
  }

  if ('is_active' in body) {
    if (typeof body.is_active !== 'boolean') {
      throw new Error('is_active 必须是布尔值');
    }
    updates.is_active = body.is_active;
  }

  if ('model_name' in body) {
    if (body.model_name !== null && typeof body.model_name !== 'string') {
      throw new Error('model_name 必须是字符串或null');
    }
    updates.model_name = body.model_name;
  }

  return updates;
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
    const updates = buildUpdateObject(body);

    // 检查是否有更新内容
    if (Object.keys(updates).length === 0) {
      return validationErrorResponse('没有提供任何要更新的字段');
    }

    const convex = getConvexClient();

    // 检查密钥是否存在
    const existingKey = await convex.query(api.api_keys.getById, { id: id as Id<"api_keys"> });
    if (!existingKey) {
      return NextResponse.json({ error: 'API密钥不存在' }, { status: 404 });
    }

    await convex.mutation(api.api_keys.update, {
      id: id as Id<"api_keys">,
      ...updates,
    });

    logger.info('API密钥更新成功', {
      id,
      provider: existingKey.provider,
      updates: Object.keys(updates),
    });

    return successResponse({ id, ...updates });
  } catch (error) {
    if (error instanceof Error && error.message.includes('必须')) {
      return validationErrorResponse(error.message);
    }
    logger.error('更新API密钥失败', { error });
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

    const convex = getConvexClient();

    // 检查密钥是否存在
    const existingKey = await convex.query(api.api_keys.getById, { id: id as Id<"api_keys"> });
    if (!existingKey) {
      return NextResponse.json({ error: 'API密钥不存在' }, { status: 404 });
    }

    await convex.mutation(api.api_keys.deleteKey, {
      id: id as Id<"api_keys">,
    });

    logger.info('API密钥删除成功', {
      id,
      provider: existingKey.provider,
      model_name: existingKey.model_name,
    });

    return successResponse({ success: true, deleted_id: id });
  } catch (error) {
    logger.error('删除API密钥失败', { error });
    return handleApiError(error, '删除API密钥API错误');
  }
}
