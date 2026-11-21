/* CORE-API-GAP (task t_b7bb0ff1) — the node consumer's ONE-LINE defaults.
 *
 * Before this module a consumer of the installed package had to find
 * `src/metrics.json` inside node_modules and JSON.parse it before it could
 * build a measurer: the table existed, the public surface did not reach it.
 *
 * DEFAULT_METRICS is the committed table itself (packages/gobi/src/metrics.json
 * — generated from the real DOM by scripts/gobi-gen-metrics.mjs, and the exact
 * table the committed corpus was stamped with). Bundling the JSON means the
 * value is inlined into dist/index.js and into any bundler's graph, so no
 * runtime file read and no path into the package are needed.
 *
 * The renderer's contract is UNCHANGED: a measurer is still mandatory and a
 * missing one still fails loudly (GobiMeasurerMissing). This export only
 * supplies the node-side table — pass it through tableMeasurer().
 */
import metricsJson from './metrics.json';
import type {GobiMetrics} from './tableMeasure';

/** The committed per-string/per-style advance-width table. */
export const DEFAULT_METRICS: GobiMetrics = metricsJson;
