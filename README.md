# Colorflower

Colorflower is a flower-native color system studio for exploring palettes through an animated petal interface. It combines a visual color picker with production-focused outputs such as HEX, RGB, HSL, OKLCH, OKLab, CSS tokens, JSON export, contrast checks, harmony modes, image palette extraction, and saved color bouquets.

![Colorflower UI](./assets/screenshots/colorflower-ui.png)

## About

Colorflower turns color selection into a visual design workflow. Instead of starting from a standard rectangular picker, the app presents a living flower where each petal is a selectable color. Designers can pick from the flower, refine with sliders, generate palettes from harmony rules, save colors into a bouquet, and copy developer-ready tokens.

The app is built as a dependency-free static web project so it can run locally, be hosted on GitHub Pages, or be dropped into a design prototype without a build step.

## Inspiration

Colorflower was inspired by the idea of a flower-based color picker, including projects such as BlossomColorPicker. The implementation, UI, palette engine, export tools, animations, and codebase are original to Colorflower.

## Features

- Animated flower color picker with 36 spectrum petals.
- Smooth petal bloom and gentle breeze animation.
- External hue ring and precision hue, saturation, and lightness controls.
- HEX, RGB, HSL, OKLCH, and OKLab outputs.
- Palette harmony modes: spectrum, complementary, triadic, analogous, monochrome, split-complementary.
- Brand mood presets: balanced, luxury, calm, playful, clinical, editorial, nature.
- Lockable hue, saturation, and lightness channels.
- WCAG-style contrast ratio helper.
- Generated color names.
- Saved palette bouquet.
- CSS custom property export.
- JSON export.
- Recent color history.
- A/B color compare with hue delta and contrast ratio.
- Image-to-flower palette extraction.
- Glassmorphism enterprise UI with built-in tooltips.
- Static, dependency-free implementation.

## Quick start

Run a local static server from the project root:

```powershell
python -m http.server 4173
```

Open:

```text
http://127.0.0.1:4173/index.html
```

## Project structure

```text
.
├── assets/
│   ├── flowers/
│   └── screenshots/
├── specs/
│   └── color-picker/
├── src/
│   ├── app.js
│   └── styles.css
├── index.html
├── LICENSE
└── README.md
```

## Validation

The app was smoke-tested locally with:

- JavaScript syntax check.
- Local HTTP response check.
- Browser console check.
- Viewport fit check for the default flower canvas.
- Feature smoke checks for bouquet, history, contrast, compare, and image-to-flower import.

## License

MIT License. See [LICENSE](./LICENSE).
