# 🔐 Formless Security Incident Report

## 事件概述

**发现时间：** 2026-01-03  
**严重程度：** 高  
**影响范围：** 第三方 LLM API key 泄露（OpenRouter / Chutes）

该事件发生于早期使用 SQL 初始化脚本的阶段；当前运行时架构已迁移为 **Clerk + Convex**，不再使用 Supabase。

## 已完成的修复

1. 移除仓库中的明文密钥与相关初始化脚本（避免再次泄露）。
2. 将 API key 管理迁移到后台 `/admin`（写入 Convex `api_keys` 表），并由 `ADMIN_EMAILS` + Convex `requireAdmin` 保护。

## 仍需人工完成的操作（必须）

1. **作废所有已泄露的 API keys**（OpenRouter / Chutes）。
2. **重新生成新的 keys**。
3. 使用 allowlisted 管理员账号登录 `/admin`，在后台重新录入新 keys。

## 建议的长期措施

### 1) 禁止在仓库中存放任何 secret

- 只通过运行环境注入（Cloudflare Pages / Convex env vars / Clerk dashboard）。
- 严禁将 key 写入 `.sql`、`.ts`、`.md` 等任何可被提交的文件。

### 2) 提交前快速扫描

```bash
git diff --cached | rg -n "(api[_-]?key|secret|password|token)\\s*[=:]"
```

### 3) 使用 pre-commit hook（可选）

```bash
cat > .git/hooks/pre-commit <<'SH'
#!/bin/sh
set -e
git diff --cached | rg -n "(sk-or-v1-|cpk_[a-f0-9]{16,})" && {
  echo "Potential secret detected. Commit aborted."
  exit 1
}
SH
chmod +x .git/hooks/pre-commit
```

## 备注：当前需要保护的关键 secret

- `CLERK_SECRET_KEY`（Cloudflare Pages env）
- `CONVEX_ADMIN_TOKEN`（Cloudflare Pages env，server-only）
- Convex env vars（`npx convex env set --prod ...`）

