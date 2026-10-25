/* feature-map home: src/BoardDialog.tsx */
/* ITEM 6b (2026-09-18) — THE BOARD DIALOG: create / rename / delete as ONE
 * designed component, replacing three `window.prompt` / `window.confirm` calls.
 *
 * Harvey: "khi tạo thì nó chỉ prompt thôi xấu quá. Tôi muốn các đoạn prompt được
 * design lại cho đẹp UI/UX."
 *
 * WHY ONE COMPONENT. The three flows share everything except their body: a
 * scrim, a card, one field, a button row, Escape-to-cancel, a focus trap and
 * focus restore. Three components would have tripled the trap logic.
 *
 * THE VISUAL VOCABULARY IS THE APP'S OWN, not a new one:
 *   - `.sp-overlay` + `.sp-card` are the search palette's scrim and card, reused
 *     verbatim; `.bd-card` only narrows the width.
 *   - `.sp-input` is the palette's field, reused for the name box.
 *   - the `FOCUSABLE` selector and the `returnFocusTo` contract are Settings.tsx's
 *     (imported, not copied) so there is exactly ONE definition of "focusable"
 *     and one focus-restore behaviour in the app.
 *   - colour is TOKENS ONLY: `--surface` / `--border-strong` / `--sel` / `--acc`
 *     / `--danger` / `--shadow-pop`. No literal colour appears in this file.
 *
 * KEYBOARD. Escape cancels. Enter in the one field submits (a one-field dialog
 * should never need a trip to the mouse). Tab is trapped inside the card and
 * cannot reach the app behind it. The App-level keydown handler carries a matching
 * guard so app shortcuts are inert while this is open — and its `isEditable`
 * early-return sits ABOVE every guard, so typing in the name field is never
 * swallowed.
 *
 * The dialog is stateless with respect to the board: it reports a result and the
 * caller performs the work. That keeps every board mutation in App.tsx, where
 * `flushSave` / `pushHistory` / the boards API already live.
 *
 * ---------------------------------------------------------------------------
 * ROUND 4, ITEM 1 (2026-09-20) — THE CREATE BODY IS TWO ROWS.
 *
 * Harvey, verbatim: "Tôi muốn khi click vào create new board, nó sẽ chỉ hiển thị
 * 2 options: 1. Blank như đang có 2. Use template => click vào show template
 * popup". The create body renders exactly two rows; the seeded-template listing
 * the dialog used to carry (8 radios + 5 non-focusable group headers) is gone
 * from this file and from the catalog: `TemplatesGallery.tsx` is the ONE UI
 * reader of the catalog.
 *
 * ---------------------------------------------------------------------------
 * ROUND 6, ITEMS 1 + 2 (2026-09-20) — TWO PEER ACTION ROWS, NO RADIO AT ALL.
 *
 * Harvey, verbatim: "cả 2 option phải đồng bộ (nên theo Use template) chứ k phải
 * cái đầu Blank thì có radio button" and "cả 2 nên có khoảng cách thay vì sát
 * nhau."
 *
 * ROUND 4 shipped ONE radio (`Blank`, a tick ring plus a selected border and a
 * roving tabindex) beside ONE action row (`Use template`, a dashed accent row).
 * Two rows that do the SAME kind of thing — they each close this dialog and start
 * a board — were drawn in two visual languages, and only one of them was a
 * button the user could simply press. This round deletes the radio model
 * outright: no `role="radiogroup"`, no `role="radio"`, no tick, no selected
 * state, no roving tabindex, no arrow/Home/End walk. There are two `bd-row`
 * buttons, the `Use template` treatment on both:
 *
 *   1. `Blank`         — creates a blank board IMMEDIATELY, named with what is in
 *                        the field (an empty field asks for the auto-numbered
 *                        default; the rule is the pure `resolveBoardName`).
 *   2. `Use template`  — closes this dialog and opens the gallery, CARRYING the
 *                        typed name with it (ITEM 3's fix; see the prop's note).
 *
 * WHY THERE IS NO THIRD CONTROL TO SUBMIT WITH. Once both rows act on press,
 * the footer's primary "Create board" button has nothing left to submit in
 * CREATE mode, so it is not rendered there — Cancel is the whole footer. The
 * RENAME (`Save name`) and DELETE (`Delete board`) buttons are unchanged: those
 * bodies really are a field plus a submit.
 *
 * ACCESSIBILITY. Both rows are real `<button>`s with a real accessible name, so a
 * keyboard user Tabs to them and Enter activates them. There is no selection to
 * announce, which is why there is no `aria-checked` anywhere in this file.
 *
 * The hint sub-lines (`blank canvas · mixed notation` / `opens the template
 * gallery`) are kept deliberately: with two identically-drawn buttons they are
 * the only thing telling the user what each one does.
 *
 * REMOVED WITH THIS ROUND (genuinely dead, not deferred): the `pick` state, the
 * `opts` array and the `hasPick` predicate the walk indexed, `optRefs`, `pickAt`,
 * `onOptKey`, and the `StartRow` type. Nothing read any of them once the radio
 * went. What replaced `START_ROWS` is `CREATE_ROWS` — the two rows' TEXT, still a
 * single data edit to add a third action, with the per-row behaviour chosen by
 * its `key`.
 * ---------------------------------------------------------------------------
 */
import {useEffect, useMemo, useRef, useState} from 'react';
import {X} from 'lucide-react';
import type {PresetId} from './presets';
import {FOCUSABLE} from './Settings';

export type BoardDialogMode = 'create' | 'rename' | 'delete';

/** What the dialog hands back. `templateId: null` is the explicit
 *  "start empty" choice — a real option, not a fallback. ROUND 6: this dialog can
 *  only ever produce `null` (Blank), because it no longer lists templates. The
 *  field is KEPT as part of the result contract — App.tsx's create branch and the
 *  data-contract harness still name it, and the seeded form is the gallery's. */
export type BoardDialogResult =
  | {kind: 'create'; name: string; seed: {preset: PresetId; templateId: string} | null}
  | {kind: 'rename'; name: string}
  | {kind: 'delete'};

type Props = {
  mode: BoardDialogMode;
  /** The CURRENT board's name: the rename field's start value, and the subject of
   *  the delete confirmation. Ignored by `create`. */
  boardName: string;
  onCancel: () => void;
  onSubmit: (r: BoardDialogResult) => void;
  /** Focus restore, Settings.tsx's contract: on close, `.current?.focus()`. */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
  /** ROUND 3 — the create field's START VALUE, computed by the CALLER from the
   *  live board list (via the pure `nextUntitledName` in `src/boards.ts`). The
   *  dialog deliberately does NOT compute it: it must not need the board list,
   *  and the auto-numbering rule has exactly ONE home — a pure, probed function.
   *  Ignored by `rename`, which starts from the live `boardName`. A caller that
   *  passes nothing gets the old literal `'Untitled'`. */
  defaultName?: string;
  /** PACKAGE-TEMPLATES §2.5 Pass 2 — the route into the template gallery,
   *  rendered as the create body's second row.
   *
   *  ROUND 4 gave the row no arguments and no state: it was a navigation, not a
   *  choice. ROUND 6, ITEM 3 makes it carry the TYPED NAME, which is a defect fix:
   *  Harvey typed a name, pressed this row, and the board came out `Untitled N`
   *  ("khi đổi tên và ấn chọn use template => thì nó lại ra là untitled X chứ k
   *  phải tên đã ghi trong New board"). The name leaves the dialog HERE — as an
   *  argument, so the caller can hold it across the gallery hop — because this
   *  is the last moment the dialog exists.
   *
   *  It is STILL not a board-creation path: the row opens the gallery and the
   *  gallery's pick creates the board, so board creation keeps its single owner
   *  (`createFromTemplate`). The name it carries is a value, not a second
   *  creation route. */
  onBrowse?: (name: string) => void;
};

/** ROUND 6, ITEM 1 — THE CREATE BODY'S TWO PEER ACTIONS.
 *
 *  Kept as DATA, not as two hand-written buttons, so "the body offers exactly two
 *  actions" is a fact the source states once and a harness can count. Both rows
 *  render the same `bd-row` markup; `key` is the only thing that differs, and it
 *  is what `submit` / `onBrowse` branch on. `blank` is FIRST because it is the
 *  zero-setup route. */
type CreateRow = {key: 'blank' | 'browse'; name: string; hint: string};
const CREATE_ROWS: CreateRow[] = [
  {key: 'blank', name: 'Blank', hint: 'blank canvas · mixed notation'},
  {key: 'browse', name: 'Use template', hint: 'opens the template gallery'},
];

export default function BoardDialog({mode, boardName, onCancel, onSubmit, returnFocusTo, defaultName, onBrowse}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // `create` starts from the CALLER's default (ROUND 3 — auto-numbered from the
  // board list, so pressing Create without typing never collides with an
  // existing board; `'Untitled'` remains the fallback for a caller that passes
  // nothing); `rename` starts from the live name. Both are SELECTED, so the
  // first keystroke replaces.
  const [name, setName] = useState(mode === 'create' ? (defaultName ?? 'Untitled') : boardName);

  /* ROUND 6, ITEM 1 — the only rows the create body can offer. `browse` needs a
     destination, so a caller that passes no `onBrowse` gets the `blank` row
     alone rather than a button that goes nowhere. */
  const createRows = useMemo(
    () => (onBrowse ? CREATE_ROWS : CREATE_ROWS.filter(r => r.key === 'blank')),
    [onBrowse],
  );

  const trimmed = name.trim();
  /* ROUND 6, ITEM 1 — only RENAME is still gated on a name, because only rename
     still has a submit button to gate. CREATE's rows act on press: an empty field
     there is how the user asks for the auto-numbered default, so gating it would
     make the Blank row silently inert — the defect this line's old form would
     have introduced. DELETE carries no name at all. */
  const needsName = mode === 'rename';
  const canSubmit = !needsName || trimmed.length > 0;

  // Keep the latest handlers for the document listener without re-binding it.
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  const submit = () => {
    if (!canSubmit) return;
    if (mode === 'create') {
      /* ROUND 6 — the Blank row's action, and the Enter-key equivalent. The
         dialog resolves NO template, so its create result carries an explicit
         `seed: null` ("Blank"); the gallery is the ONE surface that resolves a
         `${preset}:${templateId}` pair. An EMPTY name is passed on as empty
         rather than substituted here: `resolveBoardName` in `src/boards.ts` is
         the single owner of "a typed name wins, otherwise auto-number". */
      submitRef.current({kind: 'create', name: trimmed, seed: null});
      return;
    }
    if (mode === 'rename') { submitRef.current({kind: 'rename', name: trimmed}); return; }
    submitRef.current({kind: 'delete'});
  };

  /* Escape (capture + stopPropagation, exactly as Settings.tsx does it) and the
     Tab focus trap. Capture is what stops App's global handler from ALSO acting
     on the same key; App carries a second guard of its own. */
  useEffect(() => {
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancelRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const card = cardRef.current;
      if (!card) return;
      const els = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null || el === document.activeElement);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = active ? card.contains(active) : false;
      if (e.shiftKey) {
        if (!inside || active === first) { e.preventDefault(); last.focus(); }
      } else if (!inside || active === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onDocKey, true);
    return () => document.removeEventListener('keydown', onDocKey, true);
  }, []);

  /* Autofocus + select once the card is painted (Settings' setTimeout pattern).
     `delete` has no field, so it focuses the CARD — a dialog with no focus inside
     it would leave the caret on the control behind the scrim, and Tab would walk
     that control's siblings instead of the dialog's. */
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
      else cardRef.current?.focus();
    }, 10);
    return () => window.clearTimeout(t);
  }, []);

  // Focus restore: hand the caret back to the control that opened us.
  useEffect(() => () => { returnFocusTo?.current?.focus(); }, [returnFocusTo]);

  const title = mode === 'create' ? 'New board' : mode === 'rename' ? 'Rename board' : 'Delete board';

  const sub = useMemo(() => {
    if (mode === 'create') return 'Name it, then start blank — or use a template.';
    if (mode === 'rename') return 'The file name on disk changes with it.';
    return 'This cannot be undone. The board’s JSON file is deleted from disk.';
  }, [mode]);

  return (
    <div
      className="sp-overlay bd-overlay"
      data-board-dialog={mode}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        ref={cardRef}
        className="sp-card bd-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bd-title"
        tabIndex={-1}
      >
        <div className="bd-head">
          <div>
            <h2 className="bd-title" id="bd-title">{title}</h2>
            <p className="bd-sub">{sub}</p>
          </div>
          <button type="button" className="bd-x" aria-label="Cancel" onClick={onCancel}><X size={14} /></button>
        </div>

        {mode === 'delete' ? (
          <div className="bd-body">
            <div className="bd-danger-note">
              Delete board <b>“{boardName}”</b>?
            </div>
          </div>
        ) : (
          <div className="bd-body">
            <label className="bd-label" htmlFor="bd-name">name</label>
            <input
              id="bd-name"
              ref={inputRef}
              className="sp-input"
              type="text"
              value={name}
              spellCheck={false}
              autoComplete="off"
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
            />

            {mode === 'create' && (
              <>
                <div className="bd-label bd-label-gap">start from</div>
                {/* ROUND 6, ITEM 1 — TWO PEER ACTION ROWS, ONE CLASS, NO RADIO.
                    Neither row is a state: pressing either one leaves this
                    surface (one starts a blank board, the other opens the
                    gallery), so there is nothing to select, nothing to announce
                    with `role="radio"` / `aria-checked`, and no arrow-key walk to
                    run. They are ordinary buttons: Tab reaches them and Enter
                    presses them. */}
                <div className="bd-list">
                  {createRows.map(row => (
                    <button
                      key={row.key}
                      type="button"
                      className="bd-row"
                      onClick={() => (row.key === 'browse' ? onBrowse?.(trimmed) : submit())}
                    >
                      <span className="bd-row-text">
                        <span className="bd-row-name">{row.name}</span>
                        <span className="bd-row-hint">{row.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ROUND 6, ITEM 1 — CREATE mode has no submit button: both of its rows
            act on press, so a primary button would be dead UI. Cancel is the
            whole footer there. RENAME and DELETE keep theirs unchanged — those
            bodies really are a field/confirm plus a submit. Cancel stays FIRST in
            DOM order for every mode, which on the destructive dialog is what
            keeps the safe choice the one a keyboard user reaches first. */}
        <div className="bd-actions">
          <button type="button" className="bd-btn" onClick={onCancel}>Cancel</button>
          {mode === 'delete' && (
            <button type="button" className="bd-btn danger" onClick={submit}>
              Delete board
            </button>
          )}
          {mode === 'rename' && (
            <button type="button" className="bd-btn primary" disabled={!canSubmit} onClick={submit}>
              Save name
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
