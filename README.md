# 无相 Formless

> 一个充满佛性与耐心的 AI 长老，通过智慧对话帮助用户答疑解惑、疏导情绪、获得内心平静。

## 项目当前阶段

### 📋 MVP 功能已完成，正在准备部署

**核心功能完成度：100%**

**正式站点**：[formless.pro](https://formless.pro)（请确保 Cloudflare / Clerk 等控制台中的回调与 `NEXT_PUBLIC_APP_URL` 与此一致。）

项目已完成所有 MVP 核心功能的开发和测试，包括：

#### ✅ 已完成功能

**1. 对话系统**
- 实时流式对话（SSE）
- 对话历史管理（查看/删除/继续对话）
- 中英双语支持
- DeepSeek R1 模型集成

**2. 记忆系统**
- 自动提取对话中的关键信息
- 记忆召回注入到新对话
- 用户档案管理
- 删除对话时联动清理记忆

**3. 用户系统**
- Clerk 登录/注册
- 强制登录访问控制
- 用户设置页面
- Convex 权限隔离（基于 Clerk JWT）

**4. 后台管理系统**
- API Key 管理（CRUD + 轮询策略）
- 用量统计与分析
- Prompt 模板管理
- 用户管理

**5. 观照系统（亮点功能）**
- 主动关怀 Agent 系统
- 会话追踪与触发器引擎
- 多种触发场景：
  - 每日签到
  - 夜间总结
  - 过载保护
  - 危机高风险处理
- 预算与冷却管理
- 用户自定义频率和风格

**6. 技术基础设施**
- 完整的测试框架（Vitest + Playwright）
- 国际化路由（next-intl）
- Cloudflare Pages 部署配置
- Convex 数据库 Schema + Functions

---

## 快速开始

### 环境要求

- Node.js >= 20.0.0
- npm/yarn/pnpm/bun

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 到 `.env.local` 并配置：

```bash
# Convex (required)
NEXT_PUBLIC_CONVEX_URL=https://your-convex-project.convex.cloud
CONVEX_ADMIN_TOKEN=your_convex_admin_token_here

# Clerk (required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here

# Admin allowlist (required)
ADMIN_EMAILS=admin@example.com
```

### 本地开发

```bash
npx convex dev
```

在另一个终端运行：

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

### 运行测试

```bash
# 单元测试
npm run test

# E2E 测试
npm run test:e2e

# 全部测试
npm run test:all
```

---

## 部署指南

### Cloudflare Pages 部署

生产域名：**formless.pro**（在 Cloudflare Pages 项目中绑定自定义域名并完成 DNS 解析。）

```bash
# 构建项目
npm run pages:build

# 部署到 Cloudflare Pages
npm run deploy
```

### Convex 后端部署

```bash
npx convex deploy
```

详细部署文档请参考：
- [观照系统部署指南](./docs/guanzhao/DEPLOYMENT.md)
- [实施检查清单](./docs/guanzhao/IMPLEMENTATION_CHECKLIST.md)

---

## 项目结构

```
accra/
├── app/                        # Next.js App Router
│   ├── [locale]/              # 国际化路由
│   │   ├── auth/             # 认证页面
│   │   ├── chat/             # 对话页面
│   │   ├── history/          # 对话历史
│   │   └── settings/         # 用户设置
│   ├── admin/                # 后台管理
│   └── api/                  # API Routes
├── components/                # React 组件
│   ├── ui/                   # shadcn/ui 组件
│   └── guanzhao/             # 观照系统组件
├── convex/                    # Convex schema + functions
├── docs/                      # 项目文档
│   ├── prd.md                # 产品需求文档
│   ├── iteration-plan.md     # 迭代计划
│   └── guanzhao/             # 观照系统文档
├── lib/                       # 核心库
│   └── hooks/                # React Hooks
├── e2e/                       # E2E 测试
└── __tests__/                 # 单元测试
```

---

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| 框架 | Next.js 15 (App Router) |
| 部署 | Cloudflare Pages + Workers |
| 数据库 | Convex |
| 认证 | Clerk |
| 国际化 | next-intl |
| 样式 | Tailwind CSS |
| 后台 UI | shadcn/ui |
| 测试 | Vitest + Playwright |
| 对话模型 | DeepSeek R1 (Chutes) |
| 记忆提取 | GLM-4.5-Air (OpenRouter) |

---

## 核心功能说明

### 对话系统

无相长老是一位修行千年的智者，通过对话帮助用户：

- **倾听**：让每个人感到被看见、被接纳
- **启发**：不给答案，用问题引导思考
- **安宁**：让对话本身成为疗愈

对话特点：
- 慢：不急于回应，语句间有呼吸感
- 柔：永远温和，不评判
- 深：一针见血但不刺痛
- 简：惜字如金，不堆砌

### 记忆系统

- 自动提取对话中的关键信息
- 在后续对话中召回历史记忆
- 构建用户档案，提供个性化体验

### 观照系统（创新亮点）

主动关怀 Agent，在适当时机主动出现：

- **每日签到**：新的一天开始时的问候
- **夜间总结**：对话结束时的回顾
- **过载保护**：长时间对话的关怀
- **危机处理**：检测到高风险时的安全提示

用户可以自定义：
- 触发频率（静默/清简/中道/精进）
- 交互风格（慈悲/清明/直指）
- 免打扰时段

---

## 待办事项

### 观照系统部署（P0）

观照系统已迁移至 Convex（无需 Supabase/pg_cron/Edge Functions），部署清单：

- [ ] Convex：设置 `CLERK_JWT_ISSUER_DOMAIN` / `ADMIN_EMAILS` 并 `npx convex deploy`
- [ ] Clerk：创建 JWT template `convex`（`applicationID/aud = convex`，包含 `email` claim）
- [ ] Cloudflare Pages：绑定 **formless.pro**、配置 Clerk keys / `NEXT_PUBLIC_CONVEX_URL` / `NEXT_PUBLIC_APP_URL=https://formless.pro` / `CONVEX_ADMIN_TOKEN` / `ADMIN_EMAILS`
- [ ] Admin 初始化：访问 `/admin` 创建 API keys 与 prompts
- [ ] 功能测试

详见：[观照系统部署清单](./docs/guanzhao/IMPLEMENTATION_CHECKLIST.md)

### 后续计划（P1-P2）

- [ ] Landing Page 优化
- [ ] SEO 优化
- [ ] 移动端适配
- [ ] 性能优化
- [ ] 用户反馈收集

---

## 文档索引

- [产品需求文档 (PRD)](./docs/prd.md)
- [迭代计划](./docs/iteration-plan.md)
- [开发计划](./docs/dev-plan.md)
- [观照系统 README](./docs/guanzhao/README.md)

---

## 贡献指南

本项目目前处于 MVP 阶段，暂不接受外部贡献。

---

## 许可证

Copyright © 2025 Formless. All rights reserved.

---

## 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送邮件

---

*"凡所有相，皆是虚妄。无相，即不执着于外在形式，回归内心本质。"*
