# API Route Agent 指南

本文件适用于 `app/api/` 目录及其子目录。

## Edge 运行时约束

1. **禁止 Node 依赖**：避免使用 `node:*` 模块与 `ws` 等 Node-only 包。
2. **Convex Client**：不要使用 `convex/browser`；统一通过 `@/lib/convex` 的 `getConvexClient*` 工厂获取客户端。
3. **Server-only Secrets**：`CONVEX_ADMIN_TOKEN` 仅限服务端使用，严禁传到客户端。
4. **Admin allowlist**：`ADMIN_EMAILS` 必须与 Convex 侧一致，避免管理接口失效。

## 调试建议

- 使用 `handleApiError` 返回上下文，便于 Cloudflare Workers 排错。
