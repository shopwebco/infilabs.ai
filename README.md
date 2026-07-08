# Xenon — Claude Code Handoff Package

Everything Claude Code needs to build Xenon for real. No mocks, no demo features.

## How to use this package

1. Create your project repo and copy the contents of this folder into its root:
   - `CLAUDE.md` and `MISTAKES.md` must sit at the repo root (Claude Code reads `CLAUDE.md` automatically).
   - Keep `docs/` and `reference/` as-is.
2. Open Claude Code in the repo and start with:
   > "Read CLAUDE.md, MISTAKES.md, and everything in docs/. Confirm the rules back to me in your own words, list any API keys you need from me for Phase 0–1, then begin Phase 0 of docs/BUILD_PLAN.md."
3. Provide keys when asked (all test-mode keys are fine and count as real integrations):
   - Stripe test keys, Anthropic API key, Resend key (or SMTP), Google OAuth (optional), Amazon LWA (Phase 8).
4. Hold the line: if any output ever contains invented data or a dead button, point at CLAUDE.md Rule 1 and require a MISTAKES.md entry (Rule 2).

## What's inside

| Path | Contents |
|---|---|
| `CLAUDE.md` | Project law: real-code-only rules, mistake-ledger protocol, definition of done, security bar |
| `MISTAKES.md` | The permanent mistake ledger (template + example entry) |
| `docs/PRODUCT_SPEC.md` | Full product spec: roles/permission matrix, 4 pricing tiers, agency portal, white-label, Stripe Connect, agent behavior |
| `docs/ARCHITECTURE.md` | Fixed tech stack, project structure, multi-tenancy, RBAC, Stripe flows, design tokens, env vars |
| `docs/DATA_MODEL.md` | Complete Prisma schema + invariants that must be tested |
| `docs/BUILD_PLAN.md` | Phases 0–9 with hard acceptance criteria |
| `reference/*.html` | Approved visual mockups (landing, agency portal, all 6 role portals) — design reference ONLY; their numbers are demo values and must never be copied into the app |

## The two enforcement mechanisms (why this works)

**No fake code:** CLAUDE.md Rule 1 bans mocks, stubs, placeholder handlers, and invented data outright, defines what "real" means (test-mode Stripe/Anthropic = real; fabricated marketplace numbers = never), and instructs Claude Code to STOP AND ASK when something can't be built real. BUILD_PLAN acceptance criteria and DATA_MODEL invariants make it verifiable.

**Learn from mistakes:** MISTAKES.md is append-only memory. Every mistake gets a root cause + a concrete prevention rule; Claude Code must re-read the ledger at every session start and treat prevention rules as law. Repeating a logged mistake is defined as the worst possible failure.
