/**
 * HISTORY-V3 (t_37f23a89) — the ledger row's BADGE, derived client-side.
 *
 * The priority, verbatim from the brief:
 *   1. row occupies a pin slot in storage → kept. HISTORY-STABLE
 *      (t_7bba117f, 2026-11-20) removed the naming feature (owner:
 *      "tôi nghĩ k cần đặt tên"): the badge no longer carries the NAME —
 *      `label !== undefined` is the STORAGE SEAM's pin encoding (HistoryRow
 *      has no `pinned` boolean; `''` is a nameless pin), so that ONE seam
 *      read stays and the VALUE does not;
 *   2. `source === 'pre-restore'` → restore;
 *   3. newest generation of its UTC day among the listed rows → daily;
 *   4. else auto.
 *
 * ~10 lines over the rows the seam already returned. It does NOT import the
 * retention planner (historyPolicy.ts owns pruning; this owns paint only)
 * and it is DOM-free so a Node harness can bundle and pin every branch.
 *
 * UTC-day semantics: the retention policy keeps one generation per UTC day,
 * so the badge marks the same day boundary the policy does. The day slot is
 * CONSUMED by the day's newest row even when that row wears a higher-priority
 * badge — "newest of its UTC day" is a fact about the row, not a leftover
 * title handed down when a prouder badge wins.
 */
import type {HistoryRow} from '../board/boards';

export type HistoryBadgeKind = 'pinned' | 'restore' | 'daily' | 'auto';
export type HistoryBadge = {kind: HistoryBadgeKind};

/** One badge per row, in the rows' own (newest-first) order. */
export function deriveBadges(rows: readonly HistoryRow[]): HistoryBadge[] {
  const seenDays = new Set<string>();
  const out: HistoryBadge[] = [];
  for (const r of rows) {
    const day = new Date(r.at).toISOString().slice(0, 10);
    const firstOfDay = !seenDays.has(day);
    seenDays.add(day);
    if (r.label !== undefined) { out.push({kind: 'pinned'}); continue; }
    if (r.source === 'pre-restore') { out.push({kind: 'restore'}); continue; }
    if (firstOfDay) { out.push({kind: 'daily'}); continue; }
    out.push({kind: 'auto'});
  }
  return out;
}
