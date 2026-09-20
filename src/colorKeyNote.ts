/**
 * ROUND AD, ITEM 5(a) — THE COLOUR KEY'S LABEL, AND ITS DISMISSAL.
 *
 * Harvey kept the editor's semantic colour grouping (Option B) on the record —
 * "tôi muốn thiết kế theo ý tôi trước, đó là điểm khác biệt" — with ONE condition:
 * the key has to say on screen that it is THIS editor's grouping and NOT an ISO
 * convention, because no standard colour scheme exists to appeal to. The
 * research proved that rather than assuming it: draw.io's flowchart stencil
 * carries zero `fillColor` entries, Mermaid has one `nodeBkg` for every node,
 * Miro has one global palette with no shape mapping. So the grouping is
 * legitimate and the word "standard" is not.
 *
 * WHERE IT LIVES. In the inspector, directly under the `color` swatch row —
 * the control the key is a claim about. NOT a `title` attribute: a tooltip is
 * invisible on touch, and this project treats tablet and phone as in scope
 * (the same reasoning that made `.fav-remove` permanently visible rather than
 * hover-only).
 *
 * DISMISSIBLE, PERSISTENTLY, AND THE DISMISSAL FOLLOWS THE ESTABLISHED
 * CONVENTION — this is not a new mechanism. `src/marqueeMode.ts`
 * (`diagram-studio:marquee`), `src/choreography.ts` (`:animate`,
 * `:hover-highlight`), `src/theme.ts` (`:theme`), `src/categoryState.ts`
 * (`:categories`), `src/panelCollapse.ts` (`:panels`) and
 * `src/inspectorState.ts` (`:inspector-sections`) all use ONE namespaced
 * `diagram-studio:*` key, a lazy `useState` initialiser that never throws when
 * storage is unavailable, a TOLERANT parse, and a `try`/`catch` on write. This
 * file is that same shape for a boolean.
 *
 * THE NO-WRITE DEFAULT IS "SHOW". An absent key, an unreadable key and a key
 * holding anything but '0' all resolve to `true`, so the label appears for a
 * user who has never dismissed it and the first run never writes storage.
 */

/** ONE namespaced key, matching MARQUEE_KEY / ANIMATE_KEY / CATEGORIES_KEY. */
export const KEY_NOTE_KEY = 'diagram-studio:colour-key-note';

/** The label's text. Kept here rather than in the JSX so the panel, a test and
 *  the report all read the SAME string.
 *
 *  ROUND AG2, ITEM 2 — "Color", the American spelling, in the VISIBLE TEXT only.
 *  The app mixed `Colour` and `Color`; Harvey chose one ("Chọn 1 (Color) thôi").
 *  The MODULE NAME and every identifier in this file keep the British spelling on
 *  purpose, and `KEY_NOTE_KEY` below MUST: it is a persisted localStorage key, so
 *  renaming it would make an already-dismissed note reappear for every user who
 *  has dismissed it. Only the string a user reads changes.
 *
 *  MEASURED, not guessed: this is 30 characters and 216.0px in the panel's own
 *  mono face at the `.hint` rule's 12px (`scripts/measure-key-note.py`, reading
 *  the real `public/fonts/jetbrains-mono-400-latin.woff2` — 7.20px per ASCII
 *  glyph). The panel's content box is 256px at the desktop tier, less the 16px
 *  dismiss button and its 6px gap, so there are 234px — the string fits on ONE
 *  line with 18px to spare, four characters shorter than the British form it
 *  replaces (`Colour = …`, 223.2px), so the rename shortens the note rather than
 *  moving its wrap. `This editor's grouping, not ISO.` is 230.4px, which leaves
 *  3.6px and is the next honest stop. */
export const KEY_NOTE_TEXT = 'Color = our grouping, not ISO.';

/** Tolerant parse: only the two strings this module writes are meaning, and
 *  every other value — including the empty string and a retired name — means
 *  SHOW, so a hand-edited key can never make the note silently absent. */
export function parseKeyNote(raw: string | null): boolean {
  return raw !== '0';
}

export function loadKeyNote(): boolean {
  try {
    return parseKeyNote(localStorage.getItem(KEY_NOTE_KEY));
  } catch {
    // private mode / storage disabled — the note still shows, it just forgets
    return true;
  }
}

export function saveKeyNote(shown: boolean): void {
  try {
    localStorage.setItem(KEY_NOTE_KEY, shown ? '1' : '0');
  } catch { /* storage full or disabled — the choice still holds this session */ }
}
