# MJL Clarity System — Security UX

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
file covers security UX only.

## Purpose

Define secure interface behavior for access, password, invitation, and account states.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The temporary access model is exactly Level 1, Level 2, Level 3, Admin.
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## No Account Enumeration

Forgotten password must not reveal whether an account exists.

Use:

```txt
Si un compte correspond à cette adresse, un lien de réinitialisation sera envoyé.
```

Do not use:

```txt
Aucun compte trouvé.
```

## Invitation Security

Invitation links should support expired, invalid, revoked, already accepted, resend by Admin, and audit-log states.

Expired invitation message:

```txt
Cette invitation a expiré. Veuillez contacter l’administrateur pour recevoir une nouvelle invitation.
```

## Password Reset Security

Password reset pages should support invalid link, expired link, password rules, confirmation, and return to login.

## Session And Account States

Session expired:

```txt
Votre session a expiré pour des raisons de sécurité. Veuillez vous reconnecter.
```

Account disabled:

```txt
Votre accès est désactivé. Veuillez contacter l’administrateur.
```
