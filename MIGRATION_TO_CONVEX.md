# Supabase → Convex + Clerk Migration (Completed)

This project has migrated to:

- **Auth**: Clerk
- **Backend/DB**: Convex (schema + functions)
- **Frontend**: Next.js (App Router)

Supabase has been removed from the runtime architecture.

## What Changed

- Removed Supabase client, SQL migrations, and Edge Functions.
- Moved business logic and persistence to Convex (`convex/*`).
- Standardized authentication via Clerk JWTs in Convex (`convex/auth.config.ts`).
- Admin is now Clerk-authenticated + email allowlist (`ADMIN_EMAILS`).

## Required Manual Setup

### 1) Convex

Start a dev deployment:

```bash
npx convex dev
```

Deploy to production:

```bash
npx convex deploy
```

Set Convex environment variables (dev):

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-clerk-issuer-domain.clerk.accounts.dev
npx convex env set ADMIN_EMAILS admin@example.com
```

Set Convex environment variables (prod):

```bash
npx convex env set --prod CLERK_JWT_ISSUER_DOMAIN https://your-clerk-issuer-domain.clerk.accounts.dev
npx convex env set --prod ADMIN_EMAILS admin@example.com
```

### 2) Clerk

- Create a Clerk application.
- Create a JWT template named `convex`:
  - `applicationID` / `aud` should be `convex` (must match `convex/auth.config.ts`).
  - Include an `email` claim (required by `api.users.ensureCurrent`).

### 3) Next.js / Cloudflare Pages

Copy `.env.example` to `.env.local` and set at least:

```bash
NEXT_PUBLIC_CONVEX_URL=https://your-convex-project.convex.cloud
CONVEX_ADMIN_TOKEN=your_convex_admin_token_here

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here

ADMIN_EMAILS=admin@example.com
```

Notes:

- `CONVEX_ADMIN_TOKEN` is **server-only** and used to call Convex `internal.*` functions from `/api/chat`.
- `ADMIN_EMAILS` must be set in **both** Next.js and Convex.

### 4) Bootstrap Data

After signing in with an allowlisted email, visit `/admin` to:

- Create API keys (`chutes`, `openrouter`).
- Create at least one active prompt for role `formless_elder` in `zh` (and optionally `en`).

## Verification

```bash
npm run type-check
npm run test:run
```

