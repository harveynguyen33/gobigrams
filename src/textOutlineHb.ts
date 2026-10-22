/* ROUND C — the harfbuzzjs LOADER (App-only; src/textOutline.ts stays
 * bundler-agnostic pure code the legacy Node harnesses can bundle without
 * a vite-style `?url` loader).
 *
 * LAZY ASSET (Harvey-approved in-card, 2026-10-21 "ok 1"): this module's
 * own code is tiny, but it dynamic-import()s the emscripten FACTORY
 * (vendored at src/vendor/harfbuzzjs/harfbuzz.js, MIT, ~31 KB minified)
 * which FETCHES harfbuzz.wasm (~431 KB, loaded from node_modules through
 * the package export + `?url`, bound via Module.locateFile). Both land in
 * a lazy chunk and are fetched on the FIRST outlined export only; the
 * default chunk never pulls them.
 *
 * WHY A HAND-WRITTEN WRAPPER instead of the package's own index.mjs
 * helpers (both halves measured on this tree, 2026-10-22):
 *  1. BYTES: the helper layer (Blob/Face/Font/Buffer/DrawFuncs/colour/
 *     name tables) minifies to ~26 KB MORE than the raw factory. With it
 *     the build measures client_js_bytes 924,849 — OVER the 900,000
 *     ceiling. The wrapper covers only the surface the outlined export
 *     uses, which is exactly the +16,332 B the STEP-0 document priced
 *     and Harvey approved (measured after landing: see the round report).
 *  2. TARGET: index.mjs self-initialises with top-level await
 *     (`init(await createHarfBuzz())`), which the app's build target
 *     (es2020/chrome87) rejects — the build hard-fails on it.
 *  3. The factory-route alternative USING index.mjs was measured broken
 *     live ('m.Blob is not a constructor'): the helper classes are
 *     index.mjs closures and never attach to the raw module. This file
 *     IS that glue, kept as thin as the export needs.
 *
 * Why the FACTORY is vendored (src/vendor/harfbuzzjs/, MIT, LICENSE kept
 * beside it): the package's exports map cannot express a deep JS
 * specifier ("Missing \"./dist/harfbuzz.js\" specifier" — vite's
 * resolver enforces the map even for `?url`), so the factory file is
 * copied into the tree and imported by relative ?url. The .wasm needs no
 * vendoring: 'harfbuzzjs/dist/harfbuzz.wasm?url' IS in the exports map.
 *
 * The emscripten surface carries no bundled types — narrow local
 * declarations here (BN-01: no `any`).
 */
import harfbuzzFactoryUrl from './vendor/harfbuzzjs/harfbuzz.js?url';
import wasmUrl from 'harfbuzzjs/dist/harfbuzz.wasm?url';
import type {OutlineShaper} from './textOutline';

type HbModule = {
  wasmExports: {
    malloc(n: number): number;
    free(p: number): void;
    hb_blob_create(blobPtr: number, length: number, mode: number, userData: number, destroy: number): number;
    hb_face_create(blobPtr: number, index: number): number;
    hb_face_get_upem(facePtr: number): number;
    hb_font_create(facePtr: number): number;
    hb_font_set_scale(fontPtr: number, x: number, y: number): void;
    /* ROUND AZ — variable-font instantiation: set the wght axis so ONE
     * committed variable subset covers every painted weight (400..700, 650). */
    hb_font_set_variations(fontPtr: number, coordsPtr: number, coordsLength: number): void;
    hb_ot_var_get_axis_infos(facePtr: number, startOffset: number, countPtr: number, axesPtr: number): number;
    hb_font_draw_glyph(fontPtr: number, gid: number, dfuncs: number, drawData: number): void;
    hb_buffer_create(): number;
    hb_buffer_add_codepoints(bufPtr: number, cpsPtr: number, len: number, itemOffset: number, itemLength: number): void;
    hb_buffer_guess_segment_properties(bufPtr: number): void;
    hb_buffer_get_length(bufPtr: number): number;
    hb_buffer_get_glyph_infos(bufPtr: number, lenPtr: number): number;
    hb_buffer_get_glyph_positions(bufPtr: number, lenPtr: number): number;
    hb_shape(fontPtr: number, bufPtr: number, features: number, numFeatures: number): void;
    hb_draw_funcs_create(): number;
    hb_draw_funcs_set_move_to_func(d: number, f: number, ud: number, destroy: number): void;
    hb_draw_funcs_set_line_to_func(d: number, f: number, ud: number, destroy: number): void;
    hb_draw_funcs_set_quadratic_to_func(d: number, f: number, ud: number, destroy: number): void;
    hb_draw_funcs_set_cubic_to_func(d: number, f: number, ud: number, destroy: number): void;
    hb_draw_funcs_set_close_path_func(d: number, f: number, ud: number, destroy: number): void;
  };
  HEAPU8: Uint8Array;
  HEAPU32: Uint32Array;
  HEAP32: Int32Array;
  stackSave(): number;
  stackRestore(p: number): void;
  addFunction(fn: (...args: unknown[]) => void, sig: string): number;
};
type HbFactory = (moduleArg?: {locateFile?: (p: string) => string}) => Promise<HbModule>;

/* One live wasm module + the pieces created once per module. */
let hbMod: Promise<HbModule | null> | null = null;
let freeFuncPtr = 0;
let pathFuncsPtr = 0;
/* the sink the draw callbacks write into (single-threaded, synchronous
 * draw: one glyphPath call at a time owns it). */
let pathSink: string[] | null = null;

async function moduleFor(): Promise<HbModule | null> {
  if (!hbMod) {
    hbMod = (async () => {
      try {
        const create = ((await import(/* @vite-ignore */ harfbuzzFactoryUrl)).default) as unknown as HbFactory;
        const mod = await create({locateFile: () => wasmUrl});
        const x = mod.wasmExports;
        /* the blob destroy callback: frees the copied font bytes when
         * HarfBuzz destroys the blob (the package's own init() does the
         * same addFunction) */
        freeFuncPtr = mod.addFunction((ptr) => { x.free(ptr as number); }, 'vi');
        /* the SVG-path draw-funcs table, mirroring the package's
         * getPathDrawFuncs() output format exactly (M/L/Q/C/Z) */
        pathFuncsPtr = x.hb_draw_funcs_create();
        const d = pathFuncsPtr;
        const moveTo = mod.addFunction((_df, _dd, _st, toX: unknown, toY: unknown) => {
          pathSink?.push(`M${toX},${toY}`);
        }, 'viiiffi');
        const lineTo = mod.addFunction((_df, _dd, _st, toX: unknown, toY: unknown) => {
          pathSink?.push(`L${toX},${toY}`);
        }, 'viiiffi');
        const quadTo = mod.addFunction((_df, _dd, _st, cX: unknown, cY: unknown, toX: unknown, toY: unknown) => {
          pathSink?.push(`Q${cX},${cY} ${toX},${toY}`);
        }, 'viiiffffi');
        const cubicTo = mod.addFunction((_df, _dd, _st, c1X: unknown, c1Y: unknown, c2X: unknown, c2Y: unknown, toX: unknown, toY: unknown) => {
          pathSink?.push(`C${c1X},${c1Y} ${c2X},${c2Y} ${toX},${toY}`);
        }, 'viiiffffffi');
        const closeTo = mod.addFunction(() => {
          pathSink?.push('Z');
        }, 'viiii');
        x.hb_draw_funcs_set_move_to_func(d, moveTo, 0, 0);
        x.hb_draw_funcs_set_line_to_func(d, lineTo, 0, 0);
        x.hb_draw_funcs_set_quadratic_to_func(d, quadTo, 0, 0);
        x.hb_draw_funcs_set_cubic_to_func(d, cubicTo, 0, 0);
        x.hb_draw_funcs_set_close_path_func(d, closeTo, 0, 0);
        return mod;
      } catch (e) {
        console.error('[textOutline] harfbuzz init failed:', e);
        return null;
      }
    })();
  }
  return hbMod;
}

const shaperCache = new Map<string, Promise<{
  fontPtr: number;
  upem: number;
} | null>>();

/** ROUND AZ — the wght axis index within the face's fvar (needed because
 *  hb_font_set_variations takes coordinates in AXIS ORDER, not by tag).
 *  Cached per face pointer. Returns -1 when the face has no wght axis
 *  (a static instance): the caller then skips set_variations entirely. */
const wghtAxisCache = new Map<number, number>();
function wghtAxisIndex(mod: HbModule, facePtr: number): number {
  const hit = wghtAxisCache.get(facePtr);
  if (hit !== undefined) return hit;
  let idx = -1;
  try {
    const x = mod.wasmExports;
    const countPtr = x.malloc(4);
    mod.HEAPU32[countPtr / 4] = 0;
    /* query the count first (countPtr=0 writes) then read the axis records */
    x.hb_ot_var_get_axis_infos(facePtr, 0, countPtr, 0);
    const n = mod.HEAPU32[countPtr / 4];
    const axesPtr = x.malloc(n * 20); /* hb_ot_var_axis_info_t = 20 bytes */
    mod.HEAPU32[countPtr / 4] = n;
    x.hb_ot_var_get_axis_infos(facePtr, 0, countPtr, axesPtr);
    for (let i = 0; i < n; i++) {
      /* struct layout (hb_ot_var_axis_info_t): tag u32 at +0 */
      const tag = mod.HEAPU32[axesPtr / 4 + i * 5];
      /* 'wght' = 0x77676874 */
      if (tag === 0x77676874) { idx = i; break; }
    }
    x.free(countPtr);
    x.free(axesPtr);
  } catch (e) {
    console.error('[textOutline] axis query failed:', e);
    idx = -1;
  }
  wghtAxisCache.set(facePtr, idx);
  return idx;
}

async function shaperFor(bytes: Uint8Array, key: string, weight?: number) {
  let p = shaperCache.get(key);
  if (!p) {
    p = (async () => {
      try {
        const mod = await moduleFor();
        if (!mod) return null;
        const x = mod.wasmExports;
        /* copy the font bytes into the wasm heap and wrap them in a blob
         * (the destroy callback frees our copy, mirroring the package's
         * Blob: the wasm owns the storage from here) */
        const dataPtr = x.malloc(bytes.byteLength);
        mod.HEAPU8.set(bytes, dataPtr);
        const blobPtr = x.hb_blob_create(dataPtr, bytes.byteLength, 2, dataPtr, freeFuncPtr);
        const facePtr = x.hb_face_create(blobPtr, 0);
        const upem = x.hb_face_get_upem(facePtr);
        const fontPtr = x.hb_font_create(facePtr);
        x.hb_font_set_scale(fontPtr, 64, 64); /* px-per-em at shape time — layoutRun's SCALE */
        /* ROUND AZ — instantiate the wght axis when the face is variable and
         * the row's weight is known. Coordinates are in AXIS ORDER: build the
         * full vector with the default value everywhere except wght. */
        if (weight !== undefined) {
          const axisIdx = wghtAxisIndex(mod, facePtr);
          if (axisIdx >= 0) {
            const nAxes = (() => {
              const countPtr = x.malloc(4);
              mod.HEAPU32[countPtr / 4] = 0;
              x.hb_ot_var_get_axis_infos(facePtr, 0, countPtr, 0);
              const n = mod.HEAPU32[countPtr / 4];
              x.free(countPtr);
              return n;
            })();
            const coordsPtr = x.malloc(nAxes * 4);
            const coords = new Float32Array(mod.HEAPU8.buffer, coordsPtr, nAxes);
            for (let i = 0; i < nAxes; i++) coords[i] = 400; /* the sheets' default; only wght matters here and is set next */
            coords[axisIdx] = weight;
            x.hb_font_set_variations(fontPtr, coordsPtr, nAxes);
            x.free(coordsPtr);
          }
        }
        return {fontPtr, upem};
      } catch (e) {
        console.error('[textOutline] shaper init failed:', e);
        return null;
      }
    })();
    shaperCache.set(key, p);
  }
  return p;
}

/** The app's OutlineShaper for one face: shapes with HarfBuzz, extracts
 *  outlines with hb_font_draw_glyph into SVG path data (the package's
 *  Font#glyphToPath output format). `weight` instantiates the variable
 *  wght axis when the face is variable (ROUND AZ); omit it for a static
 *  instance. */
export async function makeShaper(
  bytes: Uint8Array,
  cacheKey: string,
  weight?: number,
): Promise<OutlineShaper | null> {
  const s = await shaperFor(bytes, cacheKey, weight);
  if (!s) return null;
  const mod = await moduleFor();
  if (!mod) return null;
  const x = mod.wasmExports;
  const {fontPtr, upem} = s;
  return {
    shapeRun(text: string) {
      const bufPtr = x.hb_buffer_create();
      const cps = [...text].map(c => c.codePointAt(0) as number);
      const cpsPtr = x.malloc(cps.length * 4);
      mod.HEAPU32.subarray(cpsPtr / 4, cpsPtr / 4 + cps.length).set(cps);
      x.hb_buffer_add_codepoints(bufPtr, cpsPtr, cps.length, 0, cps.length);
      x.free(cpsPtr);
      x.hb_buffer_guess_segment_properties(bufPtr);
      const sp = mod.stackSave();
      x.hb_shape(fontPtr, bufPtr, 0, 0);
      mod.stackRestore(sp);
      const len = x.hb_buffer_get_length(bufPtr);
      const infosPtr = x.hb_buffer_get_glyph_infos(bufPtr, 0);
      const possPtr32 = x.hb_buffer_get_glyph_positions(bufPtr, 0) / 4;
      const glyphs = [];
      for (let i = 0; i < len; i++) {
        glyphs.push({
          gid: mod.HEAPU32[infosPtr / 4 + i * 5],
          xOffset: mod.HEAP32[possPtr32 + i * 5 + 2],
          yOffset: mod.HEAP32[possPtr32 + i * 5 + 3],
          xAdvance: mod.HEAP32[possPtr32 + i * 5],
        });
      }
      return {glyphs, upem};
    },
    glyphPath(gid: number) {
      const path: string[] = [];
      pathSink = path;
      try {
        x.hb_font_draw_glyph(fontPtr, gid, pathFuncsPtr, 0);
      } finally {
        pathSink = null;
      }
      return path.join('');
    },
  };
}
