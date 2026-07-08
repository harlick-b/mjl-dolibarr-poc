# MJL Authoritative Decisions

This is the highest-level MJL business and implementation authority for the
repository.

## Authority Order

For MJL implementation work, use this precedence order:

1. Direct user instruction in the current Codex task.
2. `docs/mjl-authoritative-decisions.md`.
3. Active implementation prompt or task file for the current phase.
4. `docs/mjl-current-vs-target-gap-analysis.md`.
5. `docs/mjl-current-app-functional-map.md` for current-state evidence only.
6. Existing implementation code.
7. Older docs, historical prompts, executed plans, or POC notes.

If an older document conflicts with this file, the older document is
superseded. If current code conflicts with this file, current code is
implementation debt, not target behavior.

## Product Stance

The MJL app is a production-ready custom workspace inside Dolibarr. It is not a
POC and not an MVP.

Dolibarr provides authentication, users/groups/rights, third parties, projects,
ECM/documents, and export support. MJL custom code provides the workspace,
activities, expenses, documents, supervision, alerts, reports, exports, audit,
exchange logs, and invitations.

MJL-specific work must stay in `custom/mjlfinancement`, `docs/`, documented
setup scripts, documented sample-data locations, tests, SQL/update files, or a
documented safe custom theme boundary. Dolibarr core files must not be
modified.

## User-Facing Terminology

Use:

```md
Partenaires / Programmes
```

Do not use `Bailleurs / Programmes`.

Do not use `Tiers` as normal user-facing wording except in technical Dolibarr
explanations.

Known Partenaires / Programmes:

```md
UNICEF
Programme Redevabilite
```

## Role Model

Use one global business role per user.

A user can be assigned to one or many Partenaires / Programmes.

A user does not have different roles per Partenaire / Programme for current
production/test data.

Roles:

```md
AGENT_SAISIE - Agent de saisie
AGENT_VERIFICATEUR - Agent verificateur / prevalidateur
VALIDATEUR_DEFINITIF - Validateur definitif
ADMIN_PLATEFORME - Admin plateforme
```

`ADMIN_PLATEFORME` is technical/platform administration.

`VALIDATEUR_DEFINITIF` is business validation.

They are not the same concept, even if one person can have both powers.

## Deprecated POC Concepts

These are legacy only:

```md
DPAF
SUPERVISEUR_N1
SUPERVISEUR_N2
N1
N2
MJL POC roles
```

Mapping:

```md
AGENT -> AGENT_SAISIE
SUPERVISEUR_N1 -> AGENT_VERIFICATEUR
SUPERVISEUR_N2 -> AGENT_VERIFICATEUR unless explicitly migrated otherwise
DPAF -> VALIDATEUR_DEFINITIF or ADMIN_PLATEFORME depending user intent
```

## Scope Model

A non-admin user can access only data connected to assigned Partenaires /
Programmes.

Admin sees all.

Fail closed:

```md
If an object cannot resolve to a Partenaire / Programme, only Admin can access
it until the data is fixed.
```

Every custom query must filter by the active Dolibarr entity.

## Workflow

`Valide definitivement` and `Decaisse` are separate states.

Final validation approves the business decision.

Decaissement means money actually moved.

No self-validation remains mandatory:

- no self-prevalidation;
- no self-final-validation;
- no self-disbursement unless a future explicit audited override is designed.

Do not implement that override now.

## Projects

Project creation and editing must be available inside the MJL workspace.

Only `ADMIN_PLATEFORME` and `VALIDATEUR_DEFINITIF` can create/edit projects.

Normal MJL users must not need native Dolibarr project screens.

## Documents

Global Documents page remains read-only.

Uploads remain contextual.

Guarded downloads are mandatory.

Document uploads and downloads should be audited.

Supporting documents must use guarded MJL routes, not raw public ECM links.

## Exchanges

Do not expose `Echanges` as a primary top-level menu item.

Build contextual timeline/exchanges inside object detail pages.

A global search/audit view may exist under Supervision/Audit only.

## Reports And Exports

No PDF/Word reports in this phase.

CSV/XLSX only.

CSV must remain:

- UTF-8 BOM;
- semicolon-separated;
- French headers;
- stable filenames.

Every export should be audited.

## Deleted Or Merged Documentation Rule

Executed plans, duplicate generated prompts, stale POC docs, and older
conflicting docs should not remain active documentation.

Before deletion, unique useful decisions or real conclusions must be moved into
this file or another active doc.
