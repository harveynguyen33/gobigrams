/* feature-map home: src/exportPng.ts */
/* ROUND AY item 4 — exportPng.ts (pure rasterise(svgString) module).
 *
 * Spec §4: PNG = rasterise(SVG). One painter per pixel class: the SVG emitter
 * is the single source of the picture; this module turns the svgString into a
 * PNG dataURL via Blob URL → Image.decode() → canvas.drawImage.
 *
 * Contract:
 * - svgWidth/svgHeight read from the root <svg width height> attributes
 *   (present since ROUND AR; after item 3 those ARE the getBBox+pad bounds).
 * - scale multiplies the canvas exactly as html-to-image's pixelRatio did.
 *   No silent 16384 clamp: an oversize canvas REJECTS with a visible error.
 * - the canvas is pre-filled with the theme bg token (belt-and-braces for
 *   codecs that drop the bg rect; the SVG itself paints it first).
 * - the 15 s timeout races the decode, same bound as the old toPng path.
 * - `document`/`window` are touched ONLY inside rasterise() — the module is
 *   importable in the Node harness (the timeout test uses a poisoned svg and
 *   a stubbed Image via the injected deps below).
 */

export type RasteriseOpts = {
  scale: number;
  /** The theme background token (literal colour) — pre-fills the canvas. */
  bg?: string;
  /** Injectable deps for the deterministic harness path (defaults to the
   *  browser globals). The harness stubs Image so the timeout/oversize
   *  behaviours are provable without a real rasteriser. */
  deps?: {
    doc?: Document;
    win?: Window & typeof globalThis;
    ImageCtor?: typeof Image;
  };
};

export class PngOversizeError extends Error {
  constructor(w: number, h: number) {
    super(`PNG export too large: ${w}x${h} exceeds the 16384 px canvas limit — reduce the scale or the board size`);
    this.name = 'PngOversizeError';
  }
}

/** Read the root svg's width/height attributes (integers, ceil'd by the
 *  emitter). Returns null when the string carries no measurable root. */
export function svgIntrinsicSize(svg: string): {w: number; h: number} | null {
  const num = '\\d+(?:\\.\\d+)?';
  const mW = new RegExp(`<svg[^>]*?\\swidth="(${num})"[^>]*?\\sheight="(${num})"`).exec(svg);
  if (mW) return {w: parseFloat(mW[1]), h: parseFloat(mW[2])};
  const mH = new RegExp(`<svg[^>]*?\\sheight="(${num})"[^>]*?\\swidth="(${num})"`).exec(svg);
  if (mH) return {w: parseFloat(mH[2]), h: parseFloat(mH[1])};
  return null;
}

const CANVAS_LIMIT = 16384;

export function rasterise(svg: string, o: RasteriseOpts): Promise<string> {
  const doc = o.deps?.doc ?? document;
  const win = o.deps?.win ?? window;
  const ImageCtor = o.deps?.ImageCtor ?? win.Image.bind(win);

  const size = svgIntrinsicSize(svg);
  if (!size) return Promise.reject(new Error('PNG export: the SVG string has no measurable width/height'));
  const cw = Math.ceil(size.w * o.scale);
  const ch = Math.ceil(size.h * o.scale);
  /* explicit guard, never a silent rescale (spec §4) */
  if (cw > CANVAS_LIMIT || ch > CANVAS_LIMIT) {
    return Promise.reject(new PngOversizeError(cw, ch));
  }

  return new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
    const img = new ImageCtor();
    img.decoding = 'async';
    let revoked = false;
    /* timerId lives in a holder so a timeout that fires before its own
     * assignment lands (a synchronous stub clock) still clears safely */
    const timerRef: {id?: ReturnType<typeof setTimeout>} = {};
    const cleanup = () => {
      if (timerRef.id !== undefined) win.clearTimeout(timerRef.id);
      if (!revoked) {
        revoked = true;
        URL.revokeObjectURL(url);
      }
    };
    timerRef.id = win.setTimeout(() => {
      cleanup();
      reject(new Error('PNG render timed out'));
    }, 15000);
    img.onload = () => {
      try {
        const canvas = doc.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('PNG export: no 2d context'));
          return;
        }
        if (o.bg) {
          ctx.fillStyle = o.bg;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        /* the real canvas 2d context carries toDataURL on the CANVAS element
         * (the ctx does not per the DOM types); the harness stub ctx does. */
        const toDataUrl = (canvas as HTMLCanvasElement & {toDataURL?: (t: string) => string}).toDataURL
          ?? (ctx as CanvasRenderingContext2D & {toDataURL?: (t: string) => string}).toDataURL;
        if (!toDataUrl) {
          cleanup();
          reject(new Error('PNG export: no toDataURL available'));
          return;
        }
        const dataUrl = toDataUrl.call(canvas, 'image/png');
        cleanup();
        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    img.onerror = () => {
      cleanup();
      reject(new Error('PNG export: the SVG image failed to load (a poisoned string, or an external reference in secure static mode)'));
    };
    img.src = url;
  });
}
