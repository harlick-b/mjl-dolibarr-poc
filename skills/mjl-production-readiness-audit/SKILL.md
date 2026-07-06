---
name: mjl-production-readiness-audit
description: Use for MJL-specific production readiness checks, deployment blockers, evidence gaps, and release risk review.
---

# MJL Production Readiness Audit

## When to use

Use when assessing whether a feature, workflow, or deployment state is ready for
production-style review.

## Read first

- `AGENTS.md`
- `CONTEXT.md`
- `docs/mjl-financement-production-readiness.md`
- `docs/mjl-financement-production-deployment.md`

## Workflow

1. Compare current evidence to readiness and deployment docs.
2. Identify blockers, missing decisions, and stale verification.
3. Check security, storage, backup, secrets, permissions, and official-output
   risks where relevant.
4. Distinguish POC-ready from production-ready.

## Output

Return readiness status, evidence, blockers, risk level, and required human
confirmations.
