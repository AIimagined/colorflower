# Colorflower — User Guide

Colorflower is a flower-native color picker and color-system studio. Pick colors
from an animated flower, refine them with precision controls, generate
harmonious palettes, check contrast, and export production-ready tokens.

A quick version of this guide is available in-app via the **? Help** button next
to the flower canvas.

---

## 1. Picking a color

There are four ways to choose a color, and they all stay in sync:

| Control | What it does |
| --- | --- |
| **Petals** | Click any of the 36 spectrum petals to select its color. |
| **Hue wheel** | Drag around the outer rainbow ring to set the hue (0–359°). |
| **Shade arc** | Drag the thick arc on the right to move lighter ⇄ darker. The handle is filled with your exact selected shade. |
| **Sliders** | The **Hue** and **Saturation** sliders give numeric precision. |

The current selection is always shown in the readout: **HEX, RGB, HSL, OKLCH,
OKLab**, plus an auto-generated color name.

## 2. The living flower

The flower is interactive and alive:

- **Hover** a petal to lift it; nearby petals gently sway away from the cursor.
- **Pointer wind** — moving over the flower tilts the whole bloom toward the
  cursor, like it is catching a breeze. It also drifts on its own (idle float).
- **Click the center pistil** to slowly **fold the flower into a bud**, wrapped
  by green sepal leaves. Click the bud again to bloom it back open.
- **Toggle Bloom** (button) hides or reopens the entire flower.
- **Bloom speed** slider sets how fast the open/close animation runs.

> Motion respects your system **"reduce motion"** setting — animations are
> disabled automatically when that is on.

## 3. Generating palettes

- **Palette logic** — choose the rule used to build the petals:
  Full spectrum, Complementary, Triadic, Analogous, Monochrome,
  Split-complementary, or **Image** (sampled from an uploaded photo).
- **Brand mood** — biases the palette's saturation, lightness, and hue:
  Balanced, Luxury, Calm, Playful, Clinical, Editorial, Nature.
- **Locks** — tick **Lock hue / saturation / lightness** to keep that channel
  fixed when you regenerate.
- **Regenerate** builds a fresh palette using the current logic, mood, and locks.

## 4. Checking colors

- **Contrast** — type any background color into the BG field to see the WCAG
  pass/fail grade for the selected color on that background.
- **Compare** — press **Set A** and **Set B** to compare two colors' harmony and
  contrast side by side.

## 5. Saving & exporting

- **Bouquet** — **Add color** saves the current color to your bouquet palette
  (up to 12).
- **Copy HEX** copies the selected color.
- **Copy CSS tokens** exports the bouquet as `:root { --colorflower-N: … }`.
- **Copy JSON** exports the bouquet as structured JSON.
- **Image to flower** — upload an image and the petals become its dominant
  sampled colors.

## 6. Focus mode (layout)

The **Focus** toggle (top-right of the flower canvas) collapses the side panel
and top bar so the flower is centered full-width — handy for presenting or for a
distraction-free pick. Click it again (now labeled **Expand**) to restore the
full studio layout.

## 7. Tooltips

Most controls show a short tooltip on hover/focus explaining what they do.

---

## Installing / running

- **Web:** open `index.html` (or serve the folder, e.g. `python -m http.server`).
- **Chrome extension:** see [`extension/README.md`](../extension/README.md) —
  load the `extension/` folder unpacked, then click the flower toolbar icon.
- The app is dependency-free and works fully offline.
