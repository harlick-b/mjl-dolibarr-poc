# PTA-9B — Partner Activity details and sanitized Fiche

Authorized by the user on 2026-11-03. DEC-129 and the completed PTA-9A
foundation govern this slice.

## Outcome and boundary

A bound Partner user may open a currently visible approved Activity and see its
approved planning baseline, successful Validator approvals, and definitive
financial result after closure. They may download a French Partner Fiche built
from that same allowlisted projection.

Final decisions contain only the approval kind, approved revision and decision
date. They expose no actor identity, reason, internal comment, candidate content
or unsuccessful review. Completed finance contains exact approved allocation,
final spending, latest confirmed external transfer, required surplus, latest
reversement and closure date. It remains unavailable while the Activity is not
closed. The validated zero-spending path is represented explicitly without
inventing financial movements.

Attachments and their metadata, internal audit, detailed review/request rows,
notes, correction reasons, exports, mutations, historical as-of reconstruction,
real accounts and production remain excluded. Partner attachment visibility is
still undecided.

## Smallest implementation

- Add one Partner-scoped Activity-detail GET and one Partner-scoped PDF GET to
  the existing portal router. Reuse the permanent Partner principal, current
  placement/approved visibility rule, shared read lock and audit mechanism.
- Build one server-side allowlisted projection from existing revisions,
  Validator approvals, Operations and latest settlement rows. Guessed,
  withdrawn, source-placement, draft-only and cross-Partner identifiers return
  the existing not-found response. Add no migration or table.
- Generate the Partner Fiche synchronously in memory from the sanitized
  projection. Audit successful generation transactionally. Do not call or expose
  the broader internal Fiche projection.
- Extend the existing Partner Activity list with Router-owned detail selection,
  Query-owned detail state and guarded online PDF download. Authorization loss
  clears the complete Partner cache and aborts stale downloads.

## Focused verification

PostgreSQL/API checks cover current ownership, guessed/cross-Partner denial,
approved decisions without identities/reasons, pending-candidate isolation,
closed positive and validated-zero results, latest corrected settlement facts,
unfinished finance suppression, sanitized PDF text/headers/audit rollback and
deactivation serialization. React and Chromium checks cover selection, French
detail/finance states, PDF download, mobile layout, offline/auth-loss masking and
absence of internal/attachment content. Run affected portal, Fiche, settlement,
OpenAPI and quality/build checks with synthetic identities and disposable data.

## Mandatory independent review

A separate engineering reviewer and a separate product/security reviewer that
did not implement the change inspect the contract, actual diff, surrounding
authorization, PDF projection and verification evidence without modifying files
or trusting implementation claims. The implementer fixes accepted findings and
returns the candidate to the same reviewers for focused re-review. Completion
requires both reviewers to pass. Stop after PTA-9B.
