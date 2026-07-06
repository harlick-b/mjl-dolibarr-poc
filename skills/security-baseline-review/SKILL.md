---
name: security-baseline-review
description: Use for auth, APIs, user data, secrets, public forms, permissions, RLS, CORS, rate limits, guarded documents, or production-security concerns.
---

# Security Baseline Review

## When to use

Use this for authentication, authorization, secrets, public routes, user data,
document access, production configuration, or security-sensitive behavior.

## Read first

- `AGENTS.md`
- `CONTEXT.md`
- Relevant access, auth, document, route, and deployment docs

## Workflow

1. Identify protected assets, actors, entrypoints, and trust boundaries.
2. Check direct URL and POST guards, not only UI visibility.
3. Verify active entity filtering and guarded ECM/document access where relevant.
4. Flag production blockers and missing human confirmations.

## Output

Return risks with severity, evidence, recommended fixes, verification, and
remaining security confirmations.
