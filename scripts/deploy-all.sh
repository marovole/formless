#!/bin/bash

# =============================================
# 观照系统完整部署脚本
# =============================================
# 用途：一键部署观照系统所有组件
# 使用：./scripts/deploy-all.sh [--skip-db] [--skip-functions]
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

SKIP_DB=false
SKIP_FUNCTIONS=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-db)
      SKIP_DB=true
      shift
      ;;
    --skip-functions)
      SKIP_FUNCTIONS=true
      shift
      ;;
    *)
      echo -e "${RED}未知参数: $1${NC}"
      echo -e "使用: ./scripts/deploy-all.sh [--skip-db] [--skip-functions]"
      exit 1
      ;;
  esac
done

# =============================================
# 主流程
# =============================================

print_header "观照系统完整部署"

echo -e "此脚本将执行以下步骤:"
echo -e "  1. 环境检查"
if [ "$SKIP_DB" = false ]; then
  echo -e "  2. 数据库迁移"
else
  echo -e "  2. ${YELLOW}数据库迁移 (跳过)${NC}"
fi
if [ "$SKIP_FUNCTIONS" = false ]; then
  echo -e "  3. Edge Functions 部署"
else
  echo -e "  3. ${YELLOW}Edge Functions 部署 (跳过)${NC}"
fi
echo -e "  4. 前端依赖安装"
echo -e "  5. 启动开发服务器"

echo -e "\n是否继续? (y/N): \c"
read -r CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo -e "${YELLOW}部署已取消${NC}"
  exit 0
fi

# =============================================
# 步骤 1: 环境检查
# =============================================

print_step "步骤 1/5: 环境检查"

if [ ! -f "scripts/check-env.sh" ]; then
  print_error "环境检查脚本不存在"
  exit 1
fi

echo ""
./scripts/check-env.sh

if [ $? -ne 0 ]; then
  print_error "环境检查失败，请修复后重试"
  exit 1
fi

# =============================================
# 步骤 2: 数据库迁移
# =============================================

if [ "$SKIP_DB" = false ]; then
  print_step "步骤 2/5: 数据库迁移"

  if [ ! -f "scripts/deploy-db.sh" ]; then
    print_error "数据库部署脚本不存在"
    exit 1
  fi

  echo -e "\n${YELLOW}准备部署数据库...${NC}"
  echo -e "按 Enter 继续，或 Ctrl+C 取消"
  read -r

  ./scripts/deploy-db.sh --remote

  if [ $? -ne 0 ]; then
    print_error "数据库部署失败"
    exit 1
  fi
else
  echo -e "${YELLOW}▶ 步骤 2/5: 数据库迁移 (已跳过)${NC}"
fi

# =============================================
# 步骤 3: Edge Functions 部署
# =============================================

if [ "$SKIP_FUNCTIONS" = false ]; then
  print_step "步骤 3/5: Edge Functions 部署"

  if [ ! -f "scripts/deploy-functions.sh" ]; then
    print_error "Edge Functions 部署脚本不存在"
    exit 1
  fi

  echo -e "\n${YELLOW}准备部署 Edge Functions...${NC}"
  echo -e "按 Enter 继续，或 Ctrl+C 取消"
  read -r

  ./scripts/deploy-functions.sh

  if [ $? -ne 0 ]; then
    print_error "Edge Functions 部署失败"
    exit 1
  fi
else
  echo -e "${YELLOW}▶ 步骤 3/5: Edge Functions 部署 (已跳过)${NC}"
fi

# =============================================
# 步骤 4: 前端依赖安装
# =============================================

print_step "步骤 4/5: 前端依赖安装"

if [ ! -d "node_modules" ]; then
  echo -e "\n正在安装 npm 依赖...\n"

  npm install

  if [ $? -ne 0 ]; then
    print_error "npm install 失败"
    exit 1
  fi

  print_success "依赖安装完成"
else
  print_success "依赖已安装，跳过"
fi

# =============================================
# 步骤 5: 构建检查
# =============================================

print_step "步骤 5/5: 构建检查"

echo -e "\n正在检查 TypeScript 类型...\n"

if npm run build --dry-run 2>/dev/null || npx tsc --noEmit; then
  print_success "类型检查通过"
else
  print_error "类型检查失败"
  echo -e "${YELLOW}警告: 存在类型错误，但可以继续开发${NC}"
fi

# =============================================
# 完成总结
# =============================================

print_header "部署完成"

print_success "观照系统部署成功！"

echo -e "\n${BLUE}部署总结:${NC}"
if [ "$SKIP_DB" = false ]; then
  echo -e "  ${GREEN}✓${NC} 数据库迁移完成"
else
  echo -e "  ${YELLOW}○${NC} 数据库迁移已跳过"
fi

if [ "$SKIP_FUNCTIONS" = false ]; then
  echo -e "  ${GREEN}✓${NC} Edge Functions 部署完成"
else
  echo -e "  ${YELLOW}○${NC} Edge Functions 部署已跳过"
fi

echo -e "  ${GREEN}✓${NC} 前端依赖已安装"

# =============================================
# 后续步骤
# =============================================

echo -e "\n${BLUE}后续步骤:${NC}"

echo -e "\n1. ${YELLOW}配置 pg_cron 定时任务${NC}"
echo -e "   - 在 Supabase Dashboard → Database → Extensions 启用 'pg_cron'"
echo -e "   - 在 SQL Editor 执行: supabase/migrations/20250102000002_setup_cron_jobs.sql"

echo -e "\n2. ${YELLOW}启动开发服务器${NC}"
echo -e "   ${BLUE}npm run dev${NC}"

echo -e "\n3. ${YELLOW}测试功能${NC}"
echo -e "   - 访问 http://localhost:3000/settings/guanzhao 配置观照设置"
echo -e "   - 访问 http://localhost:3000/chat 开始聊天会话"
echo -e "   - 观察触发器是否正常工作"

echo -e "\n4. ${YELLOW}监控日志${NC}"
echo -e "   - 查看 Edge Functions 日志"
echo -e "   - 查看浏览器控制台"
echo -e "   - 检查数据库表记录"

echo -e "\n${GREEN}是否立即启动开发服务器? (y/N): ${NC}\c"
read -r START_DEV

if [ "$START_DEV" = "y" ] || [ "$START_DEV" = "Y" ]; then
  echo -e "\n${BLUE}正在启动开发服务器...${NC}\n"
  npm run dev
else
  echo -e "\n${YELLOW}稍后可以运行 'npm run dev' 启动开发服务器${NC}"
fi

echo ""
