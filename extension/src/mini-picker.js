// Mini flower picker — Colorflower's own compact color picker, used where a
// native <input type="color"> would break the brand (e.g. the Brand dialog
// seed). A ring of 12 hue petals + OKLCH lightness/chroma sliders (live
// gradient tracks, gamut-clamped) + hex field + EyeDropper when available.
//
// createMiniPicker(initialHex, onChange) -> { el, getHex, setHex }
// `el` is a swatch button; clicking it opens the popover. onChange(hex)
// fires on every committed change.

import { hexToRgb, rgbToHex, rgbToOklch, clampToSrgbByChroma } from '../core/color-engine.js';

const PETALS = 12;

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

export function createMiniPicker(initialHex, onChange) {
  // Internal state lives in OKLCH so petal hue / lightness / chroma compose
  // predictably (no HSL hue drift when lightness moves).
  const rgb0 = hexToRgb(initialHex) || { r: 233, g: 58, b: 58 };
  const state = rgbToOklch(rgb0.r, rgb0.g, rgb0.b);

  const swatchBtn = el('button', { type: 'button', class: 'mini-picker-swatch', 'aria-label': 'Pick a color', 'aria-haspopup': 'dialog' });
  const pop = el('div', { class: 'mini-picker-pop', role: 'dialog', 'aria-label': 'Colorflower mini picker' });
  const wrap = el('div', { class: 'mini-picker' }, [swatchBtn, pop]);

  const ring = el('div', { class: 'mini-petal-ring' });
  const center = el('div', { class: 'mini-ring-center' });
  ring.appendChild(center);
  const petalEls = [];
  for (let i = 0; i < PETALS; i += 1) {
    const hue = (i / PETALS) * 360;
    const petal = el('button', {
      type: 'button', class: 'mini-petal', 'aria-label': `Hue ${Math.round(hue)} degrees`,
      onclick: () => { state.h = hue; commit(); }
    });
    petal.style.setProperty('--petal-angle', `${hue}deg`);
    petalEls.push({ petal, hue });
    ring.appendChild(petal);
  }

  const uid = `mp-${Math.trunc(performance.now() * 1000).toString(36)}`;
  const lightRange = el('input', { type: 'range', class: 'mini-range', name: `${uid}-light`, min: 12, max: 96, step: 1, 'aria-label': 'Lightness' });
  const chromaRange = el('input', { type: 'range', class: 'mini-range', name: `${uid}-chroma`, min: 0, max: 30, step: 1, 'aria-label': 'Chroma' });
  lightRange.addEventListener('input', () => { state.l = Number(lightRange.value) / 100; commit(); });
  chromaRange.addEventListener('input', () => { state.c = Number(chromaRange.value) / 100; commit(); });

  const hexInput = el('input', {
    type: 'text', class: 'mini-hex', name: `${uid}-hex`, spellcheck: 'false', 'aria-label': 'Hex color',
    onchange: () => {
      const rgb = hexToRgb(hexInput.value.trim());
      if (!rgb) { hexInput.value = getHex(); return; }
      Object.assign(state, rgbToOklch(rgb.r, rgb.g, rgb.b));
      commit();
    }
  });

  const controls = el('div', { class: 'mini-controls' }, [
    el('label', { class: 'mini-field' }, [el('span', { text: 'Light' }), lightRange]),
    el('label', { class: 'mini-field' }, [el('span', { text: 'Chroma' }), chromaRange])
  ]);

  const footer = el('div', { class: 'mini-footer' }, [hexInput]);
  if ('EyeDropper' in window) {
    footer.appendChild(el('button', {
      type: 'button', class: 'mini-eyedropper', 'aria-label': 'Pick a color from the screen', text: '⌖',
      onclick: async () => {
        try {
          const { sRGBHex } = await new window.EyeDropper().open();
          const rgb = hexToRgb(sRGBHex);
          Object.assign(state, rgbToOklch(rgb.r, rgb.g, rgb.b));
          commit();
        } catch { /* user cancelled the eyedropper */ }
      }
    }));
  }

  pop.append(ring, controls, footer);

  function getHex() {
    return clampToSrgbByChroma(state.l, state.c, state.h).hex;
  }

  function gradientFor(vary) {
    // Sample 7 gamut-clamped stops along the varying channel at the current
    // values of the other two, so the track always shows reachable colors.
    const stops = [];
    for (let i = 0; i <= 6; i += 1) {
      const t = i / 6;
      const l = vary === 'l' ? 0.12 + t * 0.84 : state.l;
      const c = vary === 'c' ? t * 0.3 : state.c;
      stops.push(clampToSrgbByChroma(l, c, state.h).hex);
    }
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }

  function render() {
    const hex = getHex();
    swatchBtn.style.background = hex;
    center.style.background = hex;
    hexInput.value = hex;
    lightRange.value = String(Math.round(state.l * 100));
    chromaRange.value = String(Math.round(state.c * 100));
    lightRange.style.background = gradientFor('l');
    chromaRange.style.background = gradientFor('c');
    petalEls.forEach(({ petal, hue }) => {
      petal.style.background = clampToSrgbByChroma(state.l, Math.max(state.c, 0.1), hue).hex;
      petal.classList.toggle('is-active', Math.abs(((state.h - hue + 540) % 360) - 180) < 360 / PETALS / 2);
    });
  }

  function commit() {
    render();
    onChange(getHex());
  }

  swatchBtn.addEventListener('click', () => {
    const open = pop.classList.toggle('is-open');
    if (open) render();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!wrap.contains(event.target)) pop.classList.remove('is-open');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') pop.classList.remove('is-open');
  });

  render();

  return {
    el: wrap,
    getHex,
    setHex(hex) {
      const rgb = hexToRgb(hex);
      if (!rgb) return;
      Object.assign(state, rgbToOklch(rgb.r, rgb.g, rgb.b));
      render();
    }
  };
}
