# Using Colorflower from AI agents

Colorflower's color engine is available to agents through three channels, all
backed by the same `core/color-engine.js` (identical results everywhere).

## 1. MCP (recommended for agent runtimes)

The MCP server exposes 14 tools and 2 prompts over stdio for Claude Desktop,
IDEs, and agent frameworks that speak the Model Context Protocol. Every tool
returns `structuredContent` (typed, schema-validated) alongside the text
block, and is annotated read-only/idempotent so clients can call them freely.

```
cd mcp && npm install
```

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

**Tools:** `convert_color`, `generate_palette`, `check_contrast`, `name_color`,
`palette_css_tokens`, `generate_shades`, `derive_dark_palette`,
`suggest_harmony`, `mix_colors`, `tint_shade_tone`, `get_brand_color`,
`search_brands`, `nearest_brands`, `generate_theme`. `generate_theme` is the
one-call option: seed color + mood → a full light/dark semantic token theme
with a WCAG contrast audit already run.

**Prompts:** `design_palette`, `audit_contrast` — user-invokable workflows
that route through the tools above in the right order.

See [`../mcp/README.md`](../mcp/README.md).

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

## 4. Taste, not just math

The tools above compute colors; they don't decide which ones to pick.
[`../skills/colorflower-taste/SKILL.md`](../skills/colorflower-taste/SKILL.md)
is a portable Claude Code skill encoding that judgment — which harmony fits
which mood, the 60-30-10 role rule, hard contrast gates, dark-mode
derivation, and a short list of anti-slop bans (max one saturated accent, no
pure-black backgrounds, no neon-on-dark). Copy it into any project's
`skills/` directory, or point an agent at it directly.

[`../DESIGN.md`](../DESIGN.md) documents Colorflower's own UI in the same
token format the skill teaches, if you want a worked example.

---

All four are local and dependency-light; the MCP and REST surfaces never reach
the network themselves — they only compute colors and read a vendored,
bundled brand-color dataset.
