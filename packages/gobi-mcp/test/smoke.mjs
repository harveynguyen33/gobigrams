#!/usr/bin/env node
/* STEP-5-MCP — the ACCEPTANCE SMOKE TEST. Drives dist/server.mjs over the
 * REAL stdio JSON-RPC protocol (a spawned child, never an imported handler),
 * with its cwd OUTSIDE the repo (acceptance 3: no cwd / relative-path
 * dependency — the fixtures are read by THIS script, the server only ever
 * receives text).
 *
 * WHAT IT PROVES (the card's acceptance 2, plus 1 and 3):
 *   S1  MCP handshake completes; tools/list names all four tools WITH input
 *       schemas; prompts/list carries write-gobi;
 *   S2  determinism: the same fixture rendered twice -> byte-identical SVG;
 *   S3  corpus parity: every good fixture's SVG sha256 === the committed
 *       expected/<name>.svg;
 *   S4  collect-everything: each bad-* fixture's gobi_validate response carries
 *       ALL of that file's errors in ONE round (count === the committed
 *       .errors.json length) with line/column/message (+suggestion when the
 *       compiler has one);
 *   S5  describe parity: gobi_describe ids === the committed .doc.json ids
 *       (nodes and edges), and group membership reads parent correctly;
 *   S6  the error contract: a bad theme argument is refused by the schema;
 *   S7  gobi_png ships the raster as an IMAGE content block (mimeType
 *       image/png, base64 PNG magic) plus a small text block with the facts —
 *       and NO base64 run of 500+ characters in any text item (MCP-PNG-IMAGE,
 *       t_196db9fc: the regression was 26 KB of PNG as ~35k chars of text
 *       context) — or degrades to {ok:false, reason, svg} with no Chromium;
 *   S8  the input bound: an over-limit text is REFUSED by the schema with a
 *       message naming the 100,000-character limit — a -32602 tool result,
 *       never a stack trace;
 *   S9  large-but-legal: a deterministically generated 156-node / 250-edge
 *       document (~16.5 KB — the largest realistic board, measured) still
 *       renders (MCP-AUDIT, task t_4c22bdbf).
 *
 * Run: node packages/gobi-mcp/test/smoke.mjs   (from anywhere; resolves the
 * repo relative to its own file). Exit 0 = all green. */
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdtempSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SERVER = join(ROOT, 'packages/gobi-mcp/dist/server.mjs');
const FIXTURE_DIR = join(ROOT, 'packages/gobi/test/corpus/gobi');
const EXPECTED = join(ROOT, 'packages/gobi/test/corpus/expected');

let pass = 0, fail = 0;
const failures = [];
const ok = (id, cond, detail = '') => {
  if (cond) { pass++; console.log('  ok   ' + id); }
  else { fail++; failures.push(id); console.log('  FAIL ' + id + (detail ? '  — ' + detail : '')); }
};

/* ------------------------------------------------- the protocol session -- */

const CWD = mkdtempSync(join(tmpdir(), 'gobi-mcp-smoke-')); /* outside the repo */
const child = spawn(process.execPath, [SERVER], {cwd: CWD, stdio: ['pipe', 'pipe', 'pipe']});
const stderr = [];
child.stderr.on('data', (d) => stderr.push(String(d)));
child.on('exit', (code, sig) => {
  if (!done) { fail++; failures.push('S0 server exited early'); console.log(`  FAIL S0 server exited early (code=${code} sig=${sig}) stderr=${stderr.join('').slice(0, 600)}`); process.exit(1); }
});

let buf = '';
const pending = new Map();
let nextId = 1;
child.stdout.on('data', (d) => {
  buf += String(d);
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    } catch { /* a non-JSON stdout line is a protocol violation — surfaced by timeouts */ }
  }
});

const send = (obj) => child.stdin.write(JSON.stringify(obj) + '\n');
const request = (method, params) => new Promise((resolve, reject) => {
  const id = nextId++;
  const t = setTimeout(() => reject(new Error(`timeout waiting for ${method} (id=${id}); stderr: ${stderr.join('').slice(0, 600)}`)), 60_000);
  pending.set(id, (msg) => { clearTimeout(t); resolve(msg); });
  send({jsonrpc: '2.0', id, method, params});
});

/** tools/call, returning the PARSED JSON payload (the server speaks JSON in
 * its single text content block). */
const call = async (name, args) => {
  const res = await request('tools/call', {name, arguments: args});
  if (res.error) throw new Error(`${name} protocol error: ${JSON.stringify(res.error)}`);
  const text = (res.result?.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  return JSON.parse(text);
};

let done = false;
try {
  if (!existsSync(SERVER)) throw new Error(`no server bundle at ${SERVER} — run npm run build -w @techgoblin/gobi-mcp first`);

  /* S1 — handshake + tool list + prompt list */
  const init = await request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: {name: 'gobi-mcp-smoke', version: '0.0.1'},
  });
  ok('S1a initialize answered with serverInfo + capabilities',
    !!init.result?.serverInfo?.name && !!init.result?.capabilities, JSON.stringify(init).slice(0, 200));
  send({jsonrpc: '2.0', method: 'notifications/initialized'});

  const tools = await request('tools/list', {});
  const named = tools.result?.tools ?? [];
  const names = named.map((t) => t.name);
  for (const t of ['gobi_validate', 'gobi_render', 'gobi_png', 'gobi_describe']) {
    ok(`S1b tools/list names ${t} with an input schema`,
      names.includes(t) && !!(named.find((x) => x.name === t).inputSchema),
      `got: ${names.join(', ')}`);
  }
  const prompts = await request('prompts/list', {});
  ok('S1c prompts/list carries write-gobi',
    (prompts.result?.prompts ?? []).some((p) => p.name === 'write-gobi'));

  /* fixtures */
  const fixtures = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.gobi')).sort();
  const good = [], bad = [];
  for (const f of fixtures) {
    const text = readFileSync(join(FIXTURE_DIR, f), 'utf8');
    ((f.startsWith('bad-') ? bad : good).push)({file: f, name: f.replace(/\.gobi$/, ''), text});
  }
  ok('S1d the corpus is non-empty (vacuous-proof)', good.length >= 23 && bad.length >= 5,
    `${good.length} good, ${bad.length} bad`);
  const counts = ` (${good.length} good / ${bad.length} bad fixtures)`;
  if (good.length !== 24 || bad.length !== 7) console.log('  note: expected 24 good / 7 bad, measured' + counts);

  /* S2 — determinism: same fixture twice, byte-identical */
  const twice = await Promise.all([0, 1].map(() => call('gobi_render', {text: good[0].text})));
  ok('S2a render of the same fixture twice is byte-identical',
    twice[0].ok && twice[1].ok && twice[0].svg === twice[1].svg);
  const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

  /* S3 — corpus SVG parity over ALL good fixtures */
  let parity = 0;
  const mismatches = [];
  for (const g of good) {
    const r = await call('gobi_render', {text: g.text});
    const expectedSvg = readFileSync(join(EXPECTED, `${g.name}.svg`), 'utf8');
    if (r.ok && sha(r.svg) === sha(expectedSvg)) parity++;
    else mismatches.push(g.name);
  }
  ok(`S3 all ${good.length} good fixtures render to the committed SVG hashes`, parity === good.length,
    `${parity}/${good.length} matched; mismatched: ${mismatches.join(', ') || 'none'}`);

  /* S4 — collect-everything errors, per-file counts vs the committed .errors.json */
  for (const b of bad) {
    const committed = JSON.parse(readFileSync(join(EXPECTED, `${b.name}.errors.json`), 'utf8'));
    const r = await call('gobi_validate', {text: b.text});
    const wellFormed = r.ok === false && Array.isArray(r.errors)
      && r.errors.length === committed.length
      && r.errors.every((e) => Number.isInteger(e.line) && Number.isInteger(e.column) && typeof e.message === 'string');
    ok(`S4 ${b.name}: all ${committed.length} error(s) in ONE response`, !!wellFormed,
      wellFormed ? '' : `got ${JSON.stringify(r).slice(0, 300)}`);
    console.log(`       ${b.name}: ${r.errors.length} error(s), first at line ${r.errors[0]?.line}:${r.errors[0]?.column}`);
  }

  /* S5 — describe parity vs the committed .doc.json */
  const doc = JSON.parse(readFileSync(join(EXPECTED, 'spec-example.doc.json'), 'utf8'));
  const d = await call('gobi_describe', {text: readFileSync(join(FIXTURE_DIR, 'spec-example.gobi'), 'utf8')});
  ok('S5a describe node ids === doc.json node ids',
    d.ok && JSON.stringify(d.describe.nodes.map((n) => n.id)) === JSON.stringify(doc.nodes.map((n) => n.id)));
  ok('S5b describe edge ids === doc.json edge ids',
    d.ok && JSON.stringify(d.describe.edges.map((e) => e.id)) === JSON.stringify(doc.edges.map((e) => e.id)));
  const nested = JSON.parse(readFileSync(join(EXPECTED, 'groups-nesting.doc.json'), 'utf8'));
  const dn = await call('gobi_describe', {text: readFileSync(join(FIXTURE_DIR, 'groups-nesting.gobi'), 'utf8')});
  const expectGroups = nested.nodes.filter((n) => n.kind === 'group').map((g) => ({
    id: g.id, title: g.label, members: nested.nodes.filter((n) => n.parent === g.id).map((n) => n.id),
  }));
  ok('S5c describe groups + membership derived from parent',
    dn.ok && JSON.stringify(dn.describe.groups) === JSON.stringify(expectGroups),
    JSON.stringify(dn.describe?.groups));

  /* S6 — schema refusal: a bad theme never reaches the renderer (the SDK
     reports it as an errored tool RESULT carrying -32602, or as a protocol
     error — either shape proves the schema refused it). */
  const badTheme = await request('tools/call', {name: 'gobi_render', arguments: {text: good[0].text, theme: 'neon'}});
  const refusal = JSON.stringify(badTheme.error ?? badTheme.result ?? {});
  ok('S6 a bad theme is refused by the tool schema (-32602)', refusal.includes('-32602') || refusal.includes('Invalid enum value'),
    refusal.slice(0, 200));

  /* gobi_png — MCP-PNG-IMAGE (t_196db9fc). Asserted on the RAW tools/call
     result, not the parsed `call` helper: the whole point is the CONTENT SHAPE.
     The raster must arrive as an image block; the text block carries the facts
     only; and no text item anywhere may carry a base64 run of 500+ characters
     (that is the shipped defect this pins: 26 KB of PNG as ~35k chars of
     base64 inside the model's text context). */
  const base64Run = /[A-Za-z0-9+/]{500,}/;
  const chromeAvailable = !!(process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN))
    || existsSync('/usr/bin/chromium') || existsSync('/usr/bin/google-chrome')
    || existsSync(join(process.env.HOME || '', '.cache/ms-playwright'));
  if (chromeAvailable) {
    const raw = await request('tools/call', {name: 'gobi_png', arguments: {text: good[0].text, scale: 2}});
    const items = raw.result?.content ?? [];
    const image = items.find((c) => c.type === 'image');
    const texts = items.filter((c) => c.type === 'text');
    ok('S7a gobi_png returns an image content block with mimeType image/png',
      !!image && image.mimeType === 'image/png',
      `content types: ${items.map((c) => c.type).join(', ')}`);
    const bytes = image ? Buffer.from(image.data, 'base64').length : 0;
    ok('S7b the image block decodes to a real PNG (magic bytes, sane size)',
      !!image && /^iVBORw0KGgo/.test(image.data) && bytes > 1000,
      image ? `${bytes} bytes` : 'no image block');
    let facts = null;
    try { facts = JSON.parse(texts.map((c) => c.text).join('')); } catch { /* asserted below */ }
    ok('S7c the text block carries the facts (ok/bytes/width/height/scale), no image data',
      !!facts && facts.ok === true && facts.bytes === bytes && facts.bytes > 1000
        && Number.isInteger(facts.width) && facts.width > 0
        && Number.isInteger(facts.height) && facts.height > 0 && facts.scale === 2,
      texts.map((c) => c.text).join('').slice(0, 200));
    ok('S7d no base64 run of 500+ chars in ANY text item (the old defect)',
      texts.length > 0 && texts.every((c) => !base64Run.test(c.text)));
  } else {
    const png = await call('gobi_png', {text: good[0].text});
    ok('S7 gobi_png degrades to {ok:false, reason, svg} with no Chromium',
      png.ok === false && png.reason === 'rasteriser unavailable' && typeof png.svg === 'string');
  }

  /* S8 — the input bound (MCP-AUDIT): an over-limit document must be refused
     by the SCHEMA, with a message that names the limit. The same refusal
     shapes S6 accepts (-32602 in a tool result, or a protocol error); a
     stack trace or a silent compile of the padding is a failure. */
  const overLimit = await request('tools/call', {
    name: 'gobi_validate',
    arguments: {text: good[0].text + '\n' + 'x'.repeat(100_000)},
  });
  const refusal8 = JSON.stringify(overLimit.error ?? overLimit.result ?? {});
  ok('S8a an over-limit text is refused (-32602), not compiled',
    refusal8.includes('-32602') || refusal8.includes('Invalid'),
    refusal8.slice(0, 200));
  ok('S8b the refusal message names the 100,000-character limit',
    refusal8.includes('100,000') && refusal8.includes('character'),
    refusal8.slice(0, 300));
  ok('S8c the refusal is a message, not a stack trace',
    !refusal8.includes('at async') && !refusal8.includes('SyntaxError') && !refusal8.includes('\\n    at '),
    refusal8.slice(0, 300));

  /* S9 — large-but-legal input still renders. The generator is the measured
     "largest realistic board" (156 nodes, runbook-length notes, 250 labelled
     edges ≈ 16.5 KB — ~6x under the limit). Deterministic by construction. */
  const bigDoc = (() => {
    const KINDS = ['service', 'database', 'queue', 'external', 'actor', 'gateway', 'storage', 'note', 'text'];
    const COLORS = ['amber', 'violet', 'red', 'blue', 'green', 'cyan'];
    const lines = ['board "Large realistic enterprise estate"', 'direction LR'];
    const ids = [];
    for (let i = 0; i < 150; i++) {
      const id = `n${i}`;
      ids.push(id);
      let l = `${id} = ${KINDS[i % KINDS.length]} "Component ${i} — order pipeline stage ${Math.floor(i / 10)}"`;
      if (i % 4 === 0) l += ` sub:"owner=team-${i % 9} · region=ap-southeast-1 · tier=${1 + (i % 3)}"`;
      if (i % 5 === 0) l += ` color:${COLORS[i % COLORS.length]}`;
      lines.push(l);
    }
    for (let j = 0; j < 6; j++) {
      lines.push(`note${j} = note "Runbook ${j}: when the rebalance storm recurs, drain the partition handoff first, snapshot the consumer offsets, then restart the broker fleet one rack at a time. Escalate to the on-call architect if lag exceeds 30 minutes of consumer time."`);
    }
    for (let i = 0; i < 250; i++) {
      const a = ids[i % ids.length];
      const b = ids[(i * 7 + 3) % ids.length];
      if (a === b) continue;
      lines.push(i % 3 === 0 ? `${a} -> ${b} "edge ${i} async"` : `${a} -> ${b}`);
    }
    return lines.join('\n') + '\n';
  })();
  const big = await call('gobi_render', {text: bigDoc});
  ok(`S9 a ${bigDoc.length.toLocaleString('en-US')}-char document (156 nodes) still renders`,
    big.ok === true && typeof big.svg === 'string' && big.svg.length > 100_000,
    big.ok ? `svg ${big.svg.length} bytes` : JSON.stringify(big).slice(0, 200));
} catch (e) {
  fail++;
  failures.push('S0 ' + String((e && e.message) || e));
  console.log('  FAIL S0 ' + String((e && e.message) || e));
} finally {
  done = true;
  child.kill('SIGKILL');
  rmSync(CWD, {recursive: true, force: true});
}

console.log(fail ? `\nsmoke: FAIL — ${fail} failed (${pass} passed)` : `\nsmoke: PASS — ${pass}/${pass}`);
process.exit(fail ? 1 : 0);
