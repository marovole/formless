#!/bin/bash

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0

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

has_line() {
  local file="$1"
  local key="$2"
  grep -Eq "^[[:space:]]*${key}=" "$file"
}

print_header "Formless Environment Check"

print_section "1. CLI Tools"

if command -v node >/dev/null 2>&1; then
  check_pass "node: $(node --version)"
else
  check_fail "node is not installed (requires Node.js 20+)"
fi

if command -v npm >/dev/null 2>&1; then
  check_pass "npm: $(npm --version)"
else
  check_fail "npm is not installed"
fi

if command -v git >/dev/null 2>&1; then
  check_pass "git: $(git --version)"
else
  check_fail "git is not installed"
fi

if npx convex --help >/dev/null 2>&1; then
  check_pass "convex CLI available via npx"
else
  check_fail "convex CLI not available (run: npm install)"
fi

if command -v wrangler >/dev/null 2>&1; then
  check_pass "wrangler: $(wrangler --version | head -n1)"
else
  check_warn "wrangler not found (Cloudflare deploy will not work)"
fi

print_section "2. Project Files"

for file in package.json convex/schema.ts convex/auth.config.ts docs/guanzhao/guanzhao-bundle.json; do
  if [ -f "$file" ]; then
    check_pass "$file exists"
  else
    check_fail "$file missing"
  fi
done

if [ -d node_modules ]; then
  check_pass "node_modules installed"
else
  check_warn "node_modules missing (run: npm install)"
fi

print_section "3. Next.js Env (.env.local)"

if [ -f ".env.local" ]; then
  check_pass ".env.local exists"

  for key in NEXT_PUBLIC_CONVEX_URL NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY ADMIN_EMAILS CONVEX_ADMIN_TOKEN; do
    if has_line ".env.local" "$key"; then
      check_pass "$key configured"
    else
      check_fail "$key missing"
    fi
  done
else
  check_warn ".env.local not found (copy from .env.example)"
fi

print_section "4. Convex Deployment Env (best-effort)"

if npx convex env get CLERK_JWT_ISSUER_DOMAIN >/dev/null 2>&1; then
  ISSUER="$(npx convex env get CLERK_JWT_ISSUER_DOMAIN 2>/dev/null | tail -n1 || true)"
  if [ -n "${ISSUER:-}" ]; then
    check_pass "CLERK_JWT_ISSUER_DOMAIN set (dev)"
  else
    check_fail "CLERK_JWT_ISSUER_DOMAIN empty (dev)"
  fi
else
  check_warn "Could not read Convex env (run: npx convex dev, then: npx convex env list)"
fi

print_header "Summary"
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${YELLOW}Warnings: ${WARNINGS}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi

exit 0

