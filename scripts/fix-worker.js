#!/usr/bin/env node
/**
 * Fix Cloudflare Pages Worker to serve static assets from _next/static
 *
 * This script modifies .open-next/_worker.js to handle static asset requests.
 * It's needed because @opennextjs/cloudflare doesn't include this handling by default.
 */

const fs = require('fs');
const path = require('path');

const workerPath = path.join(__dirname, '../.open-next/_worker.js');

if (!fs.existsSync(workerPath)) {
  console.error('❌ Worker file not found:', workerPath);
  process.exit(1);
}

let content = fs.readFileSync(workerPath, 'utf-8');

// Check if the fix is already applied
if (content.includes('// Serve static assets from _next/static')) {
  console.log('✅ Worker already fixed');
  process.exit(0);
}

// Find the location to insert the static assets handler
const imageHandlerPattern =
  /(\/\/ Fallback for the Next default image loader\.\s+if \(url\.pathname ===\s+`\$\{globalThis\.__NEXT_BASE_PATH__\}\/_next\/image\$\{globalThis\.__TRAILING_SLASH__ \? "\/" : ""\}`\) \{\s+return await handleImageRequest\(url, request\.headers, env\);\s+\})/;

const replacement = `            // Serve static assets from _next/static
            if (url.pathname.startsWith("/_next/static/")) {
                return env.ASSETS?.fetch(request) || new Response("Not Found", { status: 404 });
            }
            $1`;

if (!imageHandlerPattern.test(content)) {
  console.error('❌ Could not find the image handler in worker.js');
  process.exit(1);
}

content = content.replace(imageHandlerPattern, replacement);

fs.writeFileSync(workerPath, content, 'utf-8');

console.log('✅ Worker fixed successfully');
