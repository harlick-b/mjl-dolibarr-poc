# MJL Clarity System

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
file records design direction only.

Design system for a Dolibarr-based public-finance project monitoring workspace.

## Purpose

The MJL Clarity System presents the Dolibarr-backed MJL workspace as a calm administrative control room for externally funded projects. It should make projects, activities, validations, alerts, exports, documents, and audit history understandable without exposing unnecessary ERP complexity.

## Product Direction

The interface must feel institutional, sober, clear, trustworthy, French-first, and optimized for administrative users. It must not feel like a generic ERP, raw Dolibarr installation, decorative SaaS dashboard, or developer-only tool.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The production access model uses one global business role per user: AGENT_SAISIE, AGENT_VERIFICATEUR, VALIDATEUR_DEFINITIF, or ADMIN_PLATEFORME.
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

Documentation work belongs under `docs/design-system/`. Future MJL implementation work belongs in safe extension boundaries, primarily `custom/mjlfinancement`, and must preserve Dolibarr core, business rules, exports, audit history, and no-self-validation behavior.
