# 无相 Formless · 部署指南

## 部署状态

### ✅ 已完成

- [x] 项目构建成功（Next.js + Cloudflare Pages）
- [x] Cloudflare Pages 部署完成
  - 部署地址：https://734b30ab.formless.pages.dev
  - 项目名称：formless

### ⚠️ 待完成

- [ ] Supabase 数据库迁移
- [ ] Supabase Edge Functions 部署
- [ ] 环境变量配置

---

## 下一步操作

### 1. 配置 Cloudflare Pages 环境变量

需要在 Cloudflare Pages 项目中配置以下环境变量：

访问：https://dash.cloudflare.com/ → Pages → formless → Settings → Environment variables

```bash
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://ixtvycjniqltthskfrdv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
JWT_SECRET=your-jwt-secret-at-least-32-characters-long

# 可选：API Keys
# OPENROUTER_API_KEY=your_openrouter_key
# CHUTES_API_KEY=your_chutes_key
```

获取密钥：https://supabase.com/dashboard/project/ixtvycjniqltthskfrdv/settings/api

### 2. 执行 Supabase 数据库迁移

由于 CLI 连接问题，请使用 Supabase Dashboard 手动执行迁移：

#### 方法 1：使用 Supabase Dashboard SQL Editor

1. 访问：https://supabase.com/dashboard/project/ixtvycjniqltthskfrdv/sql/new
2. 按顺序执行以下迁移文件：

**基础架构**（`supabase/migrations/20250102000000_base_schema.sql`）：
```bash
# 复制文件内容到 SQL Editor 执行
cat supabase/migrations/20250102000000_base_schema.sql
```

**观照系统**（`supabase/migrations/20250102000001_guanzhao_system.sql`）：
```bash
# 复制文件内容到 SQL Editor 执行
cat supabase/migrations/20250102000001_guanzhao_system.sql
```

**定时任务**（`supabase/migrations/20250102000002_setup_cron_jobs.sql`）：
```bash
# 复制文件内容到 SQL Editor 执行
cat supabase/migrations/20250102000002_setup_cron_jobs.sql
```

#### 方法 2：使用 Supabase CLI（如果网络正常）

```bash
# 重新链接项目
supabase link --project-ref ixtvycjniqltthskfrdv

# 推送迁移
supabase db push
```

### 3. 启用 pg_cron 扩展

1. 访问：https://supabase.com/dashboard/project/ixtvycjniqltthskfrdv/database/extensions
2. 搜索并启用 `pg_cron` 扩展

### 4. 部署 Supabase Edge Functions（观照系统）

```bash
# 部署会话追踪器
supabase functions deploy guanzhao-session-tracker \
  --project-ref ixtvycjniqltthskfrdv

# 部署触发引擎
supabase functions deploy guanzhao-trigger-engine \
  --project-ref ixtvycjniqltthskfrdv

# 设置 Secrets
supabase secrets set NEXT_PUBLIC_SUPABASE_URL=https://ixtvycjniqltthskfrdv.supabase.co \
  --project-ref ixtvycjniqltthskfrdv

supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key \
  --project-ref ixtvycjniqltthskfrdv
```

### 5. 验证部署

1. **前端验证**
   - 访问：https://734b30ab.formless.pages.dev
   - 测试用户注册/登录
   - 测试对话功能

2. **数据库验证**
   - 访问：https://supabase.com/dashboard/project/ixtvycjniqltthskfrdv/database/tables
   - 检查表是否创建成功（users, conversations, messages, 等）

3. **Edge Functions 验证**
   - 访问：https://supabase.com/dashboard/project/ixtvycjniqltthskfrdv/functions
   - 检查 Functions 是否部署成功

---

## 常见问题

### Supabase CLI 连接失败

**错误**：`tls error (EOF)`

**解决方案**：
1. 检查网络连接
2. 确认 Supabase 项目处于活跃状态
3. 尝试使用 Dashboard SQL Editor 手动执行迁移
4. 检查防火墙/VPN 设置

### Cloudflare Pages 环境变量不生效

**解决方案**：
1. 确保在正确的环境配置变量（Production）
2. 重新部署项目：`npx wrangler pages deploy .open-next --project-name=formless`
3. 检查变量名是否正确（不要有引号或换行）

### 观照系统不工作

**排查步骤**：
1. 检查 Edge Functions 是否部署成功
2. 检查 `guanzhao_budget_tracking` 表是否有用户记录
3. 查看函数日志：`supabase functions logs guanzhao-trigger-engine`

---

## 下一步计划

部署完成后：

1. **Landing Page 优化**：美化首页，添加产品介绍
2. **SEO 优化**：添加 meta 标签、sitemap
3. **性能优化**：优化加载速度
4. **用户反馈**：收集用户使用反馈

---

## 联系支持

如遇到问题：
1. 查看项目文档：`./docs/` 目录
2. 查看 Supabase 日志
3. 查看 Cloudflare Pages 部署日志

---

**最后更新**：2026-01-03
**部署版本**：v0.1.0
