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
