# BUILD_PLAN.md — Xenon

Build strictly in order. A phase is complete only when every acceptance criterion passes
per CLAUDE.md Rule 3 (run it, test it, honest report). Do not start the next phase early.

---

## Phase 0 — Foundation
Scaffold Next.js 15 (TS strict) + Tailwind with design tokens, Prisma + Postgres (Docker compose for dev), Auth.js with credentials (argon2) + session, base layout using the design system, `.env.example`, Vitest + Playwright wired, CI script (`lint && build && test`).

**Accept when:** `docker compose up` + `npm run dev` gives a working signup/login/logout with real hashed users in Postgres; `npm run build`, `lint`, and a passing auth test all green; no page contains placeholder data.

## Phase 1 — Plans & platform billing (Stripe)
Plan model on User, Stripe Checkout for Pro upgrade, customer portal for cancel/downgrade, webhook handler (signature-verified, idempotent), plan gates (`requirePlan`), Starter agent-query metering table.

**Accept when:** a test-mode card upgrades a real user to Pro and the webhook persists it; canceling downgrades; a Starter user is blocked server-side at the 26th agent query; webhook tests pass.

## Phase 2 — AI agent (scoped, real)
Anthropic API server route with streaming chat UI, `buildScopedContext()`, `AgentAction` logging, usage metering, honest empty-data behavior (no integration connected → agent says so).

**Accept when:** real conversations stream from the Anthropic API; usage increments in DB; the agent never outputs invented account metrics (verified by prompt design + a test asserting the context builder only includes DB-derived data).

## Phase 3 — Agency workspace, team & RBAC
Workspace creation on Agency plan, Membership roles, invites (email), ClientProject CRUD (archived flag), ClientAssignment, `requireRole`/assignment guards on every agency route, review queue (WorkItem DRAFT → IN_REVIEW → APPROVED), staff cannot publish.

**Accept when:** Playwright proves: staff sees only assigned clients and cannot publish; manager approves staff draft; admin sees all; API returns 403 (not just hidden UI) on every violation. Tenant-isolation tests pass.

## Phase 4 — Client portal + magic link + approvals
ClientPortalUser + magic-link auth (hashed, single-use, 15-min expiry), portal at `/portal/[tenant]` showing only APPROVED/PUBLISHED items, Approval approve/decline round-trip notifying the agency, work log fed by AgentAction.

**Accept when:** a real email (test inbox) logs a client in; client A can never fetch client B's data (test); approving in the portal flips the Approval row and appears in the agency review views.

## Phase 5 — Stripe Connect agency billing
Connect Standard onboarding (Account Links), gate billing features on `connectOnboarded`, create one-off invoices + recurring retainers on the connected account, portal "Pay invoice" via Stripe-hosted page, ClientInvoice mirror via connected-account webhooks, per-client subscription quantity sync on project create/archive.

**Accept when:** in test mode, an agency onboards, invoices a client, the client pays, status becomes PAID via webhook, and funds show on the connected account; adding a 6th client project updates the platform subscription quantity.

## Phase 6 — White-label
WhiteLabelSettings CRUD (admin only), runtime theming (accent, logo, brand name, emailFrom) across portal + emails, custom-domain middleware (Host → tenant), Xenon branding hidden when `hideXenon`.

**Accept when:** two different agencies' portals render distinct brands from DB values; a mapped custom host (tested via local hosts entry / header override in Playwright) resolves to the right tenant; client-facing emails carry agency branding.

## Phase 7 — Briefings & value ledger
Scheduled job generating daily (Pro/Agency) and weekly (Starter) briefings from real AgentAction + Approval data; in-app briefing page + email; per-client "value recovered" rollups from `valueImpactCents`.

**Accept when:** triggering the cron generates a briefing containing only rows that exist in the DB; empty periods produce an honest "quiet period" briefing, never filler numbers.

## Phase 8 — Amazon SP-API integration
Login-with-Amazon OAuth, encrypted token storage + refresh, initial sync jobs (orders, listings, fees where scopes allow), metrics endpoints reading synced data, connect/empty states everywhere until connected. Feature-gated cleanly if LWA env keys are absent.

**Accept when:** with real LWA credentials (user-provided; ASK if missing — do not fake), a sandbox/live seller account connects and synced rows appear in Postgres and dashboards. Without credentials, the app builds and shows gated "Connect" states with zero fabricated data.

## Phase 9 — Proposal generator, referrals, directory, platform admin
Agent-built branded audit pages (shareable, from live inputs + any public data actually fetched), referral codes + ReferralConversion ledger, public certified-agency directory with platform-admin approval, platform admin dashboard (accounts, MRR from Stripe, plan distribution, payout ledger).

**Accept when:** MRR figures on the admin dashboard reconcile with Stripe test data; a referral signup attributes to the right agency; directory listing requires admin approval; proposal pages contain no invented metrics.

---

## Standing reminders for every phase
- Read `CLAUDE.md` + `MISTAKES.md` at session start.
- Real code only; ask instead of faking (Rule 1).
- Log every mistake with a prevention rule (Rule 2).
- Server-side authz on every route; permission tests are part of "done".
- Honest progress reports at the end of each work session.
