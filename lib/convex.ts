import type { FunctionReference } from 'convex/server';

type FunctionArgs = Record<string, unknown>;

const FUNCTION_NAME_SYMBOL = Symbol.for('functionName');

/**
 * 函数引用类型 - 支持 Convex FunctionReference 或字符串
 * 使用 Record 类型允许动态属性访问
 */
type FunctionRef = FunctionReference<any, any> | string;

/**
 * 从 FunctionReference 或字符串中提取函数路径
 * Convex 的 FunctionReference 是一个 Proxy 对象，需要通过 Symbol 提取路径
 */
function getFunctionPath(fnRef: FunctionRef): string {
  if (typeof fnRef === 'string') return fnRef;

  if (fnRef && typeof fnRef === 'object') {
    // 使用类型断言访问 Convex FunctionReference 的内部属性
    const ref = fnRef as Record<string | symbol, unknown>;

    const symbolName = ref[FUNCTION_NAME_SYMBOL];
    if (typeof symbolName === 'string') {
      return symbolName;
    }
    if (typeof ref._name === 'string') {
      return ref._name;
    }
    if (typeof ref._path === 'string') {
      return ref._path;
    }
  }

  throw new Error(`Cannot extract function path from: ${typeof fnRef}`);
}

function getConvexUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL is not set');
  }
  return url;
}

export class EdgeConvexClient {
  private baseUrl: string;
  private authToken: string | null = null;
  private adminToken: string | null = null;

  constructor(url?: string) {
    this.baseUrl = url || getConvexUrl();
  }

  setAuth(token: string): void {
    this.authToken = token;
  }

  setAdminAuth(token: string): void {
    this.adminToken = token;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (this.adminToken) {
      headers['Authorization'] = `Convex ${this.adminToken}`;
    } else if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  async query<T = unknown>(
    fnRef: FunctionReference<any, any>,
    args: FunctionArgs = {}
  ): Promise<T> {
    const path = getFunctionPath(fnRef);
    const response = await fetch(`${this.baseUrl}/api/query`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        path,
        args,
        format: 'json',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Convex query failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    if (result.status === 'error') {
      throw new Error(result.errorMessage || 'Convex query error');
    }
    return result.value as T;
  }

  async mutation<T = unknown>(
    fnRef: FunctionReference<any, any>,
    args: FunctionArgs = {}
  ): Promise<T> {
    const path = getFunctionPath(fnRef);
    const response = await fetch(`${this.baseUrl}/api/mutation`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        path,
        args,
        format: 'json',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Convex mutation failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    if (result.status === 'error') {
      throw new Error(result.errorMessage || 'Convex mutation error');
    }
    return result.value as T;
  }

  async action<T = unknown>(
    fnRef: FunctionReference<any, any>,
    args: FunctionArgs = {}
  ): Promise<T> {
    const path = getFunctionPath(fnRef);
    const response = await fetch(`${this.baseUrl}/api/action`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        path,
        args,
        format: 'json',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Convex action failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    if (result.status === 'error') {
      throw new Error(result.errorMessage || 'Convex action error');
    }
    return result.value as T;
  }
}

export function getConvexClient(): EdgeConvexClient {
  return new EdgeConvexClient();
}

export function getConvexClientWithAuth(token: string): EdgeConvexClient {
  const client = new EdgeConvexClient();
  client.setAuth(token);
  return client;
}

export function getConvexAdminClient(adminToken?: string): EdgeConvexClient {
  const token = adminToken ?? process.env.CONVEX_ADMIN_TOKEN;
  if (!token) {
    const availableEnvVars = Object.keys(process.env)
      .filter((k) => k.includes('CONVEX'))
      .join(', ');
    throw new Error(
      `CONVEX_ADMIN_TOKEN is not set. Available CONVEX vars: ${availableEnvVars || 'none'}`
    );
  }

  const client = new EdgeConvexClient();
  client.setAdminAuth(token);
  return client;
}
