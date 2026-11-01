/* ROUND GOBI-S1 — the share-link codec. A whole board travels in the URL
 * fragment (never the query, never a server): JSON → deflate-raw → base64url,
 * prefixed "G1~" so an unknown future format can be refused by tag (S3).
 *
 * FORMAT (v1, pinned by checks/round-gobi-share.mjs S2d):
 *   G1~  base64url(deflate-raw(JSON.stringify(doc)))   — the shipped form
 *   S1u~ base64url(JSON.stringify(doc))                — stored fallback for
 *        hosts without CompressionStream; same decoder, same tag scheme.
 * No wrapper object: the JSON is the BoardDoc itself, so a decode that
 * succeeds yields the document with zero reshaping.
 *
 * PURITY (harness S1b): no DOM writes, no React, no app imports beyond the
 * BoardDoc TYPE. Node 22 and every target browser expose
 * CompressionStream('deflate-raw'). No new deps. Both entry points are async
 * (the two real callers — the Share door and the view route — are async by
 * nature), so there is no synchronous half-format to keep honest. */
import type {BoardDoc} from '../boards';
import {SHARE_VERSION, type ShareDecode, type ShareEncode, type ShareRefusal} from './shareTypes';

/** The uncompressed escape hatch: same scheme, 'u' marks no deflate. */
const STORED_VERSION = 'S1u';
const isTag = (t: string) => t === SHARE_VERSION || t === STORED_VERSION;

/* ---- base64url (hand-rolled byte math, no deps) --------------------------- */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
let REV: number[] | null = null;
const rev64 = (): number[] => {
  const t = new Array<number>(128).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
};

export const bytesToB64url = (b: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
      + (i + 1 < b.length ? B64[(n >> 6) & 63] : '') + (i + 2 < b.length ? B64[n & 63] : '');
  }
  return s;
};

export const b64urlToBytes = (s: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  if (REV === null) REV = rev64();
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 4) {
    const v = [REV[s.charCodeAt(i)], REV[s.charCodeAt(i + 1)] ?? -1,
      REV[s.charCodeAt(i + 2)] ?? -1, REV[s.charCodeAt(i + 3)] ?? -1];
    if (v[0] < 0 || v[1] < 0) return null;
    const n = (v[0] << 18) | (v[1] << 12) | ((v[2] > 0 ? v[2] : 0) << 6) | (v[3] > 0 ? v[3] : 0);
    out.push((n >> 16) & 255);
    if (v[2] >= 0) out.push((n >> 8) & 255);
    if (v[3] >= 0) out.push(n & 255);
  }
  return new Uint8Array(out);
};

/* ---- (de)flation through the standard streams ---------------------------- */
type CS = new (f: string) => {readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array>};
const hasStreams = (): boolean =>
  typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

/** bytes → (de)compression stream → bytes. ALL stream errors are consumed
 *  here (writer.close() is awaited; the reader loop never outlives a failed
 *  pipe) — Node's webstreams adapter otherwise raises an UNCAUGHT error from
 *  its internal zlib bridge for a corrupt deflate stream, which kills the
 *  process no matter what the caller catches. Callers get a rejection and
 *  translate it to a refusal. */
async function pipe(bytes: Uint8Array, CS: CS, format: string): Promise<Uint8Array> {
  const s = new CS(format);
  const writer = s.writable.getWriter();
  const written = writer.write(bytes).catch(() => {});
  const closed = writer.close().catch(() => {});
  try {
    const parts: Uint8Array[] = [];
    const rd = s.readable.getReader();
    for (;;) {
      const {done, value} = await rd.read();
      if (done) break;
      parts.push(value);
    }
    await Promise.all([written, closed]);
    let n = 0;
    for (const p of parts) n += p.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  } catch (e) {
    /* cancel the source so the adapter's internal error is CONSUMED, then
       re-reject to the caller as a normal rejection. */
    await Promise.allSettled([written, closed]);
    throw e;
  }
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Encode a board doc to the payload string (no URL, no #b=). */
export async function encodeShare(doc: BoardDoc): Promise<ShareEncode> {
  const json = enc.encode(JSON.stringify(doc));
  if (hasStreams()) {
    try {
      const deflated = await pipe(json, CompressionStream as unknown as CS, 'deflate-raw');
      if (deflated.length < json.length) {
        return {payload: `${SHARE_VERSION}~${bytesToB64url(deflated)}`, version: SHARE_VERSION};
      }
    } catch { /* fall through to stored */ }
  }
  return {payload: `${STORED_VERSION}~${bytesToB64url(json)}`, version: STORED_VERSION};
}

/** Minimal structural check before a decoded object reaches the canvas: a
 *  share link IS a render path, so a payload that decodes to something that is
 *  not board-shaped is a refusal, never a partial doc. */
const looksLikeBoard = (v: unknown): v is BoardDoc => {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.name === 'string'
    && Array.isArray(o.nodes) && Array.isArray(o.edges);
};

export async function decodeShare(payload: string): Promise<ShareDecode> {
  const refuse = (reason: ShareRefusal): ShareDecode => ({ok: false, reason});
  if (!payload) return refuse('empty');
  const tilde = payload.indexOf('~');
  if (tilde < 1) return refuse('format');
  const tag = payload.slice(0, tilde);
  if (!isTag(tag)) return refuse('version');
  const bytes = b64urlToBytes(payload.slice(tilde + 1));
  if (bytes === null) return refuse('encoding');
  let json = bytes;
  if (tag === SHARE_VERSION) {
    try {
      json = await pipe(bytes, DecompressionStream as unknown as CS, 'deflate-raw');
    } catch { return refuse('corrupt'); }
  }
  try {
    const doc = JSON.parse(dec.decode(json));
    return looksLikeBoard(doc) ? {ok: true, board: doc, version: tag} : refuse('corrupt');
  } catch { return refuse('corrupt'); }
}
