/* feature-map home: src/fontFiles.ts */
/* ROUND AZ (t_96100cb2) — COMMITTED FONT BYTES: the file-first provider.
 *
 * The card's core change to the outline pipeline: the shaper no longer
 * depends on the queryLocalFonts permission API (a user prompt on the first
 * outlined export, unavailable in most browsers, and a silent no-op under
 * automation). The SAME subsets the stylesheet paints are fetched from
 * public/fonts/ as raw OpenType (the <slug>-variable.ttf twins of the
 * variable woff2 faces — harfbuzzjs takes sfnt, not woff2; inflating woff2
 * at runtime was measured against committing the .ttf twin and the twin
 * costs nothing at runtime and no JS bytes, so the twin is the choice).
 *
 * Everything here is FILE-FIRST: queryLocalFonts stays, in src/textOutline.ts,
 * as the LAST-RESORT fallback for a family this tree does not ship (one of
 * the four opt-in ROUND W faces at a weight we do not commit).
 *
 * The OS/2 fsType licence guard also lives here: embedding is REFUSED when
 * the face's fsType forbids it — fsType 0x0002 (restricted embedding: no
 * embedding at all) or the card-named 0x0100 bit (reserved-forbid per the
 * card). OFL faces carry fsType 0 (installable) — measured on both shipped
 * faces at build time — so the guard passes for our fonts and keeps any
 * future font swap lawful.
 */

import {fontFileForFamily, SHIPPED_FAMILIES} from './fontManifest';

export type FontBytes = {
  bytes: Uint8Array;
  /** the concrete family name the bytes carry (for shaper cache keys) */
  name: string;
  /** OS/2 fsType, read from the bytes (0 = installable embedding) */
  fsType: number;
  /** true when the face carries a wght variation axis (the variable twins) */
  variable: boolean;
};

/** The shaper/embed source for one (family, weight): the committed
 * <slug>-variable.ttf. The variable face covers EVERY painted weight —
 * one fetch per family, hb_font_set_variations instantiates. */
export async function committedFontBytes(family: string): Promise<FontBytes | null> {
  const file = fontFileForFamily(family);
  if (!file) return null;
  try {
    const r = await fetch(file);
    if (!r.ok) {
      console.error('[fontFiles] fetch failed:', file, r.status);
      return null;
    }
    const buf = new Uint8Array(await r.arrayBuffer());
    const parsed = parseFont(buf);
    if (!parsed) {
      console.error('[fontFiles] unparseable font bytes:', file);
      return null;
    }
    return {
      bytes: buf,
      name: parsed.family || file,
      fsType: parsed.fsType,
      variable: parsed.hasFvar,
    };
  } catch (e) {
    console.error('[fontFiles] fetch threw:', file, e);
    return null;
  }
}

/** The licence guard (§74, "implemented not assumed"): embedding a face whose
 *  fsType forbids it must REFUSE. Returns null when embedding is lawful, or
 *  the visible reason when it is not. */
export function embeddingRefusal(fsType: number): string | null {
  if ((fsType & 0x0002) !== 0) return 'font licence forbids embedding (fsType restricted)';
  if ((fsType & 0x0100) !== 0) return 'font licence forbids embedding (fsType 0x0100 bit)';
  return null;
}

/** The families this tree ships bytes for (the outline checkbox can never be
 *  a silent no-op for THESE). */
export const committedFamilies = SHIPPED_FAMILIES;

/* ---- minimal sfnt parsing (name + OS/2.fsType + fvar presence) ---------- */

type ParsedFont = {family: string | null; fsType: number; hasFvar: boolean};

function u16(b: Uint8Array, o: number): number { return (b[o] << 8) | b[o + 1]; }
function u32(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

/** A true sfnt: 0x00010000 (TrueType) or 'OTTO' (CFF). woff2 starts 'wOF2'
 *  and is NOT accepted — the shaper takes raw OpenType only. */
export function parseFont(b: Uint8Array): ParsedFont | null {
  if (b.length < 12) return null;
  const sig = u32(b, 0);
  if (sig !== 0x00010000 && sig !== 0x4F54544F) return null; /* not sfnt */
  const numTables = u16(b, 4);
  let fsType = 0;
  let hasFvar = false;
  let family: string | null = null;
  for (let i = 0; i < numTables; i++) {
    const off = 12 + 16 * i;
    if (off + 16 > b.length) break;
    const tag = String.fromCharCode(b[off], b[off + 1], b[off + 2], b[off + 3]);
    const tOff = u32(b, off + 8);
    const tLen = u32(b, off + 12);
    if (tag === 'OS/2' && tOff + 8 <= b.length) fsType = u16(b, tOff + 8); /* fsType at offset 8 */
    else if (tag === 'fvar') hasFvar = true;
    else if (tag === 'name') family = readNameFamily(b, tOff, tLen);
  }
  return {family, fsType, hasFvar};
}

/** name table: family = nameID 1 (Windows platform preferred). */
function readNameFamily(b: Uint8Array, tOff: number, tLen: number): string | null {
  try {
    const count = u16(b, tOff + 2);
    const strOff = tOff + u16(b, tOff + 4);
    let best: string | null = null;
    for (let i = 0; i < count; i++) {
      const rec = tOff + 6 + 12 * i;
      if (rec + 12 > tOff + tLen) break;
      const platform = u16(b, rec);
      const nameID = u16(b, rec + 6);
      const length = u16(b, rec + 8);
      const offset = u16(b, rec + 10);
      if (nameID !== 1) continue;
      const s = platform === 3 /* windows: UTF-16BE */
        ? Array.from({length: length >> 1}, (_, k) =>
            String.fromCharCode((b[strOff + offset + k * 2] << 8) | b[strOff + offset + k * 2 + 1])).join('')
        : Array.from({length}, (_, k) => String.fromCharCode(b[strOff + offset + k])).join('');
      if (platform === 3) { best = s; break; } /* prefer windows records */
      if (!best) best = s;
    }
    return best;
  } catch {
    return null;
  }
}
