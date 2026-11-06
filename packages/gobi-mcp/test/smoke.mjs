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
 *   S6  the error contract: a bad theme argument is refused by the schema.
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

  /* gobi_png — exercised when a Chromium exists, honestly skipped otherwise */
  const chrome = process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN);
  if (chrome || existsSync('/usr/bin/chromium') || existsSync('/usr/bin/google-chrome')
    || existsSync(join(process.env.HOME || '', '.cache/ms-playwright'))) {
    const png = await call('gobi_png', {text: good[0].text, scale: 2});
    const isPng = png.ok && /^iVBORw0KGgo/.test(png.pngBase64); /* PNG magic in base64 */
    ok('S7 gobi_png returns a real PNG (base64 PNG magic)', isPng,
      isPng ? '' : JSON.stringify(png).slice(0, 200));
  } else {
    const png = await call('gobi_png', {text: good[0].text});
    ok('S7 gobi_png degrades to {ok:false, reason, svg} with no Chromium',
      png.ok === false && png.reason === 'rasteriser unavailable' && typeof png.svg === 'string');
  }
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
