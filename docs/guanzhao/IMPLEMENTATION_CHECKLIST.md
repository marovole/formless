# 观照系统实施检查列表

本文档列出了观照系统已实现的组件（基于 Convex + Clerk）。

## ✅ 已完成的实现

### 1. Convex 后端（100% 完成）

- [x] **Schema 定义** (`convex/schema.ts`)
  - guanzhao_settings 表
  - guanzhao_triggers 表
  - guanzhao_push_tokens 表

- [x] **Convex 函数** (`convex/guanzhao.ts`)
  - `handleSessionEvent` - 会话事件处理
  - `processAction` - 用户动作处理
  - `evaluateTrigger` - 触发条件评估
  - `fireTrigger` - 触发执行
  - `recordTriggerAndConsumeBudget` - 记录触发并消耗预算
  - `getRecentTriggerHistory` - 获取触发历史
  - `getGuanzhaoSettings` / `updateGuanzhaoSettings` - 设置管理
  - `registerPushToken` / `deactivatePushToken` / `getPushTokens` - 推送令牌管理

- [x] **认证辅助** (`convex/_lib/auth.ts`)
  - `requireIdentity()` - 验证用户已登录
  - `requireCurrentUser()` - 验证用户存在并返回用户文档
  - `requireAdmin()` - 验证用户是管理员

### 2. 前端组件（100% 完成）

- [x] **会话追踪 Hook** (`lib/hooks/useSessionTracking.ts`)
  - `useSessionTracking`: 会话生命周期管理
  - `useGuanzhaoTriggers`: 触发器状态管理
  - `usePushNotifications`: 推送通知管理
  - 心跳和可见性追踪

- [x] **触发器卡片** (`components/guanzhao/GuanzhaoTriggerCard.tsx`)
  - `GuanzhaoTriggerCard`: 单个触发器展示
  - `GuanzhaoTriggerContainer`: 触发器容器
  - 风格化渲染（慈悲/清明/直指）
  - 动作按钮处理

- [x] **设置页面** (`app/[locale]/settings/guanzhao/page.tsx`)
  - 观照开关
  - 频率级别选择
  - 风格选择
  - 推送通知配置
  - DND 时段设置

- [x] **聊天页面集成** (`app/[locale]/chat/page.tsx`)
  - 会话追踪集成
  - 触发器展示
  - 事件监听和处理

- [x] **UI 组件**
  - `components/ui/switch.tsx`: Switch 组件
  - `components/ui/radio-group.tsx`: RadioGroup 组件

### 3. 配置与文档（100% 完成）

- [x] **配置包** (`docs/guanzhao/guanzhao-bundle.yaml`)
  - 模板库
  - 触发配置
  - 频率级别定义
  - 动作映射

- [x] **部署文档** (`docs/guanzhao/DEPLOYMENT.md`)
  - Convex + Clerk 部署步骤
  - 环境配置说明

## 部署清单

### 环境准备

- [ ] 配置 Convex 项目
- [ ] 配置 Clerk 应用
- [ ] 设置环境变量（`.env.local`）

### 部署步骤

```bash
# 1. 部署 Convex 后端
npx convex deploy --prod

# 2. 部署 Cloudflare Pages 前端
npm run deploy
```

### 验证

- [ ] 访问 `/settings/guanzhao` 测试设置页面
- [ ] 访问 `/chat` 测试会话追踪
- [ ] 验证触发器正常工作

## 相关文档

- 部署指南：[DEPLOYMENT.md](./DEPLOYMENT.md)
- 配置说明：[README.md](./README.md)
- 主部署指南：`DEPLOYMENT_GUIDE.md`
