import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/middleware';
import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import {
  successResponse,
  validationErrorResponse,
  handleApiError,
} from '@/lib/api/responses';
import { logger } from '@/lib/logger';

/**
 * 请求体接口
 */
interface CreateApiKeyRequest {
  provider: string;
  api_key: string;
  model_name?: string | null;
  daily_limit?: number;
  priority?: number;
}

/**
 * 获取所有API密钥 (管理员)
 */
export async function GET(request: NextRequest) {
  try {
    // 认证检查
    await requireAuth(request);

    const convex = getConvexClient();
    const apiKeys = await convex.query(api.api_keys.list, {});

    // 返回时掩码 API 密钥
    const maskedApiKeys = apiKeys.map((key: Doc<"api_keys">) => ({
      id: key._id,
      provider: key.provider,
      api_key: key.api_key ? `${key.api_key.slice(0, 8)}...` : null,
      model_name: key.model_name,
      daily_limit: key.daily_limit,
      daily_used: key.daily_used,
      priority: key.priority,
      is_active: key.is_active,
      last_used_at: key.last_used_at,
      created_at: key._creationTime,
    }));

    return successResponse({ api_keys: maskedApiKeys });
  } catch (error) {
    logger.error('获取API密钥列表失败', { error });
    return handleApiError(error, '获取API密钥列表API错误');
  }
}

/**
 * 创建新的API密钥 (管理员)
 */
export async function POST(request: NextRequest) {
  try {
    // 认证检查
    await requireAuth(request);

    // 解析请求体
    const body = (await request.json()) as CreateApiKeyRequest;
    const { provider, api_key, model_name, daily_limit, priority } = body;

    // 验证必填字段
    if (!provider || !api_key) {
      return validationErrorResponse('Provider 和 API key 是必填项');
    }

    // 验证 provider 类型
    const validProviders: Array<'chutes' | 'openrouter'> = ['chutes', 'openrouter'];
    if (!validProviders.includes(provider as 'chutes' | 'openrouter')) {
      return validationErrorResponse(`无效的 provider: ${provider}`, {
        validProviders,
      });
    }

    // 验证数字字段
    if (daily_limit !== undefined && (daily_limit < 0 || !Number.isInteger(daily_limit))) {
      return validationErrorResponse('daily_limit 必须是非负整数');
    }

    if (priority !== undefined && (priority < 0 || !Number.isInteger(priority))) {
      return validationErrorResponse('priority 必须是非负整数');
    }

    const convex = getConvexClient();
    const newId = await convex.mutation(api.api_keys.create, {
      provider,
      api_key,
      model_name: model_name ?? undefined,
      daily_limit: daily_limit ?? undefined,
      priority: priority ?? undefined,
    });

    logger.info('API密钥创建成功', {
      id: newId,
      provider,
      priority: priority || 1,
    });

    return successResponse({ id: newId }, 201);
  } catch (error) {
    logger.error('创建API密钥失败', { error });
    return handleApiError(error, '创建API密钥API错误');
  }
}
