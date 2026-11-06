# @techgoblin/gobi-core

The `.gobi` diagram language core — compile and render gobigrams with **no
browser, no React, no canvas**. This is the same compiler and the same SVG
emitter the [Gobigrams](https://gobigrams.tech-goblin.com) app ships; the
byte parity is pinned by a committed corpus (see below), so a diagram rendered
here is byte-identical to the one the app exports.

Zero runtime dependencies: no React, no React Flow, no lucide, no DOM.

## The public surface

```js
import {
  compileGobi, renderGobiDocument,
  tokensFromCss, tableMeasurer,
  EXPORT_TOKENS, THEME_CSS, DEFAULT_METRICS,
} from '@techgoblin/gobi-core';
```

1. **`compileGobi(text)` → `{ok: true, doc} | {ok: false, errors[]}`**
   The whole pipeline — lex, parse, validate, layout — returning the
   surface-neutral `GobiDocument` (positions resolved, JSON-serialisable).
   Every error is collected in one pass, each with `line`, `column`,
   `message` and where possible a `suggestion`.

2. **`renderGobiDocument(doc, {theme, measureText, tokens, pad?}) → string`**
   The one `.gobi` → SVG path. Pure and deterministic: the same doc + options
   produce byte-identical output in node and the browser. The measurer and the
   theme's resolved token values are INJECTED — this renderer never guesses a
   width or a colour (a missing measurer refuses to run with a named error).

3. **The node-side inputs ship with the package**, so the two helpers above are
   one-liners instead of a hunt through `node_modules`:
   - **`DEFAULT_METRICS`** — the committed advance-width table
     (`src/metrics.json`), the exact table the corpus was stamped with. It is
     inlined in the bundle: no file read, no path into the package.
     `tableMeasurer(DEFAULT_METRICS)` returns the measurer, and its
     `fallbacks` list stays empty when every asked string is tabled.
   - **`THEME_CSS`** — the theme blocks of the app stylesheet (all five
     themes) as text, for `tokensFromCss(THEME_CSS, theme, EXPORT_TOKENS)`.
   - **`EXPORT_TOKENS`** — the CSS custom properties the SVG emitter inlines.
     `tokensFromCss` defaults its third argument to this list, and a wanted
     name the sheet does not declare fails with `GobiThemeTokenMissing`,
     naming the token — never a silently empty colour in the output.
   - **`GOBI_CARD_TOKENS` is a DIFFERENT vocabulary**: the ERD cardinality
     spellings (`'1'`, `'n'`, `'0..1'`, `'0..n'`) a column relationship uses.
     It is language vocabulary, not theme colours.

A working render, end to end — this is the whole file, and it runs as printed:

```js
import {compileGobi, renderGobiDocument, tokensFromCss, tableMeasurer,
        EXPORT_TOKENS, THEME_CSS, DEFAULT_METRICS} from '@techgoblin/gobi-core';

const src = 'board "t"\ndirection LR\na = service "A"\nb = service "B"\na -> b "calls"';
const res = compileGobi(src);
if (!res.ok) throw new Error(JSON.stringify(res.errors));
const svg = renderGobiDocument(res.doc, {
  theme: 'dark',
  tokens: tokensFromCss(THEME_CSS, 'dark', EXPORT_TOKENS),
  measureText: tableMeasurer(DEFAULT_METRICS),
});
console.log(svg.slice(0, 4), svg.length);   // <svg <bytes>
```

The same call over every fixture in `test/corpus/` reproduces its committed
`<name>.svg` sha256 — `checks/round-pkg-tarball.mjs` asserts that for the whole
corpus from an installed tarball, using only the exports above.

Rendering against **your own** stylesheet (a themed app) works the same way:
pass your CSS text instead of `THEME_CSS`. Keep `EXPORT_TOKENS` unless your
emitter inlines a different set; drop a name and you get a different SVG, which
is what the negative control in that harness demonstrates.

The canvas adapter (`GobiDocument` → React-Flow-shaped nodes/edges) is an
internal module of the package (`src/model/adapterCanvas.ts`): the renderer
needs it, but it is not part of the public root export — the emitted types are
the package's own structural `FlowNode`/`FlowEdge` mirrors (see
`src/model/flowTypes.ts`), which are assignable to and from React Flow's own
types in BOTH directions without a React dependency.

## What ships

`files: ["dist", "src", "README.md", "test/corpus"]` — the built bundle
(`dist/index.js`, one self-contained ESM file, zero imports) plus its
declaration tree (`dist/index.d.ts` + the per-module d.ts it references) plus
the TypeScript source. The tarball contains ONLY package code: the app's
`src/` tree (server board code, React components, the store) is not reachable
from here and never enters the archive — `checks/round-pkg-tarball.mjs`
(sections T0/T5) pins that by running the four consumer acceptance tests
against a real `npm pack` tarball installed into a temp directory.

## The corpus

`test/corpus/` travels with the package on purpose: a consumer must be able to
verify its own install.

- `gobi/*.gobi` — the fixtures (every node kind, every handle kind, groups,
  labels, attrs, and the `bad-*` error corpus);
- `expected/<name>.doc.json` / `.board.json` / `.svg` / `.sha256` — the
  committed expected document, board and rendered SVG per fixture.

From the workspace repo, the corpus runners are the app's harnesses:

```
node checks/round-gobi-doc-parity.mjs   # compile + adapter parity
node checks/round-gobi-render.mjs       # SVG byte parity, zero measurer fallbacks
```

Both run against the workspace sources, so the corpus is green exactly when
the package and the app agree.

## Build

```
cd packages/gobi && npm run build    # dist/index.js (self-contained ESM) + dist/*.d.ts
```

The `exports` map: **bundlers and the workspace** (`browser` + `module`)
resolve to the shipped `src/` TypeScript — the app build, every esbuild-based
harness and a fresh clone share the live modules, one copy in the client
bundle; **plain node** (`import`/`default`) and **TypeScript consumers**
(`types`) resolve to the built `dist/`. Because `src/` ships, every condition
points at a file the tarball actually carries.
