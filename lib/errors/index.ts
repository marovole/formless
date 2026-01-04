/**
 * 自定义错误类
 * 提供类型安全的错误处理机制
 */

/**
 * 应用基础错误类
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'APP_ERROR',
    public readonly statusCode: number = 500,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 未授权错误 (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = '未授权访问', cause?: unknown) {
    super(message, 'UNAUTHORIZED', 401, cause);
  }
}

/**
 * 禁止访问错误 (403)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = '无权访问此资源', cause?: unknown) {
    super(message, 'FORBIDDEN', 403, cause);
  }
}

/**
 * 资源未找到错误 (404)
 */
export class NotFoundError extends AppError {
  constructor(message: string = '资源未找到', cause?: unknown) {
    super(message, 'NOT_FOUND', 404, cause);
  }
}

/**
 * 验证错误 (400)
 */
export class ValidationError extends AppError {
  constructor(
    message: string = '数据验证失败',
    public readonly errors?: unknown,
    cause?: unknown
  ) {
    super(message, 'VALIDATION_ERROR', 400, cause);
  }
}

/**
 * 速率限制错误 (429)
 */
export class RateLimitError extends AppError {
  constructor(
    message: string = '请求过于频繁',
    public readonly retryAfter?: number,
    cause?: unknown
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, cause);
  }
}

/**
 * 数据库错误
 */
export class DatabaseError extends AppError {
  constructor(message: string = '数据库操作失败', cause?: unknown) {
    super(message, 'DATABASE_ERROR', 500, cause);
  }
}

/**
 * 外部服务错误 (API调用失败等)
 */
export class ExternalServiceError extends AppError {
  constructor(
    message: string = '外部服务调用失败',
    public readonly service?: string,
    cause?: unknown
  ) {
    super(message, 'EXTERNAL_SERVICE_ERROR', 502, cause);
  }
}

/**
 * 预算相关错误
 */
export class BudgetError extends AppError {
  constructor(message: string = '预算操作失败', cause?: unknown) {
    super(message, 'BUDGET_ERROR', 500, cause);
  }
}

/**
 * 配置错误
 */
export class ConfigError extends AppError {
  constructor(message: string = '配置错误', cause?: unknown) {
    super(message, 'CONFIG_ERROR', 500, cause);
  }
}

/**
 * 检查错误是否为应用错误
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * 从未知错误中提取错误信息
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '未知错误';
}

/**
 * 从未知错误中提取错误代码
 */
export function getErrorCode(error: unknown): string {
  if (isAppError(error)) {
    return error.code;
  }
  return 'UNKNOWN_ERROR';
}

/**
 * 从未知错误中提取状态码
 */
export function getErrorStatusCode(error: unknown): number {
  if (isAppError(error)) {
    return error.statusCode;
  }
  return 500;
}
