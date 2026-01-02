#!/bin/bash

# =============================================
# 数据库部署脚本
# =============================================
# 用途：部署观照系统数据库迁移
# 使用：./scripts/deploy-db.sh [--local|--remote]
# =============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# =============================================
# 辅助函数
# =============================================

print_header() {
  echo -e "\n${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}\n"
}

print_step() {
  echo -e "${YELLOW}▶ $1${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

# =============================================
# 参数解析
# =============================================

ENVIRONMENT="remote"  # 默认部署到远程

if [ "$1" = "--local" ]; then
  ENVIRONMENT="local"
elif [ "$1" = "--remote" ]; then
  ENVIRONMENT="remote"
fi

# =============================================
# 主流程
# =============================================

print_header "观照系统数据库部署"

echo -e "部署环境: ${YELLOW}$ENVIRONMENT${NC}\n"

# 1. 检查 Supabase CLI
print_step "1. 检查 Supabase CLI"

if ! command -v supabase &> /dev/null; then
  print_error "Supabase CLI 未安装"
  echo -e "请运行: ${YELLOW}brew install supabase/tap/supabase${NC}"
  exit 1
fi

print_success "Supabase CLI 已安装"

# 2. 检查项目链接状态
print_step "2. 检查项目链接状态"

if [ "$ENVIRONMENT" = "remote" ]; then
  if ! supabase status &> /dev/null; then
    print_error "Supabase 项目未链接"
    echo -e "\n请先链接项目:"
    echo -e "  ${YELLOW}supabase link --project-ref YOUR_PROJECT_REF${NC}"
    echo -e "\n获取项目引用 ID:"
    echo -e "  1. 访问 https://app.supabase.com/projects"
    echo -e "  2. 选择您的项目"
    echo -e "  3. 在项目设置中找到 Reference ID"
    exit 1
  fi
  print_success "项目已链接"
fi

# 3. 检查迁移文件
print_step "3. 检查迁移文件"

MIGRATIONS=(
  "supabase/migrations/20250102000000_base_schema.sql"
  "supabase/migrations/20250102000001_guanzhao_system.sql"
  "supabase/migrations/20250102000002_setup_cron_jobs.sql"
)

for migration in "${MIGRATIONS[@]}"; do
  if [ -f "$migration" ]; then
    echo -e "  ${GREEN}✓${NC} $(basename $migration)"
  else
    print_error "迁移文件不存在: $migration"
    exit 1
  fi
done

print_success "所有迁移文件就绪"

# 4. 显示确认信息
if [ "$ENVIRONMENT" = "local" ]; then
  echo -e "\n${YELLOW}⚠ 警告: 此操作将重置本地数据库${NC}"
  echo -e "本地数据库将被完全重置，所有现有数据将丢失。"
else
  echo -e "\n${YELLOW}⚠ 警告: 此操作将修改远程数据库${NC}"
  echo -e "将执行以下迁移:"
  for migration in "${MIGRATIONS[@]}"; do
    echo -e "  - $(basename $migration)"
  done
fi

echo -e "\n是否继续? (y/N): \c"
read -r CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo -e "${YELLOW}部署已取消${NC}"
  exit 0
fi

# 5. 执行部署
print_step "4. 执行数据库迁移"

if [ "$ENVIRONMENT" = "local" ]; then
  echo -e "\n正在重置本地数据库...\n"

  if supabase db reset; then
    print_success "本地数据库重置成功"
  else
    print_error "本地数据库重置失败"
    exit 1
  fi
else
  echo -e "\n正在推送迁移到远程数据库...\n"

  if supabase db push; then
    print_success "数据库迁移成功"
  else
    print_error "数据库迁移失败"
    echo -e "\n${YELLOW}故障排除:${NC}"
    echo -e "  1. 检查网络连接"
    echo -e "  2. 验证项目权限"
    echo -e "  3. 查看错误日志"
    exit 1
  fi
fi

# 6. 验证部署
print_step "5. 验证部署"

echo -e "\n检查表是否创建成功...\n"

# 这里可以添加更多验证逻辑，比如查询特定表是否存在
# 由于需要数据库连接，这里仅作提示

echo -e "请手动验证以下表是否存在:"
echo -e "  1. guanzhao_settings"
echo -e "  2. user_sessions"
echo -e "  3. guanzhao_trigger_history"
echo -e "  4. guanzhao_budget_tracking"
echo -e "  5. guanzhao_cooldowns"
echo -e "  6. guanzhao_user_actions"
echo -e "  7. guanzhao_user_feedback"

if [ "$ENVIRONMENT" = "remote" ]; then
  echo -e "\n访问 Supabase Dashboard 验证:"
  echo -e "  ${BLUE}https://app.supabase.com/project/_/editor${NC}"
fi

# 7. pg_cron 配置提醒
print_step "6. 配置定时任务 (pg_cron)"

echo -e "\n${YELLOW}重要: 需要手动配置 pg_cron${NC}\n"

echo -e "1. 启用 pg_cron 扩展:"
echo -e "   - 访问 Supabase Dashboard → Database → Extensions"
echo -e "   - 搜索并启用 'pg_cron'"

echo -e "\n2. 执行定时任务 SQL:"
echo -e "   - 访问 SQL Editor"
echo -e "   - 打开文件: ${YELLOW}supabase/migrations/20250102000002_setup_cron_jobs.sql${NC}"
echo -e "   - 执行整个脚本"

echo -e "\n3. 配置环境变量（在 SQL Editor 中执行）:"
echo -e "   ${YELLOW}ALTER DATABASE postgres SET app.settings.supabase_url = 'YOUR_URL';${NC}"
echo -e "   ${YELLOW}ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_KEY';${NC}"

echo -e "\n4. 验证定时任务:"
echo -e "   ${YELLOW}SELECT * FROM cron.job WHERE jobname LIKE 'guanzhao-%';${NC}"

# =============================================
# 完成
# =============================================

print_header "部署完成"

print_success "数据库迁移已完成！"

echo -e "\n${BLUE}下一步:${NC}"
echo -e "  1. 完成 pg_cron 配置（见上方说明）"
echo -e "  2. 运行 ${YELLOW}./scripts/deploy-functions.sh${NC} 部署 Edge Functions"
echo -e "  3. 运行 ${YELLOW}npm run dev${NC} 启动开发服务器测试"

echo ""
