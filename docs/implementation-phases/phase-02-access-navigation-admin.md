# Phase 2 - Access Gates, Admin Assignments, Navigation

## Goal

Use the production role/scope foundation in route guards, POST guards,
navigation visibility, and Admin user assignment workflows.

## Scope

- Replace normal UI exposure of POC role terms with production labels.
- Expand `admin/access.php` for role and Partenaires / Programmes assignment.
- Audit invitation, role, scope, activation, and deactivation events.
- Update navigation from central capability helpers.
- Keep exchanges out of primary navigation.
- Keep roadmap hidden unless `MJL_SHOW_INTERNAL_ROADMAP=1`.

## Verification

- E2E coverage for Admin assignment and invitation flows.
- Direct URL checks for non-admin users.
- POST guard checks for blocked role/scope actions.
- Confirmation that public registration remains absent.

