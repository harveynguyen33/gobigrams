/* ROUND GOBI-S1 — the share-link document types. The payload carries the SAME
 * BoardDoc the app door and the .gobi compiler produce (spec §3.3: "One
 * payload format… the link never carries .gobi source, only compiled JSON").
 * Import type-only: this module is part of the PURE codec cone (harness S1b)
 * and must not drag app code in. */
import type {BoardDoc} from '../boards';

/** The one format version this build writes. Bumped only on a breaking
 *  payload change; unknown tags decode to a refusal (S3), never a throw. */
export const SHARE_VERSION = 'G1';

/** Refusal reasons are machine-stable so a caller can branch on them. */
export type ShareRefusal =
  | 'empty'          // not a share payload at all
  | 'format'         // no tag~body shape
  | 'version'        // tag is not one this build understands
  | 'encoding'       // body is not valid base64url
  | 'corrupt';       // valid shape, but the bytes do not decode to a doc

export type ShareEncode = {payload: string; version: string};
export type ShareDecode =
  | {ok: true; board: BoardDoc; version: string}
  | {ok: false; reason: ShareRefusal};
