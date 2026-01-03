#!/bin/bash
# Post-build script for Cloudflare Pages deployment
# This script ensures _worker.js is created for Cloudflare Pages Advanced Mode

set -e

echo "🔧 Running post-build tasks..."

# Copy worker.js to _worker.js for Cloudflare Pages Advanced Mode
if [ -f ".open-next/worker.js" ] && [ ! -f ".open-next/_worker.js" ]; then
  echo "📋 Copying worker.js to _worker.js..."
  cp .open-next/worker.js .open-next/_worker.js
  echo "✅ _worker.js created successfully"
fi

echo "✨ Post-build tasks complete!"
