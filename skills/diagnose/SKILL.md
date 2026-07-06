---
name: diagnose
description: Use for bugs, failing tests, regressions, or unclear runtime behavior that needs evidence-driven investigation before a fix.
---

# Diagnose

## When to use

Use this for broken behavior, failing checks, regressions, inconsistent data,
or runtime behavior that is not yet understood.

## Read first

- `AGENTS.md`
- Relevant source, tests, logs, and docs for the failing surface

## Workflow

1. Reproduce or localize the symptom with the narrowest available command or
   evidence.
2. Compare expected behavior against code and durable project context.
3. Identify root cause, blast radius, and safest fix path.
4. Verify with the smallest meaningful test first, then broader checks if risk
   justifies them.

## Output

Return findings, evidence, root cause, recommended fix, verification performed,
and any remaining risk.
