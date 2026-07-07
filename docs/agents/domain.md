# Domain Docs

This is a single-context repo for Matt engineering skills.

## Read Before Exploration

- `CONTEXT.md` at the repo root for durable product and domain facts.
- `docs/adr/` for architectural decisions that touch the area being changed.
- `DESIGN.md` and `docs/design-system/` when work affects UI, auth, email,
  dashboards, exports, official outputs, or E2E-covered screens.

If one of these files is absent in a future branch, proceed silently. Create or
update domain docs only when terms, rules, or decisions are actually resolved.

## Vocabulary

Use the project vocabulary from `CONTEXT.md` in issue titles, PRDs, plans, test
names, bug hypotheses, and architecture notes. If a needed concept is not in
the glossary, treat that as a signal for `domain-modeling`.

## ADR Conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly
instead of silently overriding it.
