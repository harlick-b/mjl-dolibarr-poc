# MJL Financement Design Tokens

Status: `READY_WITH_ASSUMPTIONS`

Brand status: `provisional-brand-foundation`

`tokens.json` contains framework-neutral base values. `semantic-tokens.json` maps product roles to base tokens using DTCG-style `{path.to.token}` references.

## Use

- Consume semantic tokens in components; base values are implementation primitives.
- Preserve aliases when mapping to a future CSS or PHP styling layer.
- Do not treat these files as CSS, framework configuration, or implementation authorization.
- Do not copy an external design-system namespace or token bundle.

## Density and responsiveness

The 4px spacing scale supports compact operational tables and more spacious form/error groupings. Review viewports are 390px, 768px, 1024px, and 1366px. Touch layouts use at least 44×44px targets.

## Color and focus

The palette is derived from the supplied MJL context and is provisional. `semantic.focus.ring` resolves to `#164f7a` for sufficient distinction on light surfaces. The lighter `#7fb3d5` remains supporting emphasis and must not be the sole critical focus indicator.

Status tokens require visible text or icons; color is never the only meaning. Exact implemented foreground/background pairs must be retested after any brand change.

## Motion

Motion is functional and brief. `semantic.motion.reduced` resolves to 0ms; implementations must also remove nonessential transforms while preserving immediate state feedback.

## Replacement points

Client approval may replace palette, typography, icons, or density values. Preserve semantic names and rerun alias, contrast, focus, responsive, and component-state validation after replacement.
