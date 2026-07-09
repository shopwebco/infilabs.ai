# MISTAKES.md — Permanent Mistake Ledger

> Read this file in full at the start of every session (required by CLAUDE.md Rule 2).
> Every "Prevention rule" below has the same authority as CLAUDE.md itself.
> Append new entries at the bottom. Never delete entries.

Format for every entry:

```
## M-<number> — <short title>            (YYYY-MM-DD)
- What happened:
- Root cause:
- Fix applied:
- Prevention rule:
```

---

## M-0 — Example entry (template, keep at top)   (2026-07-07)
- What happened: A dashboard chart was rendered with a hardcoded array of numbers to "look complete" before the data API existed.
- Root cause: Prioritized visual completeness over Rule 1 (real code only).
- Fix applied: Removed hardcoded data; chart now queries `/api/metrics` and shows an honest empty state when no marketplace is connected.
- Prevention rule: A UI element may only render data returned by a real API call. If the API doesn't exist yet, build the API first or ship the empty state.

<!-- Append real entries below this line -->

## M-1 — NextAuth v5 threw UntrustedHost / "Configuration" error under `next start`   (2026-07-08)
- What happened: The E2E signup flow redirected to `/api/auth/error` ("There is a problem with the server configuration") when the app ran via `npm run start` outside Vercel.
- Root cause: NextAuth v5 (Auth.js) rejects requests whose Host header it doesn't trust unless `trustHost` is set. Vercel sets this implicitly, so it only surfaces on non-Vercel production servers (local `next start`, CI, tests).
- Fix applied: Added `trustHost: true` to the NextAuth config in `src/auth.ts`.
- Prevention rule: Any Auth.js v5 app that can run outside Vercel (CI, self-host, `next start`) must set `trustHost: true`. Verify auth flows against a production build (`next start`), not just `next dev`.

## M-2 — Playwright `getByRole('alert')` matched Next.js's route announcer   (2026-07-08)
- What happened: An auth-rejection test failed with a strict-mode violation / empty-text timeout even though the error message rendered correctly.
- Root cause: Next.js injects an always-present `<div role="alert" id="__next-route-announcer__">`, so `getByRole('alert')` resolves to two elements — the injected announcer plus the real message.
- Fix applied: Assert on the specific message text (`getByText(/invalid email or password/i)`) plus the expected URL instead of the ambiguous role.
- Prevention rule: In Next.js E2E tests, never select by `role="alert"` alone. Target the specific message text or a `data-testid`; the route announcer will always collide with a bare alert-role query.

## M-3 — `prisma migrate dev` fails in non-interactive shells   (2026-07-08)
- What happened: Creating the Phase 1 migration with `prisma migrate dev` (even `--create-only`) aborted with "environment is non-interactive, which is not supported."
- Root cause: `migrate dev` requires a TTY to prompt (e.g. to confirm a new unique constraint); this agent/CI shell has none.
- Fix applied: Generated the migration SQL with `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script` into a timestamped `prisma/migrations/<ts>_<name>/migration.sql`, then applied it with `prisma migrate deploy`.
- Prevention rule: In any non-interactive environment, never call `prisma migrate dev`. Author migrations via `migrate diff` → migration file → `migrate deploy`. Keep the schema warning (unique constraints on existing data) in mind when writing the SQL.

## M-4 — CI green locally but red in GitHub Actions (env only in gitignored .env)   (2026-07-08)
- What happened: `npm run ci` passed locally but the GitHub `build-test` job failed — `tests/stripe-webhook.test.ts` threw "Neither apiKey nor config.authenticator provided" at `new Stripe(process.env.STRIPE_SECRET_KEY!)`.
- Root cause: The Stripe test fixtures live only in the gitignored `.env` (loaded by vitest locally). CI has no `.env`, so `STRIPE_SECRET_KEY` (and the other Stripe vars) were undefined and the SDK constructor threw at import time.
- Fix applied: Added the non-secret Stripe test placeholders to the `env:` block of `.github/workflows/ci.yml` so CI mirrors local.
- Prevention rule: Whenever a test reads a new env var, add it to BOTH `.env` (local) and the CI workflow `env:` block in the same change. `.env` is gitignored, so CI never inherits it — "passes locally" is not proof CI passes. Prefer verifying with the CI env set, or grep tests for `process.env.` before pushing.

## M-5 — E2E assertion depended on an optional runtime key   (2026-07-09)
- What happened: The agent E2E asserted the "not configured" (503) fail-closed state. It held in CI (no `ANTHROPIC_API_KEY`) but broke locally the moment the real key was added to `.env` and the agent went live.
- Root cause: The test's expected behavior depended on the presence/absence of an optional runtime credential, which differs between local (`.env`) and CI — the inverse of M-4.
- Fix applied: Rewrote the agent E2E to assert only environment-independent behavior (page render, scoped note, chat input, auth-gating). Live streaming is verified separately when a key is present; the 503 fail-closed path stays enforced in the route.
- Prevention rule: E2E/integration assertions must not hinge on whether an optional key is set. Assert behavior that holds in both states, or explicitly gate+skip the test on config. Feature-gated flows need one env-independent test plus a separate, clearly key-dependent one.
