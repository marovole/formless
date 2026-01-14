#!/bin/bash
# Formless 部署前检查脚本
# 用于验证所有必需的环境变量和配置

set -e

echo "🔍 Formless 部署前检查"
echo "========================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

check_env() {
    local var_name=$1
    local var_value=${!var_name}
    local required=$2
    
    if [ -z "$var_value" ]; then
        if [ "$required" = "required" ]; then
            echo -e "${RED}✗ $var_name${NC} - 未设置 (必需)"
            ERRORS=$((ERRORS + 1))
        else
            echo -e "${YELLOW}○ $var_name${NC} - 未设置 (可选)"
        fi
    else
        echo -e "${GREEN}✓ $var_name${NC} - 已设置"
    fi
}

echo "📋 检查本地环境变量 (.env.local)..."
echo ""

# Load .env.local if exists
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs)
    echo -e "${GREEN}✓ .env.local 文件存在${NC}"
else
    echo -e "${RED}✗ .env.local 文件不存在${NC}"
    echo "  请复制 .env.example 到 .env.local 并填入配置"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "📌 Convex 配置:"
check_env "NEXT_PUBLIC_CONVEX_URL" "required"
check_env "CONVEX_DEPLOYMENT" "required"
check_env "CONVEX_DEPLOY_KEY" "required"

echo ""
echo "🔐 Clerk 配置:"
check_env "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "required"
check_env "CLERK_SECRET_KEY" "required"

echo ""
echo "👤 Admin 配置:"
check_env "ADMIN_EMAILS" "required"

echo ""
echo "🔍 检查 Convex 环境变量..."
CONVEX_CLERK_DOMAIN=$(npx convex env get CLERK_JWT_ISSUER_DOMAIN 2>/dev/null || echo "")
CONVEX_ADMIN_EMAILS=$(npx convex env get ADMIN_EMAILS 2>/dev/null || echo "")

if [ -z "$CONVEX_CLERK_DOMAIN" ]; then
    echo -e "${RED}✗ Convex CLERK_JWT_ISSUER_DOMAIN${NC} - 未设置"
    echo "  运行: npx convex env set CLERK_JWT_ISSUER_DOMAIN \"https://your-domain.clerk.accounts.dev\""
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ Convex CLERK_JWT_ISSUER_DOMAIN${NC} - 已设置"
fi

if [ -z "$CONVEX_ADMIN_EMAILS" ]; then
    echo -e "${RED}✗ Convex ADMIN_EMAILS${NC} - 未设置"
    echo "  运行: npx convex env set ADMIN_EMAILS \"admin@example.com\""
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ Convex ADMIN_EMAILS${NC} - 已设置"
fi

echo ""
echo "========================"

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}发现 $ERRORS 个问题需要修复${NC}"
    echo ""
    echo "📖 部署步骤:"
    echo "1. 在 Clerk Dashboard 创建 JWT Template:"
    echo "   - 名称: convex"
    echo "   - aud: convex"
    echo "   - 包含 email claim"
    echo ""
    echo "2. 设置 Convex 环境变量:"
    echo "   npx convex env set CLERK_JWT_ISSUER_DOMAIN \"https://xxx.clerk.accounts.dev\""
    echo "   npx convex env set ADMIN_EMAILS \"your-email@example.com\""
    echo ""
    echo "3. 部署 Convex:"
    echo "   npx convex deploy"
    echo ""
    echo "4. 部署到 Cloudflare:"
    echo "   npm run deploy"
    exit 1
else
    echo -e "${GREEN}✓ 所有检查通过！可以部署。${NC}"
    echo ""
    echo "运行以下命令部署:"
    echo "  npx convex deploy && npm run deploy"
fi
