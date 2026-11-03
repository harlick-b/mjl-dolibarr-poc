# MJL Clarity System - Current Screen Inventory

MJL product decisions come from `docs/mjl-authoritative-decisions.md`. This
inventory records current React routes and their access boundaries. It is
repository-visible evidence, not user acceptance.

## React PTA-6A/PTA-6D Activity evidence (DEC-125/128)

`/activities/$activityId` contains a compact optional-evidence panel. Agents and
Validators may add PDF/JPEG/PNG files; internal business roles may list and
download them. JPEG/PNG rows also expose an accessible, responsive preview modal
loaded through fresh protected authorization. PDF remains download-only. Admin
and Partner access, production document storage and unapproved document contexts
remain outside this surface.

## React PTA-4A (DEC-121)

`/projects/$projectId/ptas/$year` shows current whole-PTA physical and financial
metrics in the approved two-card dashboard composition. Exact server facts remain
independent of Activity pagination; percentages are French-formatted, uncapped
and explicitly non-calculable at a zero denominator. All business roles may read;
Admin remains denied by the planning workspace and backend.

## React PTA-3A-3F (DEC-115-120)

`/execution/$ptaId` lists approved Activities and their execution summaries.
`/execution/activities/$activityId` shows approved Operations, Agent controls,
pause or ineligibility reasons, exact XOF variance and paginated execution
history. Supervisor and Validator views are read-only; Admin is denied. Mutations
remain online-only and clear protected state on session invalidation.

The same workspace presents décaissement and virement authorizations, external
transfer declarations and append-only correction history. It reconciles approved
allocation with final spending: a positive unused amount may be declared returned
for the exact server-owned amount, while zero needs no artificial declaration.

## React A2.1-A2.2 (DEC-096/099)

`/access/users` is the verified-Admin account and invitation view with bounded
filters, ordinary-role invite/resend/revoke dialogs and safe status projections.
Supplied `docs/inspiration/users` governs composition; v3 governs tokens. Backend
eligibility remains mandatory. Inactive reinvitation and assigned or responsible
accounts remain excluded.

## React A1 (DEC-094)

| Screen       | Route           | Current boundary                                                                                   |
| ------------ | --------------- | -------------------------------------------------------------------------------------------------- |
| Connexion    | `/login`        | Explicit synthetic-only backend; email/password then OTP, no public registration                   |
| Invitation   | `/invitation`   | Fragment proof removed before API inspection; readonly invited email and live password criteria    |
| Vérification | `/verification` | One accessible OTP input with six visual slots; pending context only                               |
| Identité     | `/identity`     | Fresh verified server identity; blocked on invalidation, offline state or expiry; confirmed logout |

Composition follows the supplied auth references with approved v3 palette,
locally packaged Inter and approved control/card radii. Signed human
accessibility review and user acceptance remain outstanding.
