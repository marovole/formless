# 观照系统部署总结

**部署日期**: 2026-01-02
**项目**: Formless / Topeka
**分支**: marovole/cambridge-v3
**Supabase 项目**: ixtvycjniqltthskfrdv

---

## ✅ 部署完成状态

### 1. 数据库迁移（3/3）

| # | 迁移文件 | 状态 | 说明 |
|---|---------|------|------|
| 1 | `20250102000000_base_schema_fixed.sql` | ✅ 成功 | 基础架构（users, conversations, messages, prompts 等） |
| 2 | `20250102000001_guanzhao_system_fixed.sql` | ✅ 成功 | 观照系统 6 个表 + 函数 + 视图 + RLS |
| 3 | `20250102000002_setup_cron_jobs_fixed.sql` | ✅ 成功 | 5 个定时任务 + 环境变量配置 |

**修复的问题**:
- ✅ 解决 `ON CONFLICT` 唯一约束错误（使用 `WHERE NOT EXISTS`）
- ✅ 解决 `ORDER BY` 在 UPDATE 中的语法错误（使用 `DECLARE` 变量）
- ✅ 移除不存在的 `last_reset_at` 字段引用

### 2. Edge Functions（2/2）

| 函数名 | 版本 | 状态 | 部署时间 (UTC) |
|--------|------|------|----------------|
| guanzhao-session-tracker | v1 | ✅ ACTIVE | 2026-01-02 15:38:14 |
| guanzhao-trigger-engine | v1 | ✅ ACTIVE | 2026-01-02 15:38:26 |

**Dashboard**: https://supabase.com/dashboard/project/ixtvycjniqltthskfrdv/functions

**修复的问题**:
- ✅ 重组目录结构（移除嵌套的 `guanzhao/` 文件夹）
- ✅ 函数名改为 `guanzhao-session-tracker` 和 `guanzhao-trigger-engine`

### 3. 定时任务（5/5）

| 任务名 | 执行频率 | 说明 |
|--------|---------|------|
| guanzhao-check-rhythm-triggers | 每 5 分钟 | 检查节律型触发器（daily_checkin 等） |
| guanzhao-reset-daily-budget | 每天 00:00 UTC | 重置每日预算 |
| guanzhao-reset-weekly-budget | 每周一 00:00 UTC | 重置周预算 |
| guanzhao-cleanup-cooldowns | 每小时 | 清理过期冷却记录（>7 天） |
| guanzhao-cleanup-old-sessions | 每天 02:00 UTC | 清理旧会话记录（>30 天） |

### 4. 数据库表（8+6 个）

**基础表（8 个）**:
- users
- conversations
- messages
- key_quotes
- api_keys
- api_usage
- admin_users
- prompts

**观照系统表（6 个）**:
- user_sessions - 用户会话追踪
- guanzhao_trigger_history - 触发历史记录
- guanzhao_budget_tracking - 预算和设置
- guanzhao_cooldowns - 冷却管理
- push_tokens - 推送令牌
- safety_screening_logs - 风险检测日志

### 5. Git 提交记录

```
8ad199a chore: add base_schema_fixed migration and update gitignore
b67d33e refactor: flatten Edge Functions directory structure
e26bc37 fix: resolve SQL errors in cron jobs migration
29fff58 fix: resolve SQL syntax error in guanzhao_system migration
c0960fc docs: add manual deployment guide
43663fa chore: configure Supabase project settings
f176bc8 feat: add deployment automation scripts
5513c3e chore: add deployment configuration and checklist
fe9c645 feat: implement guanzhao (proactive care) system - phase 1
```

**远程分支**: https://github.com/marovole/formless/tree/marovole/cambridge-v3

---

## 🔐 环境配置

### Supabase 环境变量

已在 `.env.local` 配置：
- ✅ NEXT_PUBLIC_SUPABASE_URL
- ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
- ✅ SUPABASE_SERVICE_ROLE_KEY
- ✅ SUPABASE_DB_PASSWORD

### 数据库环境变量

已通过 SQL 设置：
```sql
app.settings.supabase_url = 'https://ixtvycjniqltthskfrdv.supabase.co'
app.settings.service_role_key = 'eyJ...' (service_role JWT)
```

### pg_cron 扩展

✅ 已在 Supabase Dashboard 启用

---

## 📋 下一步测试清单

### 1. 前端功能测试

访问线上地址：
- [ ] 设置页面：`/settings/guanzhao`
  - [ ] 启用/禁用观照系统
  - [ ] 调整频率级别（silent/qingjian/zhongdao/jingjin）
  - [ ] 更改语气风格（qingming/cibei/zhizhi）
  - [ ] 配置 DND 时段
  - [ ] 测试 Snooze 功能

- [ ] 聊天页面：`/chat`
  - [ ] 开始新对话
  - [ ] 检查会话追踪（user_sessions 表）
  - [ ] 观察触发器显示
  - [ ] 测试触发器交互（点击、关闭、反馈）

### 2. 数据库验证

在 Supabase Dashboard SQL Editor 执行：

```sql
-- 检查表是否存在
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND (table_name LIKE 'guanzhao%' OR table_name = 'user_sessions');

-- 检查定时任务
SELECT jobid, schedule, command
FROM cron.job
WHERE jobname LIKE 'guanzhao-%';

-- 检查会话记录（测试后）
SELECT * FROM user_sessions ORDER BY created_at DESC LIMIT 5;

-- 检查触发历史（测试后）
SELECT * FROM guanzhao_trigger_history ORDER BY created_at DESC LIMIT 5;
```

### 3. Edge Functions 测试

手动触发测试：

```bash
# 测试会话追踪器
curl -X POST https://ixtvycjniqltthskfrdv.supabase.co/functions/v1/guanzhao-session-tracker \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"session_start","userId":"<USER_ID>"}'

# 测试触发引擎（需要 service_role_key）
curl -X POST https://ixtvycjniqltthskfrdv.supabase.co/functions/v1/guanzhao-trigger-engine \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"task":"check_rhythm_triggers"}'
```

### 4. 定时任务监控

查看任务执行历史：

```sql
SELECT
  jobid,
  runid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job WHERE jobname LIKE 'guanzhao-%'
)
ORDER BY start_time DESC
LIMIT 20;
```

---

## 🐛 已知问题和限制

### 1. 环境变量限制

- Edge Functions 中 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 由 Supabase 自动注入
- 不能使用 `supabase secrets set` 设置 `SUPABASE_` 前缀的变量

### 2. 定时任务时区

- 所有 cron 任务使用 UTC 时区
- 用户本地时区需要在应用层处理（`user_sessions.timezone` 字段）

### 3. 首次执行可能的问题

- 定时任务首次执行前可能需要等待调度周期
- 可以手动调用 Edge Functions 进行测试

---

## 📚 参考文档

- [MANUAL_DEPLOYMENT.md](./MANUAL_DEPLOYMENT.md) - 手动部署指南
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 自动化部署文档
- [README.md](./README.md) - 观照系统概述
- [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md) - 实现清单

---

## 🎉 总结

**Phase 1 部署状态**: ✅ 100% 完成

- ✅ 数据库架构已部署
- ✅ Edge Functions 已上线
- ✅ 定时任务已配置
- ✅ 代码已推送到远程分支

**待办**:
1. 在生产环境测试所有功能
2. 监控定时任务执行
3. 收集用户反馈
4. 准备 Phase 2 需求（如需要）

---

**部署完成时间**: 2026-01-02 23:40 CST
