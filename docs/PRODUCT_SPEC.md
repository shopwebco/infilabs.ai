# PRODUCT_SPEC.md — Xenon

## 1. What Xenon is

Xenon is an AI-native platform for marketplace sellers (Amazon, Walmart, TikTok Shop, Shopify) and the agencies that serve them. Instead of 30 separate tools (the Helium 10 model), users interact with one AI agent that researches, monitors, optimizes, and acts — with humans approving decisions.

Two customer types:
1. **Self-serve sellers** (Starter / Pro / Enterprise plans)
2. **Agencies** (Agency plan) who manage many client projects, white-label the product, and bill clients through their own Stripe account.

## 2. Roles & permission matrix (authoritative)

| Capability | platform_admin | agency:admin | agency:manager | agency:staff | customer | client |
|---|---|---|---|---|---|---|
| See all platform accounts, MRR, plans | ✓ | — | — | — | — | — |
| Approve agency directory listings | ✓ | — | — | — | — | — |
| Manage agency billing / Stripe Connect | — | ✓ | — | — | — | — |
| Manage white-label settings | — | ✓ | — | — | — | — |
| Invite team members / set roles | — | ✓ | — | — | — | — |
| See ALL clients in workspace | — | ✓ | — | — | — | — |
| See ASSIGNED clients only | — | ✓ | ✓ | ✓ (task scope) | — | — |
| Approve agent/staff output before publish | — | ✓ | ✓ | — | — | — |
| Assign tasks to staff | — | ✓ | ✓ | — | — | — |
| Run research / draft content (goes to review) | — | ✓ | ✓ | ✓ | — | — |
| Publish work live | — | ✓ | ✓ | — | ✓ (own account) | — |
| Own seller dashboard, agent, playbooks | — | — | — | — | ✓ | — |
| View own project results, briefings, work log | — | — | — | — | ✓ | ✓ |
| Approve/decline proposals (restock, ads, etc.) | — | — | — | — | ✓ | ✓ |
| Ask agent about own data (read-only scope) | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| See Xenon branding | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ (white-labeled) |

Hard rules:
- All checks enforced **server-side** on every route.
- `client` users authenticate via **magic link** (passwordless), scoped to exactly one client project.
- `staff` output is always saved as `draft` and requires `manager`+ approval to publish or become client-visible.

## 3. Plans & pricing

| Plan | Price | Limits / features |
|---|---|---|
| **Starter** | $0/mo | 25 agent queries/mo, 1 marketplace, product+keyword research, profit dashboard, weekly briefing |
| **Pro** | $49/mo ($39 annual) | Unlimited agent, autonomous PPC + playbooks, all marketplaces, daily briefing, predictive engine |
| **Agency** | $199/mo base | Everything in Pro per client. 5 client projects included, +$25/mo per additional client. Unlimited client-portal viewers (never charge per viewer). White-label + custom domain. Stripe Connect billing. Proposal generator. Directory listing. Referral program (20–30% recurring). |
| **Enterprise** | Custom | Everything + SSO, audit log export, SLA, API, dedicated CSM |

Billing implementation: Stripe subscriptions (platform-level). Agency per-client overage = metered/quantity-based subscription item updated when client projects are created/archived.

## 4. Core features (all real — see CLAUDE.md Rule 1)

### 4.1 AI Agent
- Chat interface backed by the Anthropic API (Claude). Server-side calls only; key never reaches the browser.
- Agent context is scoped to the requesting user's permitted data (their account, or assigned clients, or — for client users — their single project).
- Agent actions that change anything (bids, prices, POs) create an `Approval` record; nothing executes without human approval in v1.
- Every agent action is written to `AgentAction` (the audit log) and surfaces in briefings and client work logs.

### 4.2 Briefings
- Daily (Pro+) / weekly (Starter) digest per account or client project: what happened, what the agent did, what needs a decision. Generated server-side by a scheduled job; delivered in-app + email.

### 4.3 Agency workspace
- Agency = a `Workspace` with `Membership` rows (role: admin/manager/staff, plus per-member client assignments).
- Client project = isolated container: connected marketplace accounts, data, playbooks, approvals, work log, portal users.
- Review queue: staff drafts + agent proposals → manager/admin approve → publish or send to client portal.

### 4.4 Client portal (white-label)
- Magic-link login (email → signed one-time token → session). No passwords.
- Client sees: KPI snapshot, approvals queue (approve/decline), "what your agency did" log, scoped ask-the-agent, live report page, invoices (pay via agency's Stripe).
- White-label: agency logo, brand color, "from" email identity, custom domain (`portal.agency.com` via CNAME + host-based tenant resolution). Xenon branding hidden.

### 4.5 Agency billing — Stripe Connect
- Agencies onboard with **Stripe Connect (Standard)**. Funds flow directly to the agency's Stripe account; Xenon never holds agency funds.
- Agencies can create one-off invoices and recurring retainers for client projects; clients pay from the portal.
- Optional platform application fee (config flag, default 0–2%).

### 4.6 Proposal generator
- Input: prospect store URL / ASIN list → agent produces a branded audit page (shareable link) the agency uses for sales.

### 4.7 Referrals & directory
- Every agency gets a referral code/link; conversions attribute 20–30% recurring commission (ledger table; payouts manual in v1, listed in platform admin).
- Public "Certified agencies" directory; platform admin approves listings.

### 4.8 Marketplace integrations
- Amazon SP-API first (OAuth via Login with Amazon), then Walmart, TikTok Shop, Shopify.
- REAL OAuth + data sync only. Until a user connects an account, all data surfaces show honest "Connect your store" empty states. **Never fabricate marketplace data** (CLAUDE.md Rule 1).

### 4.9 Platform admin (Xenon HQ)
- Accounts overview, MRR, plan distribution, agency approvals, referral payout ledger, feature flags.

## 5. Non-goals for v1
- Autonomous execution without approval (v2)
- Playbook marketplace (v2)
- Mobile apps (v2)
- Walmart/TikTok/Shopify sync (build the integration abstraction now; ship Amazon first)

## 6. Design system
The approved look is in `reference/*.html`. Dark theme, Space Grotesk display + Inter body + JetBrains Mono for data, ice-blue (#67E8F9) and violet (#8B5CF6) accents, glassmorphism panels. White-label portals swap accent + logo + domain per agency. Tokens are extracted in ARCHITECTURE.md — reference files are for DESIGN only; their numbers are demo values and must never appear in the app.
