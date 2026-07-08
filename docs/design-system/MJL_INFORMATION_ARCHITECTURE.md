# MJL Clarity System — Information Architecture

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
file covers information architecture only.

## Purpose

Define how the application is organized around MJL work instead of Dolibarr internals.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The temporary access model is exactly Level 1, Level 2, Level 3, Admin.
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## Primary Areas

1. Tableau de bord
2. Projets
3. Activités
4. Validations
5. Alertes
6. Documents
7. Exports
8. Historique / Audit
9. Administration

## Page Hierarchy

```txt
Tableau de bord
  - Mes actions attendues
  - Alertes
  - Activités récentes
  - Raccourcis d’export

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

Validations
  - File d’attente
  - Détail à valider
  - Décisions passées

Alertes
  - Toutes les alertes
  - Alertes urgentes
  - Alertes résolues si applicable

Exports
  - Centre d’exports
  - Export activités
  - Export projets
  - Export audit si autorisé

Administration
  - Utilisateurs
  - Invitations
  - Rôles
  - Paramètres techniques
```

## Entry Points

- Level 1 lands on `Tableau de bord personnel`.
- Level 2 lands on `File de validation`.
- Level 3 lands on `Tableau de bord global`.
- Admin lands on `Administration / Utilisateurs` unless also assigned to a functional role.

## Breadcrumbs

Use breadcrumbs on deep pages, for example `Tableau de bord > Activités > Activité A-2026-014`. Do not use breadcrumbs on simple auth pages.
