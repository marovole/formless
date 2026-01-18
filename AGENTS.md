# Formless Agent 指南

本文件为 AI 编码助手提供项目特定的指导，避免常见错误。

## 关键规则

### 1. 禁止使用 `convex/browser` 包

**原因**: Cloudflare Workers 不支持 `node:https` 模块，而 `convex/browser` 包的 WebSocket 客户端依赖 `ws` 库，`ws` 需要 `node:https`。

**错误示例**:
```typescript
// ❌ 这会导致运行时错误: "No such module node:https"
import { ConvexHttpClient } from 'convex/browser';
```

**正确做法**:
```typescript
// ✅ 使用项目自定义的 EdgeConvexClient
import { getConvexClient, getConvexClientWithAuth, getConvexAdminClient } from '@/lib/convex';
```

### 2. EdgeConvexClient 使用方式

项目提供三个工厂函数：

```typescript
// 无认证客户端（公开查询）
const client = getConvexClient();

// 用户认证客户端（使用 Clerk JWT token）
const client = getConvexClientWithAuth(clerkToken);

// Admin 客户端（使用 CONVEX_ADMIN_TOKEN，可调用 internal functions）
const client = getConvexAdminClient();
```

### 3. Convex FunctionReference 处理

Convex 的 `api.module.function` 返回 Proxy 对象，不能直接转换为字符串。

**错误**:
```typescript
const path = String(api.users.ensureCurrent); // TypeError: Cannot convert object to primitive value
```

**正确**:
```typescript
// EdgeConvexClient 内部使用 Symbol.for('functionName') 提取路径
const result = await client.mutation(api.users.ensureCurrent, { args });
```

### 4. 环境变量检查清单

部署前确保 Cloudflare Pages secrets 已配置：

```bash
npx wrangler pages secret list --project-name formless
```

必需的 secrets:
- `CONVEX_ADMIN_TOKEN` - 格式: `prod:deployment-name|base64token`
- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL
- `CLERK_SECRET_KEY` - Clerk 后端密钥
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk 前端密钥

### 5. 调试 Cloudflare Workers 错误

由于 Cloudflare Workers 日志不易获取，调试时可以：

1. 创建临时调试 endpoint 返回详细错误信息
2. 使用 `handleApiError` 在响应中包含错误上下文
3. 检查 `wrangler.toml` 的 `compatibility_flags`

当前配置:
```toml
compatibility_flags = ["nodejs_compat_v2"]
```

### 6. 常见错误模式

| 错误信息 | 原因 | 解决方案 |
|---------|------|----------|
| `No such module "node:https"` | 使用了 `convex/browser` | 改用 `EdgeConvexClient` |
| `Cannot convert object to primitive value` | FunctionReference 转字符串失败 | 使用 `Symbol.for('functionName')` 提取 |
| `CONVEX_ADMIN_TOKEN is not set` | 环境变量缺失 | 通过 wrangler 设置 secret |
| `session-token-and-uat-missing` | Clerk 认证失败 | 确保 cookies 包含 `__session` 和 `__client_uat` |

## 文件参考

| 文件 | 用途 |
|------|------|
| `/lib/convex.ts` | EdgeConvexClient 实现 |
| `/wrangler.toml` | Cloudflare Workers 配置 |
| `/open-next.config.ts` | OpenNext 构建配置 |
| `/app/api/chat/route.ts` | 聊天 API 主逻辑 |

## 修改 Convex Client 时的注意事项

如果需要修改 `/lib/convex.ts`：

1. **保持 fetch-based 实现** - 不要引入任何 Node.js 特定模块
2. **测试 FunctionReference 解析** - 确保 `Symbol.for('functionName')` 正确工作
3. **在 Cloudflare 环境测试** - 本地 `pnpm dev` 不会暴露兼容性问题
4. **部署后验证** - 使用浏览器控制台测试 `/api/chat` 端点
