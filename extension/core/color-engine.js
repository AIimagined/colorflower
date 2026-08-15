// Colorflower color engine — pure, dependency-free color operations shared by
// the web app, the MCP server, and the REST API. Mirrors the algorithms used in
// src/app.js so results are consistent everywhere.
//
// Works as an ES module in Node and the browser. Vendored spectral.js (see
// vendor/NOTICE.md, MIT) is loaded via dynamic import() only inside the
// mixing functions below — never a static import — so this file stays
// loadable as a plain <script type="module"> with zero build step.

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

function linearToSrgb(value) {
  const v = clamp(value, 0, 1);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

// Inverse of rgbToOklab: OKLab -> sRGB (0-255, unclamped-to-gamut rounding).
export function oklabToRgb(l, a, b) {
  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.2914855480 * b;
  const l3 = lPrime ** 3, m3 = mPrime ** 3, s3 = sPrime ** 3;
  const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;
  return {
    r: Math.round(linearToSrgb(r) * 255),
    g: Math.round(linearToSrgb(g) * 255),
    b: Math.round(linearToSrgb(bl) * 255)
  };
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

// OKLCH (l 0-1, c 0+, h degrees) <-> sRGB. OKLCH is the polar form of OKLab:
// c = chroma (distance from neutral axis), h = hue angle.
export function oklchToRgb(l, c, h) {
  const hr = h * Math.PI / 180;
  return oklabToRgb(l, c * Math.cos(hr), c * Math.sin(hr));
}

export function rgbToOklch(r, g, b) {
  const o = rgbToOklab(r, g, b);
  const c = Math.sqrt(o.a * o.a + o.b * o.b);
  let h = Math.atan2(o.b, o.a) * 180 / Math.PI;
  if (h < 0) h += 360;
  return { l: o.l, c, h };
}

function isInSrgbGamut(r, g, b) {
  return r >= -0.5 && r <= 255.5 && g >= -0.5 && g <= 255.5 && b >= -0.5 && b <= 255.5;
}

// Same gamma curve as linearToSrgb but WITHOUT clamping the linear input
// first — needed here so out-of-gamut values actually read as out-of-range
// instead of being silently clipped to [0,1] before we can detect it.
function linearToSrgbUnclamped(value) {
  const sign = value < 0 ? -1 : 1;
  const v = Math.abs(value);
  return sign * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
}

function oklchToRgbRaw(l, c, h) {
  const hr = h * Math.PI / 180;
  const a = c * Math.cos(hr), b = c * Math.sin(hr);
  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.2914855480 * b;
  const l3 = lPrime ** 3, m3 = mPrime ** 3, s3 = sPrime ** 3;
  return {
    r: linearToSrgbUnclamped(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3) * 255,
    g: linearToSrgbUnclamped(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3) * 255,
    b: linearToSrgbUnclamped(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3) * 255
  };
}

// A color leaving sRGB gets its hue/lightness preserved and chroma reduced
// until it lands inside the gamut (binary search), instead of naive RGB
// clipping which shifts hue and lightness. Returns { rgb, hex, wasClamped,
// requestedChroma, clampedChroma }.
export function clampToSrgbByChroma(l, c, h) {
  const raw = oklchToRgbRaw(l, c, h);
  if (isInSrgbGamut(raw.r, raw.g, raw.b)) {
    const rgb = { r: Math.round(clamp(raw.r, 0, 255)), g: Math.round(clamp(raw.g, 0, 255)), b: Math.round(clamp(raw.b, 0, 255)) };
    return { rgb, hex: rgbToHex(rgb.r, rgb.g, rgb.b), wasClamped: false, requestedChroma: c, clampedChroma: c };
  }
  let lo = 0, hi = c;
  for (let i = 0; i < 20; i += 1) {
    const mid = (lo + hi) / 2;
    const test = oklchToRgbRaw(l, mid, h);
    if (isInSrgbGamut(test.r, test.g, test.b)) lo = mid; else hi = mid;
  }
  const clamped = oklchToRgbRaw(l, lo, h);
  const rgb = { r: Math.round(clamp(clamped.r, 0, 255)), g: Math.round(clamp(clamped.g, 0, 255)), b: Math.round(clamp(clamped.b, 0, 255)) };
  return { rgb, hex: rgbToHex(rgb.r, rgb.g, rgb.b), wasClamped: true, requestedChroma: c, clampedChroma: lo };
}

// Perceptual distance between two colors in OKLab space. ~1.0 = "just
// noticeable" territory; under ~2 reads as near-identical to most eyes.
// Accepts anything parseColor() accepts (hex, rgb(), hsl(), {h,s,l}).
export function deltaE(colorA, colorB) {
  const toOklab = (input) => {
    const { h, s, l } = parseColor(input);
    const rgb = hslToRgb(h, s, l);
    return rgbToOklab(rgb.r, rgb.g, rgb.b);
  };
  const a = toOklab(colorA), b = toOklab(colorB);
  return Math.sqrt((a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2) * 100;
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

// ---- CSS named colors -------------------------------------------------------

// The 148 CSS Color Module named colors (gray/grey pairs both included, as
// the spec defines both spellings as distinct valid keywords). Inlined
// rather than a JSON file so this module stays a single dependency-free
// file that works identically imported in Node or the browser.
export const NAMED_COLORS = [
  ['aliceblue', '#f0f8ff'], ['antiquewhite', '#faebd7'], ['aqua', '#00ffff'], ['aquamarine', '#7fffd4'],
  ['azure', '#f0ffff'], ['beige', '#f5f5dc'], ['bisque', '#ffe4c4'], ['black', '#000000'],
  ['blanchedalmond', '#ffebcd'], ['blue', '#0000ff'], ['blueviolet', '#8a2be2'], ['brown', '#a52a2a'],
  ['burlywood', '#deb887'], ['cadetblue', '#5f9ea0'], ['chartreuse', '#7fff00'], ['chocolate', '#d2691e'],
  ['coral', '#ff7f50'], ['cornflowerblue', '#6495ed'], ['cornsilk', '#fff8dc'], ['crimson', '#dc143c'],
  ['cyan', '#00ffff'], ['darkblue', '#00008b'], ['darkcyan', '#008b8b'], ['darkgoldenrod', '#b8860b'],
  ['darkgray', '#a9a9a9'], ['darkgreen', '#006400'], ['darkgrey', '#a9a9a9'], ['darkkhaki', '#bdb76b'],
  ['darkmagenta', '#8b008b'], ['darkolivegreen', '#556b2f'], ['darkorange', '#ff8c00'], ['darkorchid', '#9932cc'],
  ['darkred', '#8b0000'], ['darksalmon', '#e9967a'], ['darkseagreen', '#8fbc8f'], ['darkslateblue', '#483d8b'],
  ['darkslategray', '#2f4f4f'], ['darkslategrey', '#2f4f4f'], ['darkturquoise', '#00ced1'], ['darkviolet', '#9400d3'],
  ['deeppink', '#ff1493'], ['deepskyblue', '#00bfff'], ['dimgray', '#696969'], ['dimgrey', '#696969'],
  ['dodgerblue', '#1e90ff'], ['firebrick', '#b22222'], ['floralwhite', '#fffaf0'], ['forestgreen', '#228b22'],
  ['fuchsia', '#ff00ff'], ['gainsboro', '#dcdcdc'], ['ghostwhite', '#f8f8ff'], ['gold', '#ffd700'],
  ['goldenrod', '#daa520'], ['gray', '#808080'], ['grey', '#808080'], ['green', '#008000'],
  ['greenyellow', '#adff2f'], ['honeydew', '#f0fff0'], ['hotpink', '#ff69b4'], ['indianred', '#cd5c5c'],
  ['indigo', '#4b0082'], ['ivory', '#fffff0'], ['khaki', '#f0e68c'], ['lavender', '#e6e6fa'],
  ['lavenderblush', '#fff0f5'], ['lawngreen', '#7cfc00'], ['lemonchiffon', '#fffacd'], ['lightblue', '#add8e6'],
  ['lightcoral', '#f08080'], ['lightcyan', '#e0ffff'], ['lightgoldenrodyellow', '#fafad2'], ['lightgray', '#d3d3d3'],
  ['lightgreen', '#90ee90'], ['lightgrey', '#d3d3d3'], ['lightpink', '#ffb6c1'], ['lightsalmon', '#ffa07a'],
  ['lightseagreen', '#20b2aa'], ['lightskyblue', '#87cefa'], ['lightslategray', '#778899'], ['lightslategrey', '#778899'],
  ['lightsteelblue', '#b0c4de'], ['lightyellow', '#ffffe0'], ['lime', '#00ff00'], ['limegreen', '#32cd32'],
  ['linen', '#faf0e6'], ['magenta', '#ff00ff'], ['maroon', '#800000'], ['mediumaquamarine', '#66cdaa'],
  ['mediumblue', '#0000cd'], ['mediumorchid', '#ba55d3'], ['mediumpurple', '#9370db'], ['mediumseagreen', '#3cb371'],
  ['mediumslateblue', '#7b68ee'], ['mediumspringgreen', '#00fa9a'], ['mediumturquoise', '#48d1cc'], ['mediumvioletred', '#c71585'],
  ['midnightblue', '#191970'], ['mintcream', '#f5fffa'], ['mistyrose', '#ffe4e1'], ['moccasin', '#ffe4b5'],
  ['navajowhite', '#ffdead'], ['navy', '#000080'], ['oldlace', '#fdf5e6'], ['olive', '#808000'],
  ['olivedrab', '#6b8e23'], ['orange', '#ffa500'], ['orangered', '#ff4500'], ['orchid', '#da70d6'],
  ['palegoldenrod', '#eee8aa'], ['palegreen', '#98fb98'], ['paleturquoise', '#afeeee'], ['palevioletred', '#db7093'],
  ['papayawhip', '#ffefd5'], ['peachpuff', '#ffdab9'], ['peru', '#cd853f'], ['pink', '#ffc0cb'],
  ['plum', '#dda0dd'], ['powderblue', '#b0e0e6'], ['purple', '#800080'], ['rebeccapurple', '#663399'],
  ['red', '#ff0000'], ['rosybrown', '#bc8f8f'], ['royalblue', '#4169e1'], ['saddlebrown', '#8b4513'],
  ['salmon', '#fa8072'], ['sandybrown', '#f4a460'], ['seagreen', '#2e8b57'], ['seashell', '#fff5ee'],
  ['sienna', '#a0522d'], ['silver', '#c0c0c0'], ['skyblue', '#87ceeb'], ['slateblue', '#6a5acd'],
  ['slategray', '#708090'], ['slategrey', '#708090'], ['snow', '#fffafa'], ['springgreen', '#00ff7f'],
  ['steelblue', '#4682b4'], ['tan', '#d2b48c'], ['teal', '#008080'], ['thistle', '#d8bfd8'],
  ['tomato', '#ff6347'], ['turquoise', '#40e0d0'], ['violet', '#ee82ee'], ['wheat', '#f5deb3'],
  ['white', '#ffffff'], ['whitesmoke', '#f5f5f5'], ['yellow', '#ffff00'], ['yellowgreen', '#9acd32']
];

// Nearest CSS named color(s) to an arbitrary color, ranked by perceptual
// (OKLab) distance. Distinct from nameColor()'s generative "Bloom Crimson"
// style naming below — this returns real, standard CSS keywords.
export function nearestNamedColor(input, n = 1) {
  const ranked = NAMED_COLORS
    .map(([name, hex]) => ({ name, hex, distance: deltaE(input, hex) }))
    .sort((a, b) => a.distance - b.distance);
  return n === 1 ? ranked[0] : ranked.slice(0, n);
}

// ---- Contrast (WCAG) -------------------------------------------------------

export function relativeLuminance(rgb) {
  const ch = (v) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(rgb.r) + 0.7152 * ch(rgb.g) + 0.0722 * ch(rgb.b);
}

// Raw WCAG contrast ratio (1-21) between two already-parsed rgb objects.
export function contrastRatio(fgRgb, bgRgb) {
  const l1 = relativeLuminance(fgRgb), l2 = relativeLuminance(bgRgb);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// WCAG 2.1 pass/fail grade for a contrast ratio. `large` = 18pt+/14pt-bold+ text.
export function contrastGrade(ratio, { large = false } = {}) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return large ? 'AAA' : 'AA';
  if (ratio >= 3) return large ? 'AA' : 'FAIL';
  return 'FAIL';
}

// Whichever of black/white reads better on a given background.
export function bestTextOn(background) {
  const bg = hexToRgb(toHex(background)) || { r: 255, g: 255, b: 255 };
  const onBlack = contrastRatio({ r: 0, g: 0, b: 0 }, bg);
  const onWhite = contrastRatio({ r: 255, g: 255, b: 255 }, bg);
  return onWhite >= onBlack ? '#ffffff' : '#000000';
}

export function contrast(foreground, background) {
  const fg = hexToRgb(toHex(foreground)) || { r: 0, g: 0, b: 0 };
  const bg = hexToRgb(toHex(background)) || { r: 255, g: 255, b: 255 };
  const ratio = contrastRatio(fg, bg);
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

// Runs contrast() over every {fg, bg, label?} pair and flags failures.
// Used as the hard gate before a theme/token export goes out.
export function auditPairs(pairs) {
  const results = pairs.map((pair) => ({ ...pair, ...contrast(pair.fg, pair.bg) }));
  return { results, allPass: results.every((r) => r.AA), failing: results.filter((r) => !r.AA) };
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
  split: [0, 150, 210],
  tetradic: [0, 60, 180, 240],
  square: [0, 90, 180, 270]
};

export const HARMONIES = Object.keys(HARMONY_STEPS);
export const MOODS = Object.keys(MOOD_PRESETS);

// Mood/use-case -> harmony taste table. Mirrors the reasoning shipped in
// skills/colorflower-taste/SKILL.md so both the engine and the agent skill
// agree on the same recommendations.
const HARMONY_TABLE = [
  { moods: ['calm', 'clinical', 'balanced'], harmony: 'monochrome', saturationCap: 55,
    rationale: 'One hue, varied tones — guaranteed cohesion, low visual noise. Best for dashboards, docs, calm/clinical products.' },
  { moods: ['nature', 'editorial'], harmony: 'analogous', saturationCap: 70,
    rationale: 'Adjacent hues read as naturally harmonious. Good default for content-heavy or editorial UI.' },
  { moods: ['playful'], harmony: 'triadic', saturationCap: 65,
    rationale: 'Three evenly-spaced hues give balanced energy without chaos — cap two of the three at lower saturation so one still leads.' },
  { moods: ['luxury'], harmony: 'split', saturationCap: 60,
    rationale: 'Split-complementary gives complementary-level contrast with less tension — reads premium rather than loud.' },
  { moods: ['editorial'], harmony: 'complementary', saturationCap: 40,
    rationale: 'Opposite hues at low saturation on one side make a single accent (the 10%) pop against a muted dominant base. Never use both at full saturation.' }
];

// Recommend a harmony + saturation ceiling for a mood/use-case, with a
// one-line rationale. Falls back to monochrome (the safest default) for an
// unrecognised mood.
export function suggestHarmony(mood = 'balanced', useCase = '') {
  const entry = HARMONY_TABLE.find((row) => row.moods.includes(mood))
    || HARMONY_TABLE[0];
  return {
    harmony: entry.harmony,
    saturationCap: entry.saturationCap,
    rationale: entry.rationale,
    mood,
    useCase: useCase || undefined
  };
}

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

// ---- Spectral (Kubelka-Munk paint) mixing ----------------------------------
// vendor/spectral.min.js, MIT — see vendor/NOTICE.md.

let spectralPromise;
function loadSpectral() {
  if (!spectralPromise) {
    spectralPromise = import('../vendor/spectral.min.js').then((mod) => {
      // Node (CJS interop): mod.default is the {Color, mix, palette, gradient}
      // exports object. Browser: the UMD factory attaches to globalThis as a
      // side effect of being evaluated, whether via <script> or import().
      const lib = mod?.default?.Color ? mod.default : globalThis.spectral;
      if (!lib?.Color) throw new Error('spectral.js failed to load');
      return lib;
    });
  }
  return spectralPromise;
}

function toSpectralHex(input) {
  return hslToHex(...Object.values(parseColor(input)));
}

// Physically-plausible pigment mixing (blue + yellow -> green, not gray).
// colors: array of parseColor()-compatible inputs. weights: same length,
// need not sum to 1 (spectral.js normalizes). Returns { hex, rgb }.
export async function mixColors(colors, weights) {
  const spectral = await loadSpectral();
  const pairs = colors.map((c, i) => [new spectral.Color(toSpectralHex(c)), weights[i]]);
  const mixed = spectral.mix(...pairs);
  const rgb = hexToRgb(mixed.toString());
  return { hex: mixed.toString(), rgb };
}

// Sample a spectral gradient across positioned stops at t (0-1).
// stops: array of { color, at } (at 0-1); n: number of samples to return.
export async function spectralGradient(stops, n = 8) {
  const spectral = await loadSpectral();
  const args = stops.map((s) => [new spectral.Color(toSpectralHex(s.color)), s.at]);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const t = n === 1 ? 0 : i / (n - 1);
    const c = spectral.gradient(t, ...args);
    out.push(c.toString());
  }
  return out;
}

// Tint = mix toward white, shade = mix toward black, tone = mix toward
// mid-gray. `steps` colors, evenly spaced from the seed (t=0) to the target
// (t=1) inclusive.
async function scaleToward(seed, target, steps) {
  const spectral = await loadSpectral();
  const from = new spectral.Color(toSpectralHex(seed));
  const to = new spectral.Color(target);
  const out = [];
  for (let i = 0; i < steps; i += 1) {
    const t = steps === 1 ? 0 : i / (steps - 1);
    out.push(spectral.mix([from, 1 - t], [to, t]).toString());
  }
  return out;
}

export function tintScale(seed, steps = 6) { return scaleToward(seed, '#ffffff', steps); }
export function shadeScale(seed, steps = 6) { return scaleToward(seed, '#000000', steps); }
export function toneScale(seed, steps = 6) { return scaleToward(seed, '#808080', steps); }

// ---- Ant Design-style 10-shade ramp + dark derivation -----------------------
// Reimplements the @ant-design/colors generate.ts algorithm (MIT): seed sits
// at index 5 of 10 (0-based), 5 lighter steps above, 4 darker steps below,
// stepped in HSB. Verified against the published algorithm's step sizes.

function rgbToHsb(r, g, b) {
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
  return { h, s: max === 0 ? 0 : delta / max, b: max };
}

function hsbToRgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

function hueStep(hsb, i, isLight) {
  const HUE_STEP = 2;
  if (hsb.h >= 60 && hsb.h <= 240) return isLight ? hsb.h - HUE_STEP * i : hsb.h + HUE_STEP * i;
  return isLight ? hsb.h + HUE_STEP * i : hsb.h - HUE_STEP * i;
}

function saturationStep(hsb, i, isLight) {
  if (isLight) {
    if (i === 5) return hsb.s;
    return clamp(hsb.s - 0.16 * i, 0.06, 1);
  }
  if (i === 4) return clamp(hsb.s + 0.16, 0, 1);
  return clamp(hsb.s - 0.05 * i, 0, 1);
}

function brightnessStep(hsb, i, isLight) {
  return isLight ? clamp(hsb.b + 0.05 * i, 0, 1) : clamp(hsb.b - 0.15 * i, 0, 1);
}

// 10-color shade ramp for `seed` (any parseColor()-compatible input).
// Result[5] === the seed's own hex (0-based index, seed placed 6th of 10).
export function generateShades(seed) {
  const { h, s, l } = parseColor(seed);
  const seedRgb = hslToRgb(h, s, l);
  const hsb = rgbToHsb(seedRgb.r, seedRgb.g, seedRgb.b);
  const lightShades = [1, 2, 3, 4, 5].map((i) => {
    const rgb = hsbToRgb(normalizeHue(hueStep(hsb, i, true)), saturationStep(hsb, i, true), brightnessStep(hsb, i, true));
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }).reverse();
  const darkShades = [1, 2, 3, 4].map((i) => {
    const rgb = hsbToRgb(normalizeHue(hueStep(hsb, i, false)), saturationStep(hsb, i, false), brightnessStep(hsb, i, false));
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  });
  return [...lightShades, rgbToHex(seedRgb.r, seedRgb.g, seedRgb.b), ...darkShades];
}

// Alpha-blend weights for deriving a dark-mode ramp from a light one,
// applied index-by-index onto the dark background (Ant's darkColorMap).
const DARK_BLEND_MAP = [
  { index: 7, opacity: 0.15 }, { index: 6, opacity: 0.25 }, { index: 5, opacity: 0.3 },
  { index: 5, opacity: 0.45 }, { index: 5, opacity: 0.65 }, { index: 5, opacity: 0.85 },
  { index: 4, opacity: 0.9 }, { index: 3, opacity: 0.95 }, { index: 2, opacity: 0.97 },
  { index: 1, opacity: 0.98 }
];

// Blend a 10-shade light ramp onto a dark background so it reads correctly
// in dark mode — desaturated and lifted, never neon-on-black.
export function deriveDark(shades, background = '#141414') {
  const bg = hexToRgb(background);
  return DARK_BLEND_MAP.map(({ index, opacity }) => {
    const fg = hexToRgb(shades[index]);
    const blend = (ch) => Math.round(fg[ch] * opacity + bg[ch] * (1 - opacity));
    return rgbToHex(blend('r'), blend('g'), blend('b'));
  });
}

// ---- Brand colors ------------------------------------------------------
// vendor/brand-colors.json (MIT, 2019 dataset) + data/brand-overrides.json
// (curated post-2019 rebrands), merged at load time. See vendor/NOTICE.md.

let brandPromise;
function loadBrands() {
  if (!brandPromise) {
    brandPromise = Promise.all([
      import('../vendor/brand-colors.json', { with: { type: 'json' } }).then((m) => m.default),
      import('../data/brand-overrides.json', { with: { type: 'json' } }).then((m) => m.default).catch(() => ({}))
    ]).then(([base, overrides]) => ({ ...base, ...overrides }));
  }
  return brandPromise;
}

function slugify(name) {
  return String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Group a flat {brand, 'brand-2', 'brand-3': hex} map into
// { brand: [hex, hex, ...] }.
function groupBrands(flat) {
  const groups = {};
  for (const [key, hex] of Object.entries(flat)) {
    const base = key.replace(/-\d+$/, '');
    (groups[base] ||= []).push(hex);
  }
  return groups;
}

// All hex colors for a brand by (fuzzy) name. Returns null if not found.
// { primary, colors, source } — source is 'override' or 'dataset'.
export async function getBrand(name) {
  const flat = await loadBrands();
  const slug = slugify(name);
  if (!(slug in flat) && !Object.keys(flat).some((k) => k === slug || k.startsWith(`${slug}-`))) return null;
  const groups = groupBrands(flat);
  const colors = groups[slug];
  if (!colors) return null;
  return { name: slug, primary: colors[0], colors };
}

// Brand names matching a query substring, for agent-facing discoverability.
export async function searchBrands(query, limit = 10) {
  const flat = await loadBrands();
  const q = slugify(query);
  const groups = groupBrands(flat);
  return Object.keys(groups).filter((name) => name.includes(q)).slice(0, limit);
}

// Closest brand colors to an arbitrary color, ranked by OKLab distance
// (deltaE). Returns [{ brand, hex, distance }, ...], length <= n.
export async function nearestBrands(hex, n = 5) {
  const flat = await loadBrands();
  const ranked = Object.entries(flat)
    .map(([key, brandHex]) => ({ brand: key.replace(/-\d+$/, ''), hex: brandHex, distance: deltaE(hex, brandHex) }))
    .sort((a, b) => a.distance - b.distance);
  const seen = new Set();
  const out = [];
  for (const entry of ranked) {
    if (seen.has(entry.brand)) continue;
    seen.add(entry.brand);
    out.push(entry);
    if (out.length >= n) break;
  }
  return out;
}

// One-call semantic theme: shade ramp + dark derivation + suggested harmony
// + a light/dark semantic role mapping + a contrast audit of that mapping.
// This is the tool coding agents actually want ("make me a theme from this
// seed") — everything else in this file is the building blocks it composes.
export function generateTheme(seed, mood = 'balanced') {
  const harmonyInfo = suggestHarmony(mood);
  const shades = generateShades(seed);
  const dark = deriveDark(shades);
  const light = {
    background: '#ffffff',
    surface: shades[0],
    textPrimary: '#0a0a0a',
    textSecondary: shades[8],
    brand: shades[5],
    accent: shades[5]
  };
  const darkTheme = {
    background: '#141414',
    surface: dark[0],
    textPrimary: '#f5f5f5',
    textSecondary: dark[7],
    brand: dark[5],
    accent: dark[5]
  };
  const contrastAudit = auditPairs([
    { label: 'light body text', fg: light.textPrimary, bg: light.background },
    { label: 'light secondary text', fg: light.textSecondary, bg: light.background },
    { label: 'light brand on surface', fg: light.brand, bg: light.surface },
    { label: 'dark body text', fg: darkTheme.textPrimary, bg: darkTheme.background },
    { label: 'dark secondary text', fg: darkTheme.textSecondary, bg: darkTheme.background }
  ]);
  return { seed, mood, harmony: harmonyInfo, shades, dark, light, dark_theme: darkTheme, contrastAudit };
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
