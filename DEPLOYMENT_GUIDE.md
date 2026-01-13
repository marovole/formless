# Formless Deployment Guide

This repository deploys as:

- **Frontend**: Next.js → Cloudflare Pages (via OpenNext)
- **Backend/DB**: Convex
- **Auth**: Clerk

## 1) Clerk Setup

1. Create a Clerk application.
2. Configure sign-in / sign-up URLs (optional but recommended):
   - Sign-in: `/sign-in`
   - Sign-up: `/sign-up`
   - After sign-in: `/chat`
3. Create a JWT template named `convex`:
   - `applicationID` / `aud`: `convex`
   - Include an `email` claim

## 2) Convex Setup

### Dev

```bash
npx convex dev
```

Set Convex env vars:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-clerk-issuer-domain.clerk.accounts.dev
npx convex env set ADMIN_EMAILS admin@example.com
```

### Production

```bash
npx convex deploy
```

Set prod env vars:

```bash
npx convex env set --prod CLERK_JWT_ISSUER_DOMAIN https://your-clerk-issuer-domain.clerk.accounts.dev
npx convex env set --prod ADMIN_EMAILS admin@example.com
```

Get:

- `NEXT_PUBLIC_CONVEX_URL` (used by the Next.js app)
- `CONVEX_ADMIN_TOKEN` (server-only, used by `/api/chat` to call `internal.*`)

## 3) Cloudflare Pages Setup

Build + deploy:

```bash
npm run deploy
```

Configure Cloudflare Pages environment variables:

```bash
NEXT_PUBLIC_CONVEX_URL=https://your-convex-project.convex.cloud
CONVEX_ADMIN_TOKEN=your_convex_admin_token_here

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here

ADMIN_EMAILS=admin@example.com
```

Notes:

- Do not expose `CONVEX_ADMIN_TOKEN` to the client.
- `ADMIN_EMAILS` must match Convex's `ADMIN_EMAILS`.

## 4) Post-Deploy Bootstrap

1. Sign in with an allowlisted email.
2. Visit `/admin` and create:
   - API keys (`chutes`, `openrouter`)
   - Prompts (at least one active prompt for role `formless_elder` + locale)

## 5) Smoke Checks

```bash
npm run type-check
npm run test:run
```

