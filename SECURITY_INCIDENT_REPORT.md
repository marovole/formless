# 🔐 Formless 安全修复报告

## ⚠️ 安全事件概述

**发现时间：** 2026-01-03
**严重程度：** 🔴 高危
**影响范围：** API 密钥泄露

### 暴露的密钥

1. **OpenRouter API Key**
   - 结尾：`...8d47`
   - 状态：✅ 已被 OpenRouter 自动禁用
   - 位置：`scripts/init-api-keys.sql:53`

2. **Chutes API Key**
   - 位置：`scripts/init-api-keys.sql:63`
   - 状态：⚠️ **需要立即作废并重新生成**

---

## ✅ 已完成的修复措施

### 1. 从 Git 历史中彻底移除密钥
```bash
# 使用 git filter-branch 从所有分支和历史中移除文件
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch scripts/init-api-keys.sql" \
  --prune-empty --tag-name-filter cat -- --all
```

✅ **状态：** 已完成 - 该文件已从 270 个提交中被移除

### 2. 更新 .gitignore
新增以下规则防止未来泄露：
```gitignore
# API keys and secrets
scripts/init-api-keys.sql
scripts/*-keys.sql
**/api-keys*.sql
**/*secret*.sql
```

### 3. 创建安全的密钥管理系统

**新文件：**
- ✅ `.env.example` - 环境变量模板
- ✅ `scripts/init-api-keys-template.sql` - 安全的 SQL 模板（不含实际密钥）
- ✅ `SECURITY_INCIDENT_REPORT.md` - 本文档

---

## 🚨 立即需要执行的操作

### 步骤 1: 作废暴露的密钥 ⚠️ 必须

1. **OpenRouter**
   - ✅ 已自动禁用
   - 访问 https://openrouter.ai/keys 创建新密钥

2. **Chutes** ⚠️ **立即执行**
   - 访问 Chutes 控制台
   - 作废密钥：`cpk_527e360e...`
   - 生成新的 API 密钥

### 步骤 2: 配置新密钥

1. 复制环境变量模板：
```bash
cp .env.example .env.local
```

2. 编辑 `.env.local`，填入新的密钥：
```env
OPENROUTER_API_KEY=sk-or-v1-新的密钥
CHUTES_API_KEY=cpk_新的密钥
```

3. **切勿提交 `.env.local` 文件！**

### 步骤 3: 更新 Supabase 数据库

1. 打开 `scripts/init-api-keys-template.sql`
2. 将模板中的占位符替换为新密钥
3. 在 Supabase Dashboard SQL Editor 中执行
4. **执行后立即删除包含实际密钥的临时文件**

### 步骤 4: 强制推送清理后的历史

⚠️ **警告：这将重写 Git 历史！请通知所有协作者**

```bash
# 强制推送到远程仓库（清理历史）
git push origin --force --all
git push origin --force --tags

# 清理本地引用
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### 步骤 5: 通知协作者

所有协作者需要执行：
```bash
# 删除本地仓库
cd ..
rm -rf seoul

# 重新克隆
git clone <repository-url>
cd seoul
```

---

## 🛡️ 安全最佳实践

### 1. 环境变量管理

✅ **正确做法：**
```env
# .env.local (已在 .gitignore 中)
API_KEY=actual_secret_value
```

❌ **错误做法：**
```sql
-- 切勿在代码中硬编码密钥
INSERT INTO api_keys VALUES ('sk-or-v1-actual-key');
```

### 2. Git 提交前检查

在每次提交前运行：
```bash
# 检查是否包含敏感信息
git diff --cached | grep -iE '(api[_-]?key|secret|password|token)'
```

### 3. 使用 pre-commit hook

创建 `.git/hooks/pre-commit`：
```bash
#!/bin/bash
if git diff --cached | grep -iE 'sk-or-v1-|cpk_[a-f0-9]{32}'; then
  echo "❌ 检测到 API 密钥！提交已阻止。"
  exit 1
fi
```

### 4. 定期审计

每月检查：
```bash
# 扫描所有文件中的潜在密钥
grep -r -iE "(api[_-]?key|secret|password|token).*=.*['\"].*['\"]" \
  --exclude-dir=node_modules --exclude-dir=.git .
```

---

## 📋 检查清单

- [x] 从 Git 历史中移除密钥文件
- [x] 更新 .gitignore
- [x] 创建安全的环境变量模板
- [x] 创建安全的 SQL 模板
- [ ] **作废 Chutes API 密钥** ⚠️
- [ ] **生成新的 OpenRouter API 密钥** ⚠️
- [ ] **生成新的 Chutes API 密钥** ⚠️
- [ ] 配置 .env.local
- [ ] 更新 Supabase 数据库密钥
- [ ] 强制推送清理后的历史
- [ ] 通知所有协作者
- [ ] 设置 pre-commit hook
- [ ] 审查其他可能的安全问题

---

## 📞 支持联系

- **OpenRouter 支持：** support@openrouter.ai
- **Chutes 支持：** 查看 Chutes 文档
- **GitHub 安全团队：** 如果需要进一步帮助

---

## 📚 参考资料

- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [OWASP: API Security Top 10](https://owasp.org/www-project-api-security/)
- [OpenRouter 安全最佳实践](https://openrouter.ai/docs/security)

---

**最后更新：** 2026-01-03
**修复状态：** 🟡 部分完成 - 需要用户操作完成密钥轮换
