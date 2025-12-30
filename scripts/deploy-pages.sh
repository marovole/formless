#!/bin/bash
# deploy-pages.sh - 部署到 Cloudflare Pages 并设置环境变量

set -e

PROJECT_NAME="formless"

echo "🚀 开始部署到 Cloudflare Pages..."

# 1. 构建项目
echo "📦 构建项目..."
npm run pages:build

# 2. 部署
echo "🚀 部署中..."
npx wrangler pages deploy .vercel/output/static --project-name=$PROJECT_NAME

echo ""
echo "✅ 部署完成!"
echo ""
echo "📝 下一步：设置环境变量"
echo "请运行以下命令设置敏感环境变量："
echo ""
echo "  npx wrangler pages secret put NEXT_PUBLIC_SUPABASE_URL --project-name=$PROJECT_NAME"
echo "  npx wrangler pages secret put NEXT_PUBLIC_SUPABASE_ANON_KEY --project-name=$PROJECT_NAME"
echo "  npx wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY --project-name=$PROJECT_NAME"
echo "  npx wrangler pages secret put CHUTES_API_KEY --project-name=$PROJECT_NAME"
echo "  npx wrangler pages secret put OPENROUTER_API_KEYS --project-name=$PROJECT_NAME"
echo "  npx wrangler pages secret put ADMIN_EMAIL --project-name=$PROJECT_NAME"
echo "  npx wrangler pages secret put ADMIN_PASSWORD_HASH --project-name=$PROJECT_NAME"
echo ""
echo "💡 或者使用交互式方式："
echo "  for var in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY CHUTES_API_KEY OPENROUTER_API_KEYS ADMIN_EMAIL ADMIN_PASSWORD_HASH; do"
echo "    echo \"请输入 \$var 的值：\""
echo "    read value"
echo "    echo \"\$value\" | npx wrangler pages secret put \$var --project-name=$PROJECT_NAME"
echo "  done"
