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

## Rebuild presentation scope (DEC-091)

Use React/JSX, Tailwind, shadcn/ui and Lucide under the proposed rebuild standard.
`docs/inspiration/` supplies local composition/interaction references and is
ignored by Git. It may be absent in a fresh checkout; DEC-087 requires applicable
supplied inspiration before a product screen is implemented. Missing references
block that screen, not a neutral foundation shell or independent backend work.

Approved v3 tokens govern palette, typography, spacing, dimensions and accessibility
where inspiration differs. Both supplied HTML prototypes use green palettes;
v3 and the login PNG use navy/action blue. Keep v3 identity unless explicitly
changed. Prototype behavior/sample records are not business authority or seed data.

Retain distinct planning/execution/completeness states, French labels, exact
money, responsive controls, focus and non-color cues. Customize accessible shadcn
primitives minimally; do not copy PHP widgets, jQuery/Select2 or no-JavaScript
form fallbacks as rebuild requirements. Add components only for real consumers.
The screen inventory/UI audit remain POC evidence, not the new route map.

## Approved generation governance

The normative v3 artifacts are stable by default. They may be amended in place
only under explicit user authorization, with the affected normative files,
active governance documentation, and conformance tests updated together. A new
design generation is not mandatory when the user explicitly authorizes an
in-place correction. Context, audits, and runtime implementation evidence do
not silently rewrite normative artifacts.

Runtime CSS and tests remain code-owned conformance mappings and do not
independently redefine the approved tokens or design decisions.

Completed validation reports are retained in Git history. The roadmap and
current UI audit own implementation state and outstanding review needs.

## Authoritative paths

- [Product definition](approved/v3/PRODUCT.md)
- [Design system](approved/v3/DESIGN.md)
- [Design manifest](approved/v3/design-manifest.yaml)
- [Manual review](approved/v3/MANUAL-REVIEW.md)
- [Design assumptions](approved/v3/docs/design/design-assumptions.md)
- [Design decisions](approved/v3/docs/design/design-decisions.md)
- [Component inventory](approved/v3/docs/design/component-inventory.md)
- [Base tokens](approved/v3/design-tokens/tokens.json)
- [Semantic tokens](approved/v3/design-tokens/semantic-tokens.json)
- [Token documentation](approved/v3/design-tokens/README.md)

## Historical POC font integration

Inter remains the primary browser font with Arial, Helvetica, and sans-serif
fallbacks. The integration details below describe the retained POC only. The
rebuild must confirm its font hosting/CSP/privacy policy before sensitive use. The approved Google Fonts CSS2 source is emitted exactly once on
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
