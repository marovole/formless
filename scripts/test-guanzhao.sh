#!/bin/bash

set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Guanzhao / backend sanity checks${NC}\n"

if [ ! -f "docs/guanzhao/guanzhao-bundle.json" ]; then
  echo -e "${YELLOW}Missing docs/guanzhao/guanzhao-bundle.json${NC}"
  exit 1
fi

echo "1) TypeScript type-check"
npm run type-check

echo ""
echo "2) Convex type-check"
npx tsc -p convex/tsconfig.json --noEmit

echo ""
echo "3) Unit tests"
npm run test:run

echo -e "\n${GREEN}OK${NC}"

