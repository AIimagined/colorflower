# Flower Bouquet Color Picker

This is a static vanilla poppy color picker adapted from the BlossomColorPicker interaction model:
- central core toggles bloom/collapse
- realistic layered poppy petals
- full hue selection ring
- side arc lightness slider
- cursor push and hover scale effects

It keeps the flower visually poppy-like while the hue ring makes the full color range selectable.

Theme palettes support mixed color input formats: `#hex`, `rgb()`, `rgba()`, `oklab()`, `oklch()`, and HSL objects like `{ h, s, l }`.

## Project layout

- `index.html` — app shell and controls
- `src/styles.css` — visual system, bloom/animate/sway animations
- `src/app.js` — petal generation, palette logic, interactions
- `assets/flowers/` — preset icon svgs
- `specs/color-picker/spec.md` — initial spec notes (Spec Kit style)

## Run

Open `index.html` directly in a browser, or start any local static server in this folder and load `/`.
