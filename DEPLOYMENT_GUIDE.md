# Formless Deployment Guide

This repository deploys as:

- **Frontend**: Next.js → Cloudflare Pages (via OpenNext)
- **Backend/DB**: Convex
- **Auth**: Clerk

**Production domain**: `https://formless.pro` — bind this hostname in Cloudflare Pages, set `NEXT_PUBLIC_APP_URL=https://formless.pro` for correct sitemap/OG/metadata, and add the same origin in Clerk **Allowed origins** / redirect URLs as needed.

## 1) Clerk Setup

1. Create a Clerk application.
2. Configure sign-in / sign-up URLs (optional but recommended):
   - Sign-in: `/sign-in`
   - Sign-up: `/sign-up`
   - After sign-in: `/chat`
3. Create a JWT template named `convex`:
   - `applicationID` / `aud`: `convex`
   - Include an `email` claim

## 2) Convex Setup

### Dev

```bash
npx convex dev
```

Set Convex env vars:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-clerk-issuer-domain.clerk.accounts.dev
npx convex env set ADMIN_EMAILS admin@example.com
```

### Production

```bash
npx convex deploy
```

Set prod env vars:

```bash
npx convex env set --prod CLERK_JWT_ISSUER_DOMAIN https://your-clerk-issuer-domain.clerk.accounts.dev
npx convex env set --prod ADMIN_EMAILS admin@example.com
```

Get:

- `NEXT_PUBLIC_CONVEX_URL` (used by the Next.js app)
- `CONVEX_ADMIN_TOKEN` (server-only, used by `/api/chat` to call `internal.*`)

## 3) Cloudflare Pages Setup

Build + deploy:

```bash
npm run deploy
```

Configure Cloudflare Pages environment variables:

```bash
NEXT_PUBLIC_CONVEX_URL=https://your-convex-project.convex.cloud
CONVEX_ADMIN_TOKEN=your_convex_admin_token_here

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here

ADMIN_EMAILS=admin@example.com
```

Notes:

- Do not expose `CONVEX_ADMIN_TOKEN` to the client.
- `ADMIN_EMAILS` must match Convex's `ADMIN_EMAILS`.

## 4) Post-Deploy Bootstrap

1. Sign in with an allowlisted email.
2. Visit `/admin` and create:
   - API keys (`chutes`, `openrouter`)
   - Prompts (at least one active prompt for role `formless_elder` + locale)

## 5) Smoke Checks

```bash
npm run type-check
npm run test:run
```

## 6) Rollback Runbook

目标：任何人照此步骤可在数分钟内回到稳定版本。

---

### 6a) Cloudflare Pages 回滚（约 2 分钟）

Cloudflare Pages 保存所有历史 deployment，可一键回滚。

**方式一：Dashboard（推荐）**

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Pages** → `formless`
2. 点击 **Deployments** 标签，找到最后一个 **Production** 稳定部署
3. 点击该部署行右侧 **…** 菜单 → **Rollback to this deployment**
4. 确认弹窗 → 等待约 1 分钟完成激活

**方式二：Wrangler CLI**

```bash
# 1. 列出所有生产 deployment（找到目标 ID）
wrangler pages deployment list --project-name formless

# 2. 执行回滚（将 <deployment-id> 替换为上面列出的目标 ID）
wrangler pages deployment rollback --project-name formless <deployment-id>
```

> **注**：Cloudflare Pages 回滚只影响前端静态资产和 Worker 脚本，不影响 Convex 数据或环境变量。如果本次变更同时改了 Convex，必须同步执行 **6b**。

---

### 6b) Convex 回滚（约 3–5 分钟）

Convex 没有内建的"一键回滚"，回滚方式取决于本次变更是否修改了 schema。

#### 情况 A：纯代码变更，无 schema 修改（最常见）

Schema 未动，只是函数/逻辑改了：

```bash
# 1. 找到稳定的 git commit SHA
git log --oneline -20

# 2. 切换到稳定版本（不修改工作目录，仅读取）
git checkout <stable-sha> -- convex/

# 3. 重新部署 Convex 后端
npx convex deploy

# 4. 恢复工作目录（可选，如需继续开发）
git checkout HEAD -- convex/
```

#### 情况 B：Schema 有加法性变更（新增表或新增字段）

Convex schema 变更是 append-only（只能加、不能删有数据的字段）。  
回滚代码是安全的——新增的空表/字段留在 DB 中，旧代码不使用它们，不影响运行。

```bash
git checkout <stable-sha> -- convex/
npx convex deploy   # 旧函数上线；新 schema 字段闲置无害
git checkout HEAD -- convex/
```

#### 情况 C：Schema 删除了有数据的必填字段或表（P0 事故）

Convex 不允许直接 re-deploy 与现有数据冲突的 schema（会报错拒绝）。  
**禁止**直接执行 `convex deploy`，按以下步骤处理：

1. **不要回滚 schema，改为向前修复**：
   - 在当前 `schema.ts` 中把已删除的字段**以 `v.optional(...)` 的形式加回来**
   - `npx convex deploy` → 部署成功
   - 旧版函数现在可以正常读写这些 optional 字段

2. 如果必须彻底删除该字段/表，需先通过迁移脚本将数据清空，再执行 `npx convex deploy` 移除字段定义（这属于计划性操作，不是紧急回滚）。

3. **升级给翡冷翠或 CTO（Opus4.7）**——任何 schema 破坏性变更的回滚决策需人工确认。

---

### 6c) 回滚后冒烟验证

回滚完成后，按顺序验证以下检查点（预计 3 分钟）：

| # | 检查点 | 预期结果 |
|---|--------|----------|
| 1 | 访问 `https://formless.pro` | 页面正常加载，无 500/白屏 |
| 2 | 登录流程（Clerk） | Sign-in 跳转正常，`/chat` 可访问 |
| 3 | 发送第一条消息 | AI 回复出现（SSE 流式响应正常） |
| 4 | 访问 `/admin`（管理员邮箱） | 后台管理页面加载，API Keys 列表可见 |

任一步骤失败，立即升级给翡冷翠。

---

### 6d) 决策树速查

```
发生线上故障
    │
    ├─ 只是前端（页面/样式/路由）？
    │      └→ 执行 6a（Cloudflare Pages 回滚）
    │
    ├─ Convex 函数/API 报错，schema 未改？
    │      └→ 执行 6b 情况 A
    │
    ├─ 本次上线新增了 schema 字段/表？
    │      └→ 执行 6b 情况 B（加法性变更，安全）
    │
    ├─ 本次上线删除了 schema 字段/表？
    │      └→ 执行 6b 情况 C + 立即升级人工介入
    │
    └─ 前端 + 后端都有问题？
           └→ 先 6b，再 6a，最后执行 6c 验证
```

