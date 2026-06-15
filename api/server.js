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

import http from 'node:http';
import {
  convertColor, contrast, generatePalette, nameColor, parseColor,
  buildCssTokens, HARMONIES, MOODS
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
  info: { title: 'Colorflower API', version: '1.5.0', description: 'Color conversion, palette generation, WCAG contrast, and color naming.' },
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
    '/health': { get: { operationId: 'health', summary: 'Service status', responses: { 200: { description: 'OK' } } } }
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
    return { color: q.color, name: nameColor(parseColor(q.color)) };
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
  }
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const server = http.createServer((req, res) => {
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
    res.writeHead(200);
    res.end(JSON.stringify(handler(query), null, 2));
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
