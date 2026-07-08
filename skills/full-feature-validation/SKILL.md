---
name: full-feature-validation
description: Use before marking a feature complete to verify behavior, tests, docs, security, UI consistency, and known risks.
---

# Full Feature Validation

## When to use

Use before declaring a feature, workflow, or meaningful change complete.

## Read first

- `AGENTS.md`
- `docs/mjl-authoritative-decisions.md` for MJL target behavior
- Relevant project memory, implementation docs, tests, and changed files

## Workflow

1. Restate the intended behavior and acceptance criteria.
2. Check implementation coverage across UI, permissions, data, docs, and tests.
3. Run or identify the correct verification commands for the changed surface.
4. Record skipped checks and residual risks.

## Output

Return pass/fail status, checks run, evidence, gaps, risks, and recommended
follow-up fixes.
