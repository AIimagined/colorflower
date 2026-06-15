// Colorflower MCP server — exposes the shared color engine as MCP tools over
// stdio, so agents/clients can convert colors, generate palettes, check
// contrast, and name colors.
//
// Run:  node mcp/server.js   (after `npm install` in this folder)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
  convertColor, contrast, generatePalette, nameColor, parseColor,
  buildCssTokens, HARMONIES, MOODS
} from '../core/color-engine.js';

const json = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });

const server = new McpServer({ name: 'colorflower', version: '1.5.0' });

server.registerTool('convert_color', {
  title: 'Convert color',
  description: 'Convert a color (hex, rgb(), hsl(), or {h,s,l}) into HEX, RGB, HSL, OKLCH, OKLab, plus a generated name.',
  inputSchema: { color: z.string().describe('e.g. "#e93a3a", "rgb(233,58,58)", or "hsl(0,80%,57%)"') }
}, async ({ color }) => json(convertColor(color)));

server.registerTool('generate_palette', {
  title: 'Generate palette',
  description: 'Generate a color palette using a harmony rule and brand mood.',
  inputSchema: {
    harmony: z.enum(HARMONIES).default('spectrum'),
    mood: z.enum(MOODS).default('balanced'),
    baseHue: z.number().min(0).max(360).default(0).describe('Anchor hue in degrees (ignored for spectrum).'),
    count: z.number().int().min(1).max(36).default(9)
  }
}, async (args) => json(generatePalette(args)));

server.registerTool('check_contrast', {
  title: 'Check WCAG contrast',
  description: 'Compute the WCAG contrast ratio between a foreground and background color and the AA/AAA pass results.',
  inputSchema: {
    foreground: z.string().describe('Foreground color (hex/rgb/hsl).'),
    background: z.string().describe('Background color (hex/rgb/hsl).')
  }
}, async ({ foreground, background }) => json({ foreground, background, ...contrast(foreground, background) }));

server.registerTool('name_color', {
  title: 'Name a color',
  description: 'Return Colorflower\'s generated name for a color.',
  inputSchema: { color: z.string() }
}, async ({ color }) => json({ color, name: nameColor(parseColor(color)) }));

server.registerTool('palette_css_tokens', {
  title: 'Palette as CSS tokens',
  description: 'Generate a palette and return it as :root CSS custom properties.',
  inputSchema: {
    harmony: z.enum(HARMONIES).default('spectrum'),
    mood: z.enum(MOODS).default('balanced'),
    baseHue: z.number().min(0).max(360).default(0),
    count: z.number().int().min(1).max(36).default(9)
  }
}, async (args) => json({ css: buildCssTokens(generatePalette(args)) }));

const transport = new StdioServerTransport();
await server.connect(transport);
