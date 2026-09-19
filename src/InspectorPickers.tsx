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
     Section        the ordered-list section wrapper, emits data-section

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

import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {SHAPES, ShapePreview, type Shape} from './shapes';
import {COLOR_VAR} from './colors';
import type {SectionId} from './inspector';

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

/** Where the edge's label sits along the line: the box IS the label. */
export const ArtLabelPos = ({pos}: {pos: 'center' | 'start' | 'end'}) => (
  <G>
    <line x1="1" y1="9" x2="25" y2="9" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
    <rect
      x={pos === 'start' ? 3 : pos === 'end' ? 15 : 9}
      y="5" width="8" height="8" rx="1.6"
      fill="var(--elevated)" stroke="currentColor" strokeWidth="1.5"
    />
  </G>
);

/* ===========================================================================
   IconPickerRow — trigger + caret + popover of icon+label rows (§B #2-#6,#9,#10).
   Same lifecycle as `IconPicker.tsx`: outside mousedown closes, Escape closes,
   the popover autofocuses nothing but is keyboard-reachable.
   =========================================================================== */
export type PickerOption = {v: string; label: string; art: ReactNode};

export function IconPickerRow({value, onChange, options, title, id}: {
  value: string;
  onChange: (v: string) => void;
  options: PickerOption[];
  title: string;
  id: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

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
    <div className="icon-field" ref={box}>
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
        <div className="icon-pop insp-pop">
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

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return SHAPES;
    return SHAPES.filter(s => `${s.label} ${s.hint}`.toLowerCase().includes(needle));
  }, [q]);

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
        <div className="icon-pop insp-pop">
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
export function ToggleRow({value, onChange, options, title}: {
  value: string;
  onChange: (v: string) => void;
  options: PickerOption[];
  title: string;
}) {
  return (
    <div className="swatches insp-seg" role="group" aria-label={title}>
      {options.map(o => (
        <button
          type="button"
          key={o.v}
          className={`mbtn insp-seg-btn${o.v === value ? ' on' : ''}`}
          data-opt={o.v}
          aria-pressed={o.v === value}
          title={o.label}
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
   PASS 1 ALWAYS RENDERS OPEN: `data-collapsed` is the literal `false` below
   because there is no collapse UI yet — §C's fold, its trigger row and the
   `diagram-studio:inspector-sections` persistence are PASS 3. The
   `collapsedDefault` flag is carried as DATA now (`src/inspector.ts` §A.3) so
   pass 3 has the truth table to read rather than having to re-derive it, and
   `data-collapsed-default` exposes it to a harness without a UI to toggle.
   =========================================================================== */
export function Section({id, title, collapsedDefault, children}: {
  id: SectionId;
  title: string;
  collapsedDefault: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className="insp-section"
      data-section={id}
      data-collapsed="false"
      data-collapsed-default={String(collapsedDefault)}
    >
      <div className="sec-label insp-sec-title">{title}</div>
      <div className="insp-sec-body">{children}</div>
    </section>
  );
}

export {SHAPES, COLOR_VAR};
