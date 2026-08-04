# MJL Clarity System v3

Status: `APPROVED`

## Direction

The v3 refinement keeps the established navy, action blue, restrained
surfaces, clear hierarchy, and compact administrative density. Inter becomes
the primary browser font with Arial, Helvetica, and sans-serif fallbacks.

The approved browser source is:

```text
https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap
```

The source is included once through the MJL header hook on login, password
reset, and MJL browser documents. Native authenticated Dolibarr pages,
downloads, exports, emails, CSS, JavaScript, and operational scripts do not
receive it.

## Typography and density

- Typography roles: metadata, label, body, functional, section, page, and KPI.
- Weights: 400 regular, 500 medium, 600 semibold, and 700 bold.
- Controls: 32px compact, 40px standard, and 44px important or coarse-pointer.
- Rows: 40px data and 44px interactive, produced through cell metrics.
- Controls use a 10px radius; cards use 6px and panels use 8px.
- Status badges use a 6px radius and at least 20px height.
- A 999px radius is reserved for true chips and pills.

## States and accessibility

Every interactive control has explicit base, supported hover, active,
disabled, and visible keyboard-focus states. Important controls use a
two-color focus treatment on dark or accent surfaces. Reduced-motion and
forced-colors preferences remain functional. Meaning is never communicated by
color alone.

Report printing hides navigation and transient controls while retaining
headings, status, audit history, and tabular evidence. Email and server export
outputs have no CDN dependency.
