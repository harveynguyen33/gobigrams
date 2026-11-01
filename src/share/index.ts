/* ROUND GOBI-S1 — the share-link module's public entry (spec §4.1's naming
 * law: one index the doors import). The codec is PURE (no DOM writes, no
 * React); the URL helpers below only READ location, so Node harnesses can
 * still import this file wholesale. */
import type {BoardDoc} from '../boards';
import {SHARE_VERSION, type ShareDecode, type ShareEncode} from './shareTypes';
import {encodeShare, decodeShare} from './shareCodec';

export {SHARE_VERSION};
export {encodeShare, decodeShare};
export {bytesToB64url, b64urlToBytes} from './shareCodec';
export type {ShareDecode, ShareEncode, ShareRefusal} from './shareTypes';

/** The fragment key a shared link uses. */
export const SHARE_KEY = 'b';

/** The ONE home of the prod host (harness S5d): logic below never spells the
 *  domain again. `typeof location` guards Node imports of this module. */
export const SHARE_BASE_URL =
  typeof location !== 'undefined' && location.origin.includes('gobigrams.tech-goblin.com')
    ? 'https://gobigrams.tech-goblin.com/'
    : (typeof location !== 'undefined' ? location.origin + '/' : '');

/** Build the full share URL for a board doc. */
export async function buildShareUrl(doc: BoardDoc): Promise<ShareEncode & {url: string}> {
  const e = await encodeShare(doc);
  return {...e, url: `${SHARE_BASE_URL}#b=${e.payload}`};
}
