---
description: Start an autonomous, continuous execution loop (Ralph Wiggum pattern) that iterates until all tasks pass verification
---

# Ralph Loop — Continuous Autonomous Task Execution

Initiate an autonomous loop that iteratively executes tasks, runs build/test verification, commits progress to Git, and continues until all tasks are completed.

## Loop Lifecycle

1. **State File Initialization**:
   - Create or read `.planning/ralph-loop.local.md`
   - Store objective, iteration counter, and max iterations (default: 50).

2. **Iterative Cycle**:
   - **Step A: Plan & Pick Task**: Select the next incomplete task from `ROADMAP.md` or `.planning/ralph-loop.local.md`.
   - **Step B: Execute**: Implement changes surgically.
   - **Step C: Test & Verify**: Run `npm run build`, `npm run lint`, and tests.
   - **Step D: Atomic Commit**: Commit changes with clear message (`feat(...)`, `fix(...)`).
   - **Step E: Evaluate Completion**:
     - If all tasks are completed and verified: output `<promise>DONE</promise>` and delete `.planning/ralph-loop.local.md`.
     - If tasks remain: increment iteration counter and auto-advance to next step.

## Completion Contract
Only output `<promise>DONE</promise>` when 100% of tasks are verified and working.
