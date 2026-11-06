/* CORE-STEP3 (task t_62cf7a90) — the TABLE MEASURER: the DOM-free
 * implementation of the injected-measurer contract (SPEC-GOBI-CORE §B).
 *
 * The table is committed data (src/gobi/metrics.json): the per-string,
 * per-style advance widths the DOM measurer produced for the corpus,
 * recorded by scripts/gobi-gen-metrics.mjs in a browser run. Node consumers
 * (the CLI, the corpus, a future MCP server) measure through this table so
 * the same .gobi renders byte-identically everywhere; the browser injects
 * its real DOM measurer at the boundary, and the corpus asserts the two
 * agree exactly (0 DOM-vs-table mismatches, 0 fallback hits).
 *
 * The fallback rule is HONEST, not silent: a key missing from the table
 * falls to the 0.6em estimate but is COUNTED in `fallbacks` — the corpus
 * asserts the count is 0, so an un-tabled string fails loudly downstream
 * ("run scripts/gobi-gen-metrics.mjs and commit the table"). A renderer
 * called with NO measurer at all refuses to run (renderSvg.ts).
 */

/** The measurer interface — adopted verbatim from exportSvg.ts's optional
 *  `measureText` (the seam ROUND DEFECT-2 already established). */
export type GobiMeasureText = (
  text: string,
  o: {size: number; weight: number; spacing?: number; family?: string},
) => number;

/** The committed table: metricKey(text, style) -> advance width in px. */
export type GobiMetrics = Record<string, number>;

/** The table key for one (string, style) pair. JSON of
 *  [family '', size, weight, spacing 0, text] — self-describing and robust
 *  against delimiters appearing inside family names or text. */
export function metricKey(text: string, o: {size: number; weight: number; spacing?: number; family?: string}): string {
  return JSON.stringify([o.family ?? '', o.size, o.weight, o.spacing ?? 0, text]);
}

/** Decode a metric key back to its parts (family, size, weight, spacing,
 *  text) — the negative control names the drifted string through this. */
export function metricKeyParts(key: string): {family: string; size: number; weight: number; spacing: number; text: string} | null {
  try {
    const d = JSON.parse(key);
    if (!Array.isArray(d) || d.length !== 5) return null;
    return {family: String(d[0]), size: Number(d[1]), weight: Number(d[2]), spacing: Number(d[3]), text: String(d[4])};
  } catch {
    return null;
  }
}

/** A GobiMeasureText backed by the committed table. `fallbacks` collects the
 *  keys that were MISSING (served by the 0.6em estimate) so a caller can
 *  assert the count is zero — the estimate must never fire silently. */
export function tableMeasurer(metrics: GobiMetrics): GobiMeasureText & {fallbacks: string[]} {
  const fallbacks: string[] = [];
  const measure = ((text: string, o: {size: number; weight: number; spacing?: number; family?: string}) => {
    const k = metricKey(text, o);
    const v = metrics ? metrics[k] : undefined;
    if (typeof v === 'number' && isFinite(v) && v >= 0) return v;
    fallbacks.push(k);
    return text.length * o.size * 0.6 + Math.max(0, text.length - 1) * (o.spacing ?? 0);
  }) as GobiMeasureText & {fallbacks: string[]};
  measure.fallbacks = fallbacks;
  return measure;
}
