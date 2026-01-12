/**
 * API中间件
 * 提供通用的认证、验证等中间件功能
 *
 * NOTE: This file is being deprecated in favor of Clerk authentication.
 * See lib/api/clerk-middleware.ts for the new auth pattern.
 */

import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { UnauthorizedError } from '@/lib/errors';
import type { User } from '@supabase/supabase-js';

export interface AuthenticatedContext {
  user: User;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}

/**
 * 认证中间件
 * 验证用户身份并返回用户信息和Supabase客户端
 *
 * @throws {UnauthorizedError} 当用户未认证时抛出
 */
export async function requireAuth(
  _request: NextRequest
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
    supabase,
  };
}

/**
 * 可选认证中间件
 * 尝试获取用户信息,但不强制要求认证
 */
export async function optionalAuth(
  _request: NextRequest
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ user: User | null; supabase: any }> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    user: user || null,
    supabase,
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
