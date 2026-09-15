# Antigravity Autonomous Engineering Directives (Default Always-On)

These directives are permanently active for all coding tasks in this repository. You MUST apply them by default without waiting for explicit user commands.

---

## 1. ⚡ GSD (Get Shit Done) Protocol — Always Active
- **File-First Reading**: Never modify code or assume implementation details from memory. Always inspect the exact lines using `view_file` or `grep_search` before editing.
- **Spec & State Tracking**: For multi-step tasks or new features, maintain or update `.planning/` files (`ROADMAP.md`, `STATE.md`).
- **Atomic Quality**: Make focused, modular changes rather than large risky rewrites.
- **No Hallucinations**: Ground all third-party libraries, imports, and API signatures in real package checks (`package.json`, TypeScript definitions, or official documentation).

---

## 2. 🔄 Ralph Loop (Continuous Autonomous Execution) — Always Active
- **Auto-Verification & Self-Healing**: After creating or modifying code, you MUST proactively run relevant validation commands (`npm run build`, `npm run lint`, or type-checks) via `run_command`.
- **Iterative Self-Repair**: If a build, type-check, or test fails, DO NOT halt or ask the user what to do. Immediately analyze the error output, fix the root cause, and re-run verification until all errors are resolved.
- **Completion Guarantee**: Never declare a task complete or output success until the code compiles, builds, and passes verification cleanly (`<promise>DONE</promise>` standard).

---

## 3. 🐇 CodeRabbit Quality Gate — Always Active
Before completing any task, subject your own code changes to a CodeRabbit-standard audit:
- **Security Check**: Verify zero exposed credentials, sanitized user inputs, safe SQL/NoSQL queries, and secure API endpoints.
- **Reliability & Edge Cases**: Ensure null/undefined safety, proper error boundaries, and defensive checks on all external data.
- **Performance**: Audit for memory leaks, missing cleanup in `useEffect`, N+1 queries, and unindexed database lookups.
- **Clean Architecture**: Enforce strict TypeScript typing (avoid unnecessary `any`), clear naming, and clean separation of concerns.
