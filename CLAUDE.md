# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

无相 Formless - 一个充满佛性与耐心的 AI 长老，通过智慧对话帮助用户答疑解惑、疏导情绪、获得内心平静。

## 常用命令

```bash
# 本地开发（需要两个终端）
npx convex dev              # 终端1：启动 Convex 开发服务器
npm run dev                 # 终端2：启动 Next.js 开发服务器

# 测试
npm run test                # 单元测试（监听模式）
npm run test:run            # 单元测试（单次运行）
npm run test:coverage       # 单元测试 + 覆盖率
npm run test:e2e            # E2E 测试
npm run test:e2e:ui         # E2E 测试（UI 模式）
npm run test:all            # 全部测试

# 代码检查
npm run lint                # ESLint
npm run type-check          # TypeScript 类型检查

# 构建与部署
npm run pages:build         # 构建 Cloudflare Pages
npm run preview             # 本地预览 Cloudflare 环境
npm run deploy              # 构建 + 部署到 Cloudflare Pages
npx convex deploy           # 部署 Convex 后端
```

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| 框架 | Next.js 15 (App Router) |
| 部署 | Cloudflare Pages + Workers |
| 数据库 | Convex |
| 认证 | Clerk |
| 国际化 | next-intl（8 种语言） |
| 样式 | Tailwind CSS + shadcn/ui |
| 测试 | Vitest + Playwright |

## 架构概述

### 目录结构

```
app/
├── [locale]/           # 国际化路由（zh/en/ja/ko/fr/de/es/pt）
│   ├── chat/          # 对话页面
│   ├── history/       # 对话历史
│   └── settings/      # 用户设置（含观照系统）
├── admin/             # 后台管理（API keys/prompts/用量）
└── api/               # API Routes
    └── chat/          # 聊天 API（SSE 流式响应）

convex/                # Convex 后端
├── schema.ts          # 数据库 Schema（17 张表）
├── users.ts           # 用户管理
├── conversations.ts   # 对话管理
├── messages.ts        # 消息管理
├── memories.ts        # 记忆系统
└── guanzhao.ts        # 观照系统（主动关怀 Agent）

lib/
├── convex.ts          # ⭐ EdgeConvexClient（Cloudflare 兼容）
├── llm/               # LLM 客户端（DeepSeek/OpenRouter）
├── agent/             # Agent 系统（记忆提取/工具调用）
└── hooks/             # React Hooks（useSSEChat 等）
```

### 核心数据流

```
用户输入 → /api/chat → Clerk 认证 → 加载历史 + 召回记忆
    → Agent 工具循环（最多 4 轮）→ SSE 流式响应 → 保存消息
```

## 关键约束

### Cloudflare Workers 兼容性（最重要）

**问题**: Cloudflare Workers 不支持 `node:https` 模块，`convex/browser` 包依赖 `ws` 库会导致运行时错误。

**解决方案**: 使用项目自定义的 `EdgeConvexClient`（`/lib/convex.ts`）。

```typescript
// ✅ 正确：使用项目自定义的 EdgeConvexClient
import { getConvexClient, getConvexClientWithAuth, getConvexAdminClient } from '@/lib/convex';

const client = getConvexAdminClient();
const result = await client.query(api.users.get, { id: userId });

// ❌ 错误：直接从 convex/browser 导入（会导致 "No such module node:https" 错误）
import { ConvexHttpClient } from 'convex/browser';
```

### FunctionReference 路径提取

Convex 的 `api.module.function` 返回 Proxy 对象，函数路径存储在 `Symbol.for('functionName')` 中：

```typescript
const FUNCTION_NAME_SYMBOL = Symbol.for('functionName');

function getFunctionPath(fnRef: any): string {
  if (typeof fnRef === 'string') return fnRef;
  if (fnRef && typeof fnRef === 'object') {
    const symbolName = fnRef[FUNCTION_NAME_SYMBOL];
    if (typeof symbolName === 'string') return symbolName;
  }
  throw new Error(`Cannot extract function path from: ${typeof fnRef}`);
}
```

## 环境变量

| 变量名 | 用途 |
|--------|------|
| `NEXT_PUBLIC_CONVEX_URL` | Convex 部署 URL |
| `CONVEX_ADMIN_TOKEN` | Convex Admin 认证（格式: `prod:deployment-name\|base64token`） |
| `CLERK_SECRET_KEY` | Clerk 后端密钥 |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk 前端密钥 |
| `ADMIN_EMAILS` | 管理员邮箱白名单 |

Cloudflare Pages secrets 设置：
```bash
echo 'your-token' | npx wrangler pages secret put CONVEX_ADMIN_TOKEN --project-name formless
```

## 常见问题

| 错误信息 | 原因 | 解决方案 |
|---------|------|----------|
| `No such module "node:https"` | 使用了 `convex/browser` | 改用 `EdgeConvexClient` |
| `Cannot convert object to primitive value` | FunctionReference 转字符串失败 | 使用 `Symbol.for('functionName')` |
| `CONVEX_ADMIN_TOKEN is not set` | 环境变量缺失 | 通过 wrangler 设置 secret |
| `session-token-and-uat-missing` | Clerk 认证失败 | 检查 Clerk JWT template 配置 |
