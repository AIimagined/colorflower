# Using Colorflower from AI agents

Colorflower's color engine is available to agents through three channels, all
backed by the same `core/color-engine.js` (identical results everywhere).

## 1. MCP (recommended for agent runtimes)

The MCP server exposes five tools over stdio for Claude Desktop, IDEs, and
agent frameworks that speak the Model Context Protocol.

```
cd mcp && npm install
```

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

Tools: `convert_color`, `generate_palette`, `check_contrast`, `name_color`,
`palette_css_tokens`. See [`../mcp/README.md`](../mcp/README.md).

## 2. OpenAPI / function-calling (GPT Actions, LangChain, etc.)

Run the REST API and point your agent at the machine-readable spec:

```
node api/server.js
# OpenAPI 3.1 spec:        http://127.0.0.1:8787/openapi.json
# Plugin manifest:         http://127.0.0.1:8787/.well-known/ai-plugin.json
```

- **GPT Actions / custom GPTs:** import `/openapi.json` as the action schema.
- **LangChain / LlamaIndex / tool routers:** load the OpenAPI spec to generate
  callable tools (operationIds: `convertColor`, `generatePalette`,
  `checkContrast`, `nameColor`, `paletteCssTokens`, `health`).

To expose it publicly, set `PUBLIC_URL` so the spec/manifest advertise the right
base URL:

```
PUBLIC_URL=https://colors.example.com node api/server.js
```

## 3. Raw REST (any HTTP-capable agent)

```
GET /convert?color=%23e93a3a
GET /palette?harmony=triadic&mood=playful&count=6
GET /contrast?fg=%23ffffff&bg=%23777777
```

See [`../api/README.md`](../api/README.md) for the full endpoint list.

---

All three are local and dependency-light; the MCP and REST surfaces never reach
the network themselves — they only compute colors.
