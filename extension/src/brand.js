// Colorflower "Brand" workflow — seed color + mood -> a complete, contrast-
// checked light/dark theme with multi-format export. Isolated dialog/module,
// same as learn.js: its own state, can't regress the flower or app.js.
//
// Almost all of the real work here is generateTheme() in the shared engine
// (60-30-10 role mapping, dark derivation, contrast audit) — this file is
// the UI wrapper + export formatters around it.

import { generateTheme, getBrand, searchBrands, MOODS } from '../core/color-engine.js';
import { createMiniPicker } from './mini-picker.js';

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

const ROLE_LABELS = { background: 'Background', surface: 'Surface', textPrimary: 'Text primary', textSecondary: 'Text secondary', brand: 'Brand', accent: 'Accent' };
const kebab = (s) => s.replace(/([A-Z])/g, '-$1').toLowerCase();

// ---- Export formatters -------------------------------------------------------

function toCssVars(theme) {
  const lines = [':root {'];
  Object.entries(theme.light).forEach(([k, v]) => lines.push(`  --${kebab(k)}: ${v};`));
  lines.push('}', '', '[data-theme="dark"] {');
  Object.entries(theme.dark_theme).forEach(([k, v]) => lines.push(`  --${kebab(k)}: ${v};`));
  lines.push('}');
  return lines.join('\n');
}

function toScss(theme) {
  const lines = ['// Light', ...Object.entries(theme.light).map(([k, v]) => `$${kebab(k)}: ${v};`)];
  lines.push('', '// Dark', ...Object.entries(theme.dark_theme).map(([k, v]) => `$${kebab(k)}-dark: ${v};`));
  return lines.join('\n');
}

function toTailwind(theme) {
  const colorLines = Object.entries(theme.light).map(([k, v]) => `        '${kebab(k)}': '${v}'`).join(',\n');
  return `// tailwind.config.js (excerpt) — dark values in theme.dark_theme via the JSON export\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n${colorLines}\n      }\n    }\n  }\n};`;
}

function toW3cTokens(theme) {
  const group = (roles) => Object.fromEntries(Object.entries(roles).map(([k, v]) => [kebab(k), { $type: 'color', $value: v }]));
  return JSON.stringify({ light: group(theme.light), dark: group(theme.dark_theme) }, null, 2);
}

function toJson(theme) { return JSON.stringify(theme, null, 2); }

const EXPORT_FORMATS = [
  { id: 'css', label: 'CSS variables', build: toCssVars },
  { id: 'tailwind', label: 'Tailwind', build: toTailwind },
  { id: 'tokens', label: 'W3C tokens', build: toW3cTokens },
  { id: 'scss', label: 'SCSS', build: toScss },
  { id: 'json', label: 'JSON', build: toJson }
];

// ---- UI -----------------------------------------------------------------------

async function copyText(button, text) {
  try {
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = original; }, 1200);
  } catch { /* clipboard unavailable (permissions, insecure context) — silently no-op */ }
}

function roleSwatchRow(roles, title) {
  const row = el('div', { class: 'brand-role-row' });
  row.append(el('p', { class: 'learn-mini-label', text: title }));
  const strip = el('div', { class: 'brand-role-strip' });
  Object.entries(roles).forEach(([key, hex]) => {
    strip.appendChild(el('div', { class: 'brand-role-swatch' }, [
      el('div', { class: 'brand-role-color', style: `background:${hex}` }),
      el('span', { text: ROLE_LABELS[key] || key }),
      el('code', { text: hex })
    ]));
  });
  row.appendChild(strip);
  return row;
}

function shadeStrip(colors, title) {
  const wrap = el('div', {});
  wrap.append(el('p', { class: 'learn-mini-label', text: title }));
  wrap.append(el('div', { class: 'learn-strip' }, colors.map((c) => el('div', { class: 'learn-strip-swatch', style: `background:${c}` }))));
  return wrap;
}

function contrastAuditList(audit) {
  const list = el('div', { class: 'brand-audit' });
  audit.results.forEach((r) => {
    list.appendChild(el('div', { class: 'brand-audit-row', 'data-pass': String(r.AA) }, [
      el('span', { class: 'brand-audit-dot' }),
      el('span', { class: 'brand-audit-label', text: r.label }),
      el('span', { class: 'brand-audit-ratio', text: `${r.ratio}:1 · ${r.grade}` })
    ]));
  });
  const summary = audit.allPass
    ? 'All pairs pass WCAG AA.'
    : `${audit.failing.length} pair(s) fail AA — swap in an adjacent shade before shipping.`;
  return el('div', {}, [list, el('p', { class: 'learn-caption', 'data-pass': String(audit.allPass), text: summary })]);
}

function buildResults(container, theme) {
  container.replaceChildren();
  container.append(
    el('p', { class: 'learn-caption', text: `${theme.harmony.harmony} harmony (cap ${theme.harmony.saturationCap}% saturation) — ${theme.harmony.rationale}` }),
    shadeStrip(theme.shades, 'Light 10-shade ramp'),
    shadeStrip(theme.dark, 'Dark-derived ramp'),
    roleSwatchRow(theme.light, 'Light theme roles (60-30-10)'),
    roleSwatchRow(theme.dark_theme, 'Dark theme roles'),
    el('p', { class: 'learn-mini-label', text: 'Contrast audit' }),
    contrastAuditList(theme.contrastAudit)
  );

  const exportRow = el('div', { class: 'learn-toggle-row brand-export-row' });
  const pre = el('pre', { class: 'brand-export-pre' });
  let activeFormat = EXPORT_FORMATS[0];
  const copyBtn = el('button', { type: 'button', class: 'small-command', text: 'Copy', onclick: () => copyText(copyBtn, pre.textContent) });

  function renderExport() {
    pre.textContent = activeFormat.build(theme);
    Array.from(exportRow.children).forEach((btn) => btn.classList.toggle('is-active', btn.dataset.format === activeFormat.id));
  }
  EXPORT_FORMATS.forEach((fmt) => {
    exportRow.appendChild(el('button', {
      type: 'button', class: 'learn-chip', text: fmt.label, 'data-format': fmt.id,
      onclick: () => { activeFormat = fmt; renderExport(); }
    }));
  });
  renderExport();
  container.append(el('div', { class: 'brand-export' }, [exportRow, pre, copyBtn]));
}

function init() {
  const brandToggle = document.getElementById('brand-toggle');
  const brandDialog = document.getElementById('brand-dialog');
  const brandClose = document.getElementById('brand-close');
  const body = document.getElementById('brand-body');
  if (!brandToggle || !brandDialog) return;

  let seed = '#e93a3a';
  let mood = 'balanced';
  let built = false;

  function build() {
    body.replaceChildren();

    const seedPicker = createMiniPicker(seed, (hex) => { seed = hex; regenerate(); });
    seedPicker.el.id = 'brand-seed-input';
    const brandSearch = el('input', { type: 'text', id: 'brand-search-input', name: 'brand-search', autocomplete: 'off', placeholder: 'Search a brand (e.g. spotify)...', class: 'brand-search-input' });
    const searchResults = el('div', { class: 'brand-search-results' });

    let searchTimer;
    brandSearch.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = brandSearch.value.trim();
      if (q.length < 2) { searchResults.replaceChildren(); return; }
      searchTimer = setTimeout(async () => {
        const matches = await searchBrands(q, 8);
        searchResults.replaceChildren(...matches.map((name) => el('button', {
          type: 'button', class: 'learn-chip', text: name,
          onclick: async () => {
            const brand = await getBrand(name);
            if (brand) { seed = brand.primary; seedPicker.setHex(seed); searchResults.replaceChildren(); brandSearch.value = name; regenerate(); }
          }
        })));
      }, 200);
    });

    const moodRow = el('div', { class: 'learn-toggle-row' });
    function renderMoodRow() {
      moodRow.replaceChildren(...MOODS.map((m) => el('button', {
        type: 'button', class: 'learn-chip', text: m,
        onclick: () => { mood = m; renderMoodRow(); regenerate(); }
      })));
      Array.from(moodRow.children).forEach((btn, i) => btn.classList.toggle('is-active', MOODS[i] === mood));
    }
    renderMoodRow();

    const results = el('div', { class: 'brand-results' });

    function regenerate() {
      buildResults(results, generateTheme(seed, mood));
    }
    regenerate();

    body.append(
      el('p', { class: 'learn-lede', text: 'Pick a seed color (or search a brand) and a mood. Everything below — the ramp, dark mode, and semantic tokens — is generated and contrast-checked in one pass.' }),
      el('div', { class: 'learn-mix-row' }, [
        el('label', { class: 'learn-field' }, [el('span', { text: 'Seed' }), seedPicker.el]),
        el('label', { class: 'learn-field brand-search-field' }, [el('span', { text: 'Or search a brand' }), brandSearch])
      ]),
      searchResults, moodRow, results
    );
  }

  brandToggle.addEventListener('click', () => {
    if (!built) { build(); built = true; }
    brandDialog.showModal();
  });
  brandClose?.addEventListener('click', () => brandDialog.close());
  brandDialog.addEventListener('click', (event) => { if (event.target === brandDialog) brandDialog.close(); });
}

init();
