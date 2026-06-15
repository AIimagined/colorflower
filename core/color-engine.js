// Colorflower color engine — pure, dependency-free color operations shared by
// the web app, the MCP server, and the REST API. Mirrors the algorithms used in
// src/app.js so results are consistent everywhere.
//
// Works as an ES module in Node and the browser.

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeHue(hue) {
  return ((hue % 360) + 360) % 360;
}

// ---- Conversions -----------------------------------------------------------

export function rgbToHsl(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
  }
  if (h < 0) h += 360;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb(h, s, l) {
  const sNorm = s / 100, lNorm = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n) => lNorm - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(255 * f(0)), g: Math.round(255 * f(8)), b: Math.round(255 * f(4)) };
}

export function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((p) => clamp(Math.round(p), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

export function hslToHex(h, s, l) {
  const rgb = hslToRgb(h, s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

export function hexToRgb(hex) {
  const raw = String(hex || '').trim().replace('#', '');
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(raw)) return null;
  const full = raw.length === 3 ? raw.split('').map((p) => p + p).join('') : raw;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16)
  };
}

function srgbToLinear(value) {
  const v = clamp(value / 255, 0, 1);
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function rgbToOklab(r, g, b) {
  const red = srgbToLinear(r), green = srgbToLinear(g), blue = srgbToLinear(b);
  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;
  const lr = Math.cbrt(l), mr = Math.cbrt(m), sr = Math.cbrt(s);
  return {
    l: 0.2104542553 * lr + 0.7936177850 * mr - 0.0040720468 * sr,
    a: 1.9779984951 * lr - 2.4285922050 * mr + 0.4505937099 * sr,
    b: 0.0259040371 * lr + 0.7827717662 * mr - 0.8086757660 * sr
  };
}

export function formatOklab(rgb) {
  const o = rgbToOklab(rgb.r, rgb.g, rgb.b);
  return `oklab(${(o.l * 100).toFixed(1)}% ${o.a.toFixed(4)} ${o.b.toFixed(4)})`;
}

export function formatOklch(rgb) {
  const o = rgbToOklab(rgb.r, rgb.g, rgb.b);
  const chroma = Math.sqrt(o.a * o.a + o.b * o.b);
  let hue = Math.atan2(o.b, o.a) * 180 / Math.PI;
  if (hue < 0) hue += 360;
  return `oklch(${(o.l * 100).toFixed(1)}% ${chroma.toFixed(4)} ${Math.round(hue)})`;
}

// ---- Parsing ---------------------------------------------------------------

function parseFunctionArgs(input, name) {
  const body = input.trim().slice(name.length + 1, -1).trim();
  const [main] = body.split('/');
  return main.replaceAll(',', ' ').split(/\s+/).filter(Boolean);
}

function fromRgb(r, g, b) {
  const hsl = rgbToHsl(r, g, b);
  return { h: Math.round(hsl.h), s: Math.round(hsl.s), l: Math.round(hsl.l) };
}

// Parse hex / rgb() / rgba() / hsl() / hsla() / {h,s,l} into {h,s,l}. Throws on
// unrecognised input.
export function parseColor(input) {
  if (typeof input === 'object' && input !== null) {
    return { h: Number(input.h) || 0, s: Number(input.s) || 0, l: Number(input.l) ?? 50 };
  }
  const color = String(input).trim().toLowerCase();
  if (color.startsWith('#')) {
    const rgb = hexToRgb(color);
    if (!rgb) throw new Error(`Invalid hex color: ${input}`);
    return fromRgb(rgb.r, rgb.g, rgb.b);
  }
  if (color.startsWith('rgb(') || color.startsWith('rgba(')) {
    const args = parseFunctionArgs(color, color.startsWith('rgba') ? 'rgba' : 'rgb');
    const channel = (t) => String(t).endsWith('%')
      ? clamp(Number.parseFloat(t), 0, 100) / 100 * 255
      : clamp(Number.parseFloat(t), 0, 255);
    return fromRgb(channel(args[0]), channel(args[1]), channel(args[2]));
  }
  if (color.startsWith('hsl(') || color.startsWith('hsla(')) {
    const args = parseFunctionArgs(color, color.startsWith('hsla') ? 'hsla' : 'hsl');
    return {
      h: normalizeHue(Number.parseFloat(args[0]) || 0),
      s: clamp(Number.parseFloat(args[1]) || 0, 0, 100),
      l: clamp(Number.parseFloat(args[2]) || 0, 0, 100)
    };
  }
  throw new Error(`Unrecognised color: ${input}`);
}

// ---- Naming ----------------------------------------------------------------

const HUE_NAMES = [
  ['Crimson', 15], ['Tangerine', 45], ['Marigold', 70], ['Meadow', 145],
  ['Aqua', 190], ['Azure', 225], ['Violet', 275], ['Magenta', 325], ['Rose', 360]
];

export function getHueFamily(hue) {
  const n = normalizeHue(hue);
  return HUE_NAMES.find(([, end]) => n <= end)?.[0] || 'Rose';
}

export function nameColor({ h, s, l }) {
  const hueName = getHueFamily(h);
  const tone = l < 30 ? 'Ink'
    : l > 82 ? 'Mist'
    : s < 28 ? 'Stone'
    : s > 82 ? 'Signal'
    : l > 62 ? 'Bloom'
    : 'Field';
  return `${tone} ${hueName}`;
}

// ---- Contrast (WCAG) -------------------------------------------------------

export function relativeLuminance(rgb) {
  const ch = (v) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(rgb.r) + 0.7152 * ch(rgb.g) + 0.0722 * ch(rgb.b);
}

export function contrast(foreground, background) {
  const fg = hexToRgb(toHex(foreground)) || { r: 0, g: 0, b: 0 };
  const bg = hexToRgb(toHex(background)) || { r: 255, g: 255, b: 255 };
  const l1 = relativeLuminance(fg), l2 = relativeLuminance(bg);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  const r = Math.round(ratio * 100) / 100;
  return {
    ratio: r,
    AA: r >= 4.5,
    AAA: r >= 7,
    AA_large: r >= 3,
    AAA_large: r >= 4.5,
    grade: r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA Large' : 'Fail'
  };
}

// ---- Full conversion -------------------------------------------------------

function toHex(input) {
  const { h, s, l } = parseColor(input);
  return hslToHex(h, s, l);
}

// Convert any supported input into every format + a generated name.
export function convertColor(input) {
  const { h, s, l } = parseColor(input);
  const rgb = hslToRgb(h, s, l);
  return {
    h: Math.round(h), s: Math.round(s), l: Math.round(l),
    hex: rgbToHex(rgb.r, rgb.g, rgb.b),
    rgb,
    rgbString: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    hsl: `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`,
    oklch: formatOklch(rgb),
    oklab: formatOklab(rgb),
    name: nameColor({ h, s, l })
  };
}

// ---- Palette generation ----------------------------------------------------

export const MOOD_PRESETS = {
  balanced: { saturation: 0, lightness: 0, hueBias: 0 },
  luxury: { saturation: -8, lightness: -12, hueBias: 270 },
  calm: { saturation: -22, lightness: 10, hueBias: 205 },
  playful: { saturation: 12, lightness: 8, hueBias: 42 },
  clinical: { saturation: -30, lightness: 16, hueBias: 188 },
  editorial: { saturation: 8, lightness: -8, hueBias: 348 },
  nature: { saturation: -5, lightness: -2, hueBias: 118 }
};

export const HARMONY_STEPS = {
  spectrum: null,
  complementary: [0, 180],
  triadic: [0, 120, 240],
  analogous: [-36, -14, 0, 18, 38],
  monochrome: [0],
  split: [0, 150, 210]
};

export const HARMONIES = Object.keys(HARMONY_STEPS);
export const MOODS = Object.keys(MOOD_PRESETS);

// Generate a palette of `count` colors using a harmony rule + brand mood.
// Mirrors the web app's layer generator, flattened to a single list.
export function generatePalette({ harmony = 'spectrum', mood = 'balanced', baseHue = 0, count = 9 } = {}) {
  if (!(harmony in HARMONY_STEPS)) throw new Error(`Unknown harmony: ${harmony}`);
  if (!(mood in MOOD_PRESETS)) throw new Error(`Unknown mood: ${mood}`);
  const moodPreset = MOOD_PRESETS[mood];
  const steps = HARMONY_STEPS[harmony];
  const start = harmony === 'spectrum' ? 0 : normalizeHue(baseHue || moodPreset.hueBias);
  const colors = [];
  for (let i = 0; i < count; i += 1) {
    let hue;
    if (!steps) {
      hue = normalizeHue((i / count) * 360 + start);
    } else {
      const step = steps[i % steps.length];
      const cycle = Math.floor(i / steps.length);
      hue = normalizeHue(start + step + cycle * 9);
    }
    const saturation = clamp(70 + ((i * 9) % 24) + moodPreset.saturation, 58, 96);
    const lightness = clamp(42 + ((i * 11) % 28) + moodPreset.lightness, 34, 76);
    colors.push(convertColor({ h: hue, s: saturation, l: lightness }));
  }
  return colors;
}

// Build the CSS custom-property token block from a list of colors.
export function buildCssTokens(colors) {
  const lines = [':root {'];
  colors.forEach((c, i) => {
    const slot = i + 1;
    lines.push(`  --colorflower-${slot}: ${c.hex};`);
    lines.push(`  --colorflower-${slot}-rgb: ${c.rgb.r}, ${c.rgb.g}, ${c.rgb.b};`);
    lines.push(`  --colorflower-${slot}-oklch: ${c.oklch.replace('oklch(', '').replace(')', '')};`);
  });
  lines.push('}');
  return lines.join('\n');
}
