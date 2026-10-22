/* The stand-in for `harfbuzzjs/dist/harfbuzz.wasm?url` in NON-vite
 * bundles (the legacy Node harnesses bundle src/exportSvg.ts with plain
 * esbuild, which has no ?url loader). Vite never sees this file; plain
 * esbuild runs alias the ?url specifier here via
 *   --alias:harfbuzzjs/dist/harfbuzz.wasm?url=<this file>
 * The harnesses only exercise the PURE layout/emitter path and never
 * fetch the wasm, so the value is a marker, not a URL. */
export default 'harfbuzz.wasm (harness stub — not a real asset URL)';
