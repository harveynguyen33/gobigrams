/**
 * HISTORY-V3 (t_37f23a89) — the dialog-side time formatters, ONE home.
 *
 * `fmtDate` moved VERBATIM out of App.tsx (same locale-based absolute format
 * the Boards menu has always shown) — the move is the extraction that PAID
 * for the history dialog's App wiring, App being hard-capped. BoardsPopover
 * imports it from here now; nothing else changed about it.
 *
 * `relTime` is new: the history ledger's leading relative time, minute-level
 * granularity ("3 min ago"), with the absolute `fmtDate` value expected to
 * ride the row's `title` attribute. English only — the app's UI vocabulary
 * is English; the review mockup showed Vietnamese copy, which was the
 * conversation language, not a copy decision.
 *
 * Deliberately DOM-free and locale-independent (no Intl): a harness can
 * bundle this file and pin every branch deterministically.
 */

/** Absolute date+time, the Boards menu's own format (moved verbatim). */
export const fmtDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
};

/** "N min ago"-level relative time. `now` is injectable for tests.
 *
 * Buckets: <60s "just now" · <1h "N min ago" · <24h "N h ago" · 24–48h
 * "Yesterday HH:MM" (a 24h WINDOW, not a calendar day — deterministic and
 * honest; the boundary case is a same-clock-time label either way) · older
 * "Wed Nov 20 17:02". Local clock for the HH:MM part (the label is for the
 * user's wall clock); the BADGE's day math in historyBadges.ts is UTC,
 * mirroring the retention policy's own granularity — two different clocks on
 * purpose, each documented where it lives. `toDateString()` is
 * spec-deterministic English ("Wed Nov 20 2026"), so the older-than-yesterday
 * arm is locale-independent AND cheap — no name arrays ride the bundle. */
export const relTime = (ts: number, now: number = Date.now()): string => {
  const ms = now - ts;
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} h ago`;
  const d = new Date(ts);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (ms < 2 * 86_400_000) return `Yesterday ${hm}`;
  return `${d.toDateString().slice(0, 10)} ${hm}`;
};
