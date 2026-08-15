# Colorflower MCP server

Exposes the Colorflower color engine as [Model Context Protocol](https://modelcontextprotocol.io)
tools over stdio, so MCP clients (Claude Desktop, IDEs, agents) can use it.

## Tools

| Tool | Description |
| --- | --- |
| `convert_color` | Convert hex/rgb/hsl → HEX, RGB, HSL, OKLCH, OKLab + name |
| `generate_palette` | Palette from a harmony rule + brand mood |
| `check_contrast` | WCAG contrast ratio + AA/AAA pass results |
| `name_color` | Poetic name + nearest real CSS named color |
| `palette_css_tokens` | Palette as `:root` CSS custom properties |
| `generate_shades` | 10-step Ant Design-style tint/shade ramp from a seed |
| `derive_dark_palette` | Alpha-blend a light ramp onto a dark background |
| `suggest_harmony` | Harmony + saturation cap recommendation for a mood |
| `mix_colors` | Physically-plausible paint mixing (Kubelka-Munk) |
| `tint_shade_tone` | Mix a color toward white / black / gray in N steps |
| `get_brand_color` | Look up a brand's color(s) by name |
| `search_brands` | Find brand names matching a query |
| `nearest_brands` | Rank brands by perceptual distance to a color |
| `generate_theme` | Seed + mood → full light/dark theme with a contrast audit |

All tools return `structuredContent` (schema-validated) and are annotated
`readOnlyHint`/`idempotentHint`. Two prompts are also registered:
`design_palette` and `audit_contrast`.

See [`../skills/colorflower-taste/SKILL.md`](../skills/colorflower-taste/SKILL.md)
for how an agent should sequence these calls.

## Setup

```
cd mcp
npm install
```

## Configure in a client

Add to your MCP client config (e.g. Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "colorflower": {
      "command": "node",
      "args": ["/absolute/path/to/colorflower/mcp/server.js"]
    }
  }
}
```

Then restart the client. The Colorflower tools become available.

## Notes
- Uses the shared engine in `../core/color-engine.js` — identical results to the
  web app and the REST API.
- Zero network access; pure local computation over vendored data
  (`vendor/spectral.min.js` for paint mixing, `vendor/brand-colors.json` +
  `data/brand-overrides.json` for brand lookups — see `vendor/NOTICE.md`).
