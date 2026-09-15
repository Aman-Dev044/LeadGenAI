---
trigger: always_on
description: Always enforce GSD planning, Ralph autonomous iteration, and CodeRabbit quality gates on all code generation.
---

# Always-On Triad: GSD + Ralph Loop + CodeRabbit

When working on any code task in this project:
1. **GSD Discipline**: Inspect files first, plan multi-step implementations, avoid hallucinations.
2. **Ralph Loop Self-Healing**: Automatically run build and lint checks after edits. If errors occur, fix them iteratively without waiting for user input until all checks pass.
3. **CodeRabbit Quality Gate**: Audit code for security, null safety, error handling, performance (N+1 queries, memory leaks), and clean typing before finishing.
