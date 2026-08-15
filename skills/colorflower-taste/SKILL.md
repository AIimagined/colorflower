---
name: colorflower-taste
description: Use when picking, generating, or validating a color palette or theme (for a product, brand, UI, or design system) with an agent — encodes when to use which harmony, the 60-30-10 role rule, hard contrast gates, dark-mode derivation, and anti-slop color bans, routed through the Colorflower MCP/REST tools.
---

# Colorflower taste

This skill is the judgment layer for the Colorflower color tools (MCP server
`mcp/server.js`, REST API `api/server.js`, engine `core/color-engine.js`).
The tools do the math; this file tells you which calls to make and in what
order so the result is actually tasteful, not just technically valid.

Rules here are mechanical and checkable — no vibes ("make it elegant"). If a
rule can't be verified by inspecting the output, it doesn't belong here.

## Workflow (do these in order)

1. **Infer the mood.** From the request, pick one of: `balanced`, `luxury`,
   `calm`, `playful`, `clinical`, `editorial`, `nature`.
2. **Pick a harmony.** Call `suggest_harmony(mood, useCase)` — don't guess
   the harmony yourself. It returns `{harmony, saturationCap, rationale}`.
   See the table below if you need to reason about it without the tool.
3. **Generate.** Call `generate_theme(seed, mood)` for a complete UI (it
   already applies steps 2 and 4 internally), or `generate_palette` /
   `generate_shades` for a bare palette/ramp.
4. **Gate on contrast — hard requirement.** Run `check_contrast` (or read
   `generate_theme`'s `contrastAudit`) on every foreground/background pair
   that will hold text. If ANY pair fails AA (4.5:1 body, 3:1 large text),
   do not ship it — swap in an adjacent shade from the ramp and recheck.
   Never eyeball contrast; always call the tool.
5. **Emit semantic tokens**, never numbered ones. Use role names —
   `--surface`, `--text-primary`, `--text-secondary`, `--brand`, `--accent`
   — not `--color-1`, `--color-2`. `palette_css_tokens` / `generate_theme`
   already do this.
6. **Dark mode**: never reuse a light-mode hex value on a dark background.
   Call `derive_dark_palette` (or use `generate_theme`'s `dark`/`dark_theme`
   output) — it alpha-blends onto the dark background so results stay
   desaturated and lifted, never neon-on-black.

## Harmony table

| Mood / use case | Harmony | Saturation cap | Why |
|---|---|---|---|
| calm, clinical, balanced | monochrome | 55% | One hue, varied tones — guaranteed cohesion, lowest visual noise. Dashboards, docs, health/clinical products. |
| nature, editorial (content) | analogous | 70% | Adjacent hues read as naturally harmonious. Default for content-heavy or editorial UI. |
| playful | triadic | 65% | Three evenly-spaced hues give balanced energy. Cap two of the three at lower saturation so one still leads — never run all three at full saturation. |
| luxury | split-complementary | 60% | Complementary-level contrast with less tension. Reads premium, not loud. |
| editorial (single CTA accent) | complementary | 40% | Opposite hues at LOW saturation on the base side, full saturation reserved for the one accent (the 10%). Never run both sides at full saturation — that reads as an alert, not a brand. |

Beyond this table, `tetradic` and `square` harmonies exist for cases needing
4 balanced hues (data-viz categorical colors, multi-tenant brand systems) —
use sparingly, cap every non-primary hue's saturation.

## 60-30-10 as token roles

- **60% (dominant)** = the neutral surface ladder — `background`, `surface`.
  Derive from `generate_shades(seed)`'s lightest 1-2 steps, not from a
  separate "neutral gray" unrelated to the brand hue — a faint hue tint in
  the surfaces is what makes a theme feel designed instead of default.
- **30% (secondary)** = the brand color itself — `brand` role, `shades[5]`
  (the seed).
- **10% (accent)** = ONE color, saturation under 80%, used identically
  everywhere it appears (buttons, active states, focus rings, links). Never
  more than one saturated accent color in a single UI — that's the single
  most common way agent-generated UI reads as "AI slop."

## Anti-slop bans (mechanical, check before shipping)

- No pure `#000000` background — use a near-black with a hint of the brand
  hue (e.g. `generate_shades` darkest steps, or `#141414` as a neutral floor).
- No neon-on-dark (any color at >85% lightness *and* >70% saturation
  directly on a background darker than ~20% lightness). Run it through
  `derive_dark_palette` instead of hand-picking a bright hex.
- No default purple-to-blue gradient as a decorative device unless the brand
  hue actually is purple/blue — it's the most recognizable "AI made this"
  tell.
- Max one saturated accent per screen (see 60-30-10 above).
- Every text/background pair passes AA before it ships (see step 4).

## Related

Repo root `DESIGN.md` documents Colorflower's own UI in this same token
format. `core/color-engine.js` has the underlying math (`suggestHarmony`,
`generateShades`, `deriveDark`, `auditPairs`) if you need to reason about
it without calling the MCP/REST tools.
