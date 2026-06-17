# Decision Matrix

## Default path

Continue with the Dolibarr custom-module POC while the requirements can be met
without core edits, unclear workflow compromises, or unmaintainable module
growth.

Use native Dolibarr objects first:

- Third parties for PTF/bailleurs.
- Projects for projects.
- Users/groups for permissions.
- ECM for supporting documents.

Use custom MJL objects only for business concepts Dolibarr does not model
cleanly.

## Continue with Dolibarr if

- `MjlConvention` can model the Phase 1 funding envelope.
- Activity workflow can be represented clearly in custom module code.
- Audit can show who, what, when, why, and changes.
- DPAF dashboard queries remain direct and entity-safe.
- Excel-readable CSV exports are enough.
- Junior developers and AI agents can reason about the module without touching
  too many objects at once.

## Stop gates for Symfony MVP

Switch to a Symfony MVP if any of these become true:

- Dolibarr core edits are needed.
- The hierarchical workflow is unclear or forced into the wrong Dolibarr
  concept.
- Audit cannot reliably show who, what, when, why, and field changes.
- Dashboard or export implementation becomes painful.
- Multi-entity filtering cannot be guaranteed for custom data.
- The module becomes hard for junior developers or AI agents to reason about.
- The target role contract cannot be cleanly mapped to Dolibarr permissions.

## Phase 2 object gate

Phase 2 should add only:

- `MjlWorkflowAction`
- `MjlExchangeLog`, if needed

Do not add `MjlMissionEnvelope` unless `MjlConvention` fails the envelope test.

## Export decision

Default: UTF-8 BOM semicolon CSV with French headers and stable filenames.

Allow `.xlsx` only when an existing safe Dolibarr helper or dependency is found.
