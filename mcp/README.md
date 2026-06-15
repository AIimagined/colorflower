# Colorflower MCP server

Exposes the Colorflower color engine as [Model Context Protocol](https://modelcontextprotocol.io)
tools over stdio, so MCP clients (Claude Desktop, IDEs, agents) can use it.

## Tools

| Tool | Description |
| --- | --- |
| `convert_color` | Convert hex/rgb/hsl → HEX, RGB, HSL, OKLCH, OKLab + name |
| `generate_palette` | Palette from a harmony rule + brand mood |
| `check_contrast` | WCAG contrast ratio + AA/AAA pass results |
| `name_color` | Colorflower's generated name for a color |
| `palette_css_tokens` | Palette as `:root` CSS custom properties |

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
      "args": ["C:\\Users\\v17ra\\Documents\\Codex\\Colorflower\\mcp\\server.js"]
    }
  }
}
```

Then restart the client. The five Colorflower tools become available.

## Notes
- Uses the shared engine in `../core/color-engine.js` — identical results to the
  web app and the REST API.
- Zero network access; pure local computation.
