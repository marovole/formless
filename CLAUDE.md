# Formless 项目指南

## 项目概述

无相 Formless - 一个充满佛性与耐心的 AI 长老，通过智慧对话帮助用户答疑解惑、疏导情绪、获得内心平静。

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| 框架 | Next.js 15 (App Router) |
| 部署 | Cloudflare Pages + Workers |
| 数据库 | Convex |
| 认证 | Clerk |
| 国际化 | next-intl |
| 样式 | Tailwind CSS |

## 关键约束

### Cloudflare Workers 兼容性

**问题**: Cloudflare Workers 不完全支持 Node.js API，特别是 `node:https` 模块。

**影响**: `convex/browser` 包依赖 `ws` 库（WebSocket），而 `ws` 需要 `node:https`，导致在 Cloudflare Workers 环境中运行时报错：
```
Error: No such module "node:https"
```

**解决方案**: 本项目使用自定义的 `EdgeConvexClient`（位于 `/lib/convex.ts`），通过原生 `fetch` API 直接调用 Convex HTTP API，完全绕过 WebSocket 依赖。

### Convex Client 使用规范

```typescript
// ✅ 正确：使用项目自定义的 EdgeConvexClient
import { getConvexClient, getConvexClientWithAuth, getConvexAdminClient } from '@/lib/convex';

const client = getConvexAdminClient();
const result = await client.query(api.users.get, { id: userId });

// ❌ 错误：直接从 convex/browser 导入
import { ConvexHttpClient } from 'convex/browser'; // 会导致 ws 依赖问题
```

### FunctionReference 路径提取

Convex 的 `api.module.function` 返回的是 Proxy 对象，函数路径存储在 `Symbol.for('functionName')` 中：

```typescript
const FUNCTION_NAME_SYMBOL = Symbol.for('functionName');

function getFunctionPath(fnRef: any): string {
  if (typeof fnRef === 'string') return fnRef;
  
  if (fnRef && typeof fnRef === 'object') {
    const symbolName = fnRef[FUNCTION_NAME_SYMBOL];
    if (typeof symbolName === 'string') {
      return symbolName;
    }
  }
  
  throw new Error(`Cannot extract function path from: ${typeof fnRef}`);
}
```

## 环境变量

### 必需的环境变量

| 变量名 | 用途 | 格式示例 |
|--------|------|----------|
| `NEXT_PUBLIC_CONVEX_URL` | Convex 部署 URL | `https://xxx.convex.cloud` |
| `CONVEX_ADMIN_TOKEN` | Convex Admin 认证 | `prod:deployment-name\|base64token` |
| `CLERK_SECRET_KEY` | Clerk 后端密钥 | `sk_test_xxx` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk 前端密钥 | `pk_test_xxx` |

### Cloudflare Pages Secrets

使用 wrangler 设置：
```bash
echo 'your-token' | npx wrangler pages secret put CONVEX_ADMIN_TOKEN --project-name formless
```

## 部署

```bash
# 构建并部署
pnpm run deploy

# 仅构建
pnpm pages:build

# 仅部署（需要先构建）
npx wrangler pages deploy .open-next --project-name formless
```

## 常见问题

### Q: API 返回 500 错误 "Internal Server Error"

检查顺序：
1. 确认 `CONVEX_ADMIN_TOKEN` 已正确设置
2. 确认使用的是 `EdgeConvexClient` 而非 `ConvexHttpClient`
3. 检查 Convex 函数路径是否正确（使用 `Symbol.for('functionName')` 提取）

### Q: 聊天无响应但无错误

检查：
1. OpenRouter API key 是否有效（通过 Convex Dashboard 或 `/admin` 页面查看）
2. System prompt 是否存在（需要 seed 数据）

### Q: Clerk 认证失败

确保：
1. `CLERK_SECRET_KEY` 和 `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` 都已设置
2. Clerk Dashboard 中已创建 `convex` JWT template
