---
name: mjl-e2e-verification
description: Use for MJL-specific E2E, smoke, clean-install, and verification planning across UI, workflow, export, and document behavior.
---

# MJL E2E Verification

## When to use

Use when selecting or reviewing MJL verification commands, especially for UI,
auth, dashboards, exports, official outputs, workflows, documents, or clean
installs.

## Read first

- `AGENTS.md`
- `docs/mjl-authoritative-decisions.md`
- `docs/mjl-acceptance-tests.md`
- Relevant E2E specs under `tests/e2e`

## Workflow

1. Match checks to the changed surface.
2. Prefer `npm run test:e2e` for UI-covered flows.
3. Use documented smoke and audit scripts for schema, workflow, and export
   checks. Target behavior may use only minimal disposable test fixtures;
   legacy sample-data checks are current-state characterization, not target
   evidence.
4. Report skipped checks with reasons.

## Output

Return verification matrix, commands, expected evidence, skipped checks, and
remaining risk.
