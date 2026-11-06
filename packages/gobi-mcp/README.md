# @techgoblin/gobi-mcp

A stdio [MCP](https://modelcontextprotocol.io) server exposing the `.gobi` diagram language to AI agents.
No browser, no token, no port — it runs as a local child process over `@techgoblin/gobi-core`.

**Add to a client config** — once published, no path is needed:

```json
{ "mcpServers": { "gobi": { "command": "npx", "args": ["-y", "@techgoblin/gobi-mcp"] } } }
```

Before the package is published, point at the built server in a local checkout (replace `<checkout>`
with the absolute path of your clone):

```json
{ "mcpServers": { "gobi": { "command": "node",
  "args": ["<checkout>/packages/gobi-mcp/dist/server.mjs"] } } }
```

**Tools** — `gobi_validate` (all errors in one round, line/column/message/suggestion) ·
`gobi_render` (byte-identical standalone SVG, theme dark|light|paper|midnight|contrast) ·
`gobi_png` (Chromium raster, scale 1–4; falls back to `{ok:false, reason, svg}` with no Chromium) ·
`gobi_describe` (compact node/edge/group summary). One prompt: `write-gobi` — write, validate until ok, render.

**Worked example** — `gobi_validate {"text": "board Demo\nsvc -> db"}` returns every error at once;
fix them, then `gobi_render {"text": "board Demo\nsvc[Service] -> db[Database]"}` returns `{ok, svg}`.

Build: `npm run build -w @techgoblin/gobi-mcp` · Smoke: `npm test -w @techgoblin/gobi-mcp`.
