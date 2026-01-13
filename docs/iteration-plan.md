# 无相 Formless · 迭代计划（已完成）

> **注意**：本文档记录了项目从 Supabase 迁移到 Convex + Clerk 过程中的迭代计划。
> 项目已完成迁移，当前架构为：Clerk（认证）+ Convex（后端）+ Cloudflare Pages（部署）。

## 迁移总结

### 已完成的架构变更

1. **认证系统**：Supabase Auth → Clerk
2. **数据库/后端**：Supabase PostgreSQL → Convex
3. **Edge Functions**：Supabase Edge Functions → Convex Functions
4. **部署**：Vercel → Cloudflare Pages (OpenNext)

### 已完成的核心功能

- ✅ 用户认证（Clerk）
- ✅ 对话管理（Convex）
- ✅ 消息存储（Convex）
- ✅ 记忆提取与召回（Convex）
- ✅ API Key 管理（Convex + Admin 权限）
- ✅ Prompt 管理（Convex + Admin 权限）
- ✅ 用量统计（Convex）
- ✅ 观照系统（Convex）

### 访问控制实现

所有 Convex 函数都已实现适当的访问控制：

- **Admin 级别**：`api_keys`, `prompts`, `admin` 模块使用 `requireAdmin()`
- **用户级别**：`messages`, `conversations`, `memories`, `guanzhao` 模块使用 `requireCurrentUser()`
- **身份验证**：`users` 模块使用 `requireIdentity()`

## 相关文档

- 部署指南：`DEPLOYMENT_GUIDE.md`
- 迁移说明：`MIGRATION_TO_CONVEX.md`
- 观照系统：`docs/guanzhao/README.md`
