/**
 * API响应工具
 * 提供统一的API响应格式
 */

import { NextResponse } from 'next/server';
import { isAppError, getErrorMessage, getErrorCode, getErrorStatusCode } from '@/lib/errors';
import { logger } from '@/lib/logger';

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: unknown;
  requestId?: string;
}

/**
 * 成功响应
 */
export function successResponse<T>(
  data: T,
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

/**
 * 错误响应
 */
export function errorResponse(
  error: unknown,
  defaultMessage: string = '操作失败'
): NextResponse<ApiErrorResponse> {
  const message = getErrorMessage(error) || defaultMessage;
  const code = getErrorCode(error);
  const statusCode = getErrorStatusCode(error);

  const response: ApiErrorResponse = {
    success: false,
    error: message,
    code,
  };

  // 开发环境提供详细错误
  if (process.env.NODE_ENV === 'development') {
    if (error instanceof Error) {
      response.details = {
        stack: error.stack?.split('\n').slice(0, 5),
      };
    }
  }

  return NextResponse.json(response, { status: statusCode });
}

/**
 * 未授权响应 (401)
 */
export function unauthorizedResponse(
  message: string = '未授权访问'
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: 'UNAUTHORIZED',
    },
    { status: 401 }
  );
}

/**
 * 禁止访问响应 (403)
 */
export function forbiddenResponse(
  message: string = '无权访问此资源'
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: 'FORBIDDEN',
    },
    { status: 403 }
  );
}

/**
 * 资源未找到响应 (404)
 */
export function notFoundResponse(
  resource: string = '资源'
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: `${resource}未找到`,
      code: 'NOT_FOUND',
    },
    { status: 404 }
  );
}

/**
 * 验证错误响应 (400)
 */
export function validationErrorResponse(
  message: string = '数据验证失败',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: 'VALIDATION_ERROR',
      details,
    },
    { status: 400 }
  );
}

/**
 * 速率限制响应 (429)
 */
export function rateLimitResponse(
  message: string = '请求过于频繁,请稍后再试',
  retryAfter?: number
): NextResponse<ApiErrorResponse> {
  const headers: HeadersInit = {};
  if (retryAfter) {
    headers['Retry-After'] = retryAfter.toString();
  }

  return NextResponse.json(
    {
      success: false,
      error: message,
      code: 'RATE_LIMIT_EXCEEDED',
    },
    { status: 429, headers }
  );
}

/**
 * 服务器错误响应 (500)
 */
export function serverErrorResponse(
  message: string = '服务器内部错误'
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: 'INTERNAL_SERVER_ERROR',
    },
    { status: 500 }
  );
}

/**
 * 统一的错误处理器
 * 用于 try-catch 块中处理各种错误
 */
export function handleApiError(error: unknown, context?: string): NextResponse {
  // 记录详细错误日志
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  logger.error(context || '未知错误', { 
    error: errorMessage, 
    stack: errorStack,
    context 
  });

  // 如果是应用自定义错误,使用其信息
  if (isAppError(error)) {
    return errorResponse(error);
  }

  // 未知错误,返回错误响应（包含错误类型以便调试）
  const response: ApiErrorResponse = {
    success: false,
    error: '服务器内部错误',
    code: 'INTERNAL_SERVER_ERROR',
  };

  if (context) {
    response.details = { context };
  }

  if (process.env.NODE_ENV === 'development') {
    response.details = {
      ...response.details as object,
      message: errorMessage,
      stack: errorStack?.split('\n').slice(0, 5),
    };
  }

  return NextResponse.json(response, { status: 500 });
}
