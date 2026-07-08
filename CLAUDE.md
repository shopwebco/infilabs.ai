# CLAUDE.md — Xenon Project Rules

You are building **Xenon**, a production SaaS platform (AI-native seller/agency platform).
This file is law. Read it at the start of EVERY session, before writing any code.
Also read `MISTAKES.md` at the start of every session — never repeat anything logged there.

---

## RULE 1 — REAL CODE ONLY. NO FAKE ANYTHING.

This is the most important rule in the project. Violations are never acceptable.

**Banned — never do any of these:**
- ❌ Mock data, seed data disguised as live data, hardcoded numbers presented as real metrics
- ❌ Placeholder functions: `// TODO: implement later`, `throw new Error("not implemented")`, empty handlers
- ❌ Fake API responses, stubbed fetches, `setTimeout` pretending to be network calls
- ❌ Simulated integrations ("pretend Stripe", "fake auth", in-memory DB standing in for Postgres)
- ❌ Demo-only features: buttons that don't do anything, forms that don't submit, charts fed invented data
- ❌ `Math.random()` or hardcoded arrays to make dashboards "look alive"
- ❌ Claiming something works without having run it

**Required — always:**
- ✅ Every button, form, and link performs its real function end-to-end (UI → API → DB → response)
- ✅ Real PostgreSQL via Prisma. Real migrations. No in-memory substitutes.
- ✅ Real authentication with hashed credentials / real OAuth. No `if (password === "admin")`.
- ✅ Real Stripe integration. **Stripe TEST MODE is allowed and is not "fake"** — it is Stripe's real API with test keys. Same for Anthropic API with a real key.
- ✅ If a feature depends on an external account we don't have yet (e.g., Amazon SP-API seller credentials), build the REAL integration layer + OAuth flow, and show an honest "Connect your account" empty state. **Never invent marketplace data to fill the gap.**
- ✅ Empty states are honest: "No data yet — connect your store" is correct. A chart of fabricated sales is a violation.

**If you cannot build something real** (missing API key, missing credential, unclear requirement):
**STOP. Ask the user. Do not fake it to keep moving.** Write the question in your response and wait.

---

## RULE 2 — THE MISTAKE LEDGER (learn once, never repeat)

`MISTAKES.md` at the repo root is the permanent memory of this project.

**When any mistake is discovered** — by the user, by a failing test, by a runtime error you caused, or by your own review:

1. Fix it.
2. **Immediately append an entry to `MISTAKES.md`** in this exact format:

```
## M-<number> — <short title>            (date)
- What happened: <one or two sentences>
- Root cause: <the actual reason, not the symptom>
- Fix applied: <what was changed>
- Prevention rule: <a concrete rule you will follow from now on>
```

3. Treat every "Prevention rule" in that file as if it were written in this CLAUDE.md.

**At the start of every session:** read `MISTAKES.md` in full. If you are about to do something that matches a logged mistake, stop and do it the corrected way.
**Repeating a logged mistake is the single worst failure possible in this project.**

---

## RULE 3 — DEFINITION OF DONE

A task is DONE only when ALL of these are true:
1. The code compiles/builds with zero errors (`npm run build` passes).
2. You actually ran it and exercised the feature (or its tests) yourself — not "should work".
3. The happy path AND the obvious failure path work (bad input, unauthorized user, empty data).
4. Database changes have a committed Prisma migration.
5. No console errors in the flow you touched.
6. Lint passes (`npm run lint`).
7. You wrote/updated at least the critical-path test for the feature (see Rule 4).

If any item is not met, the task is NOT done — say so explicitly instead of claiming completion.
Never say "this should work" — say "I ran X and observed Y."

---

## RULE 4 — TESTING

- Use Vitest for unit/integration, Playwright for E2E on critical flows.
- Minimum bar: every API route has at least one test for success and one for auth-rejection.
- Permission boundaries (Rule 5) MUST have tests. A staff user reaching billing data is a security bug.
- Run relevant tests before declaring any task complete.

---

## RULE 5 — SECURITY & PERMISSIONS ARE NOT OPTIONAL

- Every API route enforces authentication AND role authorization server-side. UI hiding is not security.
- RBAC hierarchy (see docs/PRODUCT_SPEC.md §Roles): platform_admin > agency admin > manager > staff; customers and clients are separate scopes.
- Client-portal users can ONLY read their own project's data. Cross-tenant data leakage is a critical failure — log it in MISTAKES.md if it ever occurs.
- All Stripe webhooks verify signatures. All inputs validated with Zod at the API boundary.
- Secrets live in `.env` (gitignored). Maintain `.env.example` with every variable name documented. Never hardcode a key, never commit a secret.

---

## RULE 6 — WORKFLOW

- Work phase by phase per `docs/BUILD_PLAN.md`. Do not start phase N+1 with phase N acceptance criteria unmet.
- Small, focused commits with clear messages (`feat:`, `fix:`, `chore:`, `test:`).
- Before building any feature, re-read its section in `docs/PRODUCT_SPEC.md` and `docs/ARCHITECTURE.md`.
- If the spec is ambiguous, ask — do not invent product decisions silently. If you must make a minor call, state it explicitly in your response.
- Match the visual design system in `reference/` (colors, typography, spacing are extracted in docs/ARCHITECTURE.md §Design tokens). The reference HTML files are DESIGN references only — do not copy their hardcoded demo numbers into the app.

---

## RULE 7 — HONEST COMMUNICATION

- Report what is working, what is not, and what is untested — every time.
- Never inflate progress. "3 of 5 endpoints done, 2 remaining" beats "almost done".
- If you realize earlier work violated Rule 1 (something fake slipped in), flag it yourself, fix it, and log it in MISTAKES.md. Self-caught violations are good; hidden ones are project-ending.

---

## Quick reference

| File | Purpose |
|---|---|
| `CLAUDE.md` | This file — project law |
| `MISTAKES.md` | Mistake ledger — read every session, append on every mistake |
| `docs/PRODUCT_SPEC.md` | What we're building — features, roles, pricing, portals |
| `docs/ARCHITECTURE.md` | Stack, project structure, design tokens, integrations |
| `docs/DATA_MODEL.md` | Full Prisma schema + relationships |
| `docs/BUILD_PLAN.md` | Phases with acceptance criteria — build in order |
| `reference/*.html` | Approved visual design mockups (design only, not data) |
