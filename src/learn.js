// Colorflower "Learn" layer — interactive color-theory chapters. Deliberately
// isolated from app.js/the flower: its own dialog, its own tiny widgets, all
// state local to this module. Nothing here can regress the picker.
//
// Each chapter is a manipulable widget backed by the real engine math
// (core/color-engine.js) — never a static description.

import {
  hslToHex, hexToRgb, rgbToHex, rgbToOklch, oklchToRgb,
  nameColor, contrast, mixColors, tintScale, shadeScale, toneScale,
  HARMONY_STEPS, NAMED_COLORS, getHueFamily
} from '../core/color-engine.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  children.forEach((c) => c && node.appendChild(c));
  return node;
}

// 12-spoke reference wheel shared by the wheel and harmony-geometry chapters.
// highlights: [{hue, label}]. shapeHues: degrees to connect with a line/polygon.
function drawWheel(container, { highlights = [], shapeHues = null } = {}) {
  container.replaceChildren();
  const size = 220, r = size / 2 - 26, cx = size / 2, cy = size / 2;
  const svg = svgEl('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}` });
  const pt = (deg) => { const a = (deg - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };

  if (shapeHues && shapeHues.length > 1) {
    const points = shapeHues.map(pt);
    if (points.length === 2) {
      svg.appendChild(svgEl('line', { x1: points[0][0], y1: points[0][1], x2: points[1][0], y2: points[1][1], stroke: '#205d49', 'stroke-width': 2.5 }));
    } else {
      svg.appendChild(svgEl('polygon', {
        points: points.map((p) => p.join(',')).join(' '),
        fill: 'rgba(46,123,98,0.12)', stroke: '#205d49', 'stroke-width': 2.5, 'stroke-dasharray': '6 5', 'stroke-linejoin': 'round'
      }));
    }
  }

  for (let h = 0; h < 360; h += 30) {
    const [x, y] = pt(h);
    const hit = highlights.find((entry) => entry.hue === h);
    svg.appendChild(svgEl('circle', {
      cx: x, cy: y, r: hit ? 14 : 10,
      fill: hslToHex(h, 70, 55),
      stroke: hit ? '#211b24' : '#ffffff', 'stroke-width': hit ? 3 : 2
    }));
    if (hit?.label) {
      const t = svgEl('text', { x, y: y - 19, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 800, fill: '#211b24' });
      t.textContent = hit.label;
      svg.appendChild(t);
    }
  }
  container.appendChild(svg);
}

function chip(label, active, onClick) {
  const btn = el('button', { type: 'button', class: 'learn-chip', text: label, onclick: onClick });
  btn.classList.toggle('is-active', active);
  return btn;
}

// ---- Chapter 1: the color wheel + primary/secondary/tertiary --------------

function chapterWheel(container) {
  let mode = 'rgb';
  const wheelWrap = el('div', { class: 'learn-wheel' });
  const caption = el('p', { class: 'learn-caption' });
  const chipRow = el('div', { class: 'learn-toggle-row' });

  function render() {
    const sets = mode === 'rgb'
      ? { primaries: [0, 120, 240], secondaries: [60, 180, 300],
          text: 'Light (RGB, additive) — primaries: red, green, blue. Add two and get a secondary: red+green=yellow, green+blue=cyan, blue+red=magenta. This is how screens work.' }
      : { primaries: [180, 300, 60], secondaries: [0, 120, 240],
          text: 'Ink (CMY, subtractive) — primaries: cyan, magenta, yellow. Each ink subtracts light instead of adding it. This is why printers mix C/M/Y(/K), not R/G/B.' };
    const highlights = [
      ...sets.primaries.map((hue) => ({ hue, label: 'P' })),
      ...sets.secondaries.map((hue) => ({ hue, label: 'S' }))
    ];
    drawWheel(wheelWrap, { highlights });
    caption.textContent = sets.text;
    chipRow.replaceChildren(
      chip('Light (RGB)', mode === 'rgb', () => { mode = 'rgb'; render(); }),
      chip('Ink (CMY)', mode === 'cmy', () => { mode = 'cmy'; render(); })
    );
  }
  render();

  container.append(
    el('p', { class: 'learn-lede', text: 'Every hue sits on a wheel. What counts as "primary" depends on whether you\'re mixing light or ink.' }),
    chipRow, wheelWrap, caption,
    el('p', { class: 'learn-note', text: 'The 6 unlabeled spokes are tertiary colors — a primary and its neighboring secondary blended (e.g. red-orange, blue-green).' })
  );
}

// ---- Chapter 2: mixing (light / paint / perceptual) ------------------------

function chapterMixing(container) {
  const inputA = el('input', { type: 'color', id: 'learn-mix-a', name: 'mix-a', value: '#0000ff' });
  const inputB = el('input', { type: 'color', id: 'learn-mix-b', name: 'mix-b', value: '#ffff00' });
  const swatch = el('div', { class: 'learn-swatch-lg' });
  const caption = el('p', { class: 'learn-caption' });
  const chipRow = el('div', { class: 'learn-toggle-row' });
  let mode = 'paint';

  async function render() {
    const a = inputA.value, b = inputB.value;
    let hex, text;
    if (mode === 'light') {
      const ra = hexToRgb(a), rb = hexToRgb(b);
      hex = rgbToHex(Math.round((ra.r + rb.r) / 2), Math.round((ra.g + rb.g) / 2), Math.round((ra.b + rb.b) / 2));
      text = 'Light (additive RGB average) — mixing colored LIGHT adds channels together. Blue + yellow light averages to a flat, muddy gray.';
    } else if (mode === 'paint') {
      hex = (await mixColors([a, b], [0.5, 0.5])).hex;
      text = 'Paint (Kubelka-Munk, spectral.js) — mixing PIGMENT is subtractive and physically modeled. Blue + yellow paint makes green, the way real paint does.';
    } else {
      const oa = rgbToOklch(hexToRgb(a).r, hexToRgb(a).g, hexToRgb(a).b);
      const ob = rgbToOklch(hexToRgb(b).r, hexToRgb(b).g, hexToRgb(b).b);
      const mid = oklchToRgb((oa.l + ob.l) / 2, (oa.c + ob.c) / 2, (oa.h + ob.h) / 2);
      hex = rgbToHex(mid.r, mid.g, mid.b);
      text = 'Perceptual (OKLCH midpoint) — splits the difference in a space matched to human vision: a clean, gray-free compromise.';
    }
    swatch.style.background = hex;
    swatch.textContent = hex.toUpperCase();
    caption.textContent = text;
    chipRow.replaceChildren(
      chip('Light', mode === 'light', () => { mode = 'light'; render(); }),
      chip('Paint', mode === 'paint', () => { mode = 'paint'; render(); }),
      chip('Perceptual', mode === 'perceptual', () => { mode = 'perceptual'; render(); })
    );
  }
  inputA.addEventListener('input', render);
  inputB.addEventListener('input', render);
  render();

  container.append(
    el('p', { class: 'learn-lede', text: 'Pick two colors. The same two inputs give three different, all-correct answers depending on what you\'re actually mixing.' }),
    el('div', { class: 'learn-mix-row' }, [inputA, inputB]),
    chipRow, swatch, caption
  );
}

// ---- Chapter 3: hue, saturation, lightness ---------------------------------

function chapterHsl(container) {
  const hueRange = el('input', { type: 'range', id: 'learn-hue', name: 'hue', min: 0, max: 359, value: 210 });
  const satRange = el('input', { type: 'range', id: 'learn-sat', name: 'saturation', min: 0, max: 100, value: 70 });
  const lightRange = el('input', { type: 'range', id: 'learn-light', name: 'lightness', min: 0, max: 100, value: 55 });
  const swatch = el('div', { class: 'learn-swatch-lg' });
  const readout = el('p', { class: 'learn-caption' });

  function render() {
    const h = Number(hueRange.value), s = Number(satRange.value), l = Number(lightRange.value);
    const hex = hslToHex(h, s, l);
    swatch.style.background = hex;
    swatch.textContent = hex.toUpperCase();
    readout.textContent = `hue ${h}°, saturation ${s}%, lightness ${l}% — "${nameColor({ h, s, l })}"`;
  }
  [hueRange, satRange, lightRange].forEach((r) => r.addEventListener('input', render));
  render();

  const field = (label, input) => el('label', { class: 'learn-field' }, [el('span', { text: label }), input]);
  container.append(
    el('p', { class: 'learn-lede', text: 'Hue is the angle on the wheel. Saturation is how far from gray. Lightness is how far from black or white. Three numbers, every color.' }),
    field('Hue', hueRange), field('Saturation', satRange), field('Lightness', lightRange),
    swatch, readout
  );
}

// ---- Chapter 4: tint, shade, tone -------------------------------------------

function chapterTintShadeTone(container) {
  const input = el('input', { type: 'color', id: 'learn-tst-seed', name: 'tint-shade-tone-seed', value: '#e93a3a' });
  const rows = el('div', { class: 'learn-scale-rows' });

  async function render() {
    rows.replaceChildren();
    const seed = input.value;
    const specs = [
      ['Tint (+ white)', await tintScale(seed, 6)],
      ['Shade (+ black)', await shadeScale(seed, 6)],
      ['Tone (+ gray)', await toneScale(seed, 6)]
    ];
    specs.forEach(([label, colors]) => {
      const strip = el('div', { class: 'learn-strip' }, colors.map((c) => el('div', { class: 'learn-strip-swatch', style: `background:${c}` })));
      rows.append(el('p', { class: 'learn-mini-label', text: label }), strip);
    });
  }
  input.addEventListener('input', render);
  render();

  container.append(
    el('p', { class: 'learn-lede', text: 'Tint, shade, and tone are just a color mixed toward white, black, or gray. Pick a color to see all three ladders.' }),
    el('div', { class: 'learn-mix-row' }, [input]),
    rows
  );
}

// ---- Chapter 5: harmony geometry --------------------------------------------

function chapterHarmony(container) {
  const input = el('input', { type: 'color', id: 'learn-harmony-seed', name: 'harmony-seed', value: '#e93a3a' });
  const wheelWrap = el('div', { class: 'learn-wheel' });
  const caption = el('p', { class: 'learn-caption' });
  const chipRow = el('div', { class: 'learn-toggle-row' });
  const harmonyNames = Object.keys(HARMONY_STEPS).filter((k) => k !== 'spectrum');
  let harmony = 'complementary';

  function render() {
    const seedHue = Math.round(rgbToOklch(hexToRgb(input.value).r, hexToRgb(input.value).g, hexToRgb(input.value).b).h);
    const nearestSpoke = Math.round(seedHue / 30) * 30 % 360;
    const steps = HARMONY_STEPS[harmony];
    const shapeHues = steps.map((offset) => (nearestSpoke + offset + 360) % 360);
    drawWheel(wheelWrap, { highlights: shapeHues.map((hue) => ({ hue, label: '' })), shapeHues });
    caption.textContent = `${harmony} — ${steps.length} hues, ${steps.join('°, ')}° apart from the seed. Change the seed color and the shape rotates with it.`;
    chipRow.replaceChildren(...harmonyNames.map((name) => chip(name, name === harmony, () => { harmony = name; render(); })));
  }
  input.addEventListener('input', render);
  render();

  container.append(
    el('p', { class: 'learn-lede', text: 'A harmony is just a shape traced between hues on the wheel. Pick a seed color and a harmony rule.' }),
    el('div', { class: 'learn-mix-row' }, [input]),
    chipRow, wheelWrap, caption
  );
}

// ---- Chapter 6: contrast ------------------------------------------------------

function chapterContrast(container) {
  const fg = el('input', { type: 'color', id: 'learn-contrast-fg', name: 'contrast-fg', value: '#000000' });
  const bg = el('input', { type: 'color', id: 'learn-contrast-bg', name: 'contrast-bg', value: '#ffffff' });
  const preview = el('div', { class: 'learn-contrast-preview' });
  const result = el('p', { class: 'learn-caption' });

  function render() {
    const c = contrast(fg.value, bg.value);
    preview.style.background = bg.value;
    preview.style.color = fg.value;
    preview.textContent = 'The quick brown fox';
    result.textContent = `${c.ratio}:1 — ${c.grade}. AA needs 4.5:1 for body text, 3:1 for large text (18pt+/14pt bold+).`;
    result.dataset.pass = String(c.AA);
  }
  fg.addEventListener('input', render);
  bg.addEventListener('input', render);
  render();

  container.append(
    el('p', { class: 'learn-lede', text: 'WCAG contrast is a ratio, not a guess. Pick a text color and a background color.' }),
    el('div', { class: 'learn-mix-row' }, [
      el('label', { class: 'learn-field' }, [el('span', { text: 'Text' }), fg]),
      el('label', { class: 'learn-field' }, [el('span', { text: 'Background' }), bg])
    ]),
    preview, result
  );
}

// ---- Chapter 7: psychology ---------------------------------------------------

const PSYCHOLOGY = {
  Crimson: 'energy, urgency, appetite — the color most likely to grab attention first.',
  Tangerine: 'warmth, enthusiasm, affordability — common in calls-to-action and food brands.',
  Marigold: 'optimism, caution — bright and cheap-feeling at full saturation, warm and premium desaturated.',
  Meadow: 'growth, health, "go" — the most restful hue family for extended reading.',
  Aqua: 'clarity, freshness — common in health, water, and cleaning products.',
  Azure: 'trust, stability, calm — the most common corporate/enterprise hue family by a wide margin.',
  Violet: 'creativity, luxury, mystery — historically rare/expensive pigment, still reads as premium.',
  Magenta: 'playfulness, boldness — high-energy, often used sparingly as an accent.',
  Rose: 'warmth, approachability, softness.'
};

function chapterPsychology(container) {
  container.append(
    el('p', { class: 'learn-lede', text: 'These are design conventions, not scientific claims — but they\'re consistent enough across brands to be worth knowing.' })
  );
  const grid = el('div', { class: 'learn-psych-grid' });
  Object.entries(PSYCHOLOGY).forEach(([family, text]) => {
    const hue = { Crimson: 8, Tangerine: 30, Marigold: 55, Meadow: 130, Aqua: 175, Azure: 210, Violet: 265, Magenta: 310, Rose: 345 }[family];
    grid.appendChild(el('div', { class: 'learn-psych-row' }, [
      el('div', { class: 'learn-psych-swatch', style: `background:${hslToHex(hue, 65, 52)}` }),
      el('div', {}, [el('strong', { text: family }), el('p', { text })])
    ]));
  });
  container.appendChild(grid);
}

// ---- Chapter 8: named colors browser -----------------------------------------

function chapterNamedColors(container) {
  const readout = el('p', { class: 'learn-caption', text: 'Click any swatch to see its details.' });
  const grid = el('div', { class: 'learn-named-grid' });
  NAMED_COLORS.forEach(([name, hex]) => {
    const sw = el('button', {
      type: 'button', class: 'learn-named-swatch', style: `background:${hex}`, 'aria-label': name,
      onclick: () => { readout.textContent = `${name} — ${hex} — hue family: ${getHueFamily(rgbToOklch(hexToRgb(hex).r, hexToRgb(hex).g, hexToRgb(hex).b).h)}`; }
    });
    grid.appendChild(sw);
  });
  container.append(
    el('p', { class: 'learn-lede', text: `All ${NAMED_COLORS.length} standard CSS named colors — the ones every browser understands by name, no hex required.` }),
    readout, grid
  );
}

// ---- Wiring ------------------------------------------------------------------

const CHAPTERS = [
  { id: 'wheel', title: 'The color wheel', render: chapterWheel },
  { id: 'mixing', title: 'Mixing', render: chapterMixing },
  { id: 'hsl', title: 'Hue · Saturation · Lightness', render: chapterHsl },
  { id: 'tint-shade-tone', title: 'Tint · Shade · Tone', render: chapterTintShadeTone },
  { id: 'harmony', title: 'Harmony geometry', render: chapterHarmony },
  { id: 'contrast', title: 'Contrast', render: chapterContrast },
  { id: 'psychology', title: 'Psychology', render: chapterPsychology },
  { id: 'names', title: 'Named colors', render: chapterNamedColors }
];

const learnToggle = document.getElementById('learn-toggle');
const learnDialog = document.getElementById('learn-dialog');
const learnClose = document.getElementById('learn-close');
const learnNav = document.getElementById('learn-nav');
const learnChapterEl = document.getElementById('learn-chapter');

function openChapter(id) {
  const chapter = CHAPTERS.find((c) => c.id === id) || CHAPTERS[0];
  learnChapterEl.replaceChildren();
  chapter.render(learnChapterEl);
  Array.from(learnNav.children).forEach((btn) => btn.classList.toggle('is-active', btn.dataset.chapter === chapter.id));
}

function initLearn() {
  learnNav.replaceChildren(...CHAPTERS.map((c) =>
    el('button', { type: 'button', class: 'learn-nav-btn', text: c.title, 'data-chapter': c.id, onclick: () => openChapter(c.id) })
  ));
  openChapter(CHAPTERS[0].id);
}

if (learnToggle && learnDialog) {
  learnToggle.addEventListener('click', () => {
    if (!learnNav.children.length) initLearn();
    learnDialog.showModal();
  });
  learnClose?.addEventListener('click', () => learnDialog.close());
  learnDialog.addEventListener('click', (event) => { if (event.target === learnDialog) learnDialog.close(); });
}
