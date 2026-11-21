/* ROUND GOBI-TEXT — the language's TEXT-ALIGNMENT vocabulary (SPEC §2.9).
 *
 * WHY IT IS DERIVED AND NOT LISTED. `src/textStyle.ts` is the app's ONE text
 * model: it owns `TextStyle.align` / `.vAlign` and the two option tables
 * (`TEXT_ALIGN_OPTS` / `TEXT_VALIGN_OPTS`) the inspector's segmented rows
 * render from. A hand-written list here could offer a word the canvas cannot
 * paint — or hide one it can — which is the same closed-world defect ROUND
 * GOBI-LOCK closed for kinds: the language only says what the app renders. So
 * the two arrays below ARE those tables, mapped to their values, and
 * checks/round-gobi-text.mjs asserts they are equal sets.
 *
 * THE DEFAULT IS THE LANGUAGE'S OWN, AND IT IS NOT THE APP'S.
 * FIRST-VISIT (2026-11-01): `alignForBody('card')` is now `center` — the
 * canvas centred the card body the same day — so the compiler's explicit
 * `align: 'center'` write is now redundant for fresh nodes but still correct
 * (it travels in `data.textStyle`, and `align:left` remains the opt-out).
 * History: when this file landed, the canvas no-write value for a card was
 * `left`, and Harvey asked for a text-authored diagram to come out CENTRED
 * without saying so on every line ("liệu các chữ center đc ko"), so the
 * compiler WRITES `align: 'center'` while the palette drag path stayed left.
 *
 * ROUND GOBI-TEXT3 — `vAlign` NOW HAS A LANGUAGE DEFAULT TOO: `middle`
 * (`GOBI_VALIGN_DEFAULT`). Harvey, looking at the render: "chữ chỉ đang ở top
 * center, có thể để chữ ở middle in vertical được không". The APP's per-target
 * no-write value (`vAlignForBody` — top on a card) is NOT touched: the compiler
 * WRITES `vAlign:'middle'` onto every node it builds, so the value travels in
 * `data.textStyle`, the canvas paints it through `textStyleVars` and the PNG
 * paints it through the scene's own placement (src/export/textVAlign.ts). One
 * stored value, two painters — that is what makes them agree; changing
 * `vAlignForBody` instead would have repainted every existing board.
 * `valign:top` / `valign:bottom` remain the opt-outs.
 *
 * A leaf module on purpose: the parser and the compiler both read it, and it
 * imports nothing but the text model. */

import {
  TEXT_ALIGN_OPTS, TEXT_VALIGN_OPTS,
  type TextStyle, type TextAlign, type TextVAlign,
} from './model/textStyle';

/** The `align:` values — the sheet's own three, in the inspector's order. */
export const GOBI_ALIGN_VALUES: string[] = TEXT_ALIGN_OPTS.map((o) => o.v);

/** The `valign:` values — likewise (top / middle / bottom). */
export const GOBI_VALIGN_VALUES: string[] = TEXT_VALIGN_OPTS.map((o) => o.v);

/** The align a `.gobi` node gets when the document says nothing (Harvey's ask). */
export const GOBI_ALIGN_DEFAULT: TextAlign = 'center';

/** The vertical align a `.gobi` node gets when the document says nothing —
 *  ROUND GOBI-TEXT3, Harvey's ask: the text sits in the MIDDLE of the box. */
export const GOBI_VALIGN_DEFAULT: TextVAlign = 'middle';

/* GOBI-TEXT-FIT (R3) — the `body:` vocabulary. The app's model names the two
 * layouts 'card' | 'label-only' (src/textStyle.ts, DiagramNode); the
 * language's word for the simple one is `simple` — the word Harvey used
 * ("simple tôi nhớ mình có option đó nữa"). Closed world like align/valign:
 * the parser refuses anything else with a suggestion at the token. */
export const GOBI_BODY_VALUES: string[] = ['card', 'simple'];

/** The language word → the model's own body value (`simple` IS `label-only`). */
export function gobiBodyOf(v: string | undefined): 'card' | 'label-only' | undefined {
  return v === 'card' ? 'card' : v === 'simple' ? 'label-only' : undefined;
}

/** Node attributes → the ONE `TextStyle` the compiler stores on `data`.
 *  Values are validated by the PARSER (it holds the token, so it can point at
 *  the offending word); this function is the write, not a second gate. */
export function gobiTextStyle(attrs: {align?: string; valign?: string}): TextStyle {
  const style: TextStyle = {
    align: (attrs.align as TextAlign | undefined) ?? GOBI_ALIGN_DEFAULT,
    vAlign: (attrs.valign as TextVAlign | undefined) ?? GOBI_VALIGN_DEFAULT,
  };
  return style;
}
