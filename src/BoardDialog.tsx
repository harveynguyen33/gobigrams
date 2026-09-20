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
 * popup". Until this round the create body rendered every catalog template,
 * grouped by family and level (8 radios + 5 non-focusable group headers). It now
 * renders exactly two rows:
 *   1. `Blank` — the row that used to read "Start empty" (`custom` preset, no
 *      seed). It is the group's radio, selected by default, and its single Tab
 *      stop.
 *   2. `Use template` — an ACTION ROW, which opens the gallery through
 *      `onBrowse` (the prop PACKAGE-TEMPLATES §2.5 added for exactly this route).
 *
 * WHY AN ACTION ROW AND NOT A RADIO. A radiogroup is a set of mutually exclusive
 * STATES with a persistent selection; "Use template" has no state. It is a
 * navigation that closes this dialog and opens the gallery, so a radio for it
 * would announce "2 of 2" for a control that leaves the surface, and it would put
 * the roving Tab stop on a row that is about to unmount. This project already
 * ruled on exactly this shape: the `.bd-browse` row is documented as "NOT A RADIO
 * AND MUST NOT BE ONE" (§2.5 Pass 2). This round promotes that row to the second
 * half of the two-row body and renames it "Use template".
 *
 * The group therefore keeps ONE `role="radiogroup"`, the roving tabindex
 * (`tabIndex={(on || (!hasPick && i === 0)) ? 0 : -1}`) and the arrow / Home / End
 * walk over `opts`, exactly as before. With a single row the walk is clamped —
 * the contract is what is kept, and a future second starting option is a one-line
 * addition to `START_ROWS`.
 *
 * REMOVED WITH THIS ROUND (genuinely dead, not deferred): the `const TEMPLATES`
 * flattening loops over `PRESETS`, `optKey`, the `Row` union's `header` kind,
 * `catRows`, the `.bd-hd` header markup (and its stylesheet rule), and the
 * `initialPick` prop. The last one had no producer left after ROUND 3 (the
 * gallery creates the board itself), so the prop and App.tsx's `boardPick` state
 * went with it. The dialog no longer imports `templateCatalog` or `PRESETS`:
 * `TemplatesGallery.tsx` is the ONE UI reader of the catalog.
 * ---------------------------------------------------------------------------
 */
import {useEffect, useMemo, useRef, useState} from 'react';
import {X} from 'lucide-react';
import type {PresetId} from './presets';
import {FOCUSABLE} from './Settings';

export type BoardDialogMode = 'create' | 'rename' | 'delete';

/** What the dialog hands back. `templateId: null` is the explicit
 *  "start empty" choice — a real option, not a fallback. ROUND 4: this dialog can
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
  /** PACKAGE-TEMPLATES §2.5 Pass 2, RENAMED BY ROUND 4 — the route into the
   *  template gallery, rendered as the body's second row. The row is deliberately
   *  NOT a radio: it carries no `role` and no `tabIndex`, so it never enters
   *  `opts` and the roving walk can never land on it or count it as a choice. It
   *  is a second ROUTE to the gallery, never a second board-creation path — the
   *  gallery resolves the template and creates the board itself (ROUND 3). */
  onBrowse?: () => void;
};

/** ROUND 4 — THE STARTING POINT. ONE radio today (`Blank`), and the walk below is
 *  written over this array rather than against a literal so a second option is a
 *  data edit. The key is what `pick` holds; it is NOT a `${preset}:${templateId}`
 *  pair any more, because this dialog resolves no templates. */
type StartRow = {key: string; name: string; hint: string};
const START_ROWS: StartRow[] = [
  {key: 'blank', name: 'Blank', hint: 'blank canvas · mixed notation'},
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
  /* ROUND 4 — `Blank` is the selection from the first paint: the dialog's create
     body has one radio and it is the default starting point, so there is no
     "nothing chosen yet" state to represent. */
  const [pick, setPick] = useState<string>(START_ROWS[0].key);
  /* Roving tabindex for the start-from radios: exactly ONE row is in the Tab
     order and the arrow keys move between them, which is the pattern
     `Settings.tsx`'s `Segmented` already establishes for this app. A
     `role="group"` of radios where every row is tabbable is a half-implemented
     widget — a screen-reader user is told "radio 1 of N" and then has to Tab
     through all N. */
  const optRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /* The rows are built ONCE: the list is static data, and re-deriving it per
     keystroke would re-create the keys on every render. `rows` is what is
     RENDERED; `opts` is only the radio keys, which is what the roving walk
     indexes. */
  const rows = useMemo(() => START_ROWS, []);
  const opts = useMemo(() => rows.map(r => r.key), [rows]);
  /* Whether the current `pick` names a real row. It is FALSE before any choice —
     in which case the first row stays the single tab stop instead of the group
     losing one. */
  const hasPick = opts.includes(pick);

  const trimmed = name.trim();
  /* The NAME only gates the two modes that have one. `delete` carries no name, so
     gating it on this would make the confirm button silently inert on a board
     whose name is empty or whitespace. */
  const needsName = mode !== 'delete';
  const canSubmit = !needsName || trimmed.length > 0;

  // Keep the latest handlers for the document listener without re-binding it.
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  /* `opts[0]` is the radio, so it is index 0 in the arrow-key order too. */
  const pickAt = (i: number) => {
    const k = opts[Math.max(0, Math.min(i, opts.length - 1))];
    if (k === undefined) return;
    setPick(k);
    optRefs.current[opts.indexOf(k)]?.focus();
  };

  const onOptKey = (e: React.KeyboardEvent, i: number) => {
    const last = opts.length - 1;
    switch (e.key) {
      case 'ArrowDown': case 'ArrowRight': e.preventDefault(); pickAt(i + 1); break;
      case 'ArrowUp': case 'ArrowLeft': e.preventDefault(); pickAt(i - 1); break;
      case 'Home': e.preventDefault(); pickAt(0); break;
      case 'End': e.preventDefault(); pickAt(last); break;
      default: break;
    }
  };

  const submit = () => {
    if (!canSubmit) return;
    if (mode === 'create') {
      /* ROUND 4 — the dialog resolves NO template, so its create result carries
         an explicit `seed: null` ("Blank"). The lookup that used to live here
         (`TEMPLATES.find(...)`) left with the template rows: the gallery is the
         ONE surface that resolves a `${preset}:${templateId}` pair, in ONE step
         (ROUND 3's `createFromTemplate`). */
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
                {/* ROUND 4 — ONE radiogroup, ONE radio. `Blank` is the whole
                    group's radio: the roving Tab stop and the arrow/Home/End
                    target are its own, so the walk can never land on the action
                    row below (which is not in `rows`, never in `opts`, and
                    carries no `role`). */}
                <div className="bd-list" role="radiogroup" aria-label="Starting point">
                  {rows.map((row, i) => {
                    const on = pick === row.key;
                    return (
                      <button
                        key={row.key}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        /* Roving tabindex: the SELECTED row (or the first, before
                           any choice) is the single tab stop; the arrows move the
                           choice AND the focus together, as a radiogroup should. */
                        tabIndex={(on || (!hasPick && i === 0)) ? 0 : -1}
                        ref={el => { optRefs.current[i] = el; }}
                        className={`bd-opt${on ? ' on' : ''}`}
                        onClick={() => setPick(row.key)}
                        onKeyDown={e => onOptKey(e, i)}
                      >
                        <span className="bd-tick" aria-hidden="true" />
                        <span className="bd-opt-text">
                          <span className="bd-opt-name">{row.name}</span>
                          <span className="bd-opt-hint">{row.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {/* ROUND 4, ITEM 1 — the body's SECOND row, and an ACTION, not a
                    state: it opens the gallery and creates nothing itself.

                    IT IS NOT A RADIO AND MUST NOT BE ONE. It is rendered HERE,
                    after the map, literally: it is not a `StartRow`, so it never
                    enters `rows`, never enters `opts`, and the roving walk —
                    which indexes `opts` — can therefore never land on it or count
                    it as one of the group's choices. It carries no `role` and no
                    `tabIndex`, so it is not an arrow-key target and a screen
                    reader does not announce it as "one of N". It stays a normal
                    Tab stop, which is what a keyboard user expects of a route out
                    of a dialog. */}
                {onBrowse && (
                  <button type="button" className="bd-browse" onClick={onBrowse}>
                    <span className="bd-opt-text">
                      <span className="bd-opt-name">Use template</span>
                      <span className="bd-opt-hint">opens the template gallery</span>
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <div className="bd-actions">
          {/* Cancel is FIRST in DOM order for every mode — on the destructive
              dialog that is what keeps the safe choice the one a keyboard user
              reaches first, matching the reading order on screen. */}
          <button type="button" className="bd-btn" onClick={onCancel}>Cancel</button>
          {mode === 'delete' ? (
            <button type="button" className="bd-btn danger" onClick={submit}>
              Delete board
            </button>
          ) : (
            <button type="button" className="bd-btn primary" disabled={!canSubmit} onClick={submit}>
              {mode === 'create' ? 'Create board' : 'Save name'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
