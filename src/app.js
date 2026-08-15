import {
  clamp, hexToRgb, relativeLuminance, contrastRatio, rgbToOklab, oklabToRgb,
  formatOklab, formatOklch, rgbToHsl, hslToRgb, rgbToHex, hslToHex, normalizeHue
} from '../core/color-engine.js';

const APP_VERSION = '1.6.0';

const BLOOM_EASING = 'cubic-bezier(.16, .84, .22, 1)';
const PETAL_CUP_PER_LAYER = 7;
const WIND_MAX_TILT = 9;
// Hover / cursor-repulsion tuning. Larger + smoother so the petals visibly
// glide away from the pointer and the hovered petal lifts noticeably.
const PETAL_HOVER_SCALE = 1.16;
const PETAL_REPULSION_RADIUS = 128;
const PETAL_REPULSION_PUSH = 24;
// Bud fold: clicking the pistil furls the petals up toward the centre into a
// closed bud. Tuned so outer petals stand up more and wrap over the inner ones.
const BUD_FOLD_DURATION = 900;
const BUD_GATHER = 0.15;
const BUD_LIFT = 10;
// Cup angles tuned so petals wrap over the centre into a compact rounded
// bud (tighter gather + smaller scale = more overlap, reads "closed").
const BUD_CUP_BASE = 50;
const BUD_CUP_PER_LAYER = 8;
const BUD_SCALE = 0.76;
const INTERACTIVE_PETAL_TRANSITION = 'transform 240ms cubic-bezier(.33,1,.68,1), opacity 130ms ease-out, background 180ms ease, filter 180ms ease, box-shadow 180ms ease';
const PETAL_STAGGER = 14;
const BAR_WIDTH = 16;
const SLIDER_OFFSET = 54;
// The shade slider is drawn thicker than the hue ring so its light->dark
// gradient of the selected hue reads clearly on its own.
const SLIDER_BAR_WIDTH = 24;
const CORE_SIZE = 62;
const PETAL_SIZE = 74;

const pickerEl = document.getElementById('colorflower-picker');
const selectedSwatch = document.getElementById('selected-swatch');
const selectedHex = document.getElementById('selected-hex');
const selectedRgb = document.getElementById('selected-rgb');
const selectedHsl = document.getElementById('selected-hsl');
const selectedOklch = document.getElementById('selected-oklch');
const selectedOklab = document.getElementById('selected-oklab');
const aiColorName = document.getElementById('ai-color-name');
const copyButton = document.getElementById('copy-color');
const toggleBloom = document.getElementById('toggle-bloom');
const densityButtons = document.querySelectorAll('.density-btn');
const appShell = document.querySelector('.app-shell');
const helpToggle = document.getElementById('help-toggle');
const helpDialog = document.getElementById('help-dialog');
const helpClose = document.getElementById('help-close');
const rebloomButton = document.getElementById('shuffle-palette');
const harmonyMode = document.getElementById('harmony-mode');
const moodMode = document.getElementById('mood-mode');
const lockHue = document.getElementById('lock-hue');
const lockSaturation = document.getElementById('lock-saturation');
const lockLightness = document.getElementById('lock-lightness');
const hueRange = document.getElementById('hue-range');
const hueValue = document.getElementById('hue-value');
const saturationRange = document.getElementById('saturation-range');
const saturationValue = document.getElementById('saturation-value');
const motionRange = document.getElementById('motion-range');
const motionValue = document.getElementById('motion-value');
const contrastBg = document.getElementById('contrast-bg');
const contrastResult = document.getElementById('contrast-result');
const addBouquetButton = document.getElementById('add-bouquet');
const bouquetList = document.getElementById('bouquet-list');
const copyTokensButton = document.getElementById('copy-tokens');
const copyJsonButton = document.getElementById('copy-json');
const tokenOutput = document.getElementById('token-output');
const setCompareAButton = document.getElementById('set-compare-a');
const setCompareBButton = document.getElementById('set-compare-b');
const compareResult = document.getElementById('compare-result');
const imageUpload = document.getElementById('image-upload');
const colorHistory = document.getElementById('color-history');
const paletteGarden = document.getElementById('palette-garden');
const appVersionEl = document.getElementById('app-version');

if (appVersionEl) appVersionEl.textContent = `v${APP_VERSION}`;

history.scrollRestoration = 'manual';
window.addEventListener('load', () => {
  window.scrollTo(0, 0);
  document.querySelector('.tool-panel')?.scrollTo(0, 0);
});

const POPPY_COLORS = [
  '#fff1cf',
  '#ffd5b3',
  'oklch(84% 0.08 39)',
  '#ffb274',
  '#ff8a50',
  '#ff693d',
  '#f24d3d',
  '#e33339',
  '#c91f35',
  '#a9142d',
  '#7a1027',
  '#4a0a18',
  'rgb(252 110 93)',
  'rgb(244 58 71)',
  'rgba(220, 31, 55, .96)',
  'hsl(352 82% 54%)',
  'oklch(59% 0.23 26)',
  'oklab(0.58 0.18 0.10)',
  '#f78a83',
  '#f45a62',
  '#ff9d63',
  '#db233a'
];

const MOOD_PRESETS = {
  balanced: { saturation: 0, lightness: 0, hueBias: 0 },
  luxury: { saturation: -8, lightness: -12, hueBias: 270 },
  calm: { saturation: -22, lightness: 10, hueBias: 205 },
  playful: { saturation: 12, lightness: 8, hueBias: 42 },
  clinical: { saturation: -30, lightness: 16, hueBias: 188 },
  editorial: { saturation: 8, lightness: -8, hueBias: 348 },
  nature: { saturation: -5, lightness: -2, hueBias: 118 }
};

const HARMONY_STEPS = {
  complementary: [0, 180],
  triadic: [0, 120, 240],
  analogous: [-36, -14, 0, 18, 38],
  monochrome: [0],
  split: [0, 150, 210]
};

const HUE_NAMES = [
  ['Crimson', 15],
  ['Tangerine', 45],
  ['Marigold', 70],
  ['Meadow', 145],
  ['Aqua', 190],
  ['Azure', 225],
  ['Violet', 275],
  ['Magenta', 325],
  ['Rose', 360]
];

const state = {
  expanded: false,
  bud: false,
  duration: Number(motionRange.value),
  selected: null,
  sliderValue: 44,
  petals: [],
  mouse: null,
  pickerCenter: null,
  raf: 0,
  draggingSlider: false,
  draggingHue: false,
  relaxTimer: 0,
  paletteOffset: 0,
  layout: null,
  ready: false,
  harmonyMode: 'spectrum',
  mood: 'balanced',
  locks: { h: false, s: false, l: false },
  extractedPalette: null,
  bouquet: [],
  history: [],
  compare: { a: null, b: null }
};

function hueToDegrees(value) {
  const token = String(value || '0').trim().toLowerCase();
  const number = Number.parseFloat(token);
  if (Number.isNaN(number)) return 0;
  if (token.endsWith('turn')) return number * 360;
  if (token.endsWith('rad')) return number * 180 / Math.PI;
  if (token.endsWith('grad')) return number * 0.9;
  return number;
}

function percentageOrNumber(value, percentScale = 1) {
  const token = String(value || '0').trim();
  const number = Number.parseFloat(token);
  if (Number.isNaN(number)) return 0;
  return token.endsWith('%') ? number / 100 * percentScale : number;
}

function getHueFamily(hue) {
  const normalized = normalizeHue(hue);
  return HUE_NAMES.find(([, end]) => normalized <= end)?.[0] || 'Rose';
}

function generateColorName(output) {
  const hueName = getHueFamily(output.h);
  const tone = output.l < 30
    ? 'Ink'
    : output.l > 82
      ? 'Mist'
      : output.s < 28
        ? 'Stone'
        : output.s > 82
          ? 'Signal'
          : output.l > 62
            ? 'Bloom'
            : 'Field';
  return `${tone} ${hueName}`;
}

function getSnapshot(output = colorOutput()) {
  return {
    h: Math.round(output.h),
    s: Math.round(output.s),
    l: Math.round(output.l),
    hex: output.hex,
    rgbString: output.rgbString,
    hsl: output.hsl,
    oklch: output.oklch,
    oklab: output.oklab,
    name: generateColorName(output)
  };
}

function buildCssTokens(colors) {
  const source = colors.length ? colors : [getSnapshot()];
  const lines = [':root {'];
  source.forEach((color, index) => {
    const slot = index + 1;
    lines.push(`  --colorflower-${slot}: ${color.hex};`);
    lines.push(`  --colorflower-${slot}-rgb: ${color.rgbString.replace('rgb(', '').replace(')', '')};`);
    lines.push(`  --colorflower-${slot}-oklch: ${color.oklch.replace('oklch(', '').replace(')', '')};`);
  });
  lines.push('}');
  return lines.join('\n');
}

function renderTokenOutput() {
  tokenOutput.textContent = buildCssTokens(state.bouquet);
}

function selectSnapshot(snapshot) {
  state.selected = {
    h: snapshot.h,
    s: snapshot.s,
    l: snapshot.l,
    sourceFormat: 'saved',
    source: snapshot.hex
  };
  state.sliderValue = lightnessToSliderValue(snapshot.l);
  for (const item of state.petals) item.el.classList.remove('is-selected');
  updateColorOutput();
}

function renderChipList(container, colors, emptyText, onRemove) {
  container.replaceChildren();
  if (!colors.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }
  colors.forEach((color) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'color-chip';
    button.style.setProperty('--chip', color.hex);
    button.title = `${color.name} ${color.hex}`;
    const dot = document.createElement('span');
    const label = document.createElement('strong');
    label.textContent = color.hex;
    button.append(dot, label);
    button.addEventListener('click', () => selectSnapshot(color));
    if (onRemove) {
      // Hover/focus-revealed × that removes the chip without selecting it.
      const remove = document.createElement('span');
      remove.className = 'chip-remove';
      remove.setAttribute('role', 'button');
      remove.setAttribute('aria-label', `Remove ${color.hex} from saved palette`);
      remove.textContent = '×';
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        onRemove(color);
      });
      button.appendChild(remove);
    }
    container.appendChild(button);
  });
}

function removeFromBouquet(color) {
  state.bouquet = state.bouquet.filter((item) => item !== color);
  renderBouquet();
}

function renderBouquet() {
  renderChipList(bouquetList, state.bouquet, 'No saved colors yet.', removeFromBouquet);
  renderChipList(paletteGarden, state.bouquet.slice(0, 10), 'Saved colors grow here.');
  renderTokenOutput();
  fitFlower(); // garden height changes shrink/grow the flower's free space
}

function renderHistory() {
  renderChipList(colorHistory, state.history, 'Your recent selections will appear here.');
}

function addHistory(output) {
  const snapshot = getSnapshot(output);
  if (state.history[0]?.hex === snapshot.hex) return;
  state.history = [snapshot, ...state.history.filter((item) => item.hex !== snapshot.hex)].slice(0, 12);
  renderHistory();
}

function updateContrast(output) {
  const background = hexToRgb(contrastBg.value) || { r: 255, g: 255, b: 255 };
  const ratio = contrastRatio(output.rgb, background);
  const grade = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large text only' : 'Below AA';
  contrastResult.textContent = `${ratio.toFixed(2)}:1 · ${grade}`;
  contrastResult.dataset.grade = ratio >= 4.5 ? 'pass' : ratio >= 3 ? 'warn' : 'fail';
}

function updateCompare() {
  const { a, b } = state.compare;
  if (!a || !b) {
    compareResult.textContent = 'Pick two colors to compare harmony and contrast.';
    return;
  }
  const hueDistance = Math.abs(a.h - b.h);
  const hueDelta = Math.round(Math.min(hueDistance, 360 - hueDistance));
  const ratio = contrastRatio(hexToRgb(a.hex), hexToRgb(b.hex));
  const swatches = document.createElement('div');
  swatches.className = 'compare-swatches';
  swatches.style.setProperty('--a', a.hex);
  swatches.style.setProperty('--b', b.hex);
  const delta = document.createElement('strong');
  delta.textContent = `${hueDelta}deg hue delta`;
  const contrastSpan = document.createElement('span');
  contrastSpan.textContent = `${ratio.toFixed(2)}:1 contrast`;
  compareResult.replaceChildren(swatches, delta, contrastSpan);
}

function syncGeneratorState() {
  if (state.selected) {
    const output = colorOutput();
    state.selected = {
      ...state.selected,
      h: output.h,
      s: output.s,
      l: output.l
    };
  }
  state.harmonyMode = harmonyMode.value;
  state.mood = moodMode.value;
  state.locks = {
    h: lockHue.checked,
    s: lockSaturation.checked,
    l: lockLightness.checked
  };
  renderPicker();
}

function extractPaletteFromImage(file) {
  if (!file) return;
  const image = new Image();
  const url = URL.createObjectURL(file);
  image.onload = () => {
    const canvas = document.createElement('canvas');
    const size = 80;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, size, size);
    const data = context.getImageData(0, 0, size, size).data;
    const buckets = new Map();

    for (let i = 0; i < data.length; i += 4 * 5) {
      const alpha = data[i + 3];
      if (alpha < 180) continue;
      const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      if (hsl.l > 96 || hsl.l < 6 || hsl.s < 8) continue;
      const key = `${Math.round(hsl.h / 12) * 12}-${Math.round(hsl.s / 10) * 10}-${Math.round(hsl.l / 10) * 10}`;
      const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
      bucket.count += 1;
      bucket.r += rgb.r;
      bucket.g += rgb.g;
      bucket.b += rgb.b;
      buckets.set(key, bucket);
    }

    state.extractedPalette = Array.from(buckets.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 18)
      .map((bucket) => {
        const rgb = {
          r: Math.round(bucket.r / bucket.count),
          g: Math.round(bucket.g / bucket.count),
          b: Math.round(bucket.b / bucket.count)
        };
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        return {
          h: Math.round(hsl.h),
          s: clamp(Math.round(hsl.s), 32, 96),
          l: clamp(Math.round(hsl.l), 24, 82),
          sourceFormat: 'image',
          source: rgbToHex(rgb.r, rgb.g, rgb.b)
        };
      });

    harmonyMode.value = 'image';
    state.harmonyMode = 'image';
    URL.revokeObjectURL(url);
    renderPicker();
  };
  image.src = url;
}

function parseFunctionArgs(input, name) {
  const body = input.trim().slice(name.length + 1, -1).trim();
  const [main] = body.split('/');
  return main.replaceAll(',', ' ').split(/\s+/).filter(Boolean);
}

function fromRgb(r, g, b, sourceFormat, source) {
  const hsl = rgbToHsl(r, g, b);
  return {
    h: Math.round(hsl.h),
    s: Math.round(hsl.s),
    l: Math.round(hsl.l),
    sourceFormat,
    source
  };
}

function parseColor(input) {
  if (typeof input === 'object' && input !== null) {
    return {
      h: Number(input.h) || 0,
      s: Number(input.s) || 0,
      l: Number(input.l) || 50,
      sourceFormat: 'hsl-object',
      source: JSON.stringify(input)
    };
  }

  const color = String(input).trim().toLowerCase();
  if (color.startsWith('#')) {
    let raw = color.slice(1);
    if (raw.length === 3 || raw.length === 4) raw = raw.split('').map((part) => part + part).join('');
    const rgbHex = raw.slice(0, 6);
    return fromRgb(
      Number.parseInt(rgbHex.slice(0, 2), 16),
      Number.parseInt(rgbHex.slice(2, 4), 16),
      Number.parseInt(rgbHex.slice(4, 6), 16),
      'hex',
      input
    );
  }
  if (color.startsWith('rgb(') || color.startsWith('rgba(')) {
    const args = parseFunctionArgs(color, color.startsWith('rgba') ? 'rgba' : 'rgb');
    const channel = (token) => String(token).endsWith('%')
      ? clamp(Number.parseFloat(token), 0, 100) / 100 * 255
      : clamp(Number.parseFloat(token), 0, 255);
    return fromRgb(channel(args[0]), channel(args[1]), channel(args[2]), color.startsWith('rgba') ? 'rgba' : 'rgb', input);
  }
  if (color.startsWith('hsl(') || color.startsWith('hsla(')) {
    const args = parseFunctionArgs(color, color.startsWith('hsla') ? 'hsla' : 'hsl');
    return {
      h: Math.round(((hueToDegrees(args[0]) % 360) + 360) % 360),
      s: Math.round(clamp(percentageOrNumber(args[1], 100), 0, 100)),
      l: Math.round(clamp(percentageOrNumber(args[2], 100), 0, 100)),
      sourceFormat: color.startsWith('hsla') ? 'hsla' : 'hsl',
      source: input
    };
  }
  if (color.startsWith('oklab(')) {
    const args = parseFunctionArgs(color, 'oklab');
    const rgb = oklabToRgb(
      clamp(percentageOrNumber(args[0], 1), 0, 1),
      percentageOrNumber(args[1], 0.4),
      percentageOrNumber(args[2], 0.4)
    );
    return fromRgb(rgb.r, rgb.g, rgb.b, 'oklab', input);
  }
  if (color.startsWith('oklch(')) {
    const args = parseFunctionArgs(color, 'oklch');
    const l = clamp(percentageOrNumber(args[0], 1), 0, 1);
    const c = Math.max(0, percentageOrNumber(args[1], 0.4));
    const h = hueToDegrees(args[2]);
    const rgb = oklabToRgb(l, Math.cos(h * Math.PI / 180) * c, Math.sin(h * Math.PI / 180) * c);
    return fromRgb(rgb.r, rgb.g, rgb.b, 'oklch', input);
  }
  return { h: 0, s: 0, l: 50, sourceFormat: 'unknown', source: input };
}

function sliderValueToLightness(value) {
  return 100 - (value / 100) * 80;
}

function lightnessToSliderValue(lightness) {
  return ((100 - clamp(lightness, 20, 100)) / 80) * 100;
}

function getVisualSaturation(sliderValue, baseSaturation) {
  return sliderValue < 10 ? (sliderValue / 10) * baseSaturation : baseSaturation;
}

function colorOutput(color = state.selected, sliderValue = state.sliderValue) {
  const lightness = sliderValueToLightness(sliderValue);
  const visualSaturation = getVisualSaturation(sliderValue, color.s);
  const rgb = hslToRgb(color.h, visualSaturation, lightness);
  return {
    h: color.h,
    s: visualSaturation,
    l: lightness,
    rgb,
    hex: hslToHex(color.h, visualSaturation, lightness),
    hsl: `hsl(${Math.round(color.h)}, ${Math.round(visualSaturation)}%, ${Math.round(lightness)}%)`,
    rgbString: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    oklch: formatOklch(rgb),
    oklab: formatOklab(rgb)
  };
}

function organizeColorsIntoLayers(colors) {
  if (state.harmonyMode === 'image' && state.extractedPalette?.length) {
    const makeImageLayer = (count, offset) => Array.from({ length: count }, (_, index) => {
      const color = state.extractedPalette[(index + offset) % state.extractedPalette.length];
      return {
        ...color,
        sourceFormat: 'image',
        source: color.source || 'image palette'
      };
    });
    return [
      makeImageLayer(9, 0),
      makeImageLayer(12, 5),
      makeImageLayer(15, 12)
    ];
  }

  const mood = MOOD_PRESETS[state.mood] || MOOD_PRESETS.balanced;
  const baseHue = state.locks.h && state.selected ? state.selected.h : mood.hueBias + state.paletteOffset * 11;
  const hueOffset = state.harmonyMode === 'spectrum' ? state.paletteOffset * 11 : baseHue;
  const harmonySteps = HARMONY_STEPS[state.harmonyMode] || null;

  const hueFor = (index, count, layerOffset) => {
    if (!harmonySteps) return normalizeHue((index / count) * 360 + hueOffset + layerOffset);
    const step = harmonySteps[index % harmonySteps.length];
    const cycle = Math.floor(index / harmonySteps.length);
    return normalizeHue(baseHue + step + layerOffset + cycle * 9);
  };

  const makeLayer = (count, layerOffset, layerIndex) => {
    const petals = [];
    for (let i = 0; i < count; i += 1) {
      const hue = hueFor(i, count, layerOffset);
      const saturation = state.locks.s && state.selected
        ? state.selected.s
        : 70 + ((i * 9 + layerIndex * 7) % 24) + mood.saturation;
      const lightness = state.locks.l && state.selected
        ? state.selected.l
        : 42 + ((i * 11 + layerIndex * 5) % 28) + mood.lightness;
      petals.push({
        h: Math.round(hue),
        s: clamp(saturation, 58, 96),
        l: clamp(lightness, 34, 76),
        sourceFormat: 'hsl',
        source: `hsl(${Math.round(hue)} ${Math.round(saturation)}% ${Math.round(lightness)}%)`
      });
    }
    return petals;
  };

  return [
    makeLayer(9, 0, 0),
    makeLayer(12, 15, 1),
    makeLayer(15, 7, 2)
  ];
}

function calculateLayerRadii(layers) {
  return layers.map((_, index) => {
    if (index === 0) return CORE_SIZE * 0.58;
    if (index === 1) return CORE_SIZE * 1.12;
    return CORE_SIZE * 1.72;
  });
}

function calculateLayerRotations(layers) {
  return layers.map((layer, index) => (360 / layer.length) * (index * 0.42));
}

function getPetalZIndex(index, bottomIndex, totalPetals, layerIndex, totalLayers) {
  const baseZ = (totalLayers - layerIndex) * 100;
  const steps = (index - bottomIndex + totalPetals) % totalPetals;
  return baseZ + steps;
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
}

function describeArc(centerX, centerY, radius, startAngle, endAngle) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 0 ${end.x} ${end.y}`;
}

function createSvgElement(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function computeLayout(colors) {
  const layers = organizeColorsIntoLayers(colors);
  const radii = calculateLayerRadii(layers);
  const rotations = calculateLayerRotations(layers);
  const hueRadius = Math.max(radii[1] + PETAL_SIZE * 2.22, 260);
  const sliderRadius = hueRadius + SLIDER_OFFSET;
  const containerRadius = sliderRadius + BAR_WIDTH + 18;
  return { layers, radii, rotations, hueRadius, sliderRadius, size: containerRadius * 2 + 4 };
}

function clearPicker() {
  pickerEl.replaceChildren();
  state.petals = [];
  state.raf = 0;
}

function makeBackground(size) {
  const bg = document.createElement('div');
  bg.className = 'cf-bg-wrapper';
  bg.style.width = `${size}px`;
  bg.style.height = `${size}px`;
  return bg;
}

function makeHueRing(layout) {
  const size = layout.hueRadius * 2 + BAR_WIDTH * 2;
  const ring = document.createElement('div');
  ring.className = 'cf-hue-ring';
  ring.style.width = `${size}px`;
  ring.style.height = `${size}px`;
  ring.style.marginLeft = `${-size / 2}px`;
  ring.style.marginTop = `${-size / 2}px`;

  const handle = document.createElement('div');
  handle.className = 'cf-hue-handle';
  ring.appendChild(handle);
  ring._cf = { handle, radius: layout.hueRadius + 2 };

  ring.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    state.draggingHue = true;
    updateHueFromPointer(event);
    ring.setPointerCapture(event.pointerId);
  });
  ring.addEventListener('pointermove', (event) => {
    if (state.draggingHue) updateHueFromPointer(event);
  });
  ring.addEventListener('pointerup', () => {
    state.draggingHue = false;
  });
  ring.addEventListener('pointercancel', () => {
    state.draggingHue = false;
  });
  return ring;
}

function makeSlider(layout) {
  const radius = layout.sliderRadius;
  const size = (radius + BAR_WIDTH) * 2 + 20;
  const center = size / 2;
  const svg = createSvgElement('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}` });
  svg.classList.add('cf-slider');
  svg.style.width = `${size}px`;
  svg.style.height = `${size}px`;
  svg.style.marginLeft = `${-size / 2}px`;
  svg.style.marginTop = `${-size / 2}px`;

  const defs = createSvgElement('defs');
  const gradient = createSvgElement('linearGradient', {
    id: 'cf-slider-gradient',
    gradientUnits: 'userSpaceOnUse'
  });
  for (let i = 0; i < 11; i += 1) {
    gradient.appendChild(createSvgElement('stop', { offset: `${i * 10}%`, 'stop-color': '#fff' }));
  }
  defs.appendChild(gradient);

  const path = describeArc(center, center, radius, 57, 123);
  const bg = createSvgElement('path', {
    d: path,
    fill: 'none',
    stroke: 'rgba(0,0,0,.08)',
    'stroke-width': SLIDER_BAR_WIDTH,
    'stroke-linecap': 'round'
  });
  const track = createSvgElement('path', {
    d: path,
    fill: 'none',
    stroke: 'url(#cf-slider-gradient)',
    'stroke-width': SLIDER_BAR_WIDTH,
    'stroke-linecap': 'round'
  });
  track.classList.add('cf-slider-track');

  // Outline ring sits behind the handle so the colored marker stays visible on
  // both light and dark shades.
  const handleOutline = createSvgElement('circle', {
    r: SLIDER_BAR_WIDTH / 2 + 5,
    fill: 'none',
    stroke: 'rgba(0,0,0,.28)',
    'stroke-width': 2
  });
  handleOutline.classList.add('cf-slider-handle-outline');
  const handle = createSvgElement('circle', {
    r: SLIDER_BAR_WIDTH / 2 + 4,
    fill: '#fff',
    stroke: '#fff',
    'stroke-width': 3
  });
  handle.classList.add('cf-slider-handle');
  svg.append(defs, bg, track, handleOutline, handle);
  svg._cf = { gradient, handle, handleOutline, center, radius };
  svg.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    state.draggingSlider = true;
    updateSliderFromPointer(event);
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove', (event) => {
    if (state.draggingSlider) updateSliderFromPointer(event);
  });
  svg.addEventListener('pointerup', () => {
    state.draggingSlider = false;
  });
  svg.addEventListener('pointercancel', () => {
    state.draggingSlider = false;
  });
  return svg;
}

// Green sepal leaves (calyx) that wrap the closed bud — hidden while bloomed,
// they fan out and cradle the colourful bud so it reads as a natural bud.
function makeCalyx() {
  const calyx = document.createElement('div');
  calyx.className = 'cf-calyx';
  const LEAVES = 8;
  for (let i = 0; i < LEAVES; i += 1) {
    const leaf = document.createElement('span');
    leaf.className = 'cf-sepal';
    // Deterministic pseudo-variation so each leaf differs in length, width,
    // angle and tint — organic rather than a uniform star.
    const base = (i / LEAVES) * 360;
    const jitter = Math.sin(i * 12.9898) * 7;
    const len = 0.74 + (Math.sin(i * 78.233) * 0.5 + 0.5) * 0.22;
    const wid = 0.92 + (Math.cos(i * 3.17) * 0.5 + 0.5) * 0.26;
    const tint = (Math.sin(i * 5.21) * 0.5 + 0.5) * 10 - 5;
    leaf.style.setProperty('--sepal-angle', `${(base + jitter).toFixed(2)}deg`);
    leaf.style.setProperty('--sepal-len', len.toFixed(3));
    leaf.style.setProperty('--sepal-wid', wid.toFixed(3));
    leaf.style.setProperty('--sepal-hue', `${tint.toFixed(1)}deg`);
    calyx.appendChild(leaf);
  }
  return calyx;
}

function makeCore() {
  const core = document.createElement('button');
  core.type = 'button';
  core.className = 'cf-core';
  core.setAttribute('aria-label', 'Fold the flower into a bud, or open it again');
  core.addEventListener('click', () => {
    // If hidden (collapsed via Toggle Bloom), a pistil click blooms it; once
    // open, the pistil furls the flower closed into a bud and back.
    if (!state.expanded) {
      setExpanded(true);
    } else {
      setBud(!state.bud);
    }
  });
  return core;
}

function petalGeometry(layerIndex, index) {
  const middle = layerIndex === 1;
  const outer = layerIndex > 1;
  return {
    width: outer ? 122 + (index % 5) * 7 : middle ? 98 + (index % 4) * 7 : 72 + (index % 3) * 6,
    height: outer ? 168 + (index % 4) * 9 : middle ? 138 + (index % 3) * 10 : 100 + (index % 2) * 9,
    twist: ((index * 29 + layerIndex * 7) % 15) - 7
  };
}

function createPetal(color, layerIndex, index, totalPetals, radius, rotation, staggerDelay, zIndex) {
  const shape = petalGeometry(layerIndex, index);
  const baseAngle = index / totalPetals * 360 - 90 + rotation;
  const angle = baseAngle + shape.twist;
  const radian = baseAngle * Math.PI / 180;
  const petalRadius = radius + ((index % 3) - 1) * 3;
  const x = Math.cos(radian) * petalRadius;
  const y = Math.sin(radian) * petalRadius;
  const petal = document.createElement('button');
  petal.type = 'button';
  petal.className = 'cf-petal';
  petal.style.setProperty('--petal-w', `${shape.width}px`);
  petal.style.setProperty('--petal-h', `${shape.height}px`);
  const layerFactor = 1 + layerIndex * 0.6;
  petal.style.setProperty('--breeze-tilt', `${((0.55 + (index % 5) * 0.18) * layerFactor).toFixed(2)}deg`);
  petal.style.setProperty('--breeze-x', `${(((index + layerIndex) % 2 === 0 ? 1 : -1) * (0.8 + (index % 4) * 0.25) * layerFactor).toFixed(2)}px`);
  petal.style.setProperty('--breeze-duration', `${(6.8 + (index % 6) * 0.42 + layerIndex * 0.48).toFixed(2)}s`);
  petal.style.setProperty('--breeze-delay', `${(-(index * 0.27 + layerIndex * 0.64)).toFixed(2)}s`);
  petal.style.zIndex = String(zIndex);
  petal.style.transition = bloomPetalTransition(staggerDelay);
  petal.dataset.index = String(state.petals.length);
  petal.setAttribute('aria-label', `Select poppy petal hue ${color.h}`);
  const surface = document.createElement('span');
  surface.className = 'cf-petal-surface';
  petal.appendChild(surface);
  petal.addEventListener('click', () => selectColor(color, false));
  petal.addEventListener('mouseenter', () => {
    const item = state.petals[Number(petal.dataset.index)];
    item.hovered = true;
    updatePetalTransform(item);
  });
  petal.addEventListener('mouseleave', () => {
    const item = state.petals[Number(petal.dataset.index)];
    item.hovered = false;
    updatePetalTransform(item);
  });
  pickerEl.appendChild(petal);
  const item = { el: petal, color, x, y, angle, hovered: false, layerIndex, staggerDelay };
  state.petals.push(item);
  updatePetalColor(item);
  updatePetalTransform(item);
}

function renderPicker() {
  clearPicker();
  pickerEl.className = 'colorflower-picker flower-poppy';
  const palette = POPPY_COLORS.map(parseColor);
  const colors = palette.slice(state.paletteOffset).concat(palette.slice(0, state.paletteOffset));
  const layout = computeLayout(colors);
  state.layout = layout;
  pickerEl.style.width = `${layout.size}px`;
  pickerEl.style.height = `${layout.size}px`;
  pickerEl.style.setProperty('--duration', `${state.duration}ms`);

  pickerEl.appendChild(makeBackground(layout.size));
  pickerEl.appendChild(makeHueRing(layout));
  pickerEl.appendChild(makeSlider(layout));

  let previousItemsCount = 0;
  const totalLayers = layout.layers.length;
  for (let layerIndex = 0; layerIndex < layout.layers.length; layerIndex += 1) {
    const layer = layout.layers[layerIndex];
    const radius = layout.radii[layerIndex];
    const rotation = layout.rotations[layerIndex];
    const totalPetals = layer.length;
    let bottomIndex = 0;
    let minDiff = Infinity;

    for (let i = 0; i < totalPetals; i += 1) {
      const angle = ((i / totalPetals) * 360 - 90 + rotation + 360) % 360;
      const diff = Math.min(Math.abs(angle - 90), 360 - Math.abs(angle - 90));
      if (diff < minDiff) {
        minDiff = diff;
        bottomIndex = i;
      }
    }

    for (let index = 0; index < layer.length; index += 1) {
      createPetal(
        layer[index],
        layerIndex,
        index,
        totalPetals,
        radius,
        rotation,
        previousItemsCount * PETAL_STAGGER + index * PETAL_STAGGER,
        getPetalZIndex(index, bottomIndex, totalPetals, layerIndex, totalLayers)
      );
    }
    previousItemsCount += layer.length;
  }

  pickerEl.appendChild(makeCalyx());
  pickerEl.appendChild(makeCore());
  selectColor(state.selected || state.petals[0]?.color || colors[8] || colors[0], true);
  updateExpandedClass();
  // Two passes: the first shrink changes surrounding layout, the second
  // re-measures against the settled geometry.
  fitFlower();
  requestAnimationFrame(fitFlower);
  requestAnimationFrame(() => setExpanded(true));
}

// Scale the whole bloom down when the stage is too short for its intrinsic
// (JS-computed) pixel size, so it never overlaps the stage header above or
// the caption/garden below. Uses the standalone `scale` property, which
// composes with the float/wind `transform` layers without touching them.
const cfFloatEl = document.querySelector('.cf-float');
const stageHeaderEl = document.querySelector('.stage-header');
const stageHintEl = document.querySelector('.stage-hint');

function fitFlower() {
  if (!state.layout || !cfFloatEl || !stageHeaderEl) return;
  const below = paletteGarden && paletteGarden.offsetHeight > 0 ? paletteGarden : stageHintEl;
  if (!below) return;
  const avail = below.getBoundingClientRect().top - stageHeaderEl.getBoundingClientRect().bottom - 12;
  // The 3D perspective tilt means the painted bloom is ~82% of its layout
  // box height, so size against the projected height, not the box. Floor at
  // 0.62 — below that the flower reads as a thumbnail; a little overlap on
  // extreme viewports beats an unusably small picker.
  const projected = state.layout.size * 0.82;
  const fit = avail > 0 ? Math.min(1, Math.max(avail / projected, 0.62)) : 1;
  state.fit = fit;
  if (fit === 1) {
    cfFloatEl.style.scale = '';
    cfFloatEl.style.width = '';
    cfFloatEl.style.height = '';
    cfFloatEl.style.translate = '';
  } else {
    // The scale property shrinks the painted flower but not its layout box —
    // explicitly size the wrapper too so the stage grid centers it correctly.
    const px = `${Math.round(state.layout.size * fit)}px`;
    cfFloatEl.style.scale = String(fit);
    cfFloatEl.style.width = px;
    cfFloatEl.style.height = px;
    cfFloatEl.style.translate = '';
  }
  state.pickerCenter = null;
}

function setExpanded(expanded) {
  state.expanded = expanded;
  if (!expanded) state.bud = false;
  pickerEl.classList.toggle('is-bud', state.bud);
  updateExpandedClass();
  for (const item of state.petals) {
    item.el.style.transition = bloomPetalTransition(item.staggerDelay);
    updatePetalTransform(item);
  }
  scheduleRelax();
}

function budPetalTransition(staggerDelay = 0) {
  return `transform ${BUD_FOLD_DURATION}ms cubic-bezier(.45, .05, .15, 1) ${staggerDelay}ms, opacity 200ms ease, background 180ms ease, filter ${BUD_FOLD_DURATION}ms ease, box-shadow 180ms ease`;
}

// Furl the bloom into a bud (or unfurl back). Outer layers lead when closing so
// they appear to wrap over the inner petals; inner layers lead when opening.
function setBud(on) {
  state.bud = on;
  pickerEl.classList.toggle('is-bud', on);
  for (const item of state.petals) {
    const layer = item.layerIndex || 0;
    const stagger = on ? (2 - layer) * 70 : layer * 70;
    item.el.style.transition = budPetalTransition(Math.max(0, stagger));
    updatePetalTransform(item);
  }
  window.clearTimeout(state.relaxTimer);
  state.relaxTimer = window.setTimeout(relaxPetalTransitions, BUD_FOLD_DURATION + 260);
}

function updateExpandedClass() {
  pickerEl.classList.toggle('is-expanded', state.expanded);
  pickerEl.querySelector('.cf-core')?.setAttribute('aria-expanded', String(state.expanded));
}

function updatePetalColor(item) {
  const h = item.color.h;
  const top = `hsl(${h}, ${clamp(item.color.s + 4, 0, 100)}%, ${clamp(item.color.l + 17, 0, 96)}%)`;
  const mid = `hsl(${h}, ${clamp(item.color.s + 2, 0, 100)}%, ${clamp(item.color.l + 1, 0, 94)}%)`;
  const lower = `hsl(${h}, ${clamp(item.color.s + 7, 0, 100)}%, ${clamp(item.color.l - 13, 5, 88)}%)`;
  const throat = `hsl(${h}, ${clamp(item.color.s + 12, 0, 100)}%, ${clamp(item.color.l - 30, 3, 48)}%)`;
  item.el.style.background = 'transparent';
  item.el.style.setProperty('--petal-bg', `radial-gradient(ellipse at 45% 98%, ${throat} 0 11%, transparent 43%), radial-gradient(circle at 32% 16%, rgba(255,255,255,.38), transparent 25%), radial-gradient(circle at 72% 18%, rgba(255,255,255,.16), transparent 27%), linear-gradient(176deg, ${top} 0%, ${mid} 47%, ${lower} 100%)`);
  item.el.style.setProperty('--petal-vein', `hsla(${h}, ${clamp(item.color.s + 8, 0, 100)}%, ${clamp(item.color.l + 25, 0, 96)}%, .34)`);
  item.el.style.setProperty('--petal-ridge', `hsla(${h}, ${clamp(item.color.s + 10, 0, 100)}%, ${clamp(item.color.l - 22, 4, 50)}%, .16)`);
}

function bloomPetalTransition(staggerDelay = 0) {
  return `transform ${state.duration}ms ${BLOOM_EASING} ${staggerDelay}ms, opacity ${state.duration}ms ${BLOOM_EASING} ${staggerDelay}ms, background 180ms ease, filter 180ms ease, box-shadow 180ms ease`;
}

function relaxPetalTransitions() {
  for (const item of state.petals) item.el.style.transition = INTERACTIVE_PETAL_TRANSITION;
}

function scheduleRelax() {
  window.clearTimeout(state.relaxTimer);
  const settle = state.duration + state.petals.length * PETAL_STAGGER + 80;
  state.relaxTimer = window.setTimeout(relaxPetalTransitions, settle);
}

// Hot path: only the transform changes per animation frame (repulsion + cup +
// scale). Kept free of repaint-triggering writes (filter / box-shadow / opacity).
function writePetalTransform(item) {
  const baseCup = (item.layerIndex || 0) * PETAL_CUP_PER_LAYER;
  // Collapsed (scale 0) — the Toggle Bloom button's hide state.
  if (!state.expanded) {
    item.el.style.transform = `translate(0, 0) rotate(${item.angle + 90}deg) rotateX(${baseCup}deg) scale(0)`;
    return;
  }
  // Bud — petals gathered toward centre and stood up to furl closed.
  if (state.bud) {
    const fx = item.x * BUD_GATHER;
    const fy = item.y * BUD_GATHER - BUD_LIFT;
    const cup = BUD_CUP_BASE + (item.layerIndex || 0) * BUD_CUP_PER_LAYER;
    item.el.style.transform = `translate(${fx.toFixed(1)}px, ${fy.toFixed(1)}px) rotate(${item.angle + 90}deg) rotateX(${cup}deg) scale(${BUD_SCALE})`;
    return;
  }
  // Bloomed — placement + cursor repulsion + hover lift.
  const scale = item.hovered ? PETAL_HOVER_SCALE : 1;
  let x = item.x;
  let y = item.y;
  if (state.mouse && !item.hovered) {
    const dx = x - state.mouse.x;
    const dy = y - state.mouse.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < PETAL_REPULSION_RADIUS) {
      // ease the falloff (quadratic) so the push is strong near the cursor and
      // tapers smoothly — reads as petals gently swaying out of the way.
      const falloff = 1 - distance / PETAL_REPULSION_RADIUS;
      const push = falloff * falloff * PETAL_REPULSION_PUSH;
      const angle = Math.atan2(dy, dx);
      x += Math.cos(angle) * push;
      y += Math.sin(angle) * push;
    }
  }
  item.el.style.transform = `translate(${x}px, ${y}px) rotate(${item.angle + 90}deg) rotateX(${baseCup}deg) scale(${scale})`;
}

// Cold path: opacity / filter / box-shadow only change on bloom or hover, so
// they are written only on those discrete events, never per frame.
function writePetalCosmetics(item) {
  item.el.style.opacity = state.expanded ? '1' : '0';
  // In bud: mute all petals toward a single soft tone so the furled cluster
  // reads as one closed bud, not a candy ball of 36 competing colors.
  item.el.style.filter = state.bud
    ? 'saturate(.68) brightness(.97)'
    : item.hovered ? 'brightness(1.12) saturate(1.12)' : 'brightness(1)';
  item.el.style.boxShadow = item.hovered
    ? '0 12px 24px rgba(80, 12, 18, .26)'
    : '0 5px 14px rgba(80, 12, 18, .16)';
}

function updatePetalTransform(item) {
  writePetalTransform(item);
  writePetalCosmetics(item);
}

function selectColor(color, preserveSlider = false) {
  state.selected = color;
  if (!preserveSlider) state.sliderValue = lightnessToSliderValue(color.l);
  for (const item of state.petals) item.el.classList.toggle('is-selected', item.color === color);
  updateColorOutput();
}

function updateColorOutput() {
  const output = colorOutput();
  selectedSwatch.style.backgroundColor = output.hex;
  selectedHex.textContent = output.hex;
  selectedRgb.textContent = output.rgbString;
  selectedHsl.textContent = output.hsl;
  selectedOklch.textContent = output.oklch;
  selectedOklab.textContent = output.oklab;
  aiColorName.textContent = generateColorName(output);
  hueRange.value = String(Math.round(output.h));
  hueValue.textContent = `${Math.round(output.h)}deg`;
  saturationRange.value = String(Math.round(state.selected.s));
  saturationValue.textContent = `${Math.round(state.selected.s)}%`;
  saturationRange.style.background = `linear-gradient(90deg, hsl(${output.h}, 0%, ${Math.round(output.l)}%), hsl(${output.h}, 100%, ${Math.round(output.l)}%))`;
  pickerEl.style.setProperty('--core-color', output.hex);
  pickerEl.style.setProperty('--ring-color', output.hsl);
  updateHueHandle(output);
  updateSlider(output);
  updateContrast(output);
  addHistory(output);
  renderTokenOutput();
  updateCompare();
}

function updateHueHandle(output = colorOutput()) {
  const ring = pickerEl.querySelector('.cf-hue-ring');
  if (!ring?._cf) return;
  const { handle, radius } = ring._cf;
  const angle = output.h * Math.PI / 180;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  handle.style.transform = `translate(${x}px, ${y}px)`;
  handle.style.backgroundColor = output.hsl;
}

function updateSlider(output = colorOutput()) {
  const slider = pickerEl.querySelector('.cf-slider');
  if (!slider?._cf) return;
  const { gradient, handle, handleOutline, center, radius } = slider._cf;
  const stops = Array.from(gradient.children);
  for (let i = 0; i < stops.length; i += 1) {
    const value = i * 10;
    const lightness = sliderValueToLightness(value);
    const saturation = getVisualSaturation(value, state.selected.s);
    stops[i].setAttribute('stop-color', `hsl(${state.selected.h}, ${saturation}%, ${lightness}%)`);
  }

  const angle = 57 + (state.sliderValue / 100) * 66;
  const pos = polarToCartesian(center, center, radius, angle);
  handle.setAttribute('cx', String(pos.x));
  handle.setAttribute('cy', String(pos.y));
  handle.setAttribute('fill', output.hsl);
  if (handleOutline) {
    handleOutline.setAttribute('cx', String(pos.x));
    handleOutline.setAttribute('cy', String(pos.y));
  }
}

function updateHueFromPointer(event) {
  const ring = pickerEl.querySelector('.cf-hue-ring');
  const rect = ring.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  let hue = Math.atan2(dy, dx) * 180 / Math.PI;
  if (hue < 0) hue += 360;
  const saturation = Number(saturationRange.value);
  state.selected = {
    h: Math.round(hue),
    s: Number.isFinite(saturation) ? clamp(saturation, 0, 100) : 88,
    l: sliderValueToLightness(state.sliderValue),
    sourceFormat: 'hue-ring',
    source: 'interactive hue ring'
  };
  for (const item of state.petals) item.el.classList.remove('is-selected');
  updateColorOutput();
}

function selectManualColor() {
  if (!state.ready) {
    return;
  }

  state.selected = {
    h: clamp(Number(hueRange.value) || 0, 0, 359),
    s: clamp(Number(saturationRange.value) || 0, 0, 100),
    l: sliderValueToLightness(state.sliderValue),
    sourceFormat: 'manual',
    source: 'manual hue and saturation controls'
  };
  for (const item of state.petals) item.el.classList.remove('is-selected');
  updateColorOutput();
}

function updateSliderFromPointer(event) {
  const slider = pickerEl.querySelector('.cf-slider');
  if (!slider?._cf) return;
  const rect = slider.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
  if (angle < 0) angle += 360;
  state.sliderValue = clamp((angle - 57) / 66 * 100, 0, 100);
  updateColorOutput();
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function applyWindTilt() {
  // NOTE: only the picker `transform` is written per frame here — that is
  // GPU-composited and cheap. The sheen (--sheen-x/y) is intentionally NOT
  // updated per frame: it drives a background gradient on 36 petal ::before
  // layers, so animating it forced a full repaint of all of them every frame
  // (~150ms/frame, ~6fps on pointer move). The static sheen + composited tilt
  // give the same look at 60fps.
  if (prefersReducedMotion.matches || !state.mouse || !state.layout) {
    pickerEl.style.transform = 'rotateX(0deg) rotateY(0deg)';
    return;
  }
  const half = state.layout.size / 2;
  const nx = clamp(state.mouse.x / half, -1, 1);
  const ny = clamp(state.mouse.y / half, -1, 1);
  pickerEl.style.transform = `rotateX(${(-ny * WIND_MAX_TILT).toFixed(2)}deg) rotateY(${(nx * WIND_MAX_TILT).toFixed(2)}deg)`;
}

// Cache the picker's center so pointermove never reads layout. Reading
// getBoundingClientRect() per move forced a synchronous reflow on every event
// (the idle float animation keeps invalidating style), which the profiler
// flagged as ~400ms of layout thrashing across a short sweep. The layout box
// is stable while floating, so a cached center is both correct and free.
function refreshPickerCenter() {
  const rect = pickerEl.getBoundingClientRect();
  state.pickerCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function queueInteractiveUpdate(event) {
  if (!state.pickerCenter) refreshPickerCenter();
  // Divide by the fit scale so mouse offsets stay in the flower's own
  // (unscaled) coordinate space, keeping wind/petal-sway math calibrated.
  const fit = state.fit || 1;
  state.mouse = {
    x: (event.clientX - state.pickerCenter.x) / fit,
    y: (event.clientY - state.pickerCenter.y) / fit
  };
  if (state.raf) return;
  state.raf = requestAnimationFrame(() => {
    applyWindTilt();
    for (const item of state.petals) writePetalTransform(item);
    state.raf = 0;
  });
}

function rebloom() {
  state.paletteOffset = (state.paletteOffset + 3) % POPPY_COLORS.length;
  renderPicker();
}

toggleBloom.addEventListener('click', () => setExpanded(!state.expanded));

if (helpToggle && helpDialog) {
  helpToggle.addEventListener('click', () => helpDialog.showModal());
  helpClose?.addEventListener('click', () => helpDialog.close());
  // Click on the backdrop (outside the dialog content) closes it.
  helpDialog.addEventListener('click', (event) => {
    if (event.target === helpDialog) helpDialog.close();
  });
}

// Three-position density switch: Zen (minimal — swatch + hue/saturation
// sliders + copy, no flower), Focus (existing collapsed-panels mode), Studio
// (full layout, default). All three share the same underlying state/engine;
// switching never loses the current selection.
const DENSITY_LEVELS = ['zen', 'focus', 'studio'];

function setDensity(level, { persist = true } = {}) {
  if (!appShell || !DENSITY_LEVELS.includes(level)) return;
  appShell.classList.toggle('is-zen', level === 'zen');
  appShell.classList.toggle('is-collapsed', level === 'focus');
  densityButtons.forEach((btn) => {
    const active = btn.dataset.density === level;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  // The flower moves/hides across density changes, so the cached pointer
  // center goes stale. Invalidate it (and refresh after the CSS transition).
  state.pickerCenter = null;
  window.setTimeout(() => { state.pickerCenter = null; fitFlower(); }, 560);
  if (persist) {
    try { window.localStorage.setItem('cf-density', level); } catch { /* private mode etc. */ }
  }
}

if (densityButtons.length && appShell) {
  densityButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setDensity(btn.dataset.density);
      btn.blur(); // don't leave the hover/focus tooltip lingering after a click
    });
  });
  let savedDensity = 'studio';
  try { savedDensity = window.localStorage.getItem('cf-density') || 'studio'; } catch { /* private mode etc. */ }
  setDensity(savedDensity, { persist: false });
}
rebloomButton.addEventListener('click', rebloom);
copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(selectedHex.textContent);
    copyButton.textContent = 'Copied';
    setTimeout(() => {
      copyButton.textContent = 'Copy HEX';
    }, 850);
  } catch {
    copyButton.textContent = 'Copy failed';
    setTimeout(() => {
      copyButton.textContent = 'Copy HEX';
    }, 1100);
  }
});

harmonyMode.addEventListener('change', syncGeneratorState);
moodMode.addEventListener('change', syncGeneratorState);
lockHue.addEventListener('change', syncGeneratorState);
lockSaturation.addEventListener('change', syncGeneratorState);
lockLightness.addEventListener('change', syncGeneratorState);
contrastBg.addEventListener('input', () => updateContrast(colorOutput()));

addBouquetButton.addEventListener('click', () => {
  const snapshot = getSnapshot();
  state.bouquet = [snapshot, ...state.bouquet.filter((item) => item.hex !== snapshot.hex)].slice(0, 12);
  renderBouquet();
});

copyTokensButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(buildCssTokens(state.bouquet));
    copyTokensButton.textContent = 'Copied tokens';
  } catch {
    copyTokensButton.textContent = 'Copy failed';
  }
  setTimeout(() => {
    copyTokensButton.textContent = 'Copy CSS tokens';
  }, 900);
});

copyJsonButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(state.bouquet.length ? state.bouquet : [getSnapshot()], null, 2));
    copyJsonButton.textContent = 'Copied JSON';
  } catch {
    copyJsonButton.textContent = 'Copy failed';
  }
  setTimeout(() => {
    copyJsonButton.textContent = 'Copy JSON';
  }, 900);
});

setCompareAButton.addEventListener('click', () => {
  state.compare.a = getSnapshot();
  updateCompare();
});

setCompareBButton.addEventListener('click', () => {
  state.compare.b = getSnapshot();
  updateCompare();
});

imageUpload.addEventListener('change', (event) => {
  extractPaletteFromImage(event.target.files?.[0]);
});

motionRange.addEventListener('input', () => {
  state.duration = Number(motionRange.value);
  motionValue.textContent = `${state.duration}ms`;
  pickerEl.style.setProperty('--duration', `${state.duration}ms`);
});

hueRange.addEventListener('input', selectManualColor);
saturationRange.addEventListener('input', selectManualColor);

pickerEl.addEventListener('pointerenter', refreshPickerCenter);
pickerEl.addEventListener('pointermove', queueInteractiveUpdate);
pickerEl.addEventListener('pointerleave', () => {
  state.mouse = null;
  applyWindTilt();
  for (const item of state.petals) writePetalTransform(item);
});

// Geometry only changes on resize/scroll; invalidate the cache then, never per move.
window.addEventListener('resize', () => { state.pickerCenter = null; fitFlower(); });
window.addEventListener('scroll', () => { state.pickerCenter = null; }, { passive: true });

// --- Shared tooltip -------------------------------------------------------
// One fixed-position element for every [data-tooltip] trigger. Placed with
// viewport-clamped math so it can never be cut off by a screen edge or by
// the tool panel's overflow clipping.
const tooltipEl = document.createElement('div');
tooltipEl.className = 'cf-tooltip';
tooltipEl.setAttribute('role', 'tooltip');
document.body.appendChild(tooltipEl);

function showTooltip(trigger) {
  const text = trigger.getAttribute('data-tooltip');
  if (!text) return;
  tooltipEl.textContent = text;
  const r = trigger.getBoundingClientRect();
  const w = tooltipEl.offsetWidth;
  const h = tooltipEl.offsetHeight;
  const x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
  let y = r.top - h - 10;
  if (y < 8) y = Math.min(r.bottom + 10, window.innerHeight - h - 8);
  tooltipEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  tooltipEl.classList.add('is-visible');
}

function hideTooltip() {
  tooltipEl.classList.remove('is-visible');
}

document.addEventListener('pointerover', (event) => {
  const trigger = event.target.closest?.('[data-tooltip]');
  if (trigger) showTooltip(trigger);
  else hideTooltip();
});
document.addEventListener('pointerdown', hideTooltip, true);
document.addEventListener('focusin', (event) => {
  const trigger = event.target.closest?.('[data-tooltip]');
  if (trigger && event.target.matches(':focus-visible')) showTooltip(trigger);
  else hideTooltip();
});
document.addEventListener('focusout', hideTooltip);
document.addEventListener('scroll', hideTooltip, true);

renderPicker();
renderBouquet();

window.setTimeout(() => {
  state.ready = true;
}, 250);
