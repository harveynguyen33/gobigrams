/* CORE-STEP4A-FIX (2026-11-05) — this module's code MOVED into the
 * @techgoblin/gobi-core workspace package (packages/gobi/src/model/layoutConstants.ts);
 * this file is the app-side re-export so every existing importer (app code and
 * the checks/ harnesses that read these paths) is unchanged. The ONE home is
 * the package — never re-add implementation here. The import is RELATIVE (not
 * the package name) so bundlers always inline it — an externalised bare
 * specifier would be unresolvable for plain-node consumers of a subpath. */
export * from '../packages/gobi/src/model/layoutConstants.ts';
