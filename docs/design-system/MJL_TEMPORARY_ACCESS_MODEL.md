# MJL Clarity System — Temporary Access Model

Note: `AGENTS.md` is the canonical in-repo agent instruction layer. This file
is retained as scoped access-model guidance; if it conflicts with `AGENTS.md`,
follow `AGENTS.md`.

## Purpose

Define the temporary access model used for UI structure, navigation, dashboard visibility, and E2E tests.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The temporary access model is exactly Level 1, Level 2, Level 3, Admin.
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## Non-Goal

This is not the final fine-grained permission matrix. Codex must not invent final permissions, role names, or access rules beyond the temporary model until a true matrix is provided.

## Level 1 — Operational User

Examples: agent, activity creator, basic project contributor.

Primary needs:

- access personal dashboard;
- create activity;
- edit own draft activity;
- resubmit returned activity;
- view own submitted activities;
- view relevant alerts;
- upload or view supporting documents;
- access own profile/account.

Should not see invitation management, global administration, system settings, unrelated audit screens, or full portfolio controls.

## Level 2 — Reviewer / Validator

Examples: N+1, N+2, reviewer, hierarchical validator.

Primary needs:

- view validation queue;
- review submitted activities;
- validate, return for correction, or reject if allowed;
- add decision comments;
- inspect supporting documents;
- view decision history;
- view alerts related to pending validations.

N+1 and N+2 may be shown separately in UI if useful, but both remain Level 2 for now.

## Level 3 — Supervision / DPAF

Examples: DPAF, project-finance supervisor, global monitoring role.

Primary needs:

- global dashboard;
- portfolio overview;
- project and activity status;
- validation bottlenecks;
- deadline risks;
- alerts;
- exports;
- audit visibility;
- reporting shortcuts;
- advanced filters.

## Admin

Admin is separate from the three functional levels.

Primary needs:

- user management;
- invitation sending;
- invitation revocation/resend;
- role assignment;
- account activation/suspension;
- technical configuration;
- module settings;
- advanced Dolibarr access if needed.

Admin can send invitations. No other role can send invitations for now.
