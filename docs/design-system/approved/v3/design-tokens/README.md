# MJL Financement v3 Design Tokens

Status: `APPROVED`

These DTCG-style files are the framework-neutral authority for the v3 visual
refinement. Components consume semantic aliases while CSS maps the same values
inside MJL-scoped selectors.

Inter is the primary browser font, followed by Arial, Helvetica, and the
generic sans-serif family. The fallback stack is mandatory when the approved
Google Fonts dependency is unavailable.

The active density model uses 32px compact controls, 40px standard controls,
44px important or coarse-pointer controls, 40px data rows, and 44px
interactive rows. The legacy 48px row token remains only as a deprecated
compatibility value.

Status badges use a 6px radius and at least 20px height. The 999px radius is
reserved for true chips and pills. The success badge alone uses `#caface`;
general success surfaces retain `#e8f5ec`.

Switch measurements are tokens only. They do not authorize a switch component
without an approved product use case.
