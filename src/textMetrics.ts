/* ROUND AY item 1 — the persisted text-metrics cache (t_822ff5a3, OPTION B).
 *
 * Export REPLAYS measurements instead of re-deriving them: pure-text geometry
 * (wrap lines, string widths, per-font ascent) is cached at module level,
 * keyed by EVERY geometry input (text, family, size, weight, spacing,
 * maxWidth). Anything not in the key cannot affect the result, so a stale
 * entry is structurally impossible — except for a late font load, handled by
 * the fonts-epoch guard below.
 *
 * The wrap itself uses the EXISTING pure `wrapText()` (exportSvg.ts) with the
 * injected width fn, so the wrap decision is byte-identical to today on day
 * one. The cache just stops re-measuring.
 *
 * The measurer stays INJECTED (`measure` fn) so the Node harness keeps its
 * deterministic stub path: in the app the browser supplies the hidden
 * <svg><text> measurer; in the harness a counting stub proves the cache
 * actually serves repeat measurements (hit counter > 0).
 *
 * Fonts-epoch guard: a stale measurement is worse than a slow one. Every
 * cache entry records the epoch it was measured under; whenever
 * `document.fonts` reports a load settling ('loadingdone' / 'loadingerror'),
 * or once at boot when fonts are already 'loaded', the epoch increments and
 * all entries from older epochs are discarded. Zoom/theme do NOT invalidate:
 * the key is px at the row's own font-size (zoom-independent) and colours are
 * not geometry.
 */

import {wrapText} from './exportSvg';

export type TextMetricsKey = {
  text: string;
  family: string;
  size: number;
  weight: number;
  spacing: number;
  maxWidth: number;
};

export type CachedMetrics = {
  lines: string[];
  widths: number[];
  ascent: number;
};

/** The injected width function — the browser's hidden <svg><text> measurer
 *  (`domMeasurer.measureText`), or the harness's deterministic stub. */
export type TextWidthFn = (
  text: string,
  o: {size: number; weight: number; spacing?: number; family?: string},
) => number;

/** The injected ascent function — canvas `measureText('Mg')
 *  .fontBoundingBoxAscent` in the app, a constant in the harness. */
export type TextAscentFn = (o: {size: number; weight: number; family?: string}) => number;

type Entry = {epoch: number; metrics: CachedMetrics};

const cache = new Map<string, Entry>();

let epoch = 0;
let bootProbed = false;
let listening = false;

/** Cache diagnostics (the harness's proof surface): how many lookups were
 *  served WITHOUT calling the injected measurer. */
let hits = 0;
let misses = 0;
export const textMetricsStats = (): {hits: number; misses: number; entries: number; epoch: number} =>
  ({hits, misses, entries: cache.size, epoch});

export const resetTextMetricsStats = (): void => { hits = 0; misses = 0; };

export function clearTextMetrics(): void {
  cache.clear();
}

/** Bump the epoch (an implicit clear): every pre-existing entry becomes
 *  unreachable on its next lookup. Called by the fonts guard below. */
function bumpEpoch(): void {
  epoch += 1;
  cache.clear();
}

/** Ensure the fonts guard is live: listeners for a font load settling, and
 *  the once-per-session boot probe. In the app today the stacks are system
 *  fonts that resolve instantly, so this is a no-op; it exists so Route 1 of
 *  the font fork (shipped fonts) cannot serve stale geometry later. Guarded
 *  so the Node harness (no document) stays on the manual epoch path. */
function ensureFontsGuard(): void {
  if (bootProbed) return;
  bootProbed = true;
  try {
    if (typeof document === 'undefined' || !document.fonts) return;
    if (document.fonts.status === 'loaded') bumpEpoch();
    if (!listening) {
      listening = true;
      const onSettle = () => bumpEpoch();
      document.fonts.addEventListener('loadingdone', onSettle);
      document.fonts.addEventListener('loadingerror', onSettle);
    }
  } catch { /* never let the guard break a measurement */ }
}

const keyOf = (k: TextMetricsKey): string =>
  `${k.maxWidth}\u0000${k.size}\u0000${k.spacing}\u0000${k.weight}\u0000${k.family}\u0000${k.text}`;

/** The cached wrap: lines + per-line widths under the injected width fn. */
export function getTextMetrics(
  key: TextMetricsKey,
  measure: TextWidthFn,
  ascentOf: TextAscentFn,
): CachedMetrics {
  ensureFontsGuard();
  const k = keyOf(key);
  const found = cache.get(k);
  if (found && found.epoch === epoch) {
    hits += 1;
    return found.metrics;
  }
  misses += 1;
  const lines = wrapText(key.text, key.maxWidth, (s) =>
    measure(s, {size: key.size, weight: key.weight, spacing: key.spacing, family: key.family}));
  const widths = lines.map((ln) =>
    measure(ln, {size: key.size, weight: key.weight, spacing: key.spacing, family: key.family}));
  const ascent = ascentOf({size: key.size, weight: key.weight, family: key.family});
  const metrics: CachedMetrics = {lines, widths, ascent};
  cache.set(k, {epoch, metrics});
  return metrics;
}

/** Cached ascent only (a pure font property, keyed by family+size+weight). */
export function getTextAscent(
  o: {family: string; size: number; weight: number},
  ascentOf: TextAscentFn,
): number {
  ensureFontsGuard();
  const k = `ascent\u0000${o.size}\u0000${o.weight}\u0000${o.family}`;
  const found = cache.get(k);
  if (found && found.epoch === epoch) {
    hits += 1;
    return found.metrics.ascent;
  }
  misses += 1;
  const ascent = ascentOf({size: o.size, weight: o.weight, family: o.family});
  cache.set(k, {epoch, metrics: {lines: [], widths: [], ascent}});
  return ascent;
}
