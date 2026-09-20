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
 */
import {useEffect, useMemo, useRef, useState} from 'react';
import {X} from 'lucide-react';
import {PRESETS, type PresetId, type TemplateSpec} from './presets';
import {templateCatalog} from './templateCatalog';
import {FOCUSABLE} from './Settings';

export type BoardDialogMode = 'create' | 'rename' | 'delete';

/** What the dialog hands back. `templateId: null` is the explicit
 *  "start empty" choice — a real option, not a fallback. */
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
  /** Pre-selected row, as a `${preset}:${templateId}` key. Unused by Pass 1's own
   *  call sites (nothing passes it yet) — it exists so the templates gallery can
   *  hand a choice over instead of creating a board itself. `undefined` = no
   *  pre-selection, which is what every caller means today. */
  initialPick?: string;
};

/* Every template the app ships, flattened with the preset that owns it. Read from
   `PRESETS` rather than transcribed, so adding a template to a preset adds it to
   this list with no edit here. A preset with no `templates` contributes nothing
   (only `custom` today, which is why "start empty" is the neutral default). */
const TEMPLATES: {preset: PresetId; presetLabel: string; t: TemplateSpec}[] = [];
for (const id of Object.keys(PRESETS) as PresetId[]) {
  for (const t of PRESETS[id].templates ?? []) {
    TEMPLATES.push({preset: id, presetLabel: PRESETS[id].label, t});
  }
}
const optKey = (preset: PresetId, templateId: string) => `${preset}:${templateId}`;
/** The "start empty" option's key. `''` can never collide with a real key: every
 *  real key contains a `:`. */
const EMPTY = '';

/* GROUPED ROWS. The same catalog the gallery will read turns the flat run into
   family → level: one NON-FOCUSABLE header per group, then its rows.

   The header is deliberately NOT a `button` and carries no `tabIndex`: it is not
   in the option array, so the roving-tabindex walk (arrow / Home / End) steps
   over it entirely, and a screen reader never announces it as a radio. It IS
   `aria-hidden` for the same reason — the group's name is already carried by the
   radiogroup's accessible name and by each row's own hint line, so announcing the
   heading again would only add a stop the walk cannot reach.

   The caption is `family — level`, EXCEPT for a family's unlevelled tail, whose
   group label already IS the family's own label (catalog rule 3): composing them
   would print "C4 — C4". So the tail reads just "C4". */
type Row =
  | {kind: 'header'; key: string; label: string}
  | {kind: 'opt'; key: string; entry: {preset: PresetId; presetLabel: string; t: TemplateSpec} | null};

const catRows = (): Row[] => {
  const rows: Row[] = [{kind: 'opt', key: EMPTY, entry: null}];
  for (const fam of templateCatalog()) {
    for (const group of fam.groups) {
      rows.push({
        kind: 'header',
        key: `hd:${fam.preset}:${group.level ?? 'none'}`,
        label: group.level === null ? fam.label : `${fam.label} — ${group.label}`,
      });
      for (const e of group.entries) {
        rows.push({kind: 'opt', key: optKey(e.preset, e.t.id), entry: {preset: e.preset, presetLabel: e.presetLabel, t: e.t}});
      }
    }
  }
  return rows;
};

export default function BoardDialog({mode, boardName, onCancel, onSubmit, returnFocusTo, initialPick}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // `create` starts from "Untitled" the way the old prompt did; `rename` starts
  // from the live name. Both are SELECTED, so the first keystroke replaces.
  const [name, setName] = useState(mode === 'create' ? 'Untitled' : boardName);
  const [pick, setPick] = useState<string>(initialPick ?? EMPTY);
  /* Roving tabindex for the start-from radios: exactly ONE row is in the Tab
     order and the arrow keys move between them, which is the pattern
     `Settings.tsx`'s `Segmented` already establishes for this app. A
     `role="group"` of radios where every row is tabbable is a half-implemented
     widget — a screen-reader user is told "radio 1 of 6" and then has to Tab
     through all six. */
  const optRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /* The rows (headers + radios) are built ONCE: the catalog is static data, and
     re-deriving it per keystroke would re-create the header keys on every render.
     `rows` is what is RENDERED; `opts` is only the radio keys, which is what the
     roving walk indexes — so a header can never become a focus stop. */
  const rows = useMemo(catRows, []);
  const opts = useMemo(() => rows.filter(r => r.kind === 'opt').map(r => r.key), [rows]);
  /* Whether the current `pick` names a real row. It is FALSE before any choice
     (the "start empty" sentinel is a key but not a pick) and also if a caller
     ever hands over an `initialPick` that no longer exists — in which case the
     first row stays the single tab stop instead of the group losing one. */
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

  /* `opts[0]` is the explicit "start empty", so it is index 0 in the arrow-key
     order too. */
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
      const hit = TEMPLATES.find(t => optKey(t.preset, t.t.id) === pick);
      submitRef.current({
        kind: 'create',
        name: trimmed,
        seed: hit ? {preset: hit.preset, templateId: hit.t.id} : null,
      });
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
    if (mode === 'create') return 'Name it, then pick a starting point — or start empty.';
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
                <div className="bd-list" role="radiogroup" aria-label="Starting template">
                  {/* ONE radiogroup, TWO row kinds. A `header` row is a plain
                      `div` with no tab stop and no `role="radio"`, so the
                      roving walk never lands on it; an `opt` row is the same
                      button it always was, indexed by its position in `opts` —
                      NOT by its position in this DOM list, which is what lets a
                      header sit between two rows without shifting the walk. */}
                  {rows.map(row => {
                    if (row.kind === 'header') {
                      return (
                        <div key={row.key} className="bd-hd" aria-hidden="true">{row.label}</div>
                      );
                    }
                    const t = row.entry;
                    const k = row.key;
                    const on = pick === k;
                    const i = opts.indexOf(k);
                    return (
                      <button
                        key={k || '__empty'}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        /* Roving tabindex: the SELECTED row (or the first, before
                           any choice — and also if a handed-over pick names no
                           existing row) is the single tab stop; the arrows move the
                           choice AND the focus together, as a radiogroup should. */
                        tabIndex={(on || (!hasPick && i === 0)) ? 0 : -1}
                        ref={el => { optRefs.current[i] = el; }}
                        className={`bd-opt${on ? ' on' : ''}`}
                        onClick={() => setPick(k)}
                        onKeyDown={e => onOptKey(e, i)}
                      >
                        <span className="bd-tick" aria-hidden="true" />
                        <span className="bd-opt-text">
                          <span className="bd-opt-name">{t ? t.t.label : 'Start empty'}</span>
                          <span className="bd-opt-hint">
                            {t
                              ? `${t.presetLabel}${t.t.hint ? ` · ${t.t.hint}` : ''}`
                              : 'blank canvas · mixed notation'}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
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
