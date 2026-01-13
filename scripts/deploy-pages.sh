#!/bin/bash

set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-formless}"

echo "Deploying to Cloudflare Pages (project: ${PROJECT_NAME})..."
echo ""

npm run deploy

echo ""
echo "Next: configure Cloudflare Pages env vars (Production):"
echo ""
echo "  NEXT_PUBLIC_CONVEX_URL"
echo "  CONVEX_ADMIN_TOKEN"
echo "  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
echo "  CLERK_SECRET_KEY"
echo "  ADMIN_EMAILS"
echo ""
echo "Optional (interactive, via Wrangler):"
echo "  npx wrangler pages secret put NEXT_PUBLIC_CONVEX_URL --project-name=${PROJECT_NAME}"
echo "  npx wrangler pages secret put CONVEX_ADMIN_TOKEN --project-name=${PROJECT_NAME}"
echo "  npx wrangler pages secret put NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY --project-name=${PROJECT_NAME}"
echo "  npx wrangler pages secret put CLERK_SECRET_KEY --project-name=${PROJECT_NAME}"
echo "  npx wrangler pages secret put ADMIN_EMAILS --project-name=${PROJECT_NAME}"

