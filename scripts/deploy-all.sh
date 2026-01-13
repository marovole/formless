#!/bin/bash

set -euo pipefail

SKIP_BACKEND=false
SKIP_FRONTEND=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-backend)
      SKIP_BACKEND=true
      shift
      ;;
    --skip-frontend)
      SKIP_FRONTEND=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./scripts/deploy-all.sh [--skip-backend] [--skip-frontend]"
      exit 1
      ;;
  esac
done

echo "Running environment checks..."
./scripts/check-env.sh || true

if [ "$SKIP_BACKEND" = false ]; then
  ./scripts/deploy-db.sh
else
  echo "Skipping Convex deploy."
fi

if [ "$SKIP_FRONTEND" = false ]; then
  ./scripts/deploy-functions.sh
else
  echo "Skipping Cloudflare Pages deploy."
fi

echo "Done."

