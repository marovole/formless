#!/bin/bash
set -e

echo "🔧 Running post-build tasks..."

if [ -f ".open-next/worker.js" ] && [ ! -f ".open-next/_worker.js" ]; then
  echo "📋 Copying worker.js to _worker.js..."
  cp .open-next/worker.js .open-next/_worker.js
  echo "✅ _worker.js created successfully"
fi

if [ -d ".open-next/assets/_next" ]; then
  echo "📋 Moving assets to root for Cloudflare Pages..."
  cp -r .open-next/assets/* .open-next/
  echo "✅ Assets moved to root"
fi

if [ ! -f ".open-next/_routes.json" ]; then
  echo "📋 Creating _routes.json..."
  cat > .open-next/_routes.json << 'EOF'
{
  "version": 1,
  "include": ["/*"],
  "exclude": ["/_next/*", "/favicon.ico", "/*.svg", "/BUILD_ID"]
}
EOF
  echo "✅ _routes.json created"
fi

echo "✨ Post-build tasks complete!"
