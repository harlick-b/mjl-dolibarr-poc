---
name: write-a-skill
description: Use when creating a reusable new workflow skill with concise SKILL.md metadata and operational instructions.
---

# Write A Skill

## When to use

Use when a repeated workflow should become a reusable local skill.

## Read first

- `AGENTS.md`
- Existing local skills under `skills/`
- System skill-creator guidance if available

## Workflow

1. Choose a lowercase hyphenated skill name.
2. Create only the files needed for the skill, starting with `SKILL.md`.
3. Include YAML frontmatter with `name` and `description`.
4. Keep the body concise: when to use, read first, workflow, output.
5. Avoid copying long project docs into the skill.

## Output

Return files created, trigger purpose, validation result, and any follow-up
needed.
