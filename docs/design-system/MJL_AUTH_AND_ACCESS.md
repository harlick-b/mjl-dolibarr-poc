# MJL Clarity System — Auth And Access

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
file covers auth/access UX only.

## Purpose

Define the authentication and invitation-only access model for the MJL workspace.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The production access model uses one global business role per user: AGENT_SAISIE, AGENT_VERIFICATEUR, VALIDATEUR_DEFINITIF, or ADMIN_PLATEFORME.
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## No Public Registration

Forbidden labels and flows:

```txt
Créer un compte
Inscription
Register
Sign up
```

Allowed labels:

```txt
Connexion
Mot de passe oublié
Définir mon mot de passe
Invitation
Accéder à mon espace
```

## Invitation-Only Flow

1. Admin creates or selects user.
2. Admin sends invitation.
3. User receives email.
4. User opens invitation link.
5. User defines password.
6. User accesses app.
7. Invitation status becomes accepted.
8. Audit records the lifecycle.

## Invitation States

```txt
Invitation non envoyée
Invitation envoyée
Invitation acceptée
Invitation expirée
Invitation révoquée
Invitation renvoyée
Échec d’envoi
```

## Account States

```txt
Invité
Actif
Suspendu
Désactivé
Réinitialisation demandée
```

## Required Auth Pages

- Login
- Invitation acceptance
- First password setup
- Forgotten password
- Password reset
- Expired invitation
- Invalid invitation
- Session expired
- Account disabled
