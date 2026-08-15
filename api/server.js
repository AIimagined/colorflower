// Colorflower REST API — zero-dependency HTTP server over the shared color
// engine. Run:  node api/server.js   (PORT env optional, default 8787)
//
// Endpoints (all GET, JSON responses):
//   /health
//   /convert?color=<hex|rgb()|hsl()>
//   /palette?harmony=<rule>&mood=<mood>&baseHue=<deg>&count=<n>
//   /contrast?fg=<color>&bg=<color>
//   /name?color=<color>
//   /tokens?harmony=&mood=&baseHue=&count=     -> CSS custom properties
//   /shades?seed=<color>                       -> 10-step Ant-style ramp
//   /dark-palette?shades=<h,h,...>&background=  -> dark-mode ramp
//   /harmony?mood=&useCase=                    -> suggested harmony + why
//   /mix?colors=<c,c,...>&weights=<w,w,...>    -> Kubelka-Munk paint mix
//   /scale?seed=&toward=tint|shade|tone&steps= -> tint/shade/tone ramp
//   /brand?name=<brand>                        -> brand color lookup
//   /brand-search?query=<q>&limit=             -> matching brand names
//   /brand-nearest?color=&count=               -> nearest brands by ΔE
//   /theme?seed=&mood=                         -> full light/dark theme

import http from 'node:http';
import {
  convertColor, contrast, generatePalette, nameColor, parseColor,
  buildCssTokens, HARMONIES, MOODS, generateShades, deriveDark,
  suggestHarmony, mixColors, tintScale, shadeScale, toneScale,
  getBrand, searchBrands, nearestBrands, generateTheme, nearestNamedColor
} from '../core/color-engine.js';

const PORT = Number(process.env.PORT) || 8787;
const BASE = process.env.PUBLIC_URL || `http://127.0.0.1:${PORT}`;

// OpenAPI 3.1 spec so function-calling agents (GPT Actions, LangChain, etc.)
// can auto-discover and call the API. Served at /openapi.json.
const colorParam = (name, required) => ({
  name, in: 'query', required, schema: { type: 'string' },
  description: 'Color as hex (#e93a3a), rgb(...), or hsl(...).'
});
const OPENAPI = {
  openapi: '3.1.0',
  info: { title: 'Colorflower API', version: '1.6.0', description: 'Color conversion, palette/theme generation, paint mixing, brand color lookup, WCAG contrast, and color naming.' },
  servers: [{ url: BASE }],
  paths: {
    '/convert': { get: { operationId: 'convertColor', summary: 'Convert a color to all formats + name', parameters: [colorParam('color', true)], responses: { 200: { description: 'Converted color' } } } },
    '/name': { get: { operationId: 'nameColor', summary: 'Generated name for a color', parameters: [colorParam('color', true)], responses: { 200: { description: 'Color name' } } } },
    '/contrast': { get: { operationId: 'checkContrast', summary: 'WCAG contrast ratio + AA/AAA results', parameters: [colorParam('fg', true), colorParam('bg', true)], responses: { 200: { description: 'Contrast result' } } } },
    '/palette': { get: { operationId: 'generatePalette', summary: 'Generate a palette from a harmony rule + brand mood', parameters: [
      { name: 'harmony', in: 'query', schema: { type: 'string', enum: HARMONIES } },
      { name: 'mood', in: 'query', schema: { type: 'string', enum: MOODS } },
      { name: 'baseHue', in: 'query', schema: { type: 'number', minimum: 0, maximum: 360 } },
      { name: 'count', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 36 } }
    ], responses: { 200: { description: 'Palette' } } } },
    '/tokens': { get: { operationId: 'paletteCssTokens', summary: 'Palette as :root CSS custom properties', parameters: [
      { name: 'harmony', in: 'query', schema: { type: 'string', enum: HARMONIES } },
      { name: 'mood', in: 'query', schema: { type: 'string', enum: MOODS } },
      { name: 'baseHue', in: 'query', schema: { type: 'number' } },
      { name: 'count', in: 'query', schema: { type: 'integer' } }
    ], responses: { 200: { description: 'CSS tokens' } } } },
    '/health': { get: { operationId: 'health', summary: 'Service status', responses: { 200: { description: 'OK' } } } },
    '/shades': { get: { operationId: 'generateShades', summary: '10-step Ant Design-style tint/shade ramp from a seed color', parameters: [colorParam('seed', true)], responses: { 200: { description: 'Shade ramp' } } } },
    '/dark-palette': { get: { operationId: 'deriveDarkPalette', summary: 'Alpha-blend a 10-shade light ramp onto a dark background', parameters: [
      { name: 'shades', in: 'query', required: true, schema: { type: 'string' }, description: 'Comma-separated list of 10 hex colors.' },
      { name: 'background', in: 'query', schema: { type: 'string' }, description: 'Dark background hex, default #141414.' }
    ], responses: { 200: { description: 'Dark-mode shade ramp' } } } },
    '/harmony': { get: { operationId: 'suggestHarmony', summary: 'Recommend a harmony rule + saturation cap for a mood', parameters: [
      { name: 'mood', in: 'query', schema: { type: 'string', enum: MOODS } },
      { name: 'useCase', in: 'query', schema: { type: 'string' } }
    ], responses: { 200: { description: 'Harmony recommendation' } } } },
    '/mix': { get: { operationId: 'mixColors', summary: 'Physically-plausible paint mixing (Kubelka-Munk)', parameters: [
      { name: 'colors', in: 'query', required: true, schema: { type: 'string' }, description: 'Comma-separated colors.' },
      { name: 'weights', in: 'query', required: true, schema: { type: 'string' }, description: 'Comma-separated weights, same length as colors.' }
    ], responses: { 200: { description: 'Mixed color' } } } },
    '/scale': { get: { operationId: 'tintShadeTone', summary: 'Mix a color toward white/black/gray in N steps', parameters: [
      colorParam('seed', true),
      { name: 'toward', in: 'query', schema: { type: 'string', enum: ['tint', 'shade', 'tone'] } },
      { name: 'steps', in: 'query', schema: { type: 'integer', minimum: 2, maximum: 20 } }
    ], responses: { 200: { description: 'Tint/shade/tone scale' } } } },
    '/brand': { get: { operationId: 'getBrandColor', summary: 'Look up a brand\'s color(s) by name', parameters: [
      { name: 'name', in: 'query', required: true, schema: { type: 'string' } }
    ], responses: { 200: { description: 'Brand colors' }, 404: { description: 'Brand not found' } } } },
    '/brand-search': { get: { operationId: 'searchBrands', summary: 'Search brand names', parameters: [
      { name: 'query', in: 'query', required: true, schema: { type: 'string' } },
      { name: 'limit', in: 'query', schema: { type: 'integer' } }
    ], responses: { 200: { description: 'Matching brand names' } } } },
    '/brand-nearest': { get: { operationId: 'nearestBrands', summary: 'Rank brands by perceptual distance to a color', parameters: [
      colorParam('color', true),
      { name: 'count', in: 'query', schema: { type: 'integer' } }
    ], responses: { 200: { description: 'Ranked brand matches' } } } },
    '/theme': { get: { operationId: 'generateTheme', summary: 'Seed + mood -> full light/dark semantic token theme with a contrast audit', parameters: [
      colorParam('seed', true),
      { name: 'mood', in: 'query', schema: { type: 'string', enum: MOODS } }
    ], responses: { 200: { description: 'Complete theme' } } } }
  }
};

// Plugin discovery manifest (ai-plugin style).
const AI_PLUGIN = {
  schema_version: 'v1',
  name_for_human: 'Colorflower',
  name_for_model: 'colorflower',
  description_for_human: 'Color conversion, palette generation, WCAG contrast, and color naming.',
  description_for_model: 'Convert colors between HEX/RGB/HSL/OKLCH/OKLab, generate harmony palettes by brand mood, check WCAG contrast, and name colors.',
  api: { type: 'openapi', url: `${BASE}/openapi.json` },
  contact_email: 'support@example.com'
};

const ROUTES = {
  '/health': () => ({ ok: true, service: 'colorflower-api', harmonies: HARMONIES, moods: MOODS }),

  '/openapi.json': () => OPENAPI,
  '/.well-known/ai-plugin.json': () => AI_PLUGIN,

  '/convert': (q) => {
    if (!q.color) throw new HttpError(400, 'Missing "color" query parameter');
    return convertColor(q.color);
  },

  '/name': (q) => {
    if (!q.color) throw new HttpError(400, 'Missing "color" query parameter');
    return { color: q.color, name: nameColor(parseColor(q.color)), nearestCssColor: nearestNamedColor(q.color) };
  },

  '/contrast': (q) => {
    if (!q.fg || !q.bg) throw new HttpError(400, 'Provide "fg" and "bg" query parameters');
    return { fg: q.fg, bg: q.bg, ...contrast(q.fg, q.bg) };
  },

  '/palette': (q) => {
    const colors = generatePalette({
      harmony: q.harmony || 'spectrum',
      mood: q.mood || 'balanced',
      baseHue: Number(q.baseHue) || 0,
      count: q.count ? Math.max(1, Math.min(36, Number(q.count))) : 9
    });
    return { harmony: q.harmony || 'spectrum', mood: q.mood || 'balanced', count: colors.length, colors };
  },

  '/tokens': (q) => {
    const colors = generatePalette({
      harmony: q.harmony || 'spectrum',
      mood: q.mood || 'balanced',
      baseHue: Number(q.baseHue) || 0,
      count: q.count ? Math.max(1, Math.min(36, Number(q.count))) : 9
    });
    return { css: buildCssTokens(colors) };
  },

  '/shades': (q) => {
    if (!q.seed) throw new HttpError(400, 'Missing "seed" query parameter');
    return { seed: q.seed, shades: generateShades(q.seed) };
  },

  '/dark-palette': (q) => {
    if (!q.shades) throw new HttpError(400, 'Missing "shades" query parameter (comma-separated hex list)');
    const shades = q.shades.split(',').map((s) => s.trim());
    if (shades.length !== 10) throw new HttpError(400, '"shades" must contain exactly 10 hex colors');
    return { shades: deriveDark(shades, q.background || '#141414') };
  },

  '/harmony': (q) => suggestHarmony(q.mood || 'balanced', q.useCase),

  '/mix': async (q) => {
    if (!q.colors || !q.weights) throw new HttpError(400, 'Provide "colors" and "weights" as comma-separated lists');
    const colors = q.colors.split(',').map((c) => c.trim());
    const weights = q.weights.split(',').map(Number);
    if (colors.length !== weights.length) throw new HttpError(400, '"colors" and "weights" must be the same length');
    return mixColors(colors, weights);
  },

  '/scale': async (q) => {
    if (!q.seed) throw new HttpError(400, 'Missing "seed" query parameter');
    const toward = q.toward || 'tint';
    const steps = q.steps ? Math.max(2, Math.min(20, Number(q.steps))) : 6;
    const fn = toward === 'shade' ? shadeScale : toward === 'tone' ? toneScale : tintScale;
    return { seed: q.seed, toward, colors: await fn(q.seed, steps) };
  },

  '/brand': async (q) => {
    if (!q.name) throw new HttpError(400, 'Missing "name" query parameter');
    const brand = await getBrand(q.name);
    if (!brand) throw new HttpError(404, `No brand found for "${q.name}"`);
    return brand;
  },

  '/brand-search': async (q) => {
    if (!q.query) throw new HttpError(400, 'Missing "query" query parameter');
    return { query: q.query, matches: await searchBrands(q.query, q.limit ? Number(q.limit) : 10) };
  },

  '/brand-nearest': async (q) => {
    if (!q.color) throw new HttpError(400, 'Missing "color" query parameter');
    return { color: q.color, matches: await nearestBrands(q.color, q.count ? Number(q.count) : 5) };
  },

  '/theme': (q) => {
    if (!q.seed) throw new HttpError(400, 'Missing "seed" query parameter');
    return generateTheme(q.seed, q.mood || 'balanced');
  }
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const query = Object.fromEntries(url.searchParams.entries());
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const handler = ROUTES[url.pathname];
  if (!handler) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found', routes: Object.keys(ROUTES) }));
    return;
  }
  try {
    const result = await handler(query);
    res.writeHead(200);
    res.end(JSON.stringify(result, null, 2));
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 400;
    res.writeHead(status);
    res.end(JSON.stringify({ error: err.message }));
  }
});

// Bind to loopback by default so the API is not exposed to the local network.
// Set HOST=0.0.0.0 explicitly to expose it (e.g. in a container behind a proxy).
const HOST = process.env.HOST || '127.0.0.1';
server.listen(PORT, HOST, () => {
  console.log(`Colorflower API listening on http://${HOST}:${PORT}`);
});
