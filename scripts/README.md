# 观照系统部署脚本

本目录包含观照系统的自动化部署和测试脚本。

## 📋 脚本列表

### 1. `check-env.sh` - 环境检查脚本

**用途**: 检查部署前的环境准备情况

**使用方法**:
```bash
./scripts/check-env.sh
# 或
npm run guanzhao:check
```

**检查项目**:
- ✅ 命令行工具 (Node.js, npm, Supabase CLI, Git)
- ✅ 项目依赖 (package.json, node_modules)
- ✅ 环境变量 (.env.local)
- ✅ Supabase 配置 (config.toml, 项目链接)
- ✅ 数据库迁移文件
- ✅ Edge Functions
- ✅ 核心库文件
- ✅ 前端组件
- ✅ API Routes
- ✅ 文档

**输出示例**:
```
════════════════════════════════════════════════════════════
  观照系统环境检查
════════════════════════════════════════════════════════════

▶ 1. 检查命令行工具
  ✓ Node.js 已安装 (v20.9.0)
  ✓ npm 已安装 (10.1.0)
  ✓ Supabase CLI 已安装 (1.123.4)
  ✓ Git 已安装 (2.39.0)

...

✓ 所有检查通过！可以开始部署。
```

---

### 2. `deploy-db.sh` - 数据库部署脚本

**用途**: 部署观照系统数据库迁移

**使用方法**:
```bash
# 部署到远程数据库（默认）
./scripts/deploy-db.sh
# 或
npm run guanzhao:deploy:db

# 部署到本地数据库
./scripts/deploy-db.sh --local
```

**执行步骤**:
1. 检查 Supabase CLI
2. 检查项目链接状态
3. 检查迁移文件
4. 执行数据库迁移 (`supabase db push`)
5. 提醒配置 pg_cron

**注意事项**:
- 远程部署需要先执行 `supabase link`
- 本地部署会重置数据库（所有数据将丢失）
- pg_cron 配置需要手动在 Dashboard 执行

---

### 3. `deploy-functions.sh` - Edge Functions 部署脚本

**用途**: 部署观照系统 Edge Functions

**使用方法**:
```bash
# 部署所有函数
./scripts/deploy-functions.sh
# 或
npm run guanzhao:deploy:functions

# 部署指定函数
./scripts/deploy-functions.sh guanzhao/session-tracker
```

**部署的函数**:
- `guanzhao/session-tracker` - 会话追踪器
- `guanzhao/trigger-engine` - 触发引擎

**前置要求**:
```bash
# 设置 Secrets（首次部署前）
supabase secrets set SUPABASE_URL=your_url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key
```

**测试命令**:
```bash
# 测试 session-tracker
curl -i --location --request POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/guanzhao/session-tracker' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"eventType":"session_start","userId":"test"}'
```

---

### 4. `deploy-all.sh` - 完整部署脚本

**用途**: 一键部署观照系统所有组件

**使用方法**:
```bash
# 完整部署
./scripts/deploy-all.sh
# 或
npm run guanzhao:deploy:all

# 跳过数据库部署
./scripts/deploy-all.sh --skip-db

# 跳过 Edge Functions 部署
./scripts/deploy-all.sh --skip-functions
```

**执行步骤**:
1. 环境检查
2. 数据库迁移
3. Edge Functions 部署
4. 前端依赖安装
5. 构建检查
6. （可选）启动开发服务器

**典型使用场景**:
- ✅ 首次部署项目
- ✅ 重新部署整个系统
- ✅ CI/CD 流水线集成

---

### 5. `test-guanzhao.sh` - 功能测试脚本

**用途**: 测试观照系统的各个功能点

**使用方法**:
```bash
./scripts/test-guanzhao.sh
# 或
npm run guanzhao:test
```

**测试项目**:
1. ✅ Edge Functions 可访问性
2. ✅ API Routes 可访问性（需要开发服务器运行）
3. ✅ 数据库表结构
4. ✅ 前端组件检查
5. ✅ 配置文件检查
6. ✅ TypeScript 类型检查

**前置要求**:
- `.env.local` 配置完整
- Edge Functions 已部署
- （可选）开发服务器运行中

**输出示例**:
```
════════════════════════════════════════════════════════════
  观照系统功能测试
════════════════════════════════════════════════════════════

▶ 1. 测试 Edge Functions 可访问性
  ℹ 测试 session-tracker...
  ✓ session-tracker 可访问 (HTTP 200)
  ℹ 测试 trigger-engine...
  ✓ trigger-engine 可访问 (HTTP 200)

...

✓ 自动化测试全部通过！
```

---

## 🚀 快速开始

### 首次部署

```bash
# 1. 环境检查
npm run guanzhao:check

# 2. 链接 Supabase 项目
supabase link --project-ref YOUR_PROJECT_REF

# 3. 完整部署
npm run guanzhao:deploy:all

# 4. 配置 pg_cron（在 Supabase Dashboard）
# - 启用 pg_cron 扩展
# - 执行 supabase/migrations/20250102000002_setup_cron_jobs.sql

# 5. 功能测试
npm run guanzhao:test

# 6. 启动开发服务器
npm run dev
```

### 更新部署

```bash
# 仅更新数据库
npm run guanzhao:deploy:db

# 仅更新 Edge Functions
npm run guanzhao:deploy:functions

# 测试更新
npm run guanzhao:test
```

---

## 📝 常用命令速查表

| 任务 | 命令 | 说明 |
|------|------|------|
| **环境检查** | `npm run guanzhao:check` | 检查环境准备情况 |
| **数据库部署** | `npm run guanzhao:deploy:db` | 部署数据库迁移 |
| **函数部署** | `npm run guanzhao:deploy:functions` | 部署 Edge Functions |
| **完整部署** | `npm run guanzhao:deploy:all` | 一键部署所有组件 |
| **功能测试** | `npm run guanzhao:test` | 测试系统功能 |
| **开发服务器** | `npm run dev` | 启动开发服务器 |
| **项目链接** | `supabase link` | 链接 Supabase 项目 |
| **查看状态** | `supabase status` | 查看项目状态 |
| **查看日志** | `supabase functions logs` | 查看函数日志 |

---

## 🔧 故障排除

### 问题 1: 环境检查失败

**症状**: `check-env.sh` 显示失败项

**解决方案**:
1. 按照脚本提示修复失败项
2. 查看 `docs/guanzhao/DEPLOYMENT.md`
3. 确保所有前置要求已满足

### 问题 2: 数据库迁移失败

**症状**: `supabase db push` 报错

**解决方案**:
```bash
# 1. 检查项目链接
supabase status

# 2. 重新链接项目
supabase link --project-ref YOUR_REF

# 3. 查看迁移状态
supabase db diff

# 4. 重试迁移
./scripts/deploy-db.sh
```

### 问题 3: Edge Functions 部署失败

**症状**: `supabase functions deploy` 报错

**解决方案**:
```bash
# 1. 检查 Secrets 是否已设置
supabase secrets list

# 2. 设置缺失的 Secrets
supabase secrets set SUPABASE_URL=your_url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key

# 3. 重新部署
./scripts/deploy-functions.sh

# 4. 查看函数日志
supabase functions logs guanzhao/session-tracker
```

### 问题 4: 测试失败

**症状**: `test-guanzhao.sh` 显示失败

**解决方案**:
1. 确保 `.env.local` 配置正确
2. 确保 Edge Functions 已部署
3. 启动开发服务器后重新测试
4. 查看具体失败项的错误信息

---

## 📚 相关文档

- [部署指南](../docs/guanzhao/DEPLOYMENT.md) - 详细的部署步骤
- [实施检查列表](../docs/guanzhao/IMPLEMENTATION_CHECKLIST.md) - 完整的实施清单
- [系统概览](../docs/guanzhao/README.md) - 系统架构和组件说明

---

## 🤝 贡献

如果您发现脚本有问题或有改进建议，请：
1. 提交 Issue
2. 创建 Pull Request
3. 更新相关文档

---

**最后更新**: 2026-01-02
**版本**: v1.0.0
