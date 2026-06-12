# Flower Bouquet Color Picker (Spec Kit Draft)

## Feature
Interactive poppy color picker adapted from the BlossomColorPicker interaction model.

- Single flower: realistic animated poppy

## Requirements
1. Rendering
   - The picker starts from a dark poppy seed head and blooms into overlapping poppy petals.
   - Petals use irregular sizing, rotation, highlights, and vein texture.
   - A circular hue ring and arc lightness slider render around the flower.
2. Selection
   - Clicking/tapping a petal sets the selected color.
   - The selected color is shown as HEX, RGB, and HSL.
   - The preview, hue ring handle, slider handle, and selected petal state update with the selected color.
   - Theme palettes can define colors as `hex`, `rgb()`, `rgba()`, `oklab()`, `oklch()`, or `{ h, s, l }`.
3. Interaction
   - The core toggles bloom/collapse.
   - Hovered petals scale and brighten.
   - Nearby petals subtly push away from the cursor while expanded.
   - The hue ring supports unrestricted hue selection.
   - Optional rebloom action rotates the petal arrangement.
4. Adaptation source
   - The geometry and transition behavior are adapted from `dayflow-js/BlossomColorPicker`.

## Acceptance
- Single poppy renders without external dependencies.
- No external runtime dependencies.
- Bloom speed control updates animation duration.
- Copy button writes selected HEX color to clipboard.
