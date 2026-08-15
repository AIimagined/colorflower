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
| `GET /shades?seed=` | 10-step Ant Design-style tint/shade ramp |
| `GET /dark-palette?shades=&background=` | Alpha-blend a light ramp onto a dark background |
| `GET /harmony?mood=&useCase=` | Suggested harmony + saturation cap + rationale |
| `GET /mix?colors=&weights=` | Physically-plausible paint mixing (Kubelka-Munk) |
| `GET /scale?seed=&toward=&steps=` | Tint / shade / tone scale |
| `GET /brand?name=` | Brand color lookup |
| `GET /brand-search?query=&limit=` | Matching brand names |
| `GET /brand-nearest?color=&count=` | Nearest brands by perceptual distance |
| `GET /theme?seed=&mood=` | Full light/dark theme + contrast audit, one call |
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

Harmonies: spectrum, complementary, triadic, analogous, monochrome, split,
tetradic, square.
Moods: balanced, luxury, calm, playful, clinical, editorial, nature.

`/brand*` routes read a vendored, community-collected dataset
(`vendor/brand-colors.json`, 2019) plus a small curated overrides layer
(`data/brand-overrides.json`) — verify against a brand's current guidelines
before using its color in production. See `vendor/NOTICE.md` for licensing.
