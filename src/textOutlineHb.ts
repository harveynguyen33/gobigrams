/* ROUND C — the harfbuzzjs LOADER (App-only; src/textOutline.ts stays
 * bundler-agnostic pure code the legacy Node harnesses can bundle without
 * a vite-style `?url` loader).
 *
 * BOTH harfbuzz pieces are LAZY ASSETS (Harvey-approved):
 *  - harfbuzz.js (the emscripten factory, 31 KB, vendored at
 *    src/vendor/harfbuzzjs/ — MIT, LICENSE beside it; vendored because the
 *    package's exports map cannot express a deep JS specifier and vite's
 *    resolver enforces the map even for `?url`) — `?url` binds its URL;
 *    the factory is dynamic-import()ed from that URL on the FIRST
 *    outlined export, so it lands in its own lazy chunk.
 *  - harfbuzz.wasm (~431 KB) — `?url` binds its URL (this one IS allowed
 *    by the package's exports map, so it loads from node_modules
 *    directly); the factory is told that URL through Module.locateFile,
 *    so the wasm is fetched once, on the first outlined export. Neither
 *    asset is bundled into the default chunk and neither counts toward
 *    client_js_bytes.
 *
 * The factory's default export carries no bundled types: one local
 * declaration at the boundary.
 */
import harfbuzzFactoryUrl from './vendor/harfbuzzjs/harfbuzz.js?url';
import wasmUrl from 'harfbuzzjs/dist/harfbuzz.wasm?url';
import type {OutlineShaper} from './textOutline';

type HbModule = {
  Blob: new (data: Uint8Array) => unknown;
  Face: new (blob: unknown, index: number) => {upem: number};
  Font: new (face: {upem: number}) => {
    glyphToPath(gid: number): string;
    setScale(x: number, y: number): void;
  };
};
type HbFactory = (moduleArg?: {locateFile?: (p: string) => string}) => Promise<HbModule>;

type HbFont = {
  glyphToPath(gid: number): string;
};
type HbShapeModule = {
  Buffer: new () => HbBuffer;
  shape(font: never, buf: never, features: Record<string, never>): void;
};
type HbBuffer = {
  addCodePoints(cps: number[]): void;
  guessSegmentProperties(): void;
  getGlyphInfos(): Array<{codepoint: number}>;
  getGlyphPositions(): Array<{xAdvance: number; yOffset: number; xOffset: number}>;
};

const shaperCache = new Map<string, Promise<{
  font: HbFont;
  mod: HbShapeModule;
  upem: number;
} | null>>();

async function shaperFor(bytes: Uint8Array, key: string) {
  let p = shaperCache.get(key);
  if (!p) {
    p = (async () => {
      try {
        const createHarfBuzz = (await import(/* @vite-ignore */ harfbuzzFactoryUrl)).default as unknown as HbFactory;
        const m = await createHarfBuzz({locateFile: () => wasmUrl});
        const face = new m.Face(new m.Blob(bytes), 0);
        const upem = face.upem;
        const font = new m.Font(face);
        font.setScale(64, 64); /* px-per-em at shape time — layoutRun's SCALE */
        return {font: font as unknown as HbFont, mod: m as unknown as HbShapeModule, upem};
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
 *  outlines with font.drawGlyph's path draw funcs (glyphToPath). */
export async function makeShaper(
  bytes: Uint8Array,
  cacheKey: string,
): Promise<OutlineShaper | null> {
  const s = await shaperFor(bytes, cacheKey);
  if (!s) return null;
  const {font, mod, upem} = s;
  return {
    shapeRun(text: string) {
      const buf = new mod.Buffer();
      buf.addCodePoints([...text].map(c => c.codePointAt(0) as number));
      buf.guessSegmentProperties();
      mod.shape(font as never, buf as never, {});
      const infos = buf.getGlyphInfos();
      const poss = buf.getGlyphPositions();
      return {
        glyphs: infos.map((g, i) => ({
          gid: g.codepoint,
          xOffset: poss[i].xOffset,
          yOffset: poss[i].yOffset,
          xAdvance: poss[i].xAdvance,
        })),
        upem,
      };
    },
    glyphPath(gid: number) {
      return font.glyphToPath(gid);
    },
  };
}
