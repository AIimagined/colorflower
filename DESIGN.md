---
name: Colorflower
category: creative tool / color system studio
---

# Colorflower — design language

Reproducible token reference for Colorflower's actual shipped UI
(`src/styles.css`), in the same format as the community `awesome-design-md`
collection. Values below are read from the live stylesheet, not aspirational.

## Overview

Warm, paper-like light theme built around a single interactive centerpiece
(the flower picker) framed by soft glass panels. No dark mode yet.

## Colors

```
bg-a:            #f7f3ec   /* warm cream, gradient start */
bg-b:            #e8f1ec   /* pale mint, gradient end */
surface:         rgba(255,255,255,0.54)   /* glass panel fill */
surface-strong:  #fffdf8   /* opaque card fill */
ink:             #211b24   /* primary text */
muted:           #675f69   /* secondary text */
line:            rgba(49,38,48,0.13)      /* hairline borders */
green:           #2e7b62   /* chrome accent (primary) */
green-dark:      #205d49   /* chrome accent, pressed/emphasis */
amber:           #bd7b2a   /* chrome accent (secondary, sparing) */
glass-line:      rgba(255,255,255,0.62)   /* panel top-edge highlight */
glass-shade:     rgba(35,27,38,0.08)      /* panel inner shadow */
core-color:      dynamic — the user's currently selected color; drives the
                  flower pistil and live readouts, not chrome */
```

Chrome discipline: two brand accents (green primary, amber secondary, used
sparingly) against a warm neutral backdrop. The flower itself carries all
saturated, user-controlled color — chrome stays restrained so the picked
color is always the most vivid thing on screen.

## Typography

- UI font: `"Aptos", "Segoe UI", sans-serif`
- Monospace (color values, code, tokens): `"Cascadia Code", "SFMono-Regular", Consolas, monospace`
- No custom type scale file yet — sizes set per-component in `styles.css`.

## Shape language

- Cards/panels: 22–28px border-radius (soft, generous).
- Pills (buttons, chips, badges): 999px (full stadium radius).
- Small controls (inputs, icon buttons): 12–16px.
- Flower petals: organic asymmetric radii (e.g.
  `52% 52% 48% 48% / 82% 82% 24% 24%`) — deliberately irregular, the one
  place the UI breaks its own geometric rules on purpose.

## Elevation

Soft drop shadows, not a stepped surface ladder (yet):
```
shadow:      0 30px 90px rgba(42,31,43,0.16)   /* panels */
soft-shadow: 0 18px 46px rgba(42,31,43,0.10)   /* cards */
```
Background is a layered radial-gradient wash (four soft radial highlights
over a diagonal cream→mint linear gradient), not a flat fill — panels sit on
top via translucency (`--surface`) plus the shadow pair above, not via a
darker/lighter step.

## Motion

- One ambient animation: the flower's idle float (`.cf-float`, `flower-float`
  keyframes, ~14s cycle).
- Pointer-driven wind tilt on the picker (`applyWindTilt`), composited
  transform only (no per-frame style writes — see perf notes in git history).
- All motion collapses under `prefers-reduced-motion`.
- Chrome transitions are short and functional (button/panel state changes),
  never competing with the flower for attention.

## Do's

- Keep exactly one thing saturated and moving: the flower / the user's
  picked color. Everything else stays warm-neutral and still.
- Round generously on chrome (pills, 22px+ cards); keep the petals the only
  organic/irregular shapes.
- Use the monospace font for anything that is a value (hex, rgb, css) —
  never the UI sans for color codes.

## Don'ts

- Don't add a second saturated accent to chrome — green + amber, used
  sparingly, is the ceiling.
- Don't give buttons/panels sharp corners — nothing in this UI is <12px radius.
- Don't animate more than one thing at rest — idle motion is the flower's
  alone.

## Known gaps

No dark mode and no formalized type/spacing scale yet — this file gets
updated when those ship.
