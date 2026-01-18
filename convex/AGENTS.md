# Convex Agent 指南

本文件适用于 `convex/` 目录及其子目录。

## 核心约束

1. **函数类型**：使用 `query` / `mutation` / `internalQuery` / `internalMutation`（来自 `./_generated/server`）。
2. **参数校验**：所有对外函数必须使用 `convex/values` 的 `v` 定义参数校验。
3. **认证**：涉及用户或管理员权限的逻辑，必须使用 `convex/_lib/auth.ts` 的 `requireIdentity()` / `requireCurrentUser()` / `requireAdmin()`。
4. **内部函数**：`internal.*` 仅限服务端调用（依赖 `CONVEX_ADMIN_TOKEN`），不要暴露给客户端调用路径。
5. **Admin allowlist**：`ADMIN_EMAILS` 必须与 Next.js 侧保持一致，否则管理端会失效。

## 参考

- `convex/auth.config.ts`：Clerk JWT 模板配置（`aud=convex`，包含 `email` claim）。
- `convex/schema.ts`：Schema 与表结构的唯一来源。
