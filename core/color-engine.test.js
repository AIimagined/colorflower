// Run: node --test core/color-engine.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  oklchToRgb, rgbToOklch, clampToSrgbByChroma, deltaE, nearestNamedColor,
  contrastRatio, contrastGrade, bestTextOn, auditPairs, convertColor,
  hexToRgb, rgbToHex, hslToRgb, mixColors, spectralGradient, tintScale,
  shadeScale, toneScale, generateShades, deriveDark, suggestHarmony,
  getBrand, searchBrands, nearestBrands, HARMONY_STEPS, generateTheme
} from './color-engine.js';

test('rgbToOklch / oklchToRgb round-trip for an in-gamut color', () => {
  const rgb = hexToRgb('#e93a3a');
  const { l, c, h } = rgbToOklch(rgb.r, rgb.g, rgb.b);
  const back = oklchToRgb(l, c, h);
  // rounding through cube-root/cube math — within 1 unit per channel
  assert.ok(Math.abs(back.r - rgb.r) <= 1);
  assert.ok(Math.abs(back.g - rgb.g) <= 1);
  assert.ok(Math.abs(back.b - rgb.b) <= 1);
});

test('clampToSrgbByChroma leaves in-gamut colors untouched', () => {
  const rgb = hexToRgb('#808080'); // gray, chroma ~0, always in gamut
  const { l, c, h } = rgbToOklch(rgb.r, rgb.g, rgb.b);
  const result = clampToSrgbByChroma(l, c, h);
  assert.equal(result.wasClamped, false);
  assert.equal(result.hex, rgbToHex(rgb.r, rgb.g, rgb.b));
});

test('clampToSrgbByChroma reduces out-of-gamut chroma and stays in [0,255]', () => {
  // Absurdly high chroma at a mid lightness is guaranteed out of sRGB gamut.
  const result = clampToSrgbByChroma(0.6, 0.5, 30);
  assert.equal(result.wasClamped, true);
  assert.ok(result.clampedChroma < result.requestedChroma);
  for (const ch of ['r', 'g', 'b']) {
    assert.ok(result.rgb[ch] >= 0 && result.rgb[ch] <= 255);
  }
});

test('deltaE of a color against itself is ~0', () => {
  assert.ok(deltaE('#3366ff', '#3366ff') < 0.01);
});

test('deltaE grows with visually larger differences', () => {
  const near = deltaE('#ff0000', '#fe0101');
  const far = deltaE('#ff0000', '#00ff00');
  assert.ok(near < far);
});

test('nearestNamedColor finds exact CSS keyword matches', () => {
  assert.equal(nearestNamedColor('#ff0000').name, 'red');
  assert.equal(nearestNamedColor('#0000ff').name, 'blue');
  assert.equal(nearestNamedColor('#ffffff').name, 'white');
});

test('nearestNamedColor(n) returns a ranked shortlist', () => {
  const top3 = nearestNamedColor('#ff0000', 3);
  assert.equal(top3.length, 3);
  assert.ok(top3[0].distance <= top3[1].distance);
  assert.ok(top3[1].distance <= top3[2].distance);
});

test('contrastRatio: black on white is the maximum 21:1', () => {
  const ratio = contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
  assert.ok(Math.abs(ratio - 21) < 0.01);
});

test('contrastGrade thresholds', () => {
  assert.equal(contrastGrade(8), 'AAA');
  assert.equal(contrastGrade(5), 'AA');
  assert.equal(contrastGrade(3.2), 'FAIL');
  assert.equal(contrastGrade(3.2, { large: true }), 'AA');
  assert.equal(contrastGrade(1.5), 'FAIL');
});

test('bestTextOn picks black for light backgrounds, white for dark', () => {
  assert.equal(bestTextOn('#ffffff'), '#000000');
  assert.equal(bestTextOn('#000000'), '#ffffff');
});

test('auditPairs flags failing contrast pairs and passes clean ones', () => {
  const audit = auditPairs([
    { label: 'good', fg: '#000000', bg: '#ffffff' },
    { label: 'bad', fg: '#777777', bg: '#888888' }
  ]);
  assert.equal(audit.allPass, false);
  assert.equal(audit.failing.length, 1);
  assert.equal(audit.failing[0].label, 'bad');
});

test('convertColor output is unchanged after the OKLCH/DRY refactor (regression guard)', () => {
  const result = convertColor('#e93a3a');
  assert.equal(result.hex, '#e93a3a');
  assert.equal(result.rgbString, 'rgb(233, 58, 58)');
  assert.equal(result.hsl, 'hsl(0, 80%, 57%)');
});

// ---- S2: mixing, tint/shade/tone, shade ramps -----------------------------

test('mixColors: blue + yellow paint-mixes toward green, not gray', async () => {
  const { hex, rgb } = await mixColors(['#0000ff', '#ffff00'], [0.5, 0.5]);
  assert.match(hex, /^#[0-9a-f]{6}$/i);
  // green channel should dominate for a real paint mix (unlike RGB average
  // of blue+yellow which would be a muddy gray-ish rgb(127,127,127)).
  assert.ok(rgb.g > rgb.r);
  assert.ok(rgb.g > rgb.b);
});

test('spectralGradient samples n colors across positioned stops', async () => {
  const stops = await spectralGradient([{ color: '#ff0000', at: 0 }, { color: '#0000ff', at: 1 }], 5);
  assert.equal(stops.length, 5);
  stops.forEach((c) => assert.match(c, /^#[0-9a-f]{6}$/i));
});

test('tintScale ends at white, shadeScale ends at black, toneScale ends at gray', async () => {
  const tints = await tintScale('#e93a3a', 4);
  const shades = await shadeScale('#e93a3a', 4);
  const tones = await toneScale('#e93a3a', 4);
  assert.equal(tints.length, 4);
  assert.equal(tints[tints.length - 1].toLowerCase(), '#ffffff');
  assert.equal(shades[shades.length - 1].toLowerCase(), '#000000');
  assert.equal(tones[tones.length - 1].toLowerCase(), '#808080');
  // first step of every scale is the seed itself
  assert.equal(tints[0].toLowerCase(), '#e93a3a');
});

test('generateShades returns 10 colors with the seed at index 5', () => {
  const shades = generateShades('#e93a3a');
  assert.equal(shades.length, 10);
  assert.equal(shades[5].toLowerCase(), '#e93a3a');
  // lighter above, darker below (rough sanity: index 0 lighter than seed,
  // index 9 darker than seed, by relative luminance).
  const lum = (hex) => { const rgb = hexToRgb(hex); return rgb.r + rgb.g + rgb.b; };
  assert.ok(lum(shades[0]) > lum(shades[5]));
  assert.ok(lum(shades[9]) < lum(shades[5]));
});

test('deriveDark blends 10 shades onto a dark background', () => {
  const shades = generateShades('#1677ff');
  const dark = deriveDark(shades);
  assert.equal(dark.length, 10);
  dark.forEach((hex) => assert.match(hex, /^#[0-9a-f]{6}$/i));
  // no entry should be pure neon-on-black: every channel should be pulled
  // toward the #141414 background, i.e. not identical to the light shade.
  assert.notEqual(dark[5].toLowerCase(), shades[5].toLowerCase());
});

// ---- S3: harmony table + brand data ----------------------------------------

test('HARMONY_STEPS includes tetradic and square beyond the original set', () => {
  assert.deepEqual(HARMONY_STEPS.tetradic, [0, 60, 180, 240]);
  assert.deepEqual(HARMONY_STEPS.square, [0, 90, 180, 270]);
});

test('suggestHarmony maps known moods and falls back safely for unknown ones', () => {
  const calm = suggestHarmony('calm');
  assert.equal(calm.harmony, 'monochrome');
  assert.ok(calm.rationale.length > 0);
  const playful = suggestHarmony('playful');
  assert.equal(playful.harmony, 'triadic');
  const unknown = suggestHarmony('made-up-mood-xyz');
  assert.ok(HARMONY_STEPS[unknown.harmony] !== undefined || unknown.harmony === 'spectrum');
});

test('getBrand: override wins over stale 2019 dataset value', async () => {
  const spotify = await getBrand('spotify');
  assert.equal(spotify.primary.toLowerCase(), '#1ed760'); // overrides.json, not the dataset's #1db954
});

test('getBrand: multi-color brand groups all its swatches', async () => {
  const google = await getBrand('google');
  assert.ok(google.colors.length >= 1);
  assert.equal(google.primary.toLowerCase(), '#4285f4');
});

test('getBrand: unknown brand returns null', async () => {
  const missing = await getBrand('totally-not-a-real-brand-xyz-123');
  assert.equal(missing, null);
});

test('searchBrands finds partial matches', async () => {
  const results = await searchBrands('spot');
  assert.ok(results.includes('spotify'));
});

test('nearestBrands ranks by perceptual distance, exact hex first', async () => {
  const results = await nearestBrands('#1ed760', 3);
  assert.equal(results.length, 3);
  assert.ok(results[0].distance <= results[1].distance);
  assert.ok(results[0].distance <= results[2].distance);
});

// ---- S4: generate_theme composite -----------------------------------------

test('generateTheme returns a complete light+dark semantic role mapping with a contrast audit', () => {
  const theme = generateTheme('#1677ff', 'calm');
  assert.equal(theme.harmony.harmony, 'monochrome');
  assert.equal(theme.shades.length, 10);
  assert.equal(theme.dark.length, 10);
  for (const role of ['background', 'surface', 'textPrimary', 'textSecondary', 'brand', 'accent']) {
    assert.match(theme.light[role], /^#[0-9a-f]{6}$/i);
    assert.match(theme.dark_theme[role], /^#[0-9a-f]{6}$/i);
  }
  assert.equal(theme.contrastAudit.results.length, 5);
  // body text on background must always pass — it's pure black/white on a
  // brand-tinted near-white/near-black, the safest pair in the mapping.
  const bodyPairs = theme.contrastAudit.results.filter((r) => r.label.includes('body text'));
  assert.ok(bodyPairs.every((r) => r.AA));
});
