# MJL Clarity System — Content Guidelines

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
file covers content style only.

## Purpose

Ensure French-first content that is formal, clear, direct, calm, non-technical, and respectful.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The temporary access model is exactly Level 1, Level 2, Level 3, Admin.
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## Preferred Labels

Use French administrative labels:

```txt
Connexion
Mot de passe oublié
Réinitialiser le mot de passe
Invitation
Activité
Projet
Validation
Retourner pour correction
Rejeter
Valider
Soumettre
Exporter
Historique
Pièces justificatives
Tableau de bord
Alertes
```

## Forbidden Or Avoided Labels

Avoid:

```txt
Register
Sign up
Créer un compte
Third party
Customer
Supplier
ERP
Module technique
Object ID
Raw status
```

## Button Wording

Buttons should use clear verbs, for example:

```txt
Soumettre l’activité
Valider l’activité
Retourner pour correction
Exporter les activités filtrées
Envoyer l’invitation
Renvoyer l’invitation
Révoquer l’invitation
Réinitialiser le mot de passe
```

## Errors And Empty States

Errors must explain what happened, what the user can do, and where to act. Empty states must guide action without sounding playful or vague.
