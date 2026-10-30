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
 * `alignForBody('card')` is `left` — the canvas's no-write value for a card —
 * and that stays true for the palette drag path, which is a different surface
 * and out of scope. A `.gobi` document is a different author: Harvey asked for
 * a text-authored diagram to come out CENTRED without saying so on every line
 * ("liệu các chữ center đc ko"), so the compiler WRITES `align: 'center'` and
 * `align:left` is the opt-out. `vAlign` deliberately has no language default:
 * the app's per-target no-write value (`vAlignForBody` — top on a card, middle
 * on a label-only node) is already right for every box, so absence is the
 * honest default and `valign:` only overrides it.
 *
 * A leaf module on purpose: the parser and the compiler both read it, and it
 * imports nothing but the text model. */

import {
  TEXT_ALIGN_OPTS, TEXT_VALIGN_OPTS,
  type TextStyle, type TextAlign, type TextVAlign,
} from '../textStyle';

/** The `align:` values — the sheet's own three, in the inspector's order. */
export const GOBI_ALIGN_VALUES: string[] = TEXT_ALIGN_OPTS.map((o) => o.v);

/** The `valign:` values — likewise (top / middle / bottom). */
export const GOBI_VALIGN_VALUES: string[] = TEXT_VALIGN_OPTS.map((o) => o.v);

/** The align a `.gobi` node gets when the document says nothing (Harvey's ask). */
export const GOBI_ALIGN_DEFAULT: TextAlign = 'center';

/** Node attributes → the ONE `TextStyle` the compiler stores on `data`.
 *  Values are validated by the PARSER (it holds the token, so it can point at
 *  the offending word); this function is the write, not a second gate. */
export function gobiTextStyle(attrs: {align?: string; valign?: string}): TextStyle {
  const style: TextStyle = {
    align: (attrs.align as TextAlign | undefined) ?? GOBI_ALIGN_DEFAULT,
  };
  if (attrs.valign) style.vAlign = attrs.valign as TextVAlign;
  return style;
}
