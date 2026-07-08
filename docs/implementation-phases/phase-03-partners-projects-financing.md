# Phase 3 - Partenaires / Programmes, Projects, Financing

## Goal

Expose partner/programme, project, funding envelope, budget, and fund receipt
workflows inside the MJL workspace with production scope checks.

## Scope

- Add or improve `partners.php`.
- Use native `llx_societe` as the technical data source.
- Add MJL project creation/editing for Admin plateforme and Validateur
  definitif.
- Rename user-facing Conventions to Enveloppes de financement.
- Scope partner, project, envelope, budget, and fund receipt lists/details.

## Verification

- E2E scope isolation for UNICEF and Programme Redevabilite users.
- Project create/edit allowed only for Admin plateforme and Validateur
  definitif.
- Direct object access fails closed when a Partenaire / Programme cannot be
  resolved.

