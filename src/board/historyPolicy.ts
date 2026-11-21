/**
 * HISTORY-V1 policy — the ONE home for the save-history retention numbers.
 *
 * Why this module exists (the defect, measured 2026-11-19): the rotating
 * history counted SAVES, not time — a board holding a full ten generations
 * spanning 23 seconds means "history" is the last 20 seconds of editing, and
 * one autosave burst erased the state before it. V1 samples checkpoints by
 * time and prunes by GENERATION: ring + daily + pins.
 *
 * Layout (the card left it open, so the choice is recorded here): a
 * dependency-free `.ts` module under `src/board/`. Both node-side consumers
 * import it directly — `vite.config.ts` and `scripts/boardRetention.mjs`,
 * which a Vite/Node >= 22 chain runs natively under `"type": "module"` — and
 * a later browser-side local adapter (V4) can import the same file with ZERO
 * `node:` specifiers in the chain, because this module imports nothing at
 * all. The numbers exist exactly once; `checks/round-history-sampling.mjs`
 * (hv5) asserts it on every run.
 *
 * Nothing here touches a filesystem: the law is PURE so a harness can prove
 * it without one, and the fs-side plumbing (readdir scans, unlink) stays in
 * `scripts/boardRetention.mjs`.
 */

/** Per-board recovery window: the newest N generations always survive a
 *  prune. This is the "I just did something wrong" net — old law and new. */
export const HISTORY_RING_KEEP = 10;
/** Long horizon: the newest generation of each of the last N UTC days also
 *  survives, so a board edited daily keeps a per-day anchor beyond the ring. */
export const HISTORY_DAILY_KEEP = 14;
/** Labelled survivors (V3 adds the UI): the planner honours at most N pinned
 *  names per plan — empty is the only caller today, but the seam is real. */
export const HISTORY_PIN_KEEP = 4;
/** A checkpoint needs this much time since the board's newest stored
 *  generation. The SAVE still happens on every PUT; only the checkpoint
 *  waits — equivalent content is never "no save". */
export const MIN_CHECKPOINT_GAP_MS = 120_000;

/** `<boardId>.<epoch-ms>.json` — one generation in `boards/.history/`. The id
 *  carries no dots (the boards API's own ID_RE), the stamp is 13 digits, so a
 *  live board name can never match this shape. */
export const HISTORY_RE = /^([A-Za-z0-9_-]+)\.(\d{13})\.json$/;

const UTC_DAY_MS = 86_400_000;

/** The stamp encoded in a generation file name, or null for any other name. */
export function historyStampOf(name: string): number | null {
  const m = HISTORY_RE.exec(name);
  return m ? Number(m[2]) : null;
}

export interface HistoryPlan {
  /** Survivor names, stamp-ascending. */
  keep: string[];
  /** Names to remove, OLDEST-FIRST — the eviction order to apply. */
  evict: string[];
  /** Names that do not match the generation grammar; never removable. */
  other: string[];
}

/**
 * Pure generational retention plan over a directory listing.
 *
 * Survivors per board id: the newest `HISTORY_RING_KEEP` generations (ring),
 * plus the newest generation of each of the last `HISTORY_DAILY_KEEP` UTC
 * days (daily), plus up to `HISTORY_PIN_KEEP` pinned names. Everything else
 * is evicted, oldest-first. The plan is strictly PER BOARD — one board's
 * churn can never evict another board's window (the repo's own measured
 * lesson: a global cap destroyed a real board's recovery copy once) — and
 * names that do not match `HISTORY_RE` are returned untouched in `other`.
 *
 * @param entries one per file, `{name}` is all the planner reads
 * @param opts.now the reference "now"; defaults to Date.now() so the
 *   middleware's callers (the PUT-path prune and the retention sweep) run on
 *   the real clock without threading it — harnesses inject a fixed value
 * @param opts.pins names to keep regardless of age, at most the newest 4 of
 *   those passed (a stamp alone is ambiguous across boards; the name carries
 *   both)
 */
export function planHistory(entries: readonly {name: string}[], opts: {now?: number; pins?: Iterable<string>}): HistoryPlan {
  const pins = new Set(opts.pins ?? []);
  const now = opts.now ?? Date.now();
  const other: string[] = [];
  const byId = new Map<string, {name: string; id: string; ts: number}[]>();
  for (const e of entries) {
    const m = HISTORY_RE.exec(e.name);
    if (!m) { other.push(e.name); continue; }
    const g = {name: e.name, id: m[1], ts: Number(m[2])};
    const list = byId.get(g.id);
    if (list) list.push(g); else byId.set(g.id, [g]);
  }

  const dayOf = (ts: number) => Math.floor(ts / UTC_DAY_MS);
  const today = dayOf(now);
  const keep = new Set<string>();

  for (const list of byId.values()) {
    list.sort((a, b) => a.ts - b.ts); // oldest → newest
    /* pins, bounded: at most the newest HISTORY_PIN_KEEP of those passed */
    for (const g of list.filter(g => pins.has(g.name)).slice(-HISTORY_PIN_KEEP)) keep.add(g.name);
    /* ring: the newest HISTORY_RING_KEEP generations of this board */
    for (const g of list.slice(-HISTORY_RING_KEEP)) keep.add(g.name);
    /* daily: the newest generation of each in-window day. The list is
       stamp-sorted, so walk back from the newest and stop at the day. */
    for (let d = today - (HISTORY_DAILY_KEEP - 1); d <= today; d++) {
      for (let i = list.length - 1; i >= 0; i--) {
        const day = dayOf(list[i].ts);
        if (day === d) { keep.add(list[i].name); break; }
        if (day < d) break;
      }
    }
  }

  const stampOf = (n: string) => historyStampOf(n) ?? 0;
  const keepNames: string[] = [];
  const evict: string[] = [];
  for (const list of byId.values()) {
    for (const g of list) {
      if (keep.has(g.name)) keepNames.push(g.name);
      else evict.push(g.name);
    }
  }
  keepNames.sort((a, b) => stampOf(a) - stampOf(b));
  evict.sort((a, b) => stampOf(a) - stampOf(b)); // oldest-first
  return {keep: keepNames, evict, other};
}

export interface CheckpointInput {
  /** Milliseconds now (injected by harnesses, Date.now() in production). */
  now: number;
  /** Stamp of this board's newest stored generation; null when it has none. */
  newestStamp: number | null;
  /** Do the bytes about to be written differ from the live file's raw bytes? */
  bytesDiffer: boolean;
  /** From the request body: 'pre-restore' bypasses the gap. Anything else —
   *  absent, unknown, wrong type — reads as 'auto'. */
  reason?: unknown;
}

/**
 * The sampling predicate: does this save take a checkpoint?
 *
 * A checkpoint needs BOTH a content change AND the gap since the newest
 * stored stamp — with two exceptions that come first: a 'pre-restore' save
 * always checkpoints (the restore event itself must land in history, and the
 * state it replaces is exactly what a user may want back), and a board with
 * no stored generation always takes its first.
 */
export function shouldCheckpoint(input: CheckpointInput): boolean {
  if (input.reason === 'pre-restore') return true;
  if (input.newestStamp == null) return true;
  if (!input.bytesDiffer) return false;
  return input.now - input.newestStamp >= MIN_CHECKPOINT_GAP_MS;
}
