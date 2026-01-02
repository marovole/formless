# 观照系统 - 部署指南

本文档说明如何部署和配置观照主动 Agent 系统。

## 前置要求

- Supabase 项目已创建
- Node.js >= 20.0.0
- 已配置的 Supabase CLI 或 Dashboard 访问权限

## 第一步：安装依赖

```bash
npm install
```

新增的依赖包括：
- `@radix-ui/react-switch` - Switch 组件
- `@radix-ui/react-radio-group` - RadioGroup 组件
- `date-fns` - 日期处理
- `expo-server-sdk` - 推送通知（可选）
- `zustand` - 状态管理（可选）

## 第二步：运行数据库迁移

### 方式 A：通过 Supabase Dashboard

1. 访问 Supabase Dashboard → SQL Editor
2. 复制 `supabase/migrations/20250102000001_guanzhao_system.sql` 文件内容
3. 粘贴到 SQL Editor 中并执行

### 方式 B：通过 Supabase CLI

```bash
# 登录 Supabase
supabase login

# 链接到你的项目
supabase link --project-ref <your-project-ref>

# 运行迁移
supabase db push
```

## 第三步：配置 pg_cron 扩展

1. 在 Supabase Dashboard 中，进入 Database → Extensions
2. 搜索并启用 `pg_cron` 扩展

然后执行以下 SQL 配置定时任务：

```sql
-- 每天凌晨 1 点重置预算
SELECT cron.schedule(
  'reset-guanzhao-budgets',
  '0 1 * * *',
  'SELECT reset_guanzhao_budgets()'
);

-- 每小时检查一次 weekly_review 时间窗（可选）
SELECT cron.schedule(
  'check-weekly-review-window',
  '0 * * * *',
  'SELECT check_weekly_review_triggers()'
);
```

## 第四步：部署 Edge Functions

### 配置环境变量

确保以下环境变量已设置：
- `SUPABASE_URL` - Supabase 项目 URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase 服务角色密钥

### 部署函数

```bash
# 部署会话追踪函数
supabase functions deploy guanzhao/session-tracker

# 部署触发引擎函数
supabase functions deploy guanzhao/trigger-engine
```

### 验证部署

访问 `https://<your-project-ref>.supabase.co/functions/v1/guanzhao/session-tracker` 确认函数已部署。

## 第五步：本地测试

### 启动开发服务器

```bash
npm run dev
```

### 测试流程

1. 访问 `http://localhost:3000/chat`
2. 登录账号
3. 查看开发控制台，应显示 "🟢 Session tracking active"
4. 等待 5-15 分钟，或手动触发 daily_checkin

### 手动触发测试

在浏览器控制台中执行：

```javascript
// 模拟触发事件
window.dispatchEvent(new CustomEvent('guanzhao:trigger', {
  detail: { triggerId: 'daily_checkin', reason: 'Manual test' }
}));
```

## 第六步：配置设置页面访问

在主导航中添加观照设置入口，或直接访问：

```
http://localhost:3000/settings/guanzhao
```

## 第七步：推送通知配置（可选）

### Expo 推送通知

1. 注册 Expo 账号：https://expo.dev
2. 创建项目并获取 Project Access Token
3. 在应用中调用注册 API：

```typescript
import * as Notifications from 'expo-notifications';

// 获取推送令牌
const token = await Notifications.getExpoPushTokenAsync({
  projectId: 'your-expo-project-id',
});

// 注册到后端
await fetch('/api/guanzhao/push-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: token.data,
    platform: 'ios' | 'android' | 'web',
  }),
});
```

## 第八步：监控和调试

### 查看数据库记录

```sql
-- 查看用户预算设置
SELECT * FROM guanzhao_budget_tracking;

-- 查看触发历史
SELECT * FROM guanzhao_trigger_history ORDER BY created_at DESC;

-- 查看会话记录
SELECT * FROM user_sessions ORDER BY started_at DESC;

-- 查看冷却记录
SELECT * FROM guanzhao_cooldowns WHERE cooldown_until > NOW();
```

### 查看日志

在 Supabase Dashboard → Edge Functions → Logs 中查看函数调用日志。

## 常见问题

### Q: 触发器没有显示？

A: 检查以下项目：
1. 用户是否启用了观照功能（`enabled = true`）
2. 用户是否在静默状态（`snoozed_until`）
3. 是否在免打扰时段
4. 预算是否足够
5. 触发器是否在冷却期

### Q: Edge Functions 调用失败？

A: 检查：
1. Edge Functions 是否已部署
2. 环境变量是否正确配置
3. 服务角色密钥是否有足够权限

### Q: 预算没有重置？

A: 检查：
1. pg_cron 扩展是否已启用
2. 定时任务是否已配置
3. 查看 `cron.job_run_details` 表确认任务执行状态

## 下一步

1. 根据实际使用情况调整频率级别和模板
2. 添加更多触发器和模板
3. 实现自定义流程（Flow）
4. 配置推送通知
5. 集成第三方安全 API 用于风险检测

## 联系与支持

如有问题，请查看：
- 项目计划：`/Users/marovole/.claude/plans/idempotent-sauteeing-blum.md`
- 设计文档：`docs/guanzhao/README.md`
- 配置文件：`docs/guanzhao/guanzhao-bundle.yaml`
