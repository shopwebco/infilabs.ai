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
