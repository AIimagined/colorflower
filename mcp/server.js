// Colorflower MCP server — exposes the shared color engine as MCP tools over
// stdio, so agents/clients can convert colors, generate palettes/themes,
// mix paint, look up brand colors, and check contrast.
//
// Run:  node mcp/server.js   (after `npm install` in this folder)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
  convertColor, contrast, generatePalette, nameColor, parseColor,
  buildCssTokens, HARMONIES, MOODS, generateShades, deriveDark,
  suggestHarmony, mixColors, tintScale, shadeScale, toneScale,
  getBrand, searchBrands, nearestBrands, generateTheme, nearestNamedColor
} from '../core/color-engine.js';

const json = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data });

// All Colorflower tools are pure functions over their inputs (or read-only
// lookups against a bundled dataset): no side effects, safe to retry, safe
// to run in parallel, no external network calls at request time.
const READ_ONLY = { readOnlyHint: true, idempotentHint: true, openWorldHint: false, destructiveHint: false };

const server = new McpServer({ name: 'colorflower', version: '1.6.0' });

const colorField = z.string().describe('e.g. "#e93a3a", "rgb(233,58,58)", or "hsl(0,80%,57%)"');
const hexField = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a 6-digit hex color, e.g. #e93a3a');

server.registerTool('convert_color', {
  title: 'Convert color',
  description: 'Convert a color (hex, rgb(), hsl(), or {h,s,l}) into HEX, RGB, HSL, OKLCH, OKLab, plus a generated name.',
  inputSchema: { color: colorField },
  outputSchema: {
    h: z.number(), s: z.number(), l: z.number(), hex: z.string(),
    rgb: z.object({ r: z.number(), g: z.number(), b: z.number() }),
    rgbString: z.string(), hsl: z.string(), oklch: z.string(), oklab: z.string(), name: z.string()
  },
  annotations: { ...READ_ONLY, title: 'Convert color' }
}, async ({ color }) => json(convertColor(color)));

server.registerTool('generate_palette', {
  title: 'Generate palette',
  description: 'Generate a color palette using a harmony rule and brand mood.',
  inputSchema: {
    harmony: z.enum(HARMONIES).default('spectrum'),
    mood: z.enum(MOODS).default('balanced'),
    baseHue: z.number().min(0).max(360).default(0).describe('Anchor hue in degrees (ignored for spectrum).'),
    count: z.number().int().min(1).max(36).default(9)
  },
  outputSchema: { colors: z.array(z.any()) },
  annotations: { ...READ_ONLY, title: 'Generate palette' }
}, async (args) => json({ colors: generatePalette(args) }));

server.registerTool('check_contrast', {
  title: 'Check WCAG contrast',
  description: 'Compute the WCAG contrast ratio between a foreground and background color and the AA/AAA pass results.',
  inputSchema: { foreground: colorField, background: colorField },
  outputSchema: {
    foreground: z.string(), background: z.string(), ratio: z.number(),
    AA: z.boolean(), AAA: z.boolean(), AA_large: z.boolean(), AAA_large: z.boolean(), grade: z.string()
  },
  annotations: { ...READ_ONLY, title: 'Check contrast' }
}, async ({ foreground, background }) => json({ foreground, background, ...contrast(foreground, background) }));

server.registerTool('name_color', {
  title: 'Name a color',
  description: 'Return both Colorflower\'s generated poetic name (e.g. "Bloom Crimson") and the nearest real CSS named color for a color.',
  inputSchema: { color: colorField },
  outputSchema: { color: z.string(), name: z.string(), nearestCssColor: z.object({ name: z.string(), hex: z.string(), distance: z.number() }) },
  annotations: { ...READ_ONLY, title: 'Name a color' }
}, async ({ color }) => json({ color, name: nameColor(parseColor(color)), nearestCssColor: nearestNamedColor(color) }));

server.registerTool('palette_css_tokens', {
  title: 'Palette as CSS tokens',
  description: 'Generate a palette and return it as :root CSS custom properties.',
  inputSchema: {
    harmony: z.enum(HARMONIES).default('spectrum'),
    mood: z.enum(MOODS).default('balanced'),
    baseHue: z.number().min(0).max(360).default(0),
    count: z.number().int().min(1).max(36).default(9)
  },
  outputSchema: { css: z.string() },
  annotations: { ...READ_ONLY, title: 'Palette CSS tokens' }
}, async (args) => json({ css: buildCssTokens(generatePalette(args)) }));

server.registerTool('generate_shades', {
  title: 'Generate 10-shade ramp',
  description: 'Generate a 10-step tint/shade ramp from a seed color (Ant Design-style HSB stepping). The seed itself is index 5.',
  inputSchema: { seed: colorField },
  outputSchema: { seed: z.string(), shades: z.array(hexField) },
  annotations: { ...READ_ONLY, title: 'Generate shade ramp' }
}, async ({ seed }) => json({ seed, shades: generateShades(seed) }));

server.registerTool('derive_dark_palette', {
  title: 'Derive dark-mode palette',
  description: 'Alpha-blend a light 10-shade ramp onto a dark background so it reads correctly in dark mode, instead of reusing light-mode hex values.',
  inputSchema: { shades: z.array(hexField).length(10), background: hexField.default('#141414') },
  outputSchema: { shades: z.array(hexField) },
  annotations: { ...READ_ONLY, title: 'Derive dark palette' }
}, async ({ shades, background }) => json({ shades: deriveDark(shades, background) }));

server.registerTool('suggest_harmony', {
  title: 'Suggest a color harmony',
  description: 'Recommend a harmony rule (monochrome/analogous/triadic/split/complementary) and a saturation ceiling for a product mood, with a one-line rationale.',
  inputSchema: { mood: z.enum(MOODS).default('balanced'), useCase: z.string().optional() },
  outputSchema: { harmony: z.string(), saturationCap: z.number(), rationale: z.string(), mood: z.string(), useCase: z.string().optional() },
  annotations: { ...READ_ONLY, title: 'Suggest harmony' }
}, async ({ mood, useCase }) => json(suggestHarmony(mood, useCase)));

server.registerTool('mix_colors', {
  title: 'Mix colors like paint',
  description: 'Physically-plausible pigment mixing (Kubelka-Munk): blue + yellow makes green, not gray, unlike naive RGB averaging.',
  inputSchema: {
    colors: z.array(colorField).min(2).describe('Colors to mix.'),
    weights: z.array(z.number().min(0)).min(2).describe('Weight per color, same length as colors (need not sum to 1).')
  },
  outputSchema: { hex: z.string(), rgb: z.object({ r: z.number(), g: z.number(), b: z.number() }) },
  annotations: { ...READ_ONLY, title: 'Mix colors' }
}, async ({ colors, weights }) => json(await mixColors(colors, weights)));

server.registerTool('tint_shade_tone', {
  title: 'Tint, shade, or tone a color',
  description: 'Mix a color toward white (tint), black (shade), or mid-gray (tone) in `steps` evenly-spaced stops. First stop is the seed itself.',
  inputSchema: {
    seed: colorField,
    toward: z.enum(['tint', 'shade', 'tone']).default('tint'),
    steps: z.number().int().min(2).max(20).default(6)
  },
  outputSchema: { seed: z.string(), toward: z.string(), colors: z.array(z.string()) },
  annotations: { ...READ_ONLY, title: 'Tint / shade / tone' }
}, async ({ seed, toward, steps }) => {
  const fn = toward === 'shade' ? shadeScale : toward === 'tone' ? toneScale : tintScale;
  return json({ seed, toward, colors: await fn(seed, steps) });
});

server.registerTool('get_brand_color', {
  title: 'Get a brand\'s color(s)',
  description: 'Look up a company/brand\'s primary color and full palette by name (e.g. "spotify", "stripe"). Dataset is community-collected (2019) plus a small curated overrides layer for major rebrands — verify against the brand\'s current guidelines for production use.',
  inputSchema: { name: z.string() },
  outputSchema: { name: z.string(), found: z.boolean().optional(), primary: z.string().optional(), colors: z.array(z.string()).optional() },
  annotations: { ...READ_ONLY, title: 'Get brand color' }
}, async ({ name }) => {
  const brand = await getBrand(name);
  return json(brand ? { ...brand, found: true } : { name, found: false });
});

server.registerTool('search_brands', {
  title: 'Search brand names',
  description: 'Find brand names in the dataset matching a query (for discovery when the exact name is unknown).',
  inputSchema: { query: z.string(), limit: z.number().int().min(1).max(50).default(10) },
  outputSchema: { query: z.string(), matches: z.array(z.string()) },
  annotations: { ...READ_ONLY, title: 'Search brands' }
}, async ({ query, limit }) => json({ query, matches: await searchBrands(query, limit) }));

server.registerTool('nearest_brands', {
  title: 'Nearest brand colors',
  description: 'Rank brands by how perceptually close their color is to a given color (OKLab distance).',
  inputSchema: { color: colorField, count: z.number().int().min(1).max(20).default(5) },
  outputSchema: { color: z.string(), matches: z.array(z.object({ brand: z.string(), hex: z.string(), distance: z.number() })) },
  annotations: { ...READ_ONLY, title: 'Nearest brands' }
}, async ({ color, count }) => json({ color, matches: await nearestBrands(color, count) }));

server.registerTool('generate_theme', {
  title: 'Generate a full theme',
  description: 'One call: seed color + mood -> a suggested harmony, a 10-shade ramp, its dark-mode derivation, a light+dark semantic token mapping (background/surface/text/brand/accent), and a WCAG contrast audit of that mapping. The tool to reach for when asked to "make a theme" or "build a color system".',
  inputSchema: { seed: colorField, mood: z.enum(MOODS).default('balanced') },
  outputSchema: { seed: z.string(), mood: z.string(), harmony: z.any(), shades: z.array(z.string()), dark: z.array(z.string()), light: z.any(), dark_theme: z.any(), contrastAudit: z.any() },
  annotations: { ...READ_ONLY, title: 'Generate theme' }
}, async ({ seed, mood }) => json(generateTheme(seed, mood)));

server.registerPrompt('design_palette', {
  title: 'Design a palette',
  description: 'Design an accessible color palette for a described product/brand and mood.',
  argsSchema: {
    description: z.string().describe('What the product/brand is, e.g. "a calm meditation app" or "an energetic sports brand".'),
    mood: z.enum(MOODS).optional()
  }
}, ({ description, mood }) => ({
  messages: [{
    role: 'user',
    content: {
      type: 'text',
      text: `Design a color palette for: ${description}${mood ? ` (mood: ${mood})` : ''}.\n\n`
        + `Use the Colorflower MCP tools in this order: 1) suggest_harmony to pick a harmony rule and saturation cap for the mood, `
        + `2) generate_theme (or generate_palette) with that harmony, 3) check_contrast / the contrastAudit on every text/background pair `
        + `and regenerate if anything fails AA, 4) palette_css_tokens or the theme's tokens for the final deliverable. `
        + `Use at most one saturated accent color; keep everything else neutral (60-30-10 rule).`
    }
  }]
}));

server.registerPrompt('audit_contrast', {
  title: 'Audit contrast',
  description: 'Check a set of foreground/background color pairs against WCAG AA/AAA.',
  argsSchema: { pairs: z.string().describe('Describe the fg/bg color pairs to check, e.g. "text #222 on background #fff, and #fff on #1677ff".') }
}, ({ pairs }) => ({
  messages: [{
    role: 'user',
    content: {
      type: 'text',
      text: `Using the check_contrast tool, verify WCAG AA (4.5:1 body text, 3:1 large text) for each of these pairs: ${pairs}. `
        + `Report the ratio and grade for each, and flag any failing pair with a suggested fix (darken/lighten by one shade step).`
    }
  }]
}));

const transport = new StdioServerTransport();
await server.connect(transport);
