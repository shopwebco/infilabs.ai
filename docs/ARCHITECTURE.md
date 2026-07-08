# ARCHITECTURE.md — Xenon

## 1. Stack (fixed — do not substitute without user approval)

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15+ (App Router, TypeScript strict) | Single app serves marketing site, app, portals, API |
| Database | PostgreSQL | Local via Docker for dev; Prisma ORM + migrations |
| Auth | Auth.js (NextAuth v5) | Credentials (argon2/bcrypt hash) + Google OAuth; separate magic-link flow for client-portal users |
| Payments | Stripe (platform subscriptions) + Stripe Connect Standard (agency billing) | Test mode keys in dev — real API, allowed |
| AI | Anthropic API (`claude-sonnet-4-6` default; make model an env var) | Server-side only |
| Jobs/schedules | Node cron in a worker route or Vercel Cron (briefings, syncs) | Must be real scheduled execution |
| Validation | Zod at every API boundary | |
| Tests | Vitest (unit/integration) + Playwright (E2E critical flows) | |
| Styling | Tailwind CSS with the token set below | |
| Email | Resend (or SMTP via env) | Magic links, briefings, invoices — real sends in dev via test inbox |

## 2. Project structure

```
/src
  /app
    /(marketing)            # landing pages (adapt reference/xenon-landing.html)
    /(app)                  # authenticated seller + agency workspace
      /dashboard            # customer (self-serve) home
      /agency               # workspace: clients, team, approvals, billing, white-label
      /admin                # platform_admin (Xenon HQ)
    /portal/[tenant]        # white-label client portal (also resolved by custom domain middleware)
    /api                    # route handlers (all Zod-validated, all auth-guarded)
  /lib
    /auth                   # session, RBAC guards: requireRole(), requireClientScope()
    /agent                  # Anthropic client, scoped-context builder, action logger
    /stripe                 # platform billing + connect helpers, webhook verification
    /integrations
      /amazon               # SP-API OAuth + sync (real; feature-gated until connected)
    /db                     # prisma client singleton
  /components               # UI kit built from design tokens
/prisma
  schema.prisma             # see DATA_MODEL.md
/tests                      # vitest + playwright
CLAUDE.md  MISTAKES.md  .env.example
```

## 3. Multi-tenancy & white-label resolution
- Middleware inspects `Host`: app domains → normal routing; unknown domains → look up `WhiteLabelSettings.customDomain` → rewrite to `/portal/[tenant]`.
- Every DB query in agency/portal contexts is filtered by `workspaceId` / `clientProjectId` derived from the **session**, never from client-supplied IDs alone.
- Tenant isolation is test-covered (see BUILD_PLAN acceptance criteria).

## 4. RBAC implementation
- `requireUser()` → session or 401.
- `requireRole(workspaceId, minRole)` → membership lookup or 403.
- `requireClientScope(projectId)` → for client-portal sessions, token's projectId must equal requested projectId or 403.
- Client-visible publishing: only rows with `status = APPROVED` are ever returned to portal queries — enforced in the query layer, not the UI.

## 5. Agent design
```
user msg → buildScopedContext(session)        # only data this role may see
        → anthropic.messages.create(...)      # server-side, streaming
        → if tool proposes an action → create Approval(status=PENDING)
        → log AgentAction(kind, payload, actor='agent', projectId/accountId)
```
- Query metering for Starter (25/mo): counted in `AgentUsage`, enforced server-side.
- The agent NEVER fabricates marketplace numbers. If the project has no connected integration, it answers from what exists and says what's missing.

## 6. Stripe flows
- **Platform**: Checkout for Pro/Agency; Agency subscription has a quantity item for extra client projects, updated on project create/archive. Webhooks: `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.paid` — signature-verified, idempotent.
- **Connect**: agency onboarding via Account Links (Standard). Invoices/retainers created **on the connected account** (`Stripe-Account` header). Portal "Pay invoice" → Stripe-hosted invoice page. Optional `application_fee_percent` behind a config flag.

## 7. Design tokens (extracted from reference/)
```css
--bg:#050810;  --panel:rgba(16,23,42,.7);  --line:rgba(125,211,252,.13);
--ice:#67E8F9; --ice-dim:#38BDF8; --violet:#8B5CF6; --violet-soft:#A78BFA;
--text:#E8ECF4; --muted:#8A94A8; --faint:#5B6478;
--green:#4ADE80; --amber:#FBBF24; --red:#F87171;
font-display:'Space Grotesk'; font-body:'Inter'; font-data:'JetBrains Mono';
radius: 14–20px; glass: backdrop-blur + 1px --line border;
CTA gradient: linear-gradient(135deg,var(--ice-dim),var(--violet));
```
White-label portals: accent + logo + brand name come from `WhiteLabelSettings` at runtime.

## 8. Environment (.env.example must list all of these with comments)
```
DATABASE_URL=
AUTH_SECRET=
GOOGLE_CLIENT_ID= / GOOGLE_CLIENT_SECRET=          # optional OAuth
STRIPE_SECRET_KEY= / STRIPE_WEBHOOK_SECRET= / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
RESEND_API_KEY= / EMAIL_FROM=
APP_URL=
AMAZON_LWA_CLIENT_ID= / AMAZON_LWA_CLIENT_SECRET=  # phase 8; feature-gated if absent
PLATFORM_FEE_PERCENT=0
```
Missing key at runtime → clear startup/feature-gate error, never a silent fake fallback.
