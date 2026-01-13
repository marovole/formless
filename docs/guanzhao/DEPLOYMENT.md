# 观照系统 - 部署指南

本文档说明如何部署和配置观照主动 Agent 系统（基于 Convex + Clerk）。

## 架构概览

- **认证**: Clerk
- **后端/数据库**: Convex
- **前端**: Next.js → Cloudflare Pages (OpenNext)

## 前置要求

- Node.js >= 20.0.0
- Convex 账户和项目
- Clerk 账户和应用
- Cloudflare Pages 项目（用于生产部署）

## 第一步：安装依赖

```bash
npm install
```

## 第二步：配置环境变量

创建 `.env.local` 文件：

```bash
# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOY_KEY=your-convex-deploy-key

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# Admin
ADMIN_EMAILS=admin@example.com
```

## 第三步：部署 Convex 后端

```bash
# 登录 Convex
npx convex login

# 部署到生产环境
npx convex deploy --prod
```

观照系统的 Convex 函数位于 `convex/guanzhao.ts`，包括：
- `handleSessionEvent` - 处理会话事件
- `processAction` - 处理用户动作
- `evaluateTrigger` - 评估触发条件
- `getGuanzhaoSettings` / `updateGuanzhaoSettings` - 设置管理
- `registerPushToken` / `deactivatePushToken` - 推送令牌管理

## 第四步：配置 Clerk

1. 在 Clerk Dashboard 中配置 JWT 模板以与 Convex 集成
2. 确保 `convex/auth.config.ts` 中的配置正确

## 第五步：本地测试

```bash
npm run dev
```

### 测试流程

1. 访问 `http://localhost:3000/chat`
2. 使用 Clerk 登录
3. 查看开发控制台，应显示会话追踪激活
4. 访问 `http://localhost:3000/settings/guanzhao` 配置观照设置

## 第六步：生产部署

### 部署到 Cloudflare Pages

```bash
# 一键部署
./scripts/deploy-all.sh

# 或分步部署
./scripts/deploy-db.sh      # 部署 Convex
./scripts/deploy-pages.sh   # 部署前端
```

### 配置 Cloudflare Pages 环境变量

在 Cloudflare Pages Dashboard 中配置：
- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_ADMIN_TOKEN`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `ADMIN_EMAILS`

## 观照功能说明

### 触发器类型

- `daily_checkin` - 每日签到
- `nightly_wrapup` - 晚间总结
- `overload_protection` - 过载保护
- `crisis_high_risk` - 危机干预

### 频率级别

- `silent` - 静默（不触发）
- `minimal` - 清简
- `moderate` - 中道
- `active` - 精进

### 风格选择

- `compassion` - 慈悲
- `clarity` - 清明
- `direct` - 直指

## 常见问题

### Q: 触发器没有显示？

检查：
1. 用户是否启用了观照功能
2. 用户是否在静默状态
3. 是否在免打扰时段
4. 预算是否足够
5. 触发器是否在冷却期

### Q: Convex 函数调用失败？

检查：
1. Convex 部署是否成功
2. 环境变量是否正确配置
3. Clerk JWT 是否正确传递

## 相关文档

- 配置包：`docs/guanzhao/guanzhao-bundle.yaml`
- 主部署指南：`DEPLOYMENT_GUIDE.md`
