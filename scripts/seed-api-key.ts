#!/usr/bin/env npx tsx
import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const ADMIN_TOKEN = process.env.CONVEX_ADMIN_TOKEN;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

if (!CONVEX_URL) {
  console.error("❌ NEXT_PUBLIC_CONVEX_URL is not set");
  process.exit(1);
}

if (!ADMIN_TOKEN) {
  console.error("❌ CONVEX_ADMIN_TOKEN is not set");
  process.exit(1);
}

if (!OPENROUTER_KEY) {
  console.error("❌ OPENROUTER_API_KEY is not set");
  console.error("   Usage: OPENROUTER_API_KEY=sk-or-... npx tsx scripts/seed-api-key.ts");
  process.exit(1);
}

async function main() {
  const client = new ConvexHttpClient(CONVEX_URL!);
  client.setAuth(ADMIN_TOKEN!);

  console.log("🔄 Seeding OpenRouter API key...");

  try {
    const result = await (client as any).mutation(
      "api_keys:seedApiKeyInternal",
      {
        provider: "openrouter",
        api_key: OPENROUTER_KEY,
        daily_limit: 1000,
        priority: 1,
        is_active: true,
      }
    );

    console.log(`✅ API key ${result.action}: ${result.id}`);
    console.log("🎉 Done! You can now use the chat.");
  } catch (error) {
    console.error("❌ Failed to seed API key:", error);
    process.exit(1);
  }
}

main();
