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
- `docs/mjl-authoritative-decisions.md`
- `CONTEXT.md`
- `docs/rebuild/03-security-compliance-baseline.md` for rebuild requirements
- Relevant access, auth, document, route, and deployment docs

## Workflow

1. Identify protected assets, actors, entrypoints, and trust boundaries.
2. Check server-side route/method and resource authorization, not only UI visibility.
3. Verify explicit MJL resource scope and private document delivery. Dolibarr
   entity/ECM adapters apply only to legacy inspection, not the rebuild.
4. Separate foundation blockers from later product decisions and external
   security dependencies. Identify whether each blocks development, sensitive
   data use, staging or production. Documentation establishes requirements, not
   implementation compliance; do not run a penetration test during a doc audit.

## Output

Return risks with severity, evidence, recommended fixes, verification, and
remaining security confirmations.
