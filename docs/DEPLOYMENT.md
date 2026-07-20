# DEPLOYMENT.md — Supabase + Vercel go-live runbook

All 10 build phases (0–9) are implemented. This is the runbook to take the
deployed app live: what already exists, which env vars to set, and the live
verification to run as each credential lands. Nothing below is optional
decoration — each unchecked item is a real gap until done.

## Current state

- **Supabase** — project `supabase-infilabs-ai` (`puclyzxitwrddaforjrs`,
  us-east-1) carries the full schema: all 5 Prisma migrations applied, with
  `_prisma_migrations` bookkeeping seeded so `prisma migrate deploy`
  reconciles cleanly. Zero rows of data yet.
- **Vercel** — repo connected; previews build and deploy per PR
  (`vercel.json` runs `prisma generate && next build`; daily briefings cron
  is configured at 13:00 UTC).
- **CI** — `.github/workflows/ci.yml`: lint + typecheck + build + tests
  against a Postgres service.

## 1. Harden Supabase (one paste, do first)

Run `supabase/rls-default-deny.sql` in the Supabase SQL editor (or ask Claude
to apply it via the Supabase MCP). It enables default-deny RLS on every table:
Supabase's anon-key REST API gets blocked; Prisma (connecting as the table
owner `postgres`) is unaffected. The file documents verification and revert.

## 2. Vercel environment variables

Project → Settings → Environment Variables. The Vercel↔Supabase integration
injects `POSTGRES_*` names — Xenon reads the names below, so add these
explicitly (values from Supabase → Settings → Database → Connection string):

| Variable | Value / note |
|---|---|
| `DATABASE_URL` | Pooled ("Transaction") string, port **6543**, append `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Direct/session string, port **5432** (Prisma Migrate only) |
| `AUTH_SECRET` | `openssl rand -base64 32` — also signs portal sessions + OAuth state + token encryption key |
| `APP_URL` | The production domain (no trailing slash) |
| `CRON_SECRET` | Random string; Vercel Cron sends it as `Authorization: Bearer` |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Agent + proposal generator (model default `claude-sonnet-4-6`) |
| `RESEND_API_KEY` / `EMAIL_FROM` | Live magic-link + branded emails (until set: honest dev-link fallback) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Platform billing (Phase 1) |
| `STRIPE_PRICE_PRO` / `STRIPE_PRICE_AGENCY` / `STRIPE_PRICE_AGENCY_CLIENT` | Price IDs from the Stripe dashboard (test mode is real) |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Second webhook endpoint, "connected accounts" mode (Phase 5) |
| `AMAZON_LWA_CLIENT_ID` / `AMAZON_LWA_CLIENT_SECRET` / `AMAZON_SP_APP_ID` | Phase 8 (feature-gated until set) |
| `AMAZON_SP_ENDPOINT` / `AMAZON_MARKETPLACE_IDS` | Defaults: NA endpoint, US marketplace |
| `PLATFORM_FEE_PERCENT` | Optional Connect application fee (default 0) |

Full commented reference: `.env.example`.

## 3. Stripe setup (test mode — counts as real)

1. Create products/prices: Pro $49/mo → `STRIPE_PRICE_PRO`; Agency $199/mo →
   `STRIPE_PRICE_AGENCY`; Extra client $25/mo → `STRIPE_PRICE_AGENCY_CLIENT`.
2. Webhook endpoint #1 (platform): `https://<domain>/api/stripe/webhook`,
   events `checkout.session.completed`, `customer.subscription.created/
   updated/deleted`, `invoice.paid` → secret into `STRIPE_WEBHOOK_SECRET`.
3. Webhook endpoint #2 (**listen to connected accounts**):
   `https://<domain>/api/stripe/connect-webhook`, events `invoice.*`,
   `account.updated` → secret into `STRIPE_CONNECT_WEBHOOK_SECRET`.

**Live verification once keys are set** (the deferred acceptance runs):
- Phase 1: test-mode card upgrades a user to Pro; webhook persists it;
  cancel downgrades; Starter blocked at the 26th agent query.
- Phase 5: agency completes Connect onboarding → invoices a client → client
  pays from the portal → webhook marks it PAID on the connected account;
  creating a 6th client project bumps the subscription quantity item.

## 4. Amazon SP-API (Phase 8)

Register the SP-API app in Seller Central → set `AMAZON_LWA_CLIENT_ID`,
`AMAZON_LWA_CLIENT_SECRET`, `AMAZON_SP_APP_ID`; add
`https://<domain>/api/integrations/amazon/callback` as the app's OAuth
redirect. Until then every surface shows the honest gated Connect state.
Live verification: connect a (sandbox) seller from `/dashboard/integrations`,
run "Sync now", confirm real order rows land in `MarketplaceOrder`.

## 5. Email (Resend)

Set `RESEND_API_KEY` + `EMAIL_FROM` (verify the domain in Resend). Magic-link
portal logins and briefing emails then send for real; the dev-link fallback
disappears automatically. Agencies' `emailFrom` white-label identities require
their domains verified in Resend too.

## 6. Local development

```bash
cp .env.example .env      # fill DATABASE_URL / DIRECT_URL / AUTH_SECRET (+ test keys)
npm install
npx prisma migrate deploy
npm run dev
```

Full gate: `npm run ci` · E2E: `PW_SYSTEM_CHROMIUM=1 npx playwright test`.
In non-interactive shells author migrations via
`prisma migrate diff → migration.sql → prisma migrate deploy` (MISTAKES.md M-3),
and mirror any new env var into `.env` **and** the CI workflow (M-4).
