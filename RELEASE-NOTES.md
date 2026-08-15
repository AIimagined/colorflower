# Colorflower — Release Notes

## v1.6.0

Color science, brand kits, and a leaner studio.

### Highlights

**Learn — interactive color theory**
- A new in-app **Learn** dialog: eight interactive chapters — the color
  wheel, pigment vs. light mixing, hue/saturation/lightness,
  tint/shade/tone, harmony geometry, contrast, color psychology, and named
  colors — each with live, manipulable examples.

**Brand kit generator**
- New **Brand** dialog: pick a seed color on a miniature flower picker and
  generate a complete light/dark semantic token theme — backgrounds,
  surfaces, text, accents — with a WCAG contrast audit run on every pairing.
- Brand color dataset: look up any of ~700 brands, search by name, or find
  the nearest brands to a color by perceptual (ΔE) distance.

**Engine upgrades** (shared by the app, REST API, and MCP server)
- **Spectral pigment mixing** (Kubelka-Munk) — colors mix like real paint.
- 10-step tint/shade ramps and alpha-blended dark-background palettes.
- OKLCH/OKLab conversions, perceptual ΔE (OKLab) distance, tint/shade/tone scales,
  harmony suggestions with rationale, and one-call theme generation.
- 25-test engine suite (`node --test core/color-engine.test.js`).

**Agent & developer surfaces**
- MCP server grown to **14 tools + 2 prompts**, all returning typed
  `structuredContent` with read-only/idempotent annotations.
- REST API mirrors every engine capability and serves an OpenAPI 3.1 spec
  plus a plugin manifest for function-calling agents.
- New portable **taste skill** (`skills/colorflower-taste/`) encoding palette
  judgment for AI agents, and `DESIGN.md` documenting the app's own tokens.

**Leaner studio UI**
- **Zen / Focus / Studio** density switcher — from a minimal swatch-and-
  sliders strip to the full toolkit; your choice is remembered.
- Single-screen layout: the studio fits the viewport with no page scrolling,
  the tool panel flows into two columns, and the flower now scales itself to
  the space available instead of overlapping neighboring controls.
- Tooltips rebuilt — positioned in viewport space so they are never clipped
  by panel edges or the screen.
- Decluttered chrome: removed decorative badges and duplicate labels.
- Bouquet chips can be removed individually (×).

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
