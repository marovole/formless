/**
 * 统一日志系统
 * 提供结构化的日志记录能力,支持不同环境的不同输出格式
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.logLevel];
  }

  private formatError(error: unknown) {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    }
    return {
      message: String(error),
    };
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };
  }

  private output(entry: LogEntry) {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    if (this.isDevelopment) {
      // 开发环境: 使用彩色输出
      const colors = {
        debug: '\x1b[36m', // 青色
        info: '\x1b[32m',  // 绿色
        warn: '\x1b[33m',  // 黄色
        error: '\x1b[31m', // 红色
      };
      const reset = '\x1b[0m';

      const levelColor = colors[entry.level];
      const prefix = `${levelColor}[${entry.level.toUpperCase()}]${reset}`;
      const timestamp = `\x1b[90m${entry.timestamp}${reset}`;

      console.log(`${timestamp} ${prefix} ${entry.message}`);

      if (entry.context && Object.keys(entry.context).length > 0) {
        console.log('  Context:', entry.context);
      }

      if (entry.error) {
        console.error('  Error:', entry.error);
      }
    } else {
      // 生产环境: JSON格式输出(便于日志聚合系统解析)
      console.log(JSON.stringify(entry));
    }
  }

  /**
   * Debug级别日志 (开发调试用)
   */
  debug(message: string, context?: LogContext) {
    this.output(this.createLogEntry('debug', message, context));
  }

  /**
   * Info级别日志 (一般信息)
   */
  info(message: string, context?: LogContext) {
    this.output(this.createLogEntry('info', message, context));
  }

  /**
   * Warning级别日志 (警告但不影响功能)
   */
  warn(message: string, context?: LogContext) {
    this.output(this.createLogEntry('warn', message, context));
  }

  /**
   * Error级别日志 (错误)
   */
  error(message: string, errorOrContext?: unknown) {
    const entry = this.createLogEntry('error', message);

    if (errorOrContext instanceof Error) {
      entry.error = this.formatError(errorOrContext);
    } else if (errorOrContext && typeof errorOrContext === 'object') {
      entry.context = errorOrContext as LogContext;
      // 如果 context 中有 error 字段,提取它
      const ctx = errorOrContext as LogContext;
      if (ctx.error) {
        entry.error = this.formatError(ctx.error);
        // 从 context 中移除 error,避免重复
        delete (entry.context as LogContext).error;
      }
    }

    this.output(entry);
  }

  /**
   * 创建带前缀的子logger (用于模块化日志)
   */
  child(prefix: string): ChildLogger {
    return new ChildLogger(this, prefix);
  }
}

/**
 * 子Logger,自动添加前缀
 */
class ChildLogger {
  constructor(
    private parent: Logger,
    private prefix: string
  ) {}

  debug(message: string, context?: LogContext) {
    this.parent.debug(`[${this.prefix}] ${message}`, context);
  }

  info(message: string, context?: LogContext) {
    this.parent.info(`[${this.prefix}] ${message}`, context);
  }

  warn(message: string, context?: LogContext) {
    this.parent.warn(`[${this.prefix}] ${message}`, context);
  }

  error(message: string, errorOrContext?: unknown) {
    if (typeof errorOrContext === 'string') {
      this.parent.error(`[${this.prefix}] ${message}`, new Error(errorOrContext));
    } else {
      this.parent.error(`[${this.prefix}] ${message}`, errorOrContext);
    }
  }
}

// 导出单例
export const logger = new Logger();

// 使用示例:
// import { logger } from '@/lib/logger';
//
// logger.info('用户登录', { userId: '123', email: 'user@example.com' });
// logger.error('数据库查询失败', new Error('Connection timeout'));
//
// const dbLogger = logger.child('Database');
// dbLogger.info('查询开始');
