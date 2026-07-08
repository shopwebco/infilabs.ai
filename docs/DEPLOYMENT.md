# DEPLOYMENT.md — Supabase + Vercel

Xenon deploys to **Vercel** with **Supabase** Postgres. Local dev uses a local Postgres cluster; nothing here is faked.

## 1. Supabase (database)

1. Create a project at supabase.com. Note the DB password.
2. Project Settings → Database → Connection string:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`. Append `?pgbouncer=true&connection_limit=1` for serverless runtimes (Vercel).
   - **Direct / Session** (port `5432`) → `DIRECT_URL` (used by Prisma Migrate only).
3. Apply the schema:
   ```bash
   DIRECT_URL="<direct>" DATABASE_URL="<pooled>" npx prisma migrate deploy
   ```
   Migrations live in `prisma/migrations/` and are committed.

## 2. Vercel (app)

1. Import the GitHub repo into Vercel (Framework preset: Next.js — auto-detected; `vercel.json` pins the build command to run `prisma generate`).
2. Add environment variables (Project → Settings → Environment Variables) — see `.env.example` for the full list. Minimum for Phase 0:
   - `DATABASE_URL`, `DIRECT_URL` (from Supabase)
   - `AUTH_SECRET` (`openssl rand -base64 32`)
   - `APP_URL` (your Vercel domain)
3. Deploy. `next build` runs `prisma generate` first (see `package.json` / `vercel.json`).

`trustHost: true` is set in `src/auth.ts`, so Auth.js works on Vercel and any other host.

## 3. Local development

A local Postgres works identically to Supabase (same Postgres engine):

```bash
cp .env.example .env      # then fill DATABASE_URL / DIRECT_URL / AUTH_SECRET
npm install
npx prisma migrate deploy # or `npm run db:migrate` to create new migrations
npm run dev
```

## 4. Verify

- `npm run ci` — lint + typecheck + build + unit/integration tests.
- `PW_SYSTEM_CHROMIUM=1 npx playwright test` — E2E signup / login / logout / gated-redirect flow.
