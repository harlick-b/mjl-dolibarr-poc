# MJL RST-001 Execution Report

## Authorization and Boundary

- Unit: `RST-001`
- User approval: 2026-08-10
- Dependency: executed `RST-000A`
- Tenant baseline: empty persistent business state with preserved native
  administrator `llx_user.rowid=1`
- Migration: none
- Later units authorized: none

Implementation stayed within the manifest's effective-role, access-management,
workspace, role-schema, verification, module, and test surfaces.

## Implemented Invariants

- A generated active-user key plus global unique-user index permits multiple
  historical inactive role rows but at most one active role across all entities.
- Database triggers reject role/user entity mismatches, business-role insertion
  or activation for native admins, native-admin promotion while a business
  role is active, and any role code outside the four authoritative values.
- One effective-role resolver returns `ADMIN_PLATEFORME` for any native
  Dolibarr administrator, regardless of a conflicting stored role.
- Business-role predicates use the effective resolver, so injected native-admin
  role drift cannot grant Agent, Supervisor, or Validator behavior.
- Both role-assignment entrypoints reject business roles for native admins.
- Agent role changes remain fail-closed until the target Activity-assignment
  model can prove that every current assignment was removed or transferred.
- Authorization resolves from current database state on every request; a
  zero-role change takes effect in an already authenticated session.
- Invalid, missing, or multiple stored roles fail closed.
- A failed initial profile assignment compensates by deleting the newly
  created inactive invitee, preventing an orphan account with zero roles.
- If that compensating deletion itself fails, the account remains inactive,
  receives no role, right, scope, or invitation, and is made visible from its
  current state as an administrative recovery blocker instead of becoming
  hidden. Audit-write failure is checked but cannot hide the blocker.
- A valid retry completes the missing profile and invitation; current-state
  recovery detection then clears the warning even if historical audit evidence
  remains.
- Direct MJL rights are replaced atomically from the effective-role policy;
  lookup failure rolls the complete profile change back.
- Normal Partner, Project, Activity, expense, document, reference-data,
  and business-supervision entrypoints exclude Admin.
- Admin retains access administration, advanced audit, validation-history
  audit, and controlled technical surfaces.
- The legacy mixed report center is denied to Admin. A dedicated complete-audit
  export remains missing and is explicitly deferred; RST-001 does not claim
  that permission-matrix capability as implemented.
- The role label is `Agent superviseur et prévalidateur`; the technical role
  label is `Admin`.

Partner authorization scopes and legacy group compatibility are unchanged;
they belong to separately approval-gated RST-002A/RST-002B work.

## Verification

The first valid isolated tracer test failed because MariaDB accepted a second
active role. After the generated-key uniqueness implementation, the same test
proved:

- invitation assignment creates exactly one active role;
- invalid invitation-profile input leaves no user or access residue;
- injected compensating-deletion and audit-write failures leave only a visible,
  inactive recovery record with no authorization or invitation residue, and a
  valid retry clears the recovery label after creating the profile/invitation;
- a role change leaves exactly one new active role;
- direct duplicate-active insertion is rejected by the database;
- a native admin business-role assignment returns generic safe feedback and
  changes no role row;
- cross-entity duplicate assignment is rejected;
- both directions of the native-admin/business-role constraint are rejected;
- an already authenticated user loses guarded workspace access immediately
  after direct role deactivation and regains it only after reassignment;
- an Agent-to-non-Agent role change remains blocked while the target
  Activity-assignment model is unavailable to prove a safe transfer;
- exact direct rights match Supervisor, Validator, and Agent policy, a missing
  right definition rolls the role transition back, and deactivation removes
  every direct MJL right;
- invalid role codes are rejected at persistence even for inactive history;
- Admin cannot open Activity creation and the schema audit passes;
- the disposable tenant and both named volumes are removed.

Additional results:

- `npm run test:unit`: PASS, 8/8 files
- PHP syntax checks for every changed PHP file: PASS
- shared-tenant module activation/schema application: PASS
- shared-tenant role/schema audit: PASS
- shared-tenant persistent-data absence verification: PASS
- `git diff --check`: PASS

The complete legacy E2E suite was not run because RST-000A intentionally
removed its persistent sample users and business fixtures. RST-014 remains the
separately approval-gated owner of replacement disposable factories.

## Result

`RST-001_EXECUTED`

RST-002A is the next independent approval unit and remains unapproved.
