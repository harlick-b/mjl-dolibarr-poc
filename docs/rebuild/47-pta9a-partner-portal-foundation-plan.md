# PTA-9A — Partner portal foundation and approved portfolio

Implemented on 2026-11-03. Final evidence and independent review are recorded in
[status 48](48-pta9a-implementation-status.md); this file remains the historical
implementation contract.

## Outcome and boundary

An Admin may invite a synthetic `PARTENAIRE` identity permanently bound to one
active Partner. Several identities may share that Partner. After the existing
invitation, password and OTP journey, the Partner receives a separate read-only
portal showing only that Partner's Projects, annual PTAs, whole-PTA metrics and
currently effective approved Activity progress.

The portal follows `docs/inspiration/partner-portal` and the matching approved
regular-user Project/PTA surfaces. Draft and candidate content, assignments,
actor identities, comments/reasons, attachments, audit, administration, exports,
Fiches and detailed settlement remain hidden. Fiche delivery, final-decision and
completed-finance detail, Partner exports, Partner-entity lifecycle, rebinding,
real identities and production are later slices.

## Smallest implementation

- Migration `0020_pta9a` adds the exclusive `PARTENAIRE` role and nullable
  `auth_user.partner_id`. Database constraints require exactly one binding for a
  Partner identity and no binding for every other role. Add no role/scope table.
- Extend the existing Admin invitation with conditional `partner_id`, verified
  against an active Partner. Invitation resend, acceptance, login, OTP, recovery,
  session invalidation and individual account deactivation preserve the binding.
  Reject every role change to or from `PARTENAIRE` and every rebinding path.
- Add dedicated Partner-scoped cursor reads for Projects, Project PTAs and PTA
  approved Activities. Reuse current metric calculation and approved revision
  facts without widening internal planning DTOs or routes. Guessed and foreign
  resources return the same not-found response.
- Add a separate Partner shell and read-only portfolio/selected-PTA screen with
  Router-owned selection, Query-owned server state, shared REST authorization
  handling, loading/empty/error states and immediate cache removal on offline or
  authorization loss. Add no mutation or offline replay behavior.

## Verification

Focused PostgreSQL/API checks cover migration compatibility; role/binding
constraints; Admin-only invitations; active/missing/foreign Partner denial;
multiple identities per Partner; permanent binding through invitation/auth and
deactivation; role-change/rebinding rejection; cross-Partner non-disclosure;
approved-baseline membership through amendment/withdrawal/transfer; exact metric
reuse; denial from every internal/admin/document/Fiche/export/audit family; list
pagination; audit rollback and deterministic authentication/deactivation races.
React and Chromium checks cover the inspired read-only portal, responsive
portfolio navigation, offline/auth-loss cache removal and absence of internal
actions. Run affected A1–A3, lifecycle, planning/metrics, OpenAPI, migration and
quality/build regressions with synthetic identities and disposable PostgreSQL.

## Independent review gate

After final-candidate verification, the same read-only product/security and
engineering agents that audited readiness independently inspect requirements,
the actual diff, surrounding authorization code and evidence without trusting
implementation claims or modifying files. The implementer fixes accepted
findings and returns the candidate to both agents for focused re-review. Do not
declare completion until both pass. Stop after PTA-9A.
