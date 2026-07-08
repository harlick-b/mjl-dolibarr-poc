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
- `docs/mjl-authoritative-decisions.md`
- `CONTEXT.md`
- `docs/mjl-production-readiness-plan.md`
- `docs/mjl-deployment-checklist.md`
- `docs/mjl-current-vs-target-gap-analysis.md`

## Workflow

1. Compare current evidence to readiness and deployment docs.
2. Identify blockers, missing decisions, and stale verification.
3. Check security, storage, backup, secrets, permissions, and official-output
   risks where relevant.
4. Distinguish local fixture/demo evidence from production-ready evidence.

## Output

Return readiness status, evidence, blockers, risk level, and required human
confirmations.
