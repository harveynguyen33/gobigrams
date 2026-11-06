/**
 * scripts/boardRetention.mjs — the ONE home of the boards/ retention policy.
 *
 * MEASURED ROOT CAUSE (task t_59671f6a, 2026-11-04/05): the boards API's
 * DELETE renames a board to `<id>.deleted-<UTC-stamp>.json` (AS-7
 * archive-not-unlink) and every PUT renames the previous generation to
 * `<id>.json.bak` (AS-6 one-generation backup). Neither class was ever
 * removed, so boards/ grew 88 → 462 real files in one evening of harness
 * runs (1,985 files at the worst measurement) and every board operation's
 * directory listing got slow enough to time a live harness out.
 *
 * THE POLICY (constant + comment, no Settings row — configured by nobody,
 * asserted by checks/round-board-retention.mjs):
 *   - a tombstone survives iff it is younger than TOMBSTONE_MAX_AGE_MS OR it
 *     is among the TOMBSTONE_KEEP_PER_ID newest tombstones of its board id
 *     (recover a mis-click, bounded per id), and then a hard global
 *     TOMBSTONE_MAX_TOTAL cap (newest first) bounds the whole class — a
 *     nightly harness load of one-shot scratch boards must never reopen the
 *     unbounded growth the age window alone would allow;
 *   - a `<id>.json.bak` survives iff its live `<id>.json` still exists and it
 *     is among the BAK_KEEP_PER_ID newest of its id (save-then-crash
 *     recovery). A deleted board's recovery copy is its tombstone, so its
 *     .bak is redundant; an id with neither a live board nor a tombstone is
 *     an orphan left behind by a pruned tombstone and goes.
 *
 * SAFETY CONTRACT: the planner is PURE and is structurally unable to name a
 * file that does not match ONE of the two exact regexes below. Live boards,
 * library.json(.bak), *.tmp crash leftovers and anything else in the
 * directory are data and survive every prune (negative control in §A/§B of
 * the harness). The prune only ever unlinks names readdir returned from the
 * directory it was given — it cannot walk outside it.
 *
 * Consumers: vite.config.ts (boot sweep + a sweep after every archived
 * DELETE, both deferred off the request path and unref'd) and
 * scripts/purge-deleted-boards.mjs remains the explicit human tool.
 */
import {readdirSync, statSync, rmSync} from 'node:fs';
import {join} from 'node:path';

export const RETENTION = Object.freeze({
  /** A tombstone younger than this always survives (recover a mis-click). */
  TOMBSTONE_MAX_AGE_MS: 30 * 86400e3,
  /** …or it is among the N newest tombstones of the SAME board id. */
  TOMBSTONE_KEEP_PER_ID: 5,
  /** Hard global bound on ALL tombstones, newest first. This is what makes
   *  the class bounded FOREVER: the age window alone would let a nightly
   *  harness load of one-shot scratch boards accumulate 30 days of them. */
  TOMBSTONE_MAX_TOTAL: 100,
  /** Newest `.json.bak` generations per live board id (2 = the current one
   *  plus one; the server's own write path can only ever produce one name,
   *  so this cap mostly guards hand-copied variants). */
  BAK_KEEP_PER_ID: 2,
});

/** `<boardId>.deleted-<YYYYMMDDTHHMMSSZ>.json` — the exact AS-7 archive name.
 *  The id class matches the boards API's own ID_RE, so a live board file
 *  (`<id>.json`, no dots in the id) can never match this shape. */
export const TOMBSTONE_RE = /^([A-Za-z0-9_-]+)\.deleted-(\d{8}T\d{6}Z)\.json$/;
/** `<boardId>.json.bak` — the exact AS-6 backup name. */
export const BAK_RE = /^([A-Za-z0-9_-]+)\.json\.bak$/;

/** Parse the tombstone name stamp (`20261104T185606Z`) to UTC ms.
 *  Returns NaN for an impossible date — the planner treats a tombstone it
 *  cannot date as the OLDEST (ranked last, first out under the global cap)
 *  rather than immortal. */
export function stampMs(ts) {
  const y = +ts.slice(0, 4), mo = +ts.slice(4, 6), d = +ts.slice(6, 8);
  const h = +ts.slice(9, 11), mi = +ts.slice(11, 13), s = +ts.slice(13, 15);
  const ms = Date.UTC(y, mo - 1, d, h, mi, s);
  return Number.isFinite(ms) ? ms : NaN;
}

const rankTs = t => (Number.isFinite(t.ts) ? t.ts : -Infinity);

/**
 * Pure retention plan over a directory listing.
 * @param {{name: string, mtimeMs?: number}[]} entries — one per file
 * @param {{now?: number}} [opts]
 * @returns {{remove: string[], removed: {tombstones: number, baks: number},
 *            kept: {tombstones: number, baks: number, other: number},
 *            scanned: number}}
 *   `remove` contains ONLY names matching TOMBSTONE_RE or BAK_RE — that is
 *   the invariant the harness's negative control pins.
 */
export function planRetention(entries, opts = {}) {
  const now = opts.now ?? Date.now();
  const names = new Set(entries.map(e => e.name));
  const tombs = [];
  const baks = [];
  let other = 0;
  for (const e of entries) {
    const m = TOMBSTONE_RE.exec(e.name);
    if (m) { tombs.push({name: e.name, id: m[1], ts: stampMs(m[2])}); continue; }
    const b = BAK_RE.exec(e.name);
    if (b) { baks.push({name: e.name, id: b[1], mtimeMs: e.mtimeMs ?? 0}); continue; }
    other++;
  }
  const remove = new Set();

  /* tombstones — age window OR per-id newest, then the global cap */
  const byId = new Map();
  for (const t of tombs) {
    if (!byId.has(t.id)) byId.set(t.id, []);
    byId.get(t.id).push(t);
  }
  const survivors = [];
  for (const group of byId.values()) {
    group.sort((a, b) => rankTs(b) - rankTs(a)); // newest first
    group.forEach((t, i) => {
      const fresh = Number.isFinite(t.ts) && now - t.ts < RETENTION.TOMBSTONE_MAX_AGE_MS;
      if (fresh || i < RETENTION.TOMBSTONE_KEEP_PER_ID) survivors.push(t);
      else remove.add(t.name);
    });
  }
  survivors.sort((a, b) => rankTs(b) - rankTs(a)); // newest first
  for (let i = RETENTION.TOMBSTONE_MAX_TOTAL; i < survivors.length; i++) {
    remove.add(survivors[i].name);
  }

  /* .baks — only while the live board exists, newest BAK_KEEP_PER_ID per id */
  const bakById = new Map();
  for (const b of baks) {
    if (!bakById.has(b.id)) bakById.set(b.id, []);
    bakById.get(b.id).push(b);
  }
  for (const [id, group] of bakById) {
    const live = names.has(`${id}.json`);
    group.sort((a, b) => b.mtimeMs - a.mtimeMs); // newest first
    let kept = 0;
    for (const b of group) {
      if (live && kept < RETENTION.BAK_KEEP_PER_ID) kept++;
      else remove.add(b.name);
    }
  }

  const removedTombstones = [...remove].filter(n => TOMBSTONE_RE.test(n)).length;
  const removedBaks = remove.size - removedTombstones;
  return {
    remove: [...remove],
    removed: {tombstones: removedTombstones, baks: removedBaks},
    kept: {tombstones: tombs.length - removedTombstones, baks: baks.length - removedBaks, other},
    scanned: entries.length,
  };
}

/**
 * Read `dir`, apply the retention plan, and REALLY remove what it names.
 * Never throws for a missing directory (returns a note) or for a file that
 * vanished mid-prune (ENOENT is fine — someone else won the race); every
 * other failure is reported through `log` rather than swallowed.
 * @returns the plan summary plus what was actually unlinked.
 */
export function pruneBoardRetention(dir, opts = {}) {
  const log = opts.log ?? (() => {});
  let entries;
  try {
    entries = readdirSync(dir, {withFileTypes: true})
      .filter(d => d.isFile())
      .map(d => {
        let mtimeMs = 0;
        try { mtimeMs = statSync(join(dir, d.name)).mtimeMs; } catch { /* raced away */ }
        return {name: d.name, mtimeMs};
      });
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      return {removed: {tombstones: 0, baks: 0}, kept: {tombstones: 0, baks: 0, other: 0}, scanned: 0, note: 'dir absent'};
    }
    throw e;
  }
  const plan = planRetention(entries, opts);
  const removed = {tombstones: 0, baks: 0};
  for (const name of plan.remove) {
    try {
      rmSync(join(dir, name));
    } catch (e) {
      if (e && e.code === 'ENOENT') continue; // raced away — already gone
      log(`[board-retention] failed to remove ${name}: ${e && e.message ? e.message : e}`);
      continue;
    }
    if (TOMBSTONE_RE.test(name)) removed.tombstones++;
    else removed.baks++;
  }
  return {...plan, remove: plan.remove.length, removed};
}
