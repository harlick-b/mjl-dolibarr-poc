# MJL Financement Design System

## Status

- Active approved design generation: v3.
- Design package and repository implementation: approved and implemented.
- Automated promotion gate: passed.
- Implementation verdict: `IMPLEMENTED_WITH_NOTES`.
- Manual accessibility validation and production/operator readiness are
  explicitly deferred from the current functional milestone. Client business
  decisions remain inputs to the next milestone.

This approval does not establish WCAG conformance or production readiness.

## Authority

MJL business rules, permissions, workflows, and product meaning remain governed
by [`docs/mjl-authoritative-decisions.md`](../mjl-authoritative-decisions.md).
Within that boundary, [`approved/v3/`](approved/v3/) is the canonical design
generation and this README is its active entry point.

The former v2 package was retired after every useful artifact was rebuilt,
consolidated, or explicitly retired in the v3 migration ledger. It is not kept
as a stale in-tree archive and remains recoverable from Git commit
`e95927f816bb127914b432adb119e522c669cbc8`.

## Approved generation governance

The normative v3 artifacts are stable by default. They may be amended in place
only under explicit user authorization, with the affected normative files,
active governance documentation, and conformance tests updated together. A new
design generation is not mandatory when the user explicitly authorizes an
in-place correction. Context, audits, and runtime implementation evidence do
not silently rewrite normative artifacts.

Runtime CSS and tests remain code-owned conformance mappings and do not
independently redefine the approved tokens or design decisions.

The validation report is the sole append-only exception inside the approved
package. New executed evidence may be appended, but prior results may never be
rewritten or deleted.

## Authoritative paths

- [Product definition](approved/v3/PRODUCT.md)
- [Design system](approved/v3/DESIGN.md)
- [Design manifest](approved/v3/design-manifest.yaml)
- [Manual review](approved/v3/MANUAL-REVIEW.md)
- [Design assumptions](approved/v3/docs/design/design-assumptions.md)
- [Design decisions](approved/v3/docs/design/design-decisions.md)
- [Component inventory](approved/v3/docs/design/component-inventory.md)
- [Design validation and migration ledger](approved/v3/docs/design/design-validation-report.md)
- [Base tokens](approved/v3/design-tokens/tokens.json)
- [Semantic tokens](approved/v3/design-tokens/semantic-tokens.json)
- [Token documentation](approved/v3/design-tokens/README.md)

## Runtime boundary

Inter is the primary browser font with Arial, Helvetica, and sans-serif
fallbacks. The approved Google Fonts CSS2 source is emitted exactly once on
login, password-reset, and MJL browser documents through the custom header
hook. It is absent from authenticated native Dolibarr pages, downloads,
exports, email, and other non-browser output.

No Dolibarr core, database schema, permission, workflow, export format, email
contract, or guarded-document behavior changes are part of v3.

Loading Google Fonts discloses ordinary network metadata, including the IP
address, user agent, request timing, and requested Google URLs. Eligible pages
emit a `same-origin` referrer meta policy and external font links use
`referrerpolicy="no-referrer"`; production must also preserve the
`Referrer-Policy: same-origin` response header. These controls prevent Google
from receiving MJL application paths and query tokens; they do not suppress
ordinary connection metadata.
The gstatic font origin may receive the Google stylesheet URL as its referrer.
Production infrastructure must preserve this policy.

## Deferred release confirmations

- Production reverse-proxy CSP, egress, and privacy policy.
- Signed keyboard, screen-reader, reflow, and real browser-zoom evidence.
- Client approval of non-protected wording and official CSV/XLSX canevas.
- Production email, public URL, secrets, storage, backup, monitoring, and
  retention configuration.

If production CSP is introduced, it must allow
`https://fonts.googleapis.com` in `style-src` and
`https://fonts.gstatic.com` in `font-src`, or an approved local Inter pipeline
must replace the CDN source.
