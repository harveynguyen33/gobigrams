/* STEP-5-MCP (task t_640282d6) — @techgoblin/gobi-mcp: the AI-AGENT DOOR over
 * the .gobi core (SPEC-GOBI-CORE §D / Step 5).
 *
 * WHAT THIS IS: a stdio MCP server exposing four tools + one prompt. MCP is
 * the portable answer — Hermes, Claude Code, Codex and Cursor all speak it,
 * and it needs no browser, no token, no network: the server runs as a local
 * child process.
 *
 * THE DOOR RULE (the card's hard rule, the spec's adapter table): NO LOGIC
 * HERE. This file parses JSON, calls the core (@techgoblin/gobi-core) and
 * returns JSON. Compile = compileGobi, draw = renderGobiDocument, summarize =
 * describeGobiDocument, tokens/sheet/metrics = the core's own node surface.
 * There is no lexer, validator, layout, measurer or colour resolver in this
 * file, and none may ever appear — a second implementation is a spec
 * violation.
 *
 * TRANSPORT: stdio ONLY — no listener, no port, no daemon. stdout IS the
 * protocol; every diagnostic goes to stderr.
 *
 * PNG: rasterised by the machine's own Chromium (the exact rasteriser path
 * scripts/gobi-render.mjs uses — CHROME_BIN, the Playwright cache, then the
 * usual system names) with no new npm dependency. When no Chromium exists the
 * tool answers { ok:false, reason:'rasteriser unavailable', svg } so the
 * agent still gets a vector fallback.
 */

import {execFile} from 'node:child_process';
import {existsSync, readFileSync, rmSync, statSync, readdirSync, writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {promisify} from 'node:util';

import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';

import {
  DEFAULT_METRICS,
  EXPORT_TOKENS,
  THEME_CSS,
  compileGobi,
  describeGobiDocument,
  renderGobiDocument,
  tableMeasurer,
  tokensFromCss,
  type GobiDocument,
  type GobiError,
} from '@techgoblin/gobi-core';

const execFileP = promisify(execFile);

/* ------------------------------------------------------------ vocabulary -- */

const THEMES = ['dark', 'light', 'paper', 'midnight', 'contrast'] as const;
type Theme = (typeof THEMES)[number];

/** The contract's error shape: `column`/`suggestion` are the card's names for
 * the compiler's `col`/`hint` — a field projection, nothing swallowed. */
const contractError = (e: GobiError) => {
  const out: {line: number; column: number; message: string; suggestion?: string} = {
    line: e.line,
    column: e.col,
    message: e.message,
  };
  if (e.hint !== undefined) out.suggestion = e.hint;
  return out;
};

type ContractError = ReturnType<typeof contractError>;
type Compiled =
  | {ok: true; doc: GobiDocument}
  | {ok: false; errors: ContractError[]};

/** Compile once, map to the contract. Every compile error is collected in
 * ONE response — the compiler's collect-everything property, kept. */
const compiled = (text: string): Compiled => {
  const r = compileGobi(text);
  if (r.ok) return {ok: true, doc: r.doc};
  return {ok: false, errors: r.errors.map(contractError)};
};

/** The render path every door shares: the shipped theme sheet + the committed
 * metric table + renderGobiDocument — the ONE drawing path. */
const renderSvg = (text: string, theme: Theme): {ok: false; errors: ContractError[]} | {ok: true; svg: string} => {
  const c = compiled(text);
  if (!c.ok) return {ok: false, errors: c.errors};
  const measurer = tableMeasurer(DEFAULT_METRICS);
  const svg = renderGobiDocument(c.doc, {
    theme,
    tokens: tokensFromCss(THEME_CSS, theme, EXPORT_TOKENS),
    measureText: measurer,
  });
  if (measurer.fallbacks.length) {
    /* never silent (the honest-fallback rule): warn on stderr, keep serving. */
    console.error(
      `gobi_render: ${measurer.fallbacks.length} string(s) missing from the metrics table `
      + `(served by the 0.6em estimate): ${measurer.fallbacks.slice(0, 3).join(' | ')}`,
    );
  }
  return {ok: true as const, svg};
};

/* --------------------------------------------------------------- raster --- */

/** The machine's Chromium — the SAME lookup order scripts/gobi-render.mjs
 * uses ($CHROME_BIN, the Playwright browser cache, then system names). */
function findChrome(): string | null {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const cache = join(process.env.HOME || '', '.cache/ms-playwright');
  if (existsSync(cache)) {
    const builds = readdirSync(cache)
      .filter((d) => /^chromium-\d+$/.test(d))
      .map((d) => ({d, n: Number(d.split('-')[1])}))
      .sort((a, b) => b.n - a.n);
    for (const {d} of builds) {
      for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-linux/headless_shell']) {
        const p = join(cache, d, sub);
        if (existsSync(p)) return p;
      }
    }
  }
  for (const p of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable']) {
    if (existsSync(p)) return p;
  }
  return null;
}

/** The repo's variable woff2 faces, inlined so the raster paints Inter /
 * JetBrains Mono instead of whatever the host has. Located relative to THIS
 * bundle (dist/server.mjs → repo root three levels up); absent when the
 * bundle is copied out of the tree — then the host fonts serve, never a
 * failure. */
function fontFaces(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const face = (file: string) => {
    const p = join(here, '..', '..', '..', 'public', 'fonts', file);
    if (!existsSync(p)) return '';
    const family = file.startsWith('jetbrains') ? 'JetBrains Mono' : 'Inter';
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:100 900;`
      + `src:url(data:font/woff2;base64,${readFileSync(p).toString('base64')}) format('woff2');}`;
  };
  return face('inter-variable.woff2') + face('jetbrains-mono-variable.woff2');
}

async function rasterPng(svg: string, scale: number): Promise<string> {
  const size = /<svg\b[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/.exec(svg);
  if (!size) throw new Error('the emitted SVG carries no numeric width/height — cannot size the raster');
  const work = mkdtempSync(join(tmpdir(), 'gobi-mcp-'));
  try {
    const html = join(work, 'page.html');
    writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFaces()}
html,body{margin:0;padding:0;background:transparent}
svg{display:block}
</style></head><body>${svg.replace(/^<\?xml[^>]*\?>\s*/, '')}</body></html>`);
    const png = join(work, 'out.png');
    await execFileP(findChrome()!, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--force-device-scale-factor=' + scale,
      `--window-size=${Math.ceil(Number(size[1]))},${Math.ceil(Number(size[2]))}`,
      '--virtual-time-budget=4000', `--screenshot=${png}`, pathToFileURL(html).href,
    ], {maxBuffer: 32 * 1024 * 1024});
    return readFileSync(png).toString('base64');
  } finally {
    rmSync(work, {recursive: true, force: true});
  }
}

/* --------------------------------------------------------------- server --- */

const server = new McpServer({name: 'gobi-mcp', version: '0.1.0'});

const textArg = z.string().describe('The full .gobi document text (not a path).');
const themeArg = z.enum(THEMES).optional().describe('Render theme (default: dark).');

server.registerTool('gobi_validate', {
  title: 'Validate a .gobi document',
  description: 'Compile a .gobi document and report EVERY error in one round '
    + '(line/column/message/suggestion) — fix them all, then re-validate. Returns ok + doc on success.',
  inputSchema: {text: textArg},
}, async ({text}) => {
  const c = compiled(text);
  return {content: [{type: 'text' as const, text: JSON.stringify(c.ok ? {ok: true, errors: [], doc: c.doc} : {ok: false, errors: c.errors})}]};
});

server.registerTool('gobi_render', {
  title: 'Render a .gobi document to SVG',
  description: 'Compile then render .gobi to a standalone SVG string '
    + '(byte-identical to the app\'s export). Call gobi_validate until ok first.',
  inputSchema: {text: textArg, theme: themeArg},
}, async ({text, theme}) => {
  const r = renderSvg(text, (theme ?? 'dark') as Theme);
  return {content: [{type: 'text' as const, text: JSON.stringify(r)}]};
});

server.registerTool('gobi_png', {
  title: 'Rasterise a .gobi document to PNG',
  description: 'Compile, render, then rasterise to PNG (base64) via the local '
    + 'Chromium. If no Chromium is available the tool returns the SVG instead '
    + '({ ok:false, reason:"rasteriser unavailable", svg }).',
  inputSchema: {text: textArg, theme: themeArg, scale: z.number().int().min(1).max(4).optional().describe('Pixel scale 1-4 (default 2).')},
}, async ({text, theme, scale}) => {
  const r = renderSvg(text, (theme ?? 'dark') as Theme);
  if (!r.ok) return {content: [{type: 'text' as const, text: JSON.stringify(r)}]};
  const chrome = findChrome();
  if (!chrome) {
    return {content: [{type: 'text' as const, text: JSON.stringify({ok: false, reason: 'rasteriser unavailable', svg: r.svg})}]};
  }
  try {
    const pngBase64 = await rasterPng(r.svg, scale ?? 2);
    return {content: [{type: 'text' as const, text: JSON.stringify({ok: true, pngBase64})}]};
  } catch (e) {
    console.error('gobi_png: raster failed — serving the SVG fallback:', String((e as Error)?.message ?? e));
    return {content: [{type: 'text' as const, text: JSON.stringify({ok: false, reason: 'rasteriser unavailable', svg: r.svg})}]};
  }
});

server.registerTool('gobi_describe', {
  title: 'Summarise a .gobi document for a model',
  description: 'Compile then summarise: nodes (ids/kinds/labels/parents), edges '
    + '(endpoints + labels + dash + cardinality) and groups with members — the '
    + 'compact read of what the document contains before you change it.',
  inputSchema: {text: textArg},
}, async ({text}) => {
  const c = compiled(text);
  return {content: [{type: 'text' as const, text: JSON.stringify(c.ok ? {ok: true, describe: describeGobiDocument(c.doc)} : {ok: false, errors: c.errors})}]};
});

server.registerPrompt('write-gobi', {
  title: 'Draw a diagram with .gobi',
  description: 'The .gobi workflow: write, validate until ok, then render.',
}, () => ({
  messages: [{
    role: 'assistant' as const,
    content: {type: 'text' as const, text:
      'Write the diagram as a .gobi document. Then call gobi_validate and fix EVERY reported error '
      + '(line/column/message/suggestion) in one round; repeat until ok. Then call gobi_render for the SVG '
      + '(or gobi_png for a raster). Use gobi_describe on an existing document before rewriting it.'},
  }],
}));

/* ------------------------------------------------------------------ main -- */

const here = dirname(fileURLToPath(import.meta.url));
const known = existsSync(join(here, '..', 'package.json')) && statSync(join(here, '..', 'package.json')).isFile();
console.error(`gobi-mcp: stdio server starting (bundle: ${fileURLToPath(import.meta.url)}${known ? '' : ' [copied out of tree — repo fonts unavailable]'})`);

await server.connect(new StdioServerTransport());
