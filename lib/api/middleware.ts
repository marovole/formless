/**
 * API中间件
 * 提供通用的认证、验证等中间件功能
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { UnauthorizedError } from '@/lib/errors';
import type { TypedSupabaseClient } from '@/lib/supabase/types';
import type { User } from '@supabase/supabase-js';

export interface AuthenticatedContext {
  user: User;
  supabase: TypedSupabaseClient;
}

/**
 * 认证中间件
 * 验证用户身份并返回用户信息和Supabase客户端
 *
 * @throws {UnauthorizedError} 当用户未认证时抛出
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthenticatedContext> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthorizedError('认证失败,请先登录');
  }

  return {
    user,
    supabase: supabase as TypedSupabaseClient,
  };
}

/**
 * 可选认证中间件
 * 尝试获取用户信息,但不强制要求认证
 */
export async function optionalAuth(
  request: NextRequest
): Promise<{ user: User | null; supabase: TypedSupabaseClient }> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    user: user || null,
    supabase: supabase as TypedSupabaseClient,
  };
}

/**
 * 从请求中提取JSON body并进行验证
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  validator: (data: unknown) => T
): Promise<T> {
  const body = await request.json();
  return validator(body);
}
