#!/bin/bash

# =============================================
# 观照系统测试脚本
# =============================================
# 用途：测试观照系统的各个功能点
# 使用：./scripts/test-guanzhao.sh
# =============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# =============================================
# 配置
# =============================================

# 从 .env.local 读取配置
if [ -f ".env.local" ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

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

test_pass() {
  echo -e "  ${GREEN}✓${NC} $1"
  ((PASSED++))
}

test_fail() {
  echo -e "  ${RED}✗${NC} $1"
  ((FAILED++))
}

test_info() {
  echo -e "  ${BLUE}ℹ${NC} $1"
}

# 测试结果计数
PASSED=0
FAILED=0

# =============================================
# 检查配置
# =============================================

print_header "观照系统功能测试"

if [ -z "$SUPABASE_URL" ] || [ -z "$ANON_KEY" ]; then
  echo -e "${RED}错误: 环境变量未配置${NC}"
  echo -e "请确保 .env.local 文件包含:"
  echo -e "  - NEXT_PUBLIC_SUPABASE_URL"
  echo -e "  - NEXT_PUBLIC_SUPABASE_ANON_KEY"
  exit 1
fi

echo -e "Supabase URL: ${BLUE}$SUPABASE_URL${NC}"
echo -e "测试模式: ${YELLOW}模拟测试 (无需真实用户)${NC}\n"

# =============================================
# 测试 1: Edge Functions 可访问性
# =============================================

print_section "1. 测试 Edge Functions 可访问性"

# 测试 session-tracker
test_info "测试 session-tracker..."

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  "${SUPABASE_URL}/functions/v1/guanzhao/session-tracker" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"session_start","userId":"test-user","timezone":"Asia/Shanghai"}' \
  2>/dev/null)

if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "400" ]; then
  test_pass "session-tracker 可访问 (HTTP $RESPONSE)"
else
  test_fail "session-tracker 不可访问 (HTTP $RESPONSE)"
fi

# 测试 trigger-engine
test_info "测试 trigger-engine..."

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  "${SUPABASE_URL}/functions/v1/guanzhao/trigger-engine" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user","triggerId":"daily_checkin","channel":"in_app"}' \
  2>/dev/null)

if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "400" ]; then
  test_pass "trigger-engine 可访问 (HTTP $RESPONSE)"
else
  test_fail "trigger-engine 不可访问 (HTTP $RESPONSE)"
fi

# =============================================
# 测试 2: API Routes 可访问性
# =============================================

print_section "2. 测试 API Routes 可访问性"

# 检查开发服务器是否运行
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo -e "${YELLOW}警告: 开发服务器未运行${NC}"
  echo -e "请先运行: ${BLUE}npm run dev${NC}"
  echo -e "\nAPI Routes 测试已跳过\n"
else
  test_info "测试 API Routes..."

  # 测试 settings API (需要认证，预期 401)
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/guanzhao/settings 2>/dev/null)
  if [ "$RESPONSE" = "401" ]; then
    test_pass "settings API 存在 (预期需要认证)"
  else
    test_fail "settings API 响应异常 (HTTP $RESPONSE)"
  fi

  # 测试 session API
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST http://localhost:3000/api/guanzhao/session \
    -H "Content-Type: application/json" \
    -d '{"eventType":"session_start"}' \
    2>/dev/null)

  if [ "$RESPONSE" = "401" ] || [ "$RESPONSE" = "200" ]; then
    test_pass "session API 存在"
  else
    test_fail "session API 响应异常 (HTTP $RESPONSE)"
  fi
fi

# =============================================
# 测试 3: 数据库表结构
# =============================================

print_section "3. 数据库表结构检查"

echo -e "${YELLOW}需要手动验证以下表是否存在:${NC}\n"

TABLES=(
  "guanzhao_settings"
  "user_sessions"
  "user_session_events"
  "guanzhao_trigger_history"
  "guanzhao_user_actions"
  "guanzhao_cooldowns"
  "guanzhao_budget_tracking"
  "guanzhao_user_feedback"
)

for table in "${TABLES[@]}"; do
  echo -e "  - $table"
done

echo -e "\n${BLUE}访问 Supabase Dashboard 验证:${NC}"
echo -e "  ${BLUE}https://app.supabase.com/project/_/editor${NC}\n"

# =============================================
# 测试 4: 前端组件检查
# =============================================

print_section "4. 前端组件检查"

COMPONENTS=(
  "components/guanzhao/GuanzhaoTriggerCard.tsx"
  "lib/hooks/useSessionTracking.ts"
  "app/[locale]/settings/guanzhao/page.tsx"
)

for component in "${COMPONENTS[@]}"; do
  if [ -f "$component" ]; then
    test_pass "$(basename $component) 存在"
  else
    test_fail "$(basename $component) 不存在"
  fi
done

# =============================================
# 测试 5: 配置文件检查
# =============================================

print_section "5. 配置文件检查"

# 检查 guanzhao-bundle.yaml
if [ -f "docs/guanzhao/guanzhao-bundle.yaml" ]; then
  test_pass "guanzhao-bundle.yaml 存在"

  # 检查文件大小
  SIZE=$(wc -c < "docs/guanzhao/guanzhao-bundle.yaml")
  if [ "$SIZE" -gt 1000 ]; then
    test_pass "配置文件内容完整 (${SIZE} bytes)"
  else
    test_fail "配置文件内容可能不完整 (${SIZE} bytes)"
  fi
else
  test_fail "guanzhao-bundle.yaml 不存在"
fi

# =============================================
# 测试 6: TypeScript 类型检查
# =============================================

print_section "6. TypeScript 类型检查"

test_info "运行 TypeScript 编译器..."

if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
  test_fail "存在 TypeScript 类型错误"
  echo -e "${YELLOW}运行 'npx tsc --noEmit' 查看详细错误${NC}"
else
  test_pass "TypeScript 类型检查通过"
fi

# =============================================
# 手动测试指南
# =============================================

print_section "7. 手动测试建议"

echo -e "${YELLOW}以下测试需要手动执行:${NC}\n"

echo -e "1. ${BLUE}设置页面测试${NC}"
echo -e "   - 访问 http://localhost:3000/settings/guanzhao"
echo -e "   - 测试启用/禁用观照"
echo -e "   - 调整频率级别"
echo -e "   - 更改语气风格"
echo -e "   - 配置 DND 时段"

echo -e "\n2. ${BLUE}会话追踪测试${NC}"
echo -e "   - 访问 http://localhost:3000/chat"
echo -e "   - 开始聊天会话"
echo -e "   - 检查 user_sessions 表是否有新记录"
echo -e "   - 验证心跳更新 (last_activity_at)"

echo -e "\n3. ${BLUE}触发器测试${NC}"
echo -e "   - 首次登录触发 daily_checkin"
echo -e "   - 长时间会话(45分钟+)触发 overload_protection"
echo -e "   - 晚上结束会话触发 nightly_wrapup"

echo -e "\n4. ${BLUE}用户交互测试${NC}"
echo -e "   - 点击触发器卡片按钮"
echo -e "   - 测试静默功能"
echo -e "   - 提交反馈"
echo -e "   - 验证 DND 时段屏蔽"

# =============================================
# 总结报告
# =============================================

print_header "测试结果总结"

echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"

echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ 自动化测试全部通过！${NC}"
  echo -e "\n${YELLOW}请继续执行手动测试以验证完整功能${NC}"
  exit 0
else
  echo -e "${RED}✗ 存在失败的测试项${NC}"
  echo -e "\n${YELLOW}请修复失败项后重新测试${NC}"
  exit 1
fi
