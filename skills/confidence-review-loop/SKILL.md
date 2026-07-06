---
name: confidence-review-loop
description: Use for risky plans, architectural uncertainty, or "are you sure?" reviews that need adversarial loophole-finding before implementation.
---

# Confidence Review Loop

## When to use

Use this before committing to a risky strategy, broad refactor,
security-sensitive change, or plan the user explicitly asks to challenge.

## Read first

- `AGENTS.md`
- The proposed plan or decision
- Relevant project memory and docs for the affected area

## Workflow

1. State the current confidence level and why it is not yet complete.
2. Search for loopholes, contradictions, missing evidence, and invalid
   assumptions.
3. Propose concrete fixes for each issue.
4. Repeat until the remaining assumptions are explicit and acceptable.

## Output

Return confidence result, loopholes found, fixes required, updated strategy, and
remaining human confirmations.
