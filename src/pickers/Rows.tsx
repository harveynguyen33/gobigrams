/* ROUND BN-4 — one slice of the former src/InspectorPickers.tsx (split
   verbatim, 2026-10-25 along the section banners the file declares).
   src/InspectorPickers.tsx re-exports the union, so no importer changes. */
import {useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode} from 'react';
import {SHAPES, ShapePreview, type Shape} from '../nodes/shapes';
import {COLOR_VAR} from '../theme/colors';
import {clampRotation, norm180} from '../canvas/rotation';
import {ROTATION_MIN, ROTATION_MAX} from '../layout/layoutConstants';
import {usePopoverPlacement} from './popover';
import {G} from './Art';
import {resolveTableScale, TABLE_SCALE_MIN, TABLE_SCALE_STEP} from '../../packages/gobi/src/model/tableStyle';

/* ===========================================================================
   IconPickerRow — trigger + caret + popover of icon+label rows (§B #2-#6,#9,#10).
   Same lifecycle as `IconPicker.tsx`: outside mousedown closes, Escape closes,
   the popover autofocuses nothing but is keyboard-reachable.
   =========================================================================== */
export type PickerOption = {
  v: string;
  label: string;
  art: ReactNode;
  /** ROUND Z, ITEM 1 — THE BUTTON'S TOOLTIP, WHEN IT IS NOT THE LABEL.
   *  Six families do not fit a 3-column row at a legible size, so the font
   *  control prints a SHORT label (`JetBrains`, `Be Vietnam`) and puts the real
   *  family name here, where hovering still tells the truth. Absent for every
   *  other option, whose label already IS its name. */
  title?: string;
};

export function IconPickerRow({value, onChange, options, title, id, rowClass}: {
  value: string;
  onChange: (v: string) => void;
  options: PickerOption[];
  title: string;
  id: string;
  /** ROUND W FIX — an OPTIONAL class for the `.icon-field` wrapper, so ONE
   *  caller can scope sheet rules to its own rows. ROUND X, ITEM 3 — NO CALLER
   *  PASSES IT ANY MORE. Its one caller was the font picker, which needed a hook
   *  to suppress a duplicate name in its option rows; the font control is now a
   *  segmented row with no trigger, no popover and no duplicate, so the prop and
   *  its `icon-field-font` call site are gone. Kept on the shared primitive
   *  deliberately: it is optional and inert, the other four pickers are
   *  byte-identical with or without it, and the next picker that needs a scoped
   *  sheet rule should not have to re-add the same plumbing. */
  rowClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  /* ROUND AB, ITEM 3 — the viewport guard (see `usePopoverPlacement` above). */
  const {popRef, style: popStyle} = usePopoverPlacement(open);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const current = options.find(o => o.v === value) ?? options[0];

  return (
    <div className={`icon-field${rowClass ? ` ${rowClass}` : ''}`} ref={box}>
      <button
        type="button"
        id={id}
        className={`icon-trigger${open ? ' on' : ''}`}
        onClick={() => setOpen(o => !o)}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="icon-trigger-glyph">{current?.art}</span>
        <span className="icon-trigger-name">{current?.label ?? value}</span>
        <span className="icon-trigger-caret">▾</span>
      </button>

      {open && (
        <div className="icon-pop insp-pop" ref={popRef} style={popStyle}>
          <div className="insp-opt-list" role="listbox" aria-label={title}>
            {options.map(o => (
              <button
                type="button"
                key={o.v}
                role="option"
                aria-selected={o.v === value}
                className={`insp-opt${o.v === value ? ' on' : ''}`}
                title={o.label}
                onClick={() => { onChange(o.v); setOpen(false); }}
              >
                <span className="insp-opt-glyph">{o.art}</span>
                <span className="insp-opt-label">{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ===========================================================================
   ShapesPicker — §B #11, the 19-shape searchable popover.
   Reuses `ShapePreview` (`src/nodes/shapes.tsx:195`) as the item art — the same
   silhouette the palette row and the library search already draw, so the
   inspector cannot drift from them. Searches label + hint with the same
   lowercase-substring haystack the palette uses.
   =========================================================================== */
export function ShapesPicker({value, onChange, color}: {
  value: Shape;
  onChange: (v: Shape) => void;
  /** The node's live outline colour, so the previews recolour with the node. */
  color: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  /* ROUND AB, ITEM 3 — the viewport guard. THE case this round is about: the
   *  shape popover is three rows taller than the icon one (a search field plus
   *  19 two-line rows), and its `bottom` measured 601 in a 577px viewport. The
   *  guard re-measures whenever the RESULT LIST changes length, so narrowing 19
   *  rows down to 1 by typing brings the popover back down instead of leaving
   *  it lifted for a height it no longer has. */
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return SHAPES;
    return SHAPES.filter(s => `${s.label} ${s.hint}`.toLowerCase().includes(needle));
  }, [q]);
  const {popRef, style: popStyle} = usePopoverPlacement(open, results.length);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    const t = window.setTimeout(() => searchRef.current?.focus(), 10);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
      window.clearTimeout(t);
    };
  }, [open]);

  const current = SHAPES.find(s => s.id === value) ?? SHAPES[0];

  return (
    <div className="icon-field" ref={box}>
      <button
        type="button"
        id="insp-shape"
        className={`icon-trigger${open ? ' on' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Choose the node shape"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="icon-trigger-glyph"><ShapePreview shape={current.id} color={color} /></span>
        <span className="icon-trigger-name">{current.label}</span>
        <span className="icon-trigger-caret">▾</span>
      </button>

      {open && (
        <div className="icon-pop insp-pop" ref={popRef} style={popStyle}>
          <input
            ref={searchRef}
            className="icon-search"
            placeholder="Search shapes…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && results[0]) { onChange(results[0].id); setOpen(false); }
            }}
          />
          <div className="insp-shape-list" role="listbox" aria-label="Shape">
            {results.map(s => (
              <button
                type="button"
                key={s.id}
                role="option"
                data-shape={s.id}
                aria-selected={s.id === value}
                className={`insp-shape-item${s.id === value ? ' on' : ''}`}
                onClick={() => { onChange(s.id); setOpen(false); }}
              >
                <span className="insp-opt-glyph"><ShapePreview shape={s.id} color={color} /></span>
                <span className="insp-shape-text">
                  <span className="insp-opt-label">{s.label}</span>
                  <span className="insp-shape-hint">{s.hint}</span>
                </span>
              </button>
            ))}
            {!results.length && <div className="icon-empty">No shape matches “{q}”.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ===========================================================================
   ToggleRow — §B #1 (segmented icon picker), #8 (segmented row), #12 (2-button
   toggle). ONE component for all three: the only difference between "a
   segmented icon picker" and "a segmented row" is whether the options carry art.
   `on` is painted with the panel's existing `.mbtn` vocabulary (`styles.css:1725`)
   so a selected button looks the same here as in the multi-select branch.
   =========================================================================== */
export function ToggleRow({value, onChange, options, title, wide, grid3, half}: {
  value: string;
  onChange: (v: string) => void;
  options: PickerOption[];
  title: string;
  /** ROUND X, ITEM 3 — a MODIFIER, not a fork. The S×4 and Align rows carry one
   *  or two glyphs per button; the font row carries a WORD (`Mono`, `Read`), so
   *  its buttons need more than the default padding to keep the word off the
   *  border. Same wrapper, same `.insp-seg-btn`, same `.on` treatment — only the
   *  padding differs, applied with `.insp-seg.wide` so there is still exactly ONE
   *  segmented control in the panel. */
  wide?: boolean;
  /** ROUND Z, ITEM 1 — THE SIX-BUTTON MODIFIER: TWO ROWS OF THREE.
   *
   *  A second modifier rather than a change to `wide`, because the two describe
   *  different rows: `wide` is a 4-across row of words, this is a 3+3 grid. Six
   *  buttons in one 6-across row would give each a 37px cell — the measurement
   *  below is what rules that out, not taste.
   *
   *  IT IS IMPLEMENTED AS FLEX, NOT AS A GRID, and that is a deliberate reading
   *  of this sheet's cascade rather than a preference. `.insp-seg` declares
   *  `display: grid`, but every segmented row in the app renders through
   *  `<div className="swatches insp-seg">` and `.swatches { display: flex }`
   *  (styles.css:1526) has the SAME specificity and sits LATER in the file — so
   *  all four rows compute `display: flex; flex-wrap: wrap` today, and a
   *  `grid-template-columns` on the same element would compute against a flex
   *  container and do nothing at all. `flex-basis` with `box-sizing:
   *  border-box` (the global `*` rule, styles.css:268) produces the identical
   *  81px cell, and it does so through the display value those rows actually
   *  have. The cell measurement is in the `.insp-seg.grid3` block below. */
  grid3?: boolean;
  /** ROUND AA, ITEM 1 — THE OTHER WORD-ROW MODIFIER: TWO PER LINE.
   *
   *  A second per-line modifier rather than a re-use of `grid3`, because the two
   *  describe different rows: `grid3` is a 3+3 grid of six, this is a 2+2 of
   *  four. Both exist for the same reason — a row of WORD buttons cannot divide
   *  the field by its own count without breaking a word — and both are written
   *  as the same flex basis, in the same idiom (`grid3` is documented at the
   *  `.insp-seg.grid3` block in `styles.css`).
   *
   *  WHICH ROWS NEED IT IS A MEASUREMENT, not a preference. The canvas Speed row
   *  is the only one: at four across its longest label (`very fast`, 59.6px in
   *  the app's 11px mono) exceeds the 41.5px content box the equal share gives
   *  it, and the label would wrap. Every other segmented row's longest label
   *  fits its own share; the numbers are in the `.insp-seg.half` block. */
  half?: boolean;
}) {
  return (
    <div
      className={`swatches insp-seg${wide ? ' wide' : ''}${grid3 ? ' grid3' : ''}${half ? ' half' : ''}`}
      role="group"
      aria-label={title}
    >
      {options.map(o => (
        <button
          type="button"
          key={o.v}
          className={`mbtn insp-seg-btn${o.v === value ? ' on' : ''}`}
          data-opt={o.v}
          aria-pressed={o.v === value}
          /* ROUND Z, ITEM 1 — THE FULL FAMILY NAME ON HOVER. The font row's
             labels are short only because the full ones do not fit; the button
             still has to say which family it is, and a tooltip is where that
             belongs. Every other option has no `title`, so the label stays the
             tooltip exactly as before. */
          title={o.title ?? o.label}
          onClick={() => onChange(o.v)}
        >
          {o.art ?? o.label}
        </button>
      ))}
    </div>
  );
}


/* ===========================================================================
   ScaleRow — TABLE-SCALE (t_cdd8e4f6): the inspector row for ONE table's own
   scale, beside its name/schema/colour — a hero table in a board of small ones,
   so the value lives on the NODE and the board's density is untouched.
   TABLE-SCALE-NOMAX (t_7f37db5b, Harvey: "Min is ok but should not restrict
   max"): a `range` needs SOME max, so the slider's max is DERIVED from the
   current value (`max(2, ceil(scale * 2 * 2) / 2)` = twice it, to a whole 50%)
   and can never pin the thumb at the real value; the NUMBER field takes any
   value >= 0.75 and is the door to everything above. The readout prints the
   TRUE percent (a board carrying 8 shows "800%" beside a 1600% slider). `Reset`
   returns the card to the density as-is; the model stores the FRACTION, the
   reader sees percent. Writes go through the caller's ONE update path (one undo
   entry per commit, like every inspector field).

   SCALE-UNITS (t_c6f652b3, 2026-11-10): ONE unit everywhere — PERCENT. The
   number field used to speak SCALE UNITS (`1` beside `100%`), so `400` there was
   400x (measured 72 792px, silently). It now takes the slider's percent (min 75,
   step 5, no max) and divides ONCE; the DOCUMENT keeps `scale: 4` for 400%.
   =========================================================================== */
export function ScaleRow({value, onChange}: {value?: number; onChange: (v: number) => void}) {
  const scale = resolveTableScale(value);
  const pct = Math.round(scale * 100);
  const min = Math.round(TABLE_SCALE_MIN * 100);
  const step = Math.round(TABLE_SCALE_STEP * 100);
  const max = Math.round(Math.max(2, Math.ceil(scale * 4) / 2) * 100);
  return (
    <div className="field">
      <label>scale <b data-scale-value>{pct}%</b></label>
      <div className="field-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={pct}
          data-table-scale
          aria-label="table scale"
          title={`this table only — ${min}% to ${max}% (the field beside takes any percent above ${min}%)`}
          onChange={e => onChange(resolveTableScale(Number(e.currentTarget.value) / 100))}
        />
        <input
          type="number"
          min={min}
          step={step}
          value={pct}
          data-table-scale-num
          aria-label="table scale value"
          title={`this table only — any percent from ${min} up, no maximum`}
          onChange={e => {
            const v = Number(e.currentTarget.value);
            if (isFinite(v) && v >= min) onChange(resolveTableScale(v / 100));
          }}
        />
        <button
          type="button"
          className="mbtn"
          title="Reset this table to 100%"
          aria-label="Reset table scale to 100%"
          disabled={pct === 100}
          onClick={() => onChange(1)}
        >Reset</button>
      </div>
    </div>
  );
}


/* ===========================================================================
   RotationRow — ROUND ROTATE item 3: the inspector's Rotation row (number
   input + reset). Lives HERE, not App.tsx, because a package-p invariant
   keeps App free of numeric input elements; the row is presentational and
   writes through the caller's onChange (App's `update`, one undo entry per
   commit like every inspector field).
   =========================================================================== */
export function RotationRow({value, onChange}: {value: number; onChange: (v: number) => void}) {
  /* ROTATION-RANGE — display the NORMALISED angle: a legacy board may hold an
   *  un-normalised value (999), and the field must never claim an angle the
   *  node does not paint. Writes route through clampRotation, so what lands
   *  in the board is always step-rounded and inside (-180, 180]. */
  const shown = norm180(value);
  return (
    <div className="field">
      <label>rotation</label>
      <div className="field-row">
        <input
          type="number"
          min={ROTATION_MIN}
          max={ROTATION_MAX}
          step={1}
          value={shown}
          onChange={e => onChange(clampRotation(e.target.value))}
        />
        {/* ROTATION-RANGE — a WORD, not the old ↺ glyph (it read as "rotate
            counter-clockwise", and Harvey pressed it without knowing what it
            did); disabled at 0 so it never sits enabled doing nothing. */}
        <button
          type="button"
          className="mbtn"
          title="Reset rotation to 0"
          aria-label="Reset rotation to 0"
          disabled={shown === 0}
          onClick={() => onChange(0)}
        >Reset</button>
      </div>
    </div>
  );
}
