# Colorflower — Release Notes

## v1.5.0

A flower-native color system studio: pick colors from an animated 3D flower,
generate palettes, check contrast, and export production-ready tokens.

### Highlights

**Living flower picker**
- 36-petal spectrum flower with real CSS 3D depth — petals cup forward.
- Idle float ("drifting in space"), a pointer-driven breeze that tilts the
  bloom, and petals that lift and sway away from the cursor.
- Botanical pistil (stigmatic disc + stamens). Click it to fold the flower into
  a leafy bud, and click again to bloom it open.

**Color tools**
- Outer hue wheel and a light → dark shade arc with a live handle.
- Precision hue, saturation, and bloom-speed controls.
- Harmony modes (spectrum, complementary, triadic, analogous, monochrome,
  split-complementary) and brand-mood presets.
- Lockable hue / saturation / lightness channels.
- HEX, RGB, HSL, OKLCH, OKLab outputs with generated color names.
- WCAG contrast helper and A/B color compare.
- Image-to-flower palette extraction.

**Save & export**
- Saved color bouquet, recent history.
- Export as CSS custom properties or JSON.

**Experience**
- Focus mode: collapse the panels so the flower canvas is centered; expand to
  return to the full studio.
- In-app help panel and per-control tooltips.
- Smooth 60 fps rendering; honors reduced-motion preferences.
- Custom flower app icon and favicons.

**Beyond the browser**
- Chrome / Edge extension.
- Color engine module, REST API, and an MCP server so developers and AI agents
  can convert colors, generate palettes, and check contrast programmatically.

### Notes
- Dependency-free static web app; runs offline, no build step.
