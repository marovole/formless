#!/bin/bash

# =============================================
# Edge Functions 部署脚本
# =============================================
# 用途：部署观照系统 Edge Functions
# 使用：./scripts/deploy-functions.sh [function-name]
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
# 函数列表
# =============================================

FUNCTIONS=(
  "guanzhao/session-tracker"
  "guanzhao/trigger-engine"
)

# =============================================
# 参数解析
# =============================================

DEPLOY_SPECIFIC=""

if [ -n "$1" ]; then
  DEPLOY_SPECIFIC="$1"
fi

# =============================================
# 主流程
# =============================================

print_header "观照系统 Edge Functions 部署"

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

if ! supabase status &> /dev/null; then
  print_error "Supabase 项目未链接"
  echo -e "\n请先链接项目:"
  echo -e "  ${YELLOW}supabase link --project-ref YOUR_PROJECT_REF${NC}"
  exit 1
fi

print_success "项目已链接"

# 3. 检查函数文件
print_step "3. 检查 Edge Functions"

if [ -n "$DEPLOY_SPECIFIC" ]; then
  # 部署指定函数
  FUNCTION_PATH="supabase/functions/$DEPLOY_SPECIFIC/index.ts"

  if [ ! -f "$FUNCTION_PATH" ]; then
    print_error "函数不存在: $DEPLOY_SPECIFIC"
    echo -e "\n可用的函数:"
    for func in "${FUNCTIONS[@]}"; do
      echo -e "  - $func"
    done
    exit 1
  fi

  echo -e "  ${GREEN}✓${NC} $DEPLOY_SPECIFIC"
  DEPLOY_LIST=("$DEPLOY_SPECIFIC")
else
  # 部署所有函数
  for func in "${FUNCTIONS[@]}"; do
    FUNCTION_PATH="supabase/functions/$func/index.ts"

    if [ -f "$FUNCTION_PATH" ]; then
      echo -e "  ${GREEN}✓${NC} $func"
    else
      print_error "函数不存在: $func"
      exit 1
    fi
  done

  DEPLOY_LIST=("${FUNCTIONS[@]}")
fi

print_success "所有函数文件就绪"

# 4. 检查依赖配置
print_step "4. 检查依赖配置"

if [ -f "supabase/functions/import_map.json" ]; then
  print_success "import_map.json 存在"
else
  print_error "import_map.json 不存在"
  exit 1
fi

# 5. 检查环境变量 (Secrets)
print_step "5. 检查环境变量"

echo -e "\nEdge Functions 需要以下 Secrets:"
echo -e "  - SUPABASE_URL"
echo -e "  - SUPABASE_SERVICE_ROLE_KEY"

echo -e "\n${YELLOW}确保已设置 Secrets:${NC}"
echo -e "  ${YELLOW}supabase secrets set SUPABASE_URL=your_url${NC}"
echo -e "  ${YELLOW}supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key${NC}"

echo -e "\n是否已设置 Secrets? (y/N): \c"
read -r SECRETS_CONFIRMED

if [ "$SECRETS_CONFIRMED" != "y" ] && [ "$SECRETS_CONFIRMED" != "Y" ]; then
  echo -e "${YELLOW}部署已取消。请先设置 Secrets。${NC}"
  exit 0
fi

# 6. 显示确认信息
echo -e "\n${YELLOW}将部署以下函数:${NC}"
for func in "${DEPLOY_LIST[@]}"; do
  echo -e "  - $func"
done

echo -e "\n是否继续部署? (y/N): \c"
read -r CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo -e "${YELLOW}部署已取消${NC}"
  exit 0
fi

# 7. 执行部署
print_step "6. 部署 Edge Functions"

DEPLOYED=0
FAILED=0

for func in "${DEPLOY_LIST[@]}"; do
  echo -e "\n${BLUE}正在部署 $func...${NC}\n"

  if supabase functions deploy "$func" --no-verify-jwt; then
    print_success "$func 部署成功"
    ((DEPLOYED++))
  else
    print_error "$func 部署失败"
    ((FAILED++))
  fi
done

# 8. 部署结果
print_header "部署结果"

echo -e "${GREEN}成功: $DEPLOYED${NC}"
echo -e "${RED}失败: $FAILED${NC}"

if [ $FAILED -gt 0 ]; then
  echo -e "\n${RED}部分函数部署失败${NC}"
  echo -e "\n${YELLOW}故障排除:${NC}"
  echo -e "  1. 检查函数代码是否有语法错误"
  echo -e "  2. 确认 import_map.json 配置正确"
  echo -e "  3. 验证网络连接"
  echo -e "  4. 查看 Supabase Dashboard 的函数日志"
  exit 1
fi

# 9. 测试函数
print_step "7. 测试 Edge Functions"

echo -e "\n${YELLOW}建议测试函数是否正常工作${NC}\n"

echo -e "测试 session-tracker:"
echo -e "  ${BLUE}curl -i --location --request POST \\${NC}"
echo -e "  ${BLUE}'https://YOUR_PROJECT_REF.supabase.co/functions/v1/guanzhao/session-tracker' \\${NC}"
echo -e "  ${BLUE}--header 'Authorization: Bearer YOUR_ANON_KEY' \\${NC}"
echo -e "  ${BLUE}--header 'Content-Type: application/json' \\${NC}"
echo -e "  ${BLUE}--data '{\"eventType\":\"session_start\",\"userId\":\"test\"}'${NC}"

echo -e "\n测试 trigger-engine:"
echo -e "  ${BLUE}curl -i --location --request POST \\${NC}"
echo -e "  ${BLUE}'https://YOUR_PROJECT_REF.supabase.co/functions/v1/guanzhao/trigger-engine' \\${NC}"
echo -e "  ${BLUE}--header 'Authorization: Bearer YOUR_ANON_KEY' \\${NC}"
echo -e "  ${BLUE}--header 'Content-Type: application/json' \\${NC}"
echo -e "  ${BLUE}--data '{\"userId\":\"test\",\"triggerId\":\"daily_checkin\",\"channel\":\"in_app\"}'${NC}"

# 10. 查看日志
echo -e "\n${YELLOW}查看函数日志:${NC}"
echo -e "  在 Supabase Dashboard → Edge Functions → Logs"
echo -e "  或使用 CLI: ${BLUE}supabase functions logs guanzhao/session-tracker${NC}"

# =============================================
# 完成
# =============================================

print_header "部署完成"

print_success "Edge Functions 部署成功！"

echo -e "\n${BLUE}下一步:${NC}"
echo -e "  1. 测试函数是否正常工作（见上方测试命令）"
echo -e "  2. 在 Supabase Dashboard 查看函数日志"
echo -e "  3. 运行 ${YELLOW}npm run dev${NC} 启动前端测试完整流程"

echo ""
