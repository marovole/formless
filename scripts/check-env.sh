#!/bin/bash

# =============================================
# 观照系统环境检查脚本
# =============================================
# 用途：检查部署前的环境准备情况
# 使用：./scripts/check-env.sh
# =============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查结果计数
PASSED=0
FAILED=0
WARNINGS=0

# =============================================
# 辅助函数
# =============================================

print_header() {
  echo -e "\n${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}\n"
}

print_section() {
  echo -e "\n${YELLOW}▶ $1${NC}"
}

check_pass() {
  echo -e "  ${GREEN}✓${NC} $1"
  ((PASSED++))
}

check_fail() {
  echo -e "  ${RED}✗${NC} $1"
  ((FAILED++))
}

check_warn() {
  echo -e "  ${YELLOW}⚠${NC} $1"
  ((WARNINGS++))
}

# =============================================
# 检查项
# =============================================

print_header "观照系统环境检查"

# 1. 检查必需的命令行工具
print_section "1. 检查命令行工具"

if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version)
  check_pass "Node.js 已安装 ($NODE_VERSION)"
else
  check_fail "Node.js 未安装 - 请安装 Node.js 18+"
fi

if command -v npm &> /dev/null; then
  NPM_VERSION=$(npm --version)
  check_pass "npm 已安装 ($NPM_VERSION)"
else
  check_fail "npm 未安装"
fi

if command -v supabase &> /dev/null; then
  SUPABASE_VERSION=$(supabase --version)
  check_pass "Supabase CLI 已安装 ($SUPABASE_VERSION)"
else
  check_fail "Supabase CLI 未安装 - 运行: brew install supabase/tap/supabase"
fi

if command -v git &> /dev/null; then
  GIT_VERSION=$(git --version)
  check_pass "Git 已安装 ($GIT_VERSION)"
else
  check_fail "Git 未安装"
fi

# 2. 检查项目依赖
print_section "2. 检查项目依赖"

if [ -f "package.json" ]; then
  check_pass "package.json 存在"
else
  check_fail "package.json 不存在"
fi

if [ -d "node_modules" ]; then
  check_pass "node_modules 已安装"
else
  check_warn "node_modules 未安装 - 运行: npm install"
fi

# 3. 检查环境变量
print_section "3. 检查环境变量"

if [ -f ".env.local" ]; then
  check_pass ".env.local 文件存在"

  # 检查必需的环境变量
  if grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local; then
    check_pass "NEXT_PUBLIC_SUPABASE_URL 已配置"
  else
    check_fail "NEXT_PUBLIC_SUPABASE_URL 未配置"
  fi

  if grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY" .env.local; then
    check_pass "NEXT_PUBLIC_SUPABASE_ANON_KEY 已配置"
  else
    check_fail "NEXT_PUBLIC_SUPABASE_ANON_KEY 未配置"
  fi

  if grep -q "SUPABASE_SERVICE_ROLE_KEY" .env.local; then
    check_pass "SUPABASE_SERVICE_ROLE_KEY 已配置"
  else
    check_warn "SUPABASE_SERVICE_ROLE_KEY 未配置（Edge Functions 需要）"
  fi
else
  check_fail ".env.local 文件不存在 - 请创建并配置环境变量"
fi

# 4. 检查 Supabase 配置
print_section "4. 检查 Supabase 配置"

if [ -f "supabase/config.toml" ]; then
  check_pass "supabase/config.toml 存在"

  # 检查 project_id 是否已配置
  if grep -q 'project_id = "your-project-ref"' supabase/config.toml; then
    check_warn "project_id 仍为默认值 - 请更新为实际的项目引用 ID"
  else
    check_pass "project_id 已配置"
  fi
else
  check_fail "supabase/config.toml 不存在"
fi

# 检查是否已链接 Supabase 项目
if [ -f ".git/config" ]; then
  if supabase status &> /dev/null; then
    check_pass "Supabase 项目已链接"
  else
    check_warn "Supabase 项目未链接 - 运行: supabase link --project-ref YOUR_REF"
  fi
else
  check_warn "无法检查 Supabase 链接状态"
fi

# 5. 检查数据库迁移文件
print_section "5. 检查数据库迁移文件"

MIGRATIONS=(
  "supabase/migrations/20250102000000_base_schema.sql"
  "supabase/migrations/20250102000001_guanzhao_system.sql"
  "supabase/migrations/20250102000002_setup_cron_jobs.sql"
)

for migration in "${MIGRATIONS[@]}"; do
  if [ -f "$migration" ]; then
    check_pass "$(basename $migration) 存在"
  else
    check_fail "$(basename $migration) 不存在"
  fi
done

# 6. 检查 Edge Functions
print_section "6. 检查 Edge Functions"

FUNCTIONS=(
  "supabase/functions/guanzhao/session-tracker/index.ts"
  "supabase/functions/guanzhao/trigger-engine/index.ts"
)

for func in "${FUNCTIONS[@]}"; do
  if [ -f "$func" ]; then
    check_pass "$(basename $(dirname $func)) 存在"
  else
    check_fail "$(basename $(dirname $func)) 不存在"
  fi
done

if [ -f "supabase/functions/import_map.json" ]; then
  check_pass "import_map.json 存在"
else
  check_fail "import_map.json 不存在"
fi

# 7. 检查核心库文件
print_section "7. 检查核心库文件"

CORE_FILES=(
  "lib/guanzhao/config.ts"
  "lib/guanzhao/budget.ts"
  "lib/guanzhao/safetyKeywords.ts"
  "lib/guanzhao/types.ts"
  "lib/hooks/useSessionTracking.ts"
)

for file in "${CORE_FILES[@]}"; do
  if [ -f "$file" ]; then
    check_pass "$(basename $file) 存在"
  else
    check_fail "$(basename $file) 不存在"
  fi
done

# 8. 检查前端组件
print_section "8. 检查前端组件"

COMPONENTS=(
  "components/guanzhao/GuanzhaoTriggerCard.tsx"
  "app/[locale]/settings/guanzhao/page.tsx"
  "components/ui/switch.tsx"
  "components/ui/radio-group.tsx"
)

for component in "${COMPONENTS[@]}"; do
  if [ -f "$component" ]; then
    check_pass "$(basename $component) 存在"
  else
    check_fail "$(basename $component) 不存在"
  fi
done

# 9. 检查 API Routes
print_section "9. 检查 API Routes"

API_ROUTES=(
  "app/api/guanzhao/session/route.ts"
  "app/api/guanzhao/settings/route.ts"
  "app/api/guanzhao/actions/route.ts"
  "app/api/guanzhao/trigger/route.ts"
  "app/api/guanzhao/push-token/route.ts"
)

for route in "${API_ROUTES[@]}"; do
  if [ -f "$route" ]; then
    check_pass "$(basename $(dirname $route)) API 存在"
  else
    check_fail "$(basename $(dirname $route)) API 不存在"
  fi
done

# 10. 检查文档
print_section "10. 检查文档"

DOCS=(
  "docs/guanzhao/README.md"
  "docs/guanzhao/DEPLOYMENT.md"
  "docs/guanzhao/IMPLEMENTATION_CHECKLIST.md"
)

for doc in "${DOCS[@]}"; do
  if [ -f "$doc" ]; then
    check_pass "$(basename $doc) 存在"
  else
    check_fail "$(basename $doc) 不存在"
  fi
done

# =============================================
# 总结报告
# =============================================

print_header "检查结果总结"

echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${YELLOW}警告: $WARNINGS${NC}"
echo -e "${RED}失败: $FAILED${NC}"

echo ""

if [ $FAILED -eq 0 ]; then
  if [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ 所有检查通过！可以开始部署。${NC}"
    echo -e "\n${BLUE}下一步:${NC}"
    echo -e "  1. 运行 ${YELLOW}./scripts/deploy-db.sh${NC} 部署数据库"
    echo -e "  2. 运行 ${YELLOW}./scripts/deploy-functions.sh${NC} 部署 Edge Functions"
    echo -e "  3. 运行 ${YELLOW}npm run dev${NC} 启动开发服务器测试"
    exit 0
  else
    echo -e "${YELLOW}⚠ 有警告项需要注意，但可以继续部署。${NC}"
    echo -e "\n${BLUE}建议:${NC}"
    echo -e "  1. 检查并修复上述警告项"
    echo -e "  2. 继续部署前请确保理解警告的影响"
    exit 0
  fi
else
  echo -e "${RED}✗ 有失败项，请修复后再部署。${NC}"
  echo -e "\n${BLUE}建议:${NC}"
  echo -e "  1. 查看上述失败项"
  echo -e "  2. 参考 docs/guanzhao/DEPLOYMENT.md"
  echo -e "  3. 修复问题后重新运行此脚本"
  exit 1
fi
