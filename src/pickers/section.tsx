/* ROUND BN-4 — one slice of the former src/InspectorPickers.tsx (split
   verbatim, 2026-10-25 along the section banners the file declares).
   src/InspectorPickers.tsx re-exports the union, so no importer changes. */
import {useId, type ReactNode} from 'react';
import type {SectionId} from '../inspector';

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

