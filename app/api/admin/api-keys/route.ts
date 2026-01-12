import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/middleware';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import {
  successResponse,
  validationErrorResponse,
  handleApiError,
} from '@/lib/api/responses';
import { logger } from '@/lib/logger';
import type { TypedSupabaseClient, ApiKey, ApiKeyInsert } from '@/lib/supabase/types';

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

    // 使用管理员客户端获取所有密钥
    const supabase = getSupabaseAdminClient() as TypedSupabaseClient;

    const { data: apiKeys, error } = await supabase
      .from('api_keys')
      .select('*')
      .order('priority', { ascending: true });

    if (error) {
      logger.error('获取API密钥列表失败', { error });
      throw new Error('获取API密钥列表失败');
    }

    return successResponse({ api_keys: apiKeys || [] });
  } catch (error) {
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

    // 构建插入数据
    const insertData: ApiKeyInsert = {
      provider: provider as 'chutes' | 'openrouter',
      api_key: api_key,
      model_name: model_name || null,
      daily_limit: daily_limit || 1000,
      priority: priority || 1,
      is_active: true,
    };

    const supabase = getSupabaseAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newApiKey, error } = await (supabase.from('api_keys') as any)
      .insert([insertData])
      .select()
      .single();

    if (error) {
      logger.error('创建API密钥失败', { error, provider });
      throw new Error('创建API密钥失败');
    }

    logger.info('API密钥创建成功', {
      id: newApiKey.id,
      provider: newApiKey.provider,
      priority: newApiKey.priority,
    });

    return successResponse({ api_key: newApiKey }, 201);
  } catch (error) {
    return handleApiError(error, '创建API密钥API错误');
  }
}
