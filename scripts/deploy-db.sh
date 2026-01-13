#!/bin/bash

set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Deploying Convex backend...${NC}\n"

if ! npx convex --help >/dev/null 2>&1; then
  echo -e "${YELLOW}convex CLI not available. Run: npm install${NC}"
  exit 1
fi

npx convex deploy

echo -e "\n${GREEN}Convex deploy completed.${NC}"
echo -e "${BLUE}Next steps:${NC}"
echo -e "  - Set env vars: ${YELLOW}npx convex env set --prod CLERK_JWT_ISSUER_DOMAIN ...${NC}"
echo -e "  - Set env vars: ${YELLOW}npx convex env set --prod ADMIN_EMAILS ...${NC}"

