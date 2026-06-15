# Colorflower REST API

A zero-dependency HTTP API over the shared color engine. Pure Node built-ins.

## Run

```
node api/server.js
```

Listens on `http://127.0.0.1:8787` (override with the `PORT` env var). CORS is
open (`Access-Control-Allow-Origin: *`).

## Endpoints

| Method & path | Description |
| --- | --- |
| `GET /health` | Service status + available harmonies and moods |
| `GET /convert?color=` | Convert a color to all formats + name |
| `GET /name?color=` | Generated name for a color |
| `GET /contrast?fg=&bg=` | WCAG contrast ratio + AA/AAA results |
| `GET /palette?harmony=&mood=&baseHue=&count=` | Generate a palette |
| `GET /tokens?harmony=&mood=&baseHue=&count=` | Palette as CSS custom properties |
| `GET /openapi.json` | OpenAPI 3.1 spec (for function-calling agents) |
| `GET /.well-known/ai-plugin.json` | Plugin discovery manifest |

`color` / `fg` / `bg` accept hex (`#e93a3a`), `rgb(...)`, or `hsl(...)`
(URL-encode `#` as `%23`).

## Examples

```
curl "http://127.0.0.1:8787/convert?color=%23e93a3a"
curl "http://127.0.0.1:8787/contrast?fg=%23ffffff&bg=%23777777"
curl "http://127.0.0.1:8787/palette?harmony=triadic&mood=playful&count=6"
```

Harmonies: spectrum, complementary, triadic, analogous, monochrome, split.
Moods: balanced, luxury, calm, playful, clinical, editorial, nature.
