# MJL Financement Design System

## Status

The approved v3 package governs visual presentation. The application remains
under development; signed human accessibility review, client copy review, and
user acceptance remain outstanding. Production readiness is not established.

## Authority

MJL business rules, permissions, workflows, data, outputs, and product meaning
are governed by [`docs/mjl-authoritative-decisions.md`](../mjl-authoritative-decisions.md)
and its canonical v2 owners. Within that boundary,
[`approved/v3/`](approved/v3/) is the canonical visual design generation and
this README is its active entry point.

The approved package predates the post-cadrage v2 product reset. Its tokens,
components, focus states, density, responsive behavior, and accessibility
guidance remain authoritative. Its old role, Partner-scope, finance,
document-policy, CSV/XLSX-only, and PDF-prohibition statements are superseded.

## Post-cadrage UI implementation map

`docs/inspiration/` supplies the target screen composition and interaction
examples. The approved v3 tokens govern palette, typography, spacing,
dimensions, and accessibility where the examples differ. The prototype HTML is
a visual reference, not application code or a source of permissions, records,
or workflow state. Demo controls and sample records do not enter the runtime.

The current application uses PHP-rendered pages and JavaScript. Extend the
existing MJL page headers, forms, tables, status presentation, feedback, and
empty/error states. Use the installed jQuery UI calendar and Select2 only where
an existing MJL control does not supply the needed interaction, styled with v3
tokens and initialized within the MJL shell. Shared presentation helpers take
already-authorized data; routes retain data access, tokens, versions, and
actions. Mutualize repeated dialog, filter, date, financial, status, Operation,
and chronology presentation when their first consumers are implemented. Keep
validation, execution, and financial-completeness statuses distinct. Shared
browser financial previews must use exact integer arithmetic; server rules
remain authoritative. Preserve Inter's existing loading path.

| Target surface | Existing guarded route or entry point |
| --- | --- |
| Role dashboard, alerts, reports | `index.php`, `alerts.php`, `reports.php` |
| Activities list, full-page planning, detail, review | `activities.php` |
| Operation execution and exception decisions | `operations.php`, `operationrequests.php` |
| Partners, Projects, Operation Types | `partners.php`, `projects.php`, `operationtypes.php` |
| Users and invitations | `admin/access.php`, `invitation.php` |
| History and audited downloads | `workflowactions.php`, `reportexport.php` |

All paths in the table are under `custom/mjlfinancement/`. The six primary
navigation entries are Tableau de bord, Activités, Partenaires, Projets,
Utilisateurs, and Historique, filtered by existing access rules. Provide
authorized contextual links to Alerts, Reports, Operations, Exception Requests,
Operation Types, and technical administration before removing their current
sidebar entries. The Operation drawer is read-only in this pass; existing
guarded execution remains accessible. Existing form submissions and redirects
remain the action path. Use supported filter parameters only and preserve
ordinary navigation and forms without JavaScript.

Before each wave, map proposed UI mechanisms to its approved screen behavior
or a concrete integrity risk. Use focused disposable-tenant E2E coverage for
touched screens, syntax checks for changed source, and representative visual
comparison. Report what was implemented and stop before the next wave.

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

If production CSP is introduced, it must allow
`https://fonts.googleapis.com` in `style-src` and
`https://fonts.gstatic.com` in `font-src`, or an approved local Inter pipeline
must replace the CDN source. Other deferred deployment questions are in the
[deployment checklist](../mjl-deployment-checklist.md).
