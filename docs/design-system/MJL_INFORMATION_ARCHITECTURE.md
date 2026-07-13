# MJL Clarity System — Information Architecture

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
file covers information architecture only.

## Purpose

Define how the application is organized around MJL work instead of Dolibarr internals.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The production access model uses one global business role per user: AGENT_SAISIE, AGENT_VERIFICATEUR, VALIDATEUR_DEFINITIF, or ADMIN_PLATEFORME.
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## Primary Areas

1. Tableau de bord
2. Partenaires / Programmes
3. Projets
4. Activités
5. Dépenses
6. Documents
7. Financement
8. Supervision
9. Administration

## Page Hierarchy

```txt
Tableau de bord
  - Mes actions attendues
  - Alertes
  - Activités récentes
  - Raccourcis d’export

Partenaires / Programmes
  - Liste des partenaires
  - Détail partenaire / programme
  - Portefeuille rattaché

Projets
  - Liste des projets
  - Détail projet
  - Activités du projet
  - Documents du projet

Activités
  - Liste des activités
  - Créer une activité
  - Détail activité
  - Modifier brouillon
  - Historique de décision

Dépenses
  - Liste des dépenses
  - Créer une dépense
  - Détail dépense
  - Justificatifs
  - Prévalidation, validation définitive et décaissement

Documents
  - Bibliothèque
  - Téléchargements gardés
  - Uploads contextuels depuis les objets métier

Financement
  - Enveloppes de financement
  - Budgets
  - Fonds reçus

Supervision
  - Supervision finance
  - Historique des validations
  - Alertes globales
  - Rapports / Exports
  - Historique / Audit

Administration
  - Accès utilisateurs
  - Invitations
  - Rôles et périmètres
  - Préparation production si explicitement activée
```

## Entry Points

- `AGENT_SAISIE` lands on `Mes actions attendues`.
- `AGENT_VERIFICATEUR` lands on `File de validation`.
- `VALIDATEUR_DEFINITIF` lands on `Supervision finance`.
- `ADMIN_PLATEFORME` lands on administration and platform diagnostics.

## Breadcrumbs

Use breadcrumbs on deep pages, for example `Tableau de bord > Activités > Activité A-2026-014`. Do not use breadcrumbs on simple auth pages.
