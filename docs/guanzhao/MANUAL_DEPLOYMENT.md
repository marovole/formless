# 观照系统手动部署指南

由于 Supabase CLI 直连存在网络问题，我们通过 Dashboard 手动执行迁移。

## 🗄️ 步骤 1: 部署数据库迁移

### 访问 SQL Editor

```
https://app.supabase.com/project/ixtvycjniqltthskfrdv/sql/new
```

### 执行迁移（按顺序）

#### 1️⃣ **迁移 1: 基础架构**

文件: `supabase/migrations/20250102000000_base_schema.sql`

**操作**:
1. 打开本地文件 `supabase/migrations/20250102000000_base_schema.sql`
2. 复制**全部内容**
3. 粘贴到 SQL Editor
4. 点击 **Run** 或按 `Cmd+Enter`
5. 等待执行完成（应显示成功消息）

#### 2️⃣ **迁移 2: 观照系统**

文件: `supabase/migrations/20250102000001_guanzhao_system.sql`

**操作**:
1. 打开本地文件 `supabase/migrations/20250102000001_guanzhao_system.sql`
2. 复制**全部内容**
3. 粘贴到 SQL Editor（新建查询）
4. 点击 **Run**
5. 等待执行完成

#### 3️⃣ **迁移 3: 定时任务**

⚠️ **注意**: 需要先启用 pg_cron 扩展

**步骤 A: 启用 pg_cron**
1. 访问: https://app.supabase.com/project/ixtvycjniqltthskfrdv/database/extensions
2. 搜索 `pg_cron`
3. 点击启用（Enable）

**步骤 B: 执行迁移**
文件: `supabase/migrations/20250102000002_setup_cron_jobs.sql`

1. 打开本地文件
2. 复制**全部内容**
3. 粘贴到 SQL Editor
4. 点击 **Run**

**步骤 C: 配置环境变量**

在 SQL Editor 中执行：

```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://ixtvycjniqltthskfrdv.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4dHZ5Y2puaXFsdHRoc2tmcmR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzEwNTk3NiwiZXhwIjoyMDgyNjgxOTc2fQ.TwAh_qfiG_U03eTcrQXmiFoc62ABj2XlioMs3JqK014';
```

### ✅ 验证部署

在 SQL Editor 中执行：

```sql
-- 检查表是否创建
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'guanzhao%' OR table_name = 'user_sessions';

-- 检查定时任务
SELECT jobid, schedule, command
FROM cron.job
WHERE jobname LIKE 'guanzhao-%';
```

应该看到 7 个表和 5 个定时任务。

---

## 🚀 步骤 2: 部署 Edge Functions

### 设置 Secrets

```bash
supabase secrets set SUPABASE_URL=https://ixtvycjniqltthskfrdv.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4dHZ5Y2puaXFsdHRoc2tmcmR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzEwNTk3NiwiZXhwIjoyMDgyNjgxOTc2fQ.TwAh_qfiG_U03eTcrQXmiFoc62ABj2XlioMs3JqK014
```

### 部署函数

```bash
# 部署会话追踪器
supabase functions deploy guanzhao/session-tracker

# 部署触发引擎
supabase functions deploy guanzhao/trigger-engine
```

### 验证部署

访问: https://app.supabase.com/project/ixtvycjniqltthskfrdv/functions

应该看到 2 个函数：
- ✅ guanzhao/session-tracker
- ✅ guanzhao/trigger-engine

---

## 🧪 步骤 3: 启动开发服务器测试

```bash
# 安装依赖（如果还没有）
npm install

# 启动开发服务器
npm run dev
```

### 测试页面

#### 1. 设置页面
```
http://localhost:3000/settings/guanzhao
```

测试：
- [ ] 启用/禁用观照
- [ ] 调整频率级别
- [ ] 更改语气风格
- [ ] 配置 DND 时段

#### 2. 聊天页面
```
http://localhost:3000/chat
```

测试：
- [ ] 开始聊天会话
- [ ] 观察是否创建会话记录
- [ ] 检查触发器是否显示

---

## 📊 步骤 4: 验证数据库记录

访问: https://app.supabase.com/project/ixtvycjniqltthskfrdv/editor

检查表：
- [ ] `guanzhao_settings` - 用户设置
- [ ] `user_sessions` - 会话记录
- [ ] `guanzhao_trigger_history` - 触发历史
- [ ] `guanzhao_budget_tracking` - 预算追踪

---

## 🔧 故障排除

### 问题 1: SQL 执行错误

**症状**: 执行 SQL 时报错

**解决方案**:
1. 确保按顺序执行迁移（1 → 2 → 3）
2. 如果表已存在，可以先删除再重新执行
3. 检查错误消息中的具体提示

### 问题 2: Edge Functions 部署失败

**症状**: `supabase functions deploy` 失败

**解决方案**:
```bash
# 检查是否已链接项目
supabase link --project-ref ixtvycjniqltthskfrdv --password exOTmNnz1zh6IfVo

# 重新设置 Secrets
supabase secrets set SUPABASE_URL=https://ixtvycjniqltthskfrdv.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_KEY

# 重新部署
supabase functions deploy guanzhao/session-tracker
```

### 问题 3: 前端连接失败

**症状**: 前端无法连接到 Supabase

**解决方案**:
1. 检查 `.env.local` 文件是否正确
2. 重启开发服务器 (`npm run dev`)
3. 清除浏览器缓存

---

## ✅ 完成检查清单

- [ ] 数据库迁移 1 执行成功
- [ ] 数据库迁移 2 执行成功
- [ ] pg_cron 扩展已启用
- [ ] 数据库迁移 3 执行成功
- [ ] Secrets 已设置
- [ ] Edge Functions 已部署
- [ ] 开发服务器启动成功
- [ ] 设置页面可访问
- [ ] 聊天页面可访问
- [ ] 数据库有记录写入

---

**准备好了吗？让我们开始！** 🚀
