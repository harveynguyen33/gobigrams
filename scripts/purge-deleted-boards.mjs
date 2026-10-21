#!/usr/bin/env node
/**
 * scripts/purge-deleted-boards.mjs — age-bounded cleanup for the AS-7
 * delete archives (`boards/<id>.deleted-<ISO8601-UTC>.json`).
 *
 * AS-7 contract: a board DELETE never destroys bytes — it renames the file to
 * the archive name. The archive directory must not grow without bound, but the
 * cleanup must never be an accident: this script is DRY-RUN BY DEFAULT. It
 * deletes nothing unless `--apply` is passed, and then only archives whose
 * embedded UTC timestamp is older than the age given by `--older-than`
 * (default 30d). A human (or an explicit, flagged automation step) runs it.
 *
 * Usage:
 *   node scripts/purge-deleted-boards.mjs [--dir boards] [--older-than 30d] [--apply]
 *
 * Exit codes: 0 ok, 1 usage/IO error. Never touches files that do not match
 * `<something>.deleted-<YYYYMMDDTHHMMSSZ>.json`, and never touches the live
 * board files, the library, or the `.bak` generations.
 */
import {readdirSync, statSync, rmSync} from 'node:fs';
import {join, resolve} from 'node:path';

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};

const dir = resolve(opt('--dir', 'boards'));
const AGE_RE = /^(\d+)([dhw])$/;
const UNIT_MS = {h: 3600e3, d: 86400e3, w: 7 * 86400e3};
const ageArg = opt('--older-than', '30d');
const ageMatch = AGE_RE.exec(ageArg);
if (!ageMatch) {
  console.error(`--older-than must look like 30d / 12h / 2w (got "${ageArg}")`);
  process.exit(1);
}
const maxAgeMs = Number(ageMatch[1]) * UNIT_MS[ageMatch[2]];
const apply = flag('--apply');

/* The archive name shape the boards API writes (AS-7). Anything else in the
   directory — live boards, library.json(.bak), <id>.json.bak — is untouchable
   by construction: the regex only matches the `.deleted-<stamp>.json` tail. */
const ARCHIVE_RE = /^(?<base>.+)\.deleted-(?<ts>\d{8}T\d{6}Z)\.json$/;
const stampMs = ts => {
  const y = +ts.slice(0, 4), mo = +ts.slice(4, 6), d = +ts.slice(6, 8);
  const h = +ts.slice(9, 11), mi = +ts.slice(11, 13), s = +ts.slice(13, 15);
  return Date.UTC(y, mo - 1, d, h, mi, s);
};

let entries;
try {
  entries = readdirSync(dir);
} catch (e) {
  console.error(`cannot read ${dir}: ${e.message}`);
  process.exit(1);
}

const now = Date.now();
const victims = [];
for (const f of entries) {
  const m = ARCHIVE_RE.exec(f);
  if (!m) continue;
  const ts = stampMs(m.groups.ts);
  const ageDays = (now - ts) / 86400e3;
  if (now - ts > maxAgeMs) victims.push({f, ageDays});
}

if (victims.length === 0) {
  console.log(`${dir}: no archives older than ${ageArg} — nothing to ${apply ? 'delete' : 'delete (dry run)'}`);
  process.exit(0);
}

for (const {f, ageDays} of victims) {
  const p = join(dir, f);
  if (apply) {
    try { rmSync(p); } catch (e) { console.error(`FAILED ${f}: ${e.message}`); continue; }
    console.log(`deleted ${f} (age ${ageDays.toFixed(1)}d)`);
  } else {
    console.log(`would delete ${f} (age ${ageDays.toFixed(1)}d) — pass --apply to remove`);
  }
}
console.log(apply
  ? `${victims.length} archive(s) deleted from ${dir}`
  : `dry run: ${victims.length} archive(s) would be deleted from ${dir} (nothing removed)`);
