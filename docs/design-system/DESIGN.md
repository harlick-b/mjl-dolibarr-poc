# MJL Clarity System

> Phase 0 authority notice: this file provides visual and interaction guidance
> only. Canonical v2 controls product scope, roles, permissions, workflows,
> data, documents, and output formats.

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
file records design direction only.

Design system for the MJL public-finance monitoring application; React rebuild
implementation follows the proposed new-stack standard (DEC-091).

## Purpose

The MJL Clarity System presents the MJL workspace as a calm administrative control room for externally funded projects. It should make projects, activities, validations, alerts, exports, documents, and audit history understandable without exposing unnecessary ERP complexity.

## Product Direction

The interface must feel institutional, sober, clear, trustworthy, French-first, and optimized for administrative users. It must not feel like a generic ERP, raw Dolibarr installation, decorative SaaS dashboard, or developer-only tool.

## Baseline Constraints

- Dolibarr core files must not be modified.
- Custom-module/theme constraints apply only to retained POC maintenance; the
  rebuild uses React/JSX and the approved visual tokens.
- The production access model assigns one global MJL role per user: three business roles (AGENT_SAISIE, AGENT_VERIFICATEUR, VALIDATEUR_DEFINITIF) and one administration role (ADMIN_PLATEFORME).
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## Design Principles

- Hide the ERP, reveal the mission.
- Use progressive disclosure instead of blind hiding.
- Give every page one dominant purpose.
- Show status before details.
- Represent validation as a timeline, not only buttons.
- Make alerts actionable.
- Treat exports and official outputs as first-class product surfaces.
- Treat auth pages and emails as part of the product experience.

## Implementation Boundary

Documentation belongs under `docs/design-system/`. Authorized rebuild UI uses
React/JSX, Tailwind, shadcn/ui and Lucide. Preserve business rules, exports, audit
and no-self-validation independently of the legacy PHP presentation.
