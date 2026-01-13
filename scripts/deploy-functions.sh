#!/bin/bash

set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Deploying Cloudflare Pages frontend...${NC}\n"

if [ ! -f "package.json" ]; then
  echo -e "${YELLOW}package.json not found. Run this from repo root.${NC}"
  exit 1
fi

npm run deploy

echo -e "\n${GREEN}Cloudflare Pages deploy completed.${NC}"
echo -e "${BLUE}Reminder:${NC}"
echo -e "  - Configure env vars in Cloudflare Pages:"
echo -e "    ${YELLOW}NEXT_PUBLIC_CONVEX_URL${NC}, ${YELLOW}CONVEX_ADMIN_TOKEN${NC}, ${YELLOW}NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY${NC}, ${YELLOW}CLERK_SECRET_KEY${NC}, ${YELLOW}ADMIN_EMAILS${NC}"

