/**
 * Clerk 认证中间件
 * 用于 API 路由的认证
 */

import { auth } from '@clerk/nextjs/server';
import { UnauthorizedError } from '@/lib/errors';

export interface ClerkAuthContext {
  userId: string;
}

/**
 * 认证中间件
 * 验证用户身份并返回用户 ID
 *
 * @throws {UnauthorizedError} 当用户未认证时抛出
 */
export async function requireClerkAuth(): Promise<ClerkAuthContext> {
  const { userId } = await auth();

  if (!userId) {
    throw new UnauthorizedError('认证失败,请先登录');
  }

  return { userId };
}

/**
 * 可选认证中间件
 * 尝试获取用户信息,但不强制要求认证
 */
export async function optionalClerkAuth(): Promise<{ userId: string | null }> {
  const { userId } = await auth();
  return { userId: userId || null };
}
