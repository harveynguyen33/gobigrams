/* CORE-STEP4A-FIX (2026-11-05) — this module's code MOVED into the
 * @techgoblin/gobi-core workspace package (packages/gobi/src/model/theme.ts);
 * this file is the app-side re-export so every existing importer (app code and
 * the checks/ harnesses that read these paths) is unchanged. The ONE home is
 * the package — never re-add implementation here. The import is RELATIVE (not
 * the package name) so bundlers always inline it — an externalised bare
 * specifier would be unresolvable for plain-node consumers of a subpath. */
export * from '../../packages/gobi/src/model/theme.ts';

/* HEADROOM (t_a21adb78) — the ONE dark-preference media query. It was spelled
 * twice (App's system listener + ThemePicker's probe); a browser string, so it
 * stays app-side and does not belong in the pure core model. */
export const DARK_MQ = '(prefers-color-scheme: dark)';
