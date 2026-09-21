/* PACKAGE-P §B — the control vocabulary that replaces the 12 bare `<select>`s.

   WHY THIS FILE EXISTS. Upstream's panel has ZERO `<select>` (see §0.1 of the
   spec: `FontPickerTrigger.tsx:37` → trigger, `FontPicker.tsx:105` → popover,
   `FontPickerList.tsx:308` → icon+label list). Our 12 selects were a regression
   against the reference. This file holds the three control shapes that replace
   them, plus the glyph bank they are drawn from:

     IconPickerRow  trigger + caret + popover of icon+label rows   (§B #2-#6, #9, #10)
     ShapesPicker   trigger + caret + SEARCHABLE popover of silhouettes (§B #11)
     ToggleRow      N inline buttons, optional art                 (§B #1 segmented, #8 segmented, #12)
     Stepper        − / value / + numeric stepper                  (§B #7)
     Section        the ordered-list section wrapper: data-section, folding trigger
     CardReadout    a folded row's current-value readout, on the trigger

   THE POPOVER PATTERN IS COPIED FROM `src/IconPicker.tsx`, not invented: the
   same `icon-field` wrapper, the same outside-mousedown + Escape close, the same
   autofocus-on-open, the same `icon-*` classes. A second popover idiom in the
   same panel would be the actual defect; this is the same one.

   WHY THE ART IS INLINE SVG AND NOT LUCIDE. §B suggests lucide names for the
   small glyphs (`AlignStart`, `Minus`, …). Four of the seven vocabularies have
   NO lucide equivalent at all — crow's feet, zero-or-one ring-and-bar,
   cardinality, and per-option line curvature are notation glyphs, not UI icons.
   Drawing some options from lucide and the rest by hand would give one picker
   two visual languages. Everything is therefore drawn here, in one
   `viewBox="0 0 26 18"` box (`src/styles.css:593` `.shape-preview`), with
   `currentColor` strokes so the button's own `color` drives the art and NO
   colour literal enters either file. No new npm dependency, either. */

import {useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {SHAPES, ShapePreview, type Shape} from './shapes';
import {COLOR_VAR} from './colors';
import type {SectionId} from './inspector';

/* ===========================================================================
   ROUND AB, ITEM 3 — KEEPING AN OPEN POPOVER INSIDE THE VIEWPORT.

   Measured live before this round: the shape popover's `bottom` was 601 against
   a 577px viewport, so its last rows were clipped and unclickable. The panel is
   `overflow: auto`, so the popover cannot simply be scrolled into view — it has
   to be LIFTED, or shortened, or flipped.

   THE TECHNIQUE IS THE ONE THIS PROJECT ALREADY USES, borrowed from
   `src/ContextMenu.tsx:62-69`: read a real `getBoundingClientRect()` after
   mount and move the box by the overflow it reports. What is NOT reused is the
   right-click menu's "flip above the trigger when there is no room below": that
   menu is portalled at the pointer and can flip freely, while an inspector
   popover is anchored to a trigger that may sit anywhere in a 500px panel, so
   an unconditional flip would put the popover over the controls ABOVE the row —
   in a field that is not its own. Lifting keeps it attached to its trigger and
   keeps the scrollable list reachable; it is the same measurement, applied to
   the axis the panel can actually act on.

   A NEGATIVE `margin-top` is what moves it, and that is deliberate:
   `top: calc(100% + 6px)` is the anchor that ties the popover to its trigger,
   and overriding `top` would detach it. The sheet declares the lift as a
   margin, the sheet's own `max-height` rules (`.insp-opt-list`,
   `.insp-shape-list`, `.insp-pop`) cap and scroll the BODY, and this function
   only supplies the offset — so the three mechanisms compose instead of
   competing. The two guards below always apply, so the popover stays inside the
   viewport at ANY viewport height, not only the `dvh` ones the sheet can state:

     (1) the box must not reach below the viewport floor (`innerHeight - pad`);
     (2) it must not cover the trigger it hangs from — a box lifted past its own
         button would hide the control the user just clicked.

   `lift` is clamped at 0, so a popover with room below it is never moved at
   all, and the placement is recomputed on every open and on every scroll or
   resize while it is open — at the real layout size of the list the current
   search term produced. */
const POPOVER_PAD = 8;
/** The popover's own offset from its trigger — `top: calc(100% + 6px)` in
 *  `styles.css`, stated here because the placement is computed against the
 *  UNPLACED position. */
const POPOVER_GAP = 6;
/** Which side of the trigger the popover sits on, and how far it is shifted
 *  back toward the viewport from that side. `shift` is 0 for the ordinary case
 *  (the whole popover fits where it is). */
type PopoverPlacement = {above: boolean; shift: number};

/**
 * The measured placement of an open popover, relative to the VIEWPORT.
 *
 * WHY THE ANCHOR AND NOT THE POPOVER'S OWN RECT. Everything below is derived
 * from the TRIGGER's rect (the `.icon-field` wrapper, `box.parentElement`) plus
 * the popover's HEIGHT — never from the popover's current top. That matters
 * because the result decides the popover's own position: measuring the shifted
 * box would make the placement feed back on itself (shift it once and the next
 * measurement asks for zero), which is an oscillation, not a fix. Height and
 * the trigger's rect are both mode-independent, so this function is idempotent.
 */
export function popoverPlacement(box: HTMLElement | null): PopoverPlacement {
  if (!box) return {above: false, shift: 0};
  const rect = box.getBoundingClientRect();
  const anchor = box.parentElement?.getBoundingClientRect() ?? rect;
  const vh = window.innerHeight;
  const h = rect.height;
  const floor = vh - POPOVER_PAD;

  const belowTop = anchor.bottom + POPOVER_GAP;
  const belowOverflow = belowTop + h - floor;
  const aboveBottom = anchor.top - POPOVER_GAP;
  const aboveOverflow = POPOVER_PAD - (aboveBottom - h);

  /* (1) IT FITS BELOW — the normal case, and the one that must not move. */
  if (belowOverflow <= 0) return {above: false, shift: 0};
  /* (2) IT DOES NOT FIT BELOW BUT IT FITS ABOVE — FLIP, which is the
   *     established behaviour for a panel whose trigger sits low in a short
   *     viewport. `bottom: calc(100% + 6px)` in `.icon-pop` is the existing
   *     anchored-above idiom; the flip only chooses it. */
  if (aboveOverflow <= 0) return {above: true, shift: 0};
  /* (3) NEITHER SIDE FITS — the viewport is shorter than the popover. Take the
   *     roomier side and shift the remainder back inside, clamped so the
   *     popover cannot trade a clipped bottom for a clipped top. The list caps
   *     (`min(60dvh, 260px)` on `.insp-opt-list` / `.insp-shape-list`) are what
   *     keep case (3) rare. */
  if (belowOverflow <= aboveOverflow) {
    return {above: false, shift: Math.max(0, Math.min(belowOverflow, belowTop - POPOVER_PAD))};
  }
  return {above: true, shift: Math.max(0, Math.min(aboveOverflow, floor - aboveBottom))};
}

/** The placement as the inline style the popover wears.
 *
 *  BELOW is the class's own `top: calc(100% + 6px)`; ABOVE sets `top: auto`
 *  and `bottom: calc(100% + 6px)` — `top: auto` is not optional, because an
 *  absolutely-positioned box with BOTH `top` and `bottom` set and `height: auto`
 *  would STRETCH between them instead of hanging off the trigger.
 *
 *  The shift is a MARGIN, not a `top`/`bottom` value: the anchor is what keeps
 *  the popover tied to its trigger, and overriding it would detach the popover
 *  from the control it belongs to. A negative `margin-top` moves a `top`-anchored
 *  box up; a negative `margin-bottom` moves a `bottom`-anchored box down. */
export const placementStyle = ({above, shift}: PopoverPlacement) => above
  ? {top: 'auto', bottom: `calc(100% + ${POPOVER_GAP}px)`, marginTop: 0, marginBottom: -shift}
  : {top: `calc(100% + ${POPOVER_GAP}px)`, bottom: 'auto', marginTop: -shift, marginBottom: 0};

/** `useLayoutEffect` is the right hook in the browser (measure and place BEFORE
 *  the first paint, so a clipped popover is never painted) and a no-op warning
 *  on the server, where `checks/package-p-render-check.mjs` renders these
 *  components. The guard is the standard one, so the SSR pass stays silent and
 *  the browser pass still measures pre-paint. */
const useMeasure = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** One hook per popover component: the ref to measure, and the placement to
 *  apply. `dep` is whatever else changes the popover's HEIGHT — the result
 *  count, for the shape picker — so the placement is re-measured when the box
 *  resizes rather than only when it opens. */
function usePopoverPlacement(open: boolean, dep: unknown = 0) {
  const popRef = useRef<HTMLDivElement>(null);
  const placeRef = useRef<PopoverPlacement>({above: false, shift: 0});
  const [place, setPlace] = useState<PopoverPlacement>(placeRef.current);
  useMeasure(() => {
    if (!open) return;
    const apply = () => {
      const next = popoverPlacement(popRef.current);
      /* Written through the ref as well, so the comparison below is against the
       *  last APPLIED placement rather than against a state value this closure
       *  cannot see. The early return is what keeps a scroll from re-rendering
       *  the panel once per frame: most scroll events do not change the answer. */
      if (next.above === placeRef.current.above && next.shift === placeRef.current.shift) return;
      placeRef.current = next;
      setPlace(next);
    };
    apply();
    /* The trigger can MOVE while the popover is open: the panel scrolls, the
     *  window resizes, the user's search re-flows the list. The placement is
     *  therefore re-derived on those events rather than frozen at open — the
     *  capture-phase scroll listener catches the panel, whose scroll event does
     *  not bubble to the window. */
    document.addEventListener('scroll', apply, true);
    window.addEventListener('resize', apply);
    return () => {
      document.removeEventListener('scroll', apply, true);
      window.removeEventListener('resize', apply);
    };
  }, [open, dep]);
  return {popRef, style: placementStyle(place)};
}

/* ===========================================================================
   The glyph bank. Every glyph is 26×18, `currentColor`, stroke-filled only.
   A glyph is a picture of the VALUE, so the trigger shows what is set without
   the user opening the popover.
   =========================================================================== */
const G = ({children}: {children: ReactNode}) => (
  <svg className="insp-glyph" viewBox="0 0 26 18" width="26" height="18" aria-hidden="true">
    {children}
  </svg>
);

/** Stroke width ladder — the line's own weight IS the glyph. */
export const ArtWidth = ({w}: {w: number}) => (
  <G><line x1="2" y1="9" x2="24" y2="9" stroke="currentColor" strokeWidth={w} strokeLinecap="round" /></G>
);

/** solid / dashed / dotted, drawn as the actual dash patterns the edge uses
 *  (`App.tsx:433` `dashArray` — '6 4' and '1.5 3.5'). */
export const ArtDash = ({kind}: {kind: 'solid' | 'dashed' | 'dotted'}) => (
  <G>
    <line
      x1="2" y1="9" x2="24" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeDasharray={kind === 'dashed' ? '6 4' : kind === 'dotted' ? '1.5 3.5' : undefined}
    />
  </G>
);

/** ROUND AL, AL-6 — the five FLOW states, drawn as what they DO to the line.
 *  The `flow` row is a GLYPH row, so these are what its square chips carry
 *  instead of the words the panel used to print. A glyph row built of squares is
 *  even by construction, and it is also what brought the row from 90.9% of the
 *  field down to ~69% — ten word-buttons on one line was the owner's "chen chúc".
 *
 *  `dots` and `pulse` share a rail line: dots shows three staggered beads, pulse
 *  a bright segment sweeping it. `icon` shows the travelling chip in miniature. */
export const ArtFlow = ({kind}: {kind: 'none' | 'dots' | 'dash' | 'pulse' | 'icon'}) => (
  <G>
    {kind === 'none' && (
      <line x1="2" y1="9" x2="24" y2="9" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" opacity=".38" />
    )}
    {kind === 'dots' && (
      <>
        <circle cx="5" cy="9" r="2" fill="currentColor" />
        <circle cx="13" cy="9" r="2" fill="currentColor" opacity=".6" />
        <circle cx="21" cy="9" r="2" fill="currentColor" opacity=".32" />
      </>
    )}
    {kind === 'dash' && (
      <line x1="2" y1="9" x2="24" y2="9" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeDasharray="4 3" />
    )}
    {kind === 'pulse' && (
      <>
        <line x1="2" y1="9" x2="24" y2="9" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" opacity=".35" />
        <line x1="9" y1="9" x2="17" y2="9" stroke="currentColor" strokeWidth="3.4"
          strokeLinecap="round" />
      </>
    )}
    {kind === 'icon' && (
      <>
        <line x1="2" y1="9" x2="24" y2="9" stroke="currentColor" strokeWidth="1.6"
          strokeLinecap="round" opacity=".5" />
        <rect x="9" y="5" width="8" height="8" rx="1.8" fill="currentColor" />
      </>
    )}
  </G>
);

/** The four path shapes `PATH_TYPES` (`App.tsx:109`) can produce. */
export const ArtCurve = ({kind}: {kind: 'bezier' | 'smoothstep' | 'step' | 'straight'}) => (
  <G>
    <path
      d={
        kind === 'bezier' ? 'M2 15 C 10 15 16 3 24 3'
        : kind === 'smoothstep' ? 'M2 15 H 11 C 13 15 13 3 15 3 H 24'
        : kind === 'step' ? 'M2 15 H 13 V 3 H 24'
        : 'M2 15 L 24 3'
      }
      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
    />
  </G>
);

/** Arrowhead vocabulary: bare line, closed triangle, open chevron.
 *  `flip` mirrors the whole glyph so the head-start picker reads as the
 *  mirror of the head-end picker, exactly as the two controls relate. */
export const ArtArrow = ({kind, flip}: {kind: 'none' | 'closed' | 'open'; flip?: boolean}) => (
  <G>
    <g transform={flip ? 'translate(26 0) scale(-1 1)' : undefined}>
      <line x1="2" y1="9" x2={kind === 'none' ? 24 : 17} y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {kind === 'closed' && <path d="M17 4 L24 9 L17 14 Z" fill="currentColor" />}
      {kind === 'open' && <path d="M17 4 L24 9 L17 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
    </g>
  </G>
);

/** Crow's-foot cardinality notation, at the RIGHT end of the line. `flip`
 *  mirrors it for the source-end control. The six kinds are IE / IDEF1X
 *  notation, which is why this is drawn rather than iconised. */
export const ArtCardinality = ({kind, flip}: {kind: string; flip?: boolean}) => (
  <G>
    <g transform={flip ? 'translate(26 0) scale(-1 1)' : undefined}>
      <line x1="2" y1="9" x2={kind === 'arrow' ? 17 : 24} y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {kind === 'one' && <line x1="21" y1="3" x2="21" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
      {kind === 'zeroOrOne' && <>
        <circle cx="16.5" cy="9" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <line x1="22.5" y1="3.5" x2="22.5" y2="14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>}
      {kind === 'many' && <path d="M24 9 L18 3 M24 9 L18 9 M24 9 L18 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
      {kind === 'zeroOrMany' && <>
        <circle cx="16" cy="9" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M24 9 L18.5 3.5 M24 9 L18.5 9 M24 9 L18.5 14.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </>}
      {kind === 'arrow' && <path d="M17 4 L24 9 L17 14 Z" fill="currentColor" />}
    </g>
  </G>
);

/** Where the edge's label sits along the line: the box IS the label.
 *
 *  ROUND AK, AK-3 — DELETED WITH ITS ONLY CONSUMER. `ArtLabelPos` was drawn
 *  solely by `OFFSET_OPTS` in `App.tsx`, which backed the `label position` row.
 *  That row is gone (the label drag sets the same value), so the glyph has no
 *  referent. Left in the file as a written record rather than silently dropped;
 *  `checks/package-p-inspector.mjs` re-anchors its `ArtLabelPos` count to 0.
 *
 *  export const ArtLabelPos = ({pos}: {pos: 'center' | 'start' | 'end'}) => (
 *    <G>
 *      <line x1="1" y1="9" x2="25" y2="9" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
 *      <rect x={pos === 'start' ? 3 : pos === 'end' ? 15 : 9} y="5" width="8" height="8"
 *        rx="1.6" fill="var(--elevated)" stroke="currentColor" strokeWidth="1.5" />
 *    </G>
 *  );
 */

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
   Reuses `ShapePreview` (`src/shapes.tsx:195`) as the item art — the same
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
   Stepper — §B #7. A numeric ordinal from 1..6 has no icon vocabulary, and a
   6-item select was the wrong shape for it. `min`/`max` clamp in the handler so
   the control cannot emit an out-of-range value.
   =========================================================================== */
export function Stepper({value, onChange, min, max, title}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  title: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="insp-stepper" role="group" aria-label={title}>
      <button
        type="button" className="insp-step-btn" title={`Fewer (min ${min})`}
        disabled={value <= min} onClick={() => onChange(clamp(value - 1))}
      >−</button>
      <span className="insp-step-val" data-value={value}>{value}</span>
      <button
        type="button" className="insp-step-btn" title={`More (max ${max})`}
        disabled={value >= max} onClick={() => onChange(clamp(value + 1))}
      >+</button>
    </div>
  );
}

/* ===========================================================================
   Section — the section wrapper for the ordered render.
   `data-section` is the harness contract (§F.3 asserts the ORDERED list).

   PASS 3 OWNS THE FOLD. `data-collapsed` is now the REAL boolean as a string,
   per section, from live state — never a literal. `data-collapsed-default`
   stays exactly as pass 1 left it: §A.3's truth table as data, so a harness can
   read the default without a UI to toggle.

   A FOLDED SECTION RENDERS AS ONE TRIGGER ROW — `▸ Flow animation` — and the
   body is NOT RENDERED AT ALL, not hidden. §F.4 asks for "their bodies absent,
   their trigger rows present", and a CSS hide would leave the controls in the
   DOM for a query to find (and for a screen reader to announce). The fold is a
   mount/unmount, so "collapsed" and "absent" cannot disagree.

   THE TRIGGER IS A REAL `<button type="button">`: a native button gives Enter
   and Space for free, so no key handler is added anywhere for this. The caret
   and the title are decorative — the accessible name is the section title, with
   the readout named but not spelled into it, so a screen reader says "Flow
   animation, collapsed, button" rather than reading `off · 3` as the label.

   THE READOUT (`<CardReadout>`) is what makes folding SAFE rather than merely
   tidy: a folded row still shows the value it controls, so nothing is hidden
   that the user cannot see from the collapsed state.
   =========================================================================== */
export function Section({id, title, collapsedDefault, collapsed, onToggle, readout, readoutLabel, children}: {
  id: SectionId;
  title: string;
  /** §A.3's default, carried as DATA and never read as live state. */
  collapsedDefault: boolean;
  /** Live fold state for THIS section — owned by `useInspectorSections`. */
  collapsed: boolean;
  onToggle: (id: SectionId) => void;
  /** The section's CURRENT VALUE, shown on the folded trigger (optional). */
  readout?: ReactNode;
  /** What the readout's value IS, for assistive tech: "cardinality ends". */
  readoutLabel?: string;
  children: ReactNode;
}) {
  /* The body's id must be stable between the trigger's `aria-controls` and the
     body itself, and unique across the sections in a tree. `useId` is the one
     React primitive for that, and it survives SSR — which matters because
     `checks/package-p-render-check.mjs` renders these sections server-side. */
  const bodyId = `insp-sec-${id}-${useId()}`;
  return (
    <section
      className="insp-section"
      data-section={id}
      data-collapsed={String(collapsed)}
      data-collapsed-default={String(collapsedDefault)}
    >
      <button
        type="button"
        className="insp-sec-trigger"
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        onClick={() => onToggle(id)}
      >
        <span className="insp-sec-caret" aria-hidden="true" data-open={!collapsed}>
          {/* ROUND W, ITEM 1 — A DRAWN TRIANGLE, NOT A TEXT GLYPH. The row used
              to print U+25B8 (`▸`) / U+25BE (`▾`) in `var(--mono)`. Those
              glyphs exist in some monospace faces and not others, so the one
              affordance the folded state had could render as a tofu box — and
              at 10px it read as a smudge even when it did render. A path in
              `currentColor` reads at this size in EVERY font, and it inherits
              the row's hover colour for free. It rotates rather than swapping
              `d`, so the two states cannot disagree about the shape. */}
          <svg width="10" height="10" viewBox="0 0 10 10" focusable="false">
            <path d="M3.4 1.6 L7.6 5 L3.4 8.4 Z" fill="currentColor" />
          </svg>
        </span>
        {/* `.insp-sec-title` stays on the LABEL so the section's title is still
            counted once per section by the render check, folded or not. */}
        <span className="sec-label insp-sec-title">{title}</span>
        {collapsed && readout != null && (
          <CardReadout label={readoutLabel}>{readout}</CardReadout>
        )}
      </button>
      {!collapsed && <div className="insp-sec-body" id={bodyId}>{children}</div>}
    </section>
  );
}

/** A folded row's current-value readout. `label` is the value's NAME, for the
 *  accessible name of the trigger; the value itself stays a visual readout, so
 *  the trigger reads as "Flow animation, collapsed: flow off" and never as
 *  "Flow animation off · 3". `min-width: 0` + an ellipsis keeps a long value
 *  (a crow's-foot pair is the worst case) inside the 288px panel. */
export function CardReadout({label, children}: {label?: string; children: ReactNode}) {
  return (
    <span className="insp-sec-readout">
      {label && <span className="visually-hidden">{label}: </span>}
      <span className="insp-sec-readout-val">{children}</span>
    </span>
  );
}

export {SHAPES, COLOR_VAR};
