---
description: Perform a thorough AI code review and quality audit on local changes or pull requests
---

# CodeRabbit Quality Review Workflow

Runs a comprehensive automated code review inspired by CodeRabbit's quality gate.

## Execution Steps

1. **Diff Inspection**:
   - Inspect git status and diff: `git diff HEAD~1` or `git status`.
2. **Analysis Dimensions**:
   - **Correctness**: Logic bugs, edge cases, null references, off-by-one errors.
   - **Security**: OWASP Top 10, unescaped inputs, SQL injection, XSS, exposed secrets.
   - **Performance**: N+1 queries, unmemoized expensive computations, memory leaks.
   - **Architecture & Clean Code**: Consistency, maintainability, typing completeness.
3. **Structured Report**:
   - Provide summary, severity tags (🔴 Critical, 🟠 Warning, 🟡 Suggestion, 🟢 Praise), and suggested diff fixes.
4. **Interactive Remediation**:
   - Offer to automatically apply fixes for detected issues.
