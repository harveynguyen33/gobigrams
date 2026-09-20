/* PACKAGE-TEMPLATES §2.5 Pass 2 — THE TEMPLATES GALLERY.

   WHY A SECOND SURFACE. The New-board dialog is a NAME-FIRST modal: one field,
   one line of hint per row in a 210 px scrolling box. A level-based catalog
   needs the two things that modal has no room for — a PREVIEW and STRUCTURE
   (family → level). So the gallery is where a user BROWSES; the dialog stays
   where a user CREATES.

   THE PREVIEW IS DATA, NOT AN ASSET. There are no thumbnail files in this
   project and adding an image pipeline would add a dependency and a failure
   mode. The card's glyph strip is drawn from the template's OWN `nodes` with the
   existing `ShapePreview`, so a preview cannot drift from the template it
   previews, a new template previews correctly with no edit here, and the cost is
   zero bytes on disk. The strip takes the first `PREVIEW_MAX` DISTINCT shapes in
   node order and counts the remainder as `+N`; the phone tier shows at most
   `PREVIEW_MAX_PHONE` glyphs and its own counter, both in CSS, no state.

   THE GALLERY NEVER CREATES A BOARD. Its action hands a `${preset}:${templateId}`
   key to the caller, which opens the board dialog pre-selected on it. Board
   creation therefore stays single-owner (the dialog's caller), and this file
   contains no persistence call, no history push and no board mutation of any
   kind. That is asserted as a text scan by checks/package-templates.mjs.

   THE VOCABULARY IS THE APP'S OWN, NOT A NEW ONE: `.sp-overlay` scrim +
   `.sp-card` shell (as BoardDialog does with `.bd-overlay` / `.bd-card`), the
   `FOCUSABLE` selector imported from Settings.tsx, and the same
   capture-Escape + Tab-trap + `returnFocusTo` contract. Only the `.tg-*` rules
   are new, and they are TOKENS ONLY — no colour literal appears in this file or
   in that block. Tier behaviour lives entirely in styles.css, scoped on the
   form-factor / orientation attributes the interface hook already writes; this
   component adds no breakpoint, no layout prop and no state flag.
*/
import {useEffect, useMemo, useRef} from 'react';
import {X} from 'lucide-react';
import {COLOR_VAR, resolveColorKey, type Colored} from './colors';
import {asShape, ShapePreview, type Shape} from './shapes';
import {FOCUSABLE} from './Settings';
import {templateCatalog, type TemplateFamily} from './templateCatalog';
import type {PresetId, TemplateLevel} from './presets';

/* How many distinct glyphs a card shows. TWO numbers, and neither is a
   breakpoint: they are COUNTS of preview glyphs. The wide one is what the
   component renders; the phone tier hides everything past the fourth with one
   `:nth-child` rule and swaps in the matching counter, so the "+N" a user reads
   at either tier accounts for exactly the glyphs that tier did not draw. */
export const PREVIEW_MAX = 6;
export const PREVIEW_MAX_PHONE = 4;

export type PreviewGlyph = {shape: Shape; color: string};

/** The glyph strip for ONE node list: the first `max` DISTINCT shapes in NODE
 *  ORDER, de-duplicated, each carrying the colour its own node declares.
 *
 *  THE SHAPE SET IS NOT FILTERED, AND THAT IS DELIBERATE. `flow-basic` and its
 *  siblings carry no annotation at all, but the legacy `approval` carries three
 *  `group` lanes and the ERD template carries a `note` — and each of those is a
 *  real symbol the template really draws, with a real preview in `ShapePreview`.
 *  Excluding them here (as the SHAPE-SET acceptance probes do, for the different
 *  question "how many ISO 5807 ids does this level use") would make a whole
 *  family preview as an EMPTY strip.
 *
 *  NOTHING IS HARD-CODED HERE either — the strip is read out of the template's
 *  own nodes, so a template that adds a shape previews correctly with no edit to
 *  this file. A node with no shape at all (a `label` annotation, which has no
 *  `ShapePreview` art) is skipped rather than coerced: `asShape` falls back to a
 *  real id, and a fallback glyph would claim the template contains a shape it
 *  does not. */
export function previewGlyphs(
  nodes: readonly {data?: {shape?: unknown} & Colored}[] | undefined,
  max: number = PREVIEW_MAX,
): {glyphs: PreviewGlyph[]; distinct: Shape[]} {
  const distinct: PreviewGlyph[] = [];
  for (const n of nodes ?? []) {
    const raw = n?.data?.shape;
    if (typeof raw !== 'string' || !raw) continue;
    const shape = asShape(raw);
    if (distinct.some(g => g.shape === shape)) continue;
    distinct.push({shape, color: COLOR_VAR[resolveColorKey(n.data) ?? 'slate']});
  }
  return {glyphs: distinct.slice(0, Math.max(0, max)), distinct: distinct.map(g => g.shape)};
}

export type TemplateCard = {
  /** `${preset}:${templateId}` — the SAME key the board dialog's pre-selection
   *  takes, so handing the choice over needs no translation step. */
  key: string;
  preset: PresetId;
  presetLabel: string;
  templateId: string;
  label: string;
  hint: string;
  level: TemplateLevel | null;
  /** The group's own label (`Basic` / `Advanced` / `Complex`); `''` for an
   *  unlevelled family, whose cards would otherwise repeat the rail's family
   *  name twice. */
  levelLabel: string;
  nodes: number;
  edges: number;
  glyphs: PreviewGlyph[];
  extraWide: number;
  extraPhone: number;
  distinctShapes: number;
};

export type GalleryGroup = {id: string; label: string; level: TemplateLevel | null; cards: TemplateCard[]};
export type GalleryFamily = {preset: PresetId; label: string; hint: string; groups: GalleryGroup[]};

/** The CARD MODEL, derived from the ONE catalog. Order is the catalog's order —
 *  nothing is re-sorted here, so the gallery and the dialog cannot disagree
 *  about what exists or in what order.
 *
 *  An empty group would render a header over nothing. The catalog already omits
 *  empty groups; the filter below keeps that true even if it ever stopped, and
 *  checks/package-templates.mjs asserts the catalog's own behaviour rather than
 *  taking it on faith. */
export function galleryModel(families: TemplateFamily[] = templateCatalog()): GalleryFamily[] {
  return families
    .map(f => ({
      preset: f.preset,
      label: f.label,
      hint: f.hint,
      groups: f.groups
        .filter(g => g.entries.length > 0)
        .map(g => ({
          id: `${f.preset}:${g.level ?? 'none'}`,
          label: g.label,
          level: g.level,
          cards: g.entries.map(e => {
            const {glyphs, distinct} = previewGlyphs(e.t.nodes);
            return {
              key: `${e.preset}:${e.t.id}`,
              preset: e.preset,
              presetLabel: e.presetLabel,
              templateId: e.t.id,
              label: e.t.label,
              hint: e.t.hint ?? e.presetHint,
              level: e.level,
              levelLabel: e.level === null ? '' : g.label,
              nodes: e.t.nodes.length,
              edges: e.t.edges.length,
              glyphs,
              extraWide: Math.max(0, distinct.length - PREVIEW_MAX),
              extraPhone: Math.max(0, distinct.length - PREVIEW_MAX_PHONE),
              distinctShapes: distinct.length,
            };
          }),
        })),
    }))
    .filter(f => f.groups.length > 0);
}

type Props = {
  onCancel: () => void;
  /** The chosen `${preset}:${templateId}` key. The caller opens the board dialog
   *  with it; the gallery itself never touches a board. */
  onUse: (pick: string) => void;
  /** Focus restore, Settings.tsx's contract: on close, `.current?.focus()`. */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
};

export default function TemplatesGallery({onCancel, onUse, returnFocusTo}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const firstCard = useRef<HTMLButtonElement | null>(null);
  const sections = useRef<Record<string, HTMLElement | null>>({});

  // The catalog is static data: deriving the cards once keeps the glyph strips
  // and the section keys stable for the life of the modal.
  const model = useMemo(() => galleryModel(), []);

  // Keep the latest cancel for the document listener without re-binding it.
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  /* Escape (capture + stopPropagation, exactly as Settings.tsx and BoardDialog
     do it) and the Tab focus trap. Capture is what stops App's global handler
     from ALSO acting on the same key; App carries a second guard of its own. */
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

  /* The FIRST CARD takes focus on open, not the scrim: the cards are the thing
     being browsed, so a keyboard user starts on the content with no Tab first.
     Same painted-then-focus pattern Settings and BoardDialog use. */
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (firstCard.current) firstCard.current.focus();
      else cardRef.current?.focus();
    }, 10);
    return () => window.clearTimeout(t);
  }, []);

  // Focus restore: hand the caret back to the control that opened us.
  useEffect(() => () => { returnFocusTo?.current?.focus(); }, [returnFocusTo]);

  /* The rail navigates within one scroll container, so it needs no state: a
     rail item scrolls its section into view. A "current family" flag would be a
     UI state to persist or clear, and v1 deliberately has none. */
  const jump = (id: string) => { sections.current[id]?.scrollIntoView({block: 'start'}); };

  let flat = 0;

  return (
    <div
      className="sp-overlay tg-overlay"
      data-templates-gallery="true"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        ref={cardRef}
        className="sp-card tg-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tg-title"
        tabIndex={-1}
      >
        <div className="bd-head">
          <div>
            <h2 className="bd-title" id="tg-title">Templates</h2>
            <p className="bd-sub">
              Previews are drawn from each template’s own shapes. Choosing one opens New board with it pre-selected.
            </p>
          </div>
          <button type="button" className="bd-x" aria-label="Close" onClick={onCancel}><X size={14} /></button>
        </div>

        <div className="tg-body">
          {/* The family rail. It lists FAMILY → LEVEL, in the catalog's own
              order, and each item is a plain button that scrolls its section
              into view — it is navigation, not a filter (§3.5: level is a label
              and a grouping header, not a control). */}
          <nav className="tg-rail" aria-label="Template families">
            {model.map(f => (
              <div className="tg-rail-fam" key={f.preset}>
                <div className="tg-rail-fam-label">{f.label}</div>
                {f.groups.map(g => (
                  <button type="button" className="tg-rail-item" key={g.id} onClick={() => jump(g.id)}>
                    <span>{g.label}</span>
                    <span className="tg-rail-n">{g.cards.length}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="tg-grid">
            {model.map(f => f.groups.map(g => (
              <section className="tg-sec" key={g.id}>
                {/* `family — level`, except for an unlevelled family, whose group
                    label already IS the family name: composing them would print
                    "C4 — C4". Same rule the dialog's own headers use. */}
                <h3
                  className="tg-sec-hd"
                  ref={el => { sections.current[g.id] = el; }}
                >
                  {g.level === null ? f.label : `${f.label} — ${g.label}`}
                </h3>
                <div className="tg-tiles">
                  {g.cards.map(c => {
                    const isFirst = flat++ === 0;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        className="tg-tile"
                        ref={isFirst ? firstCard : null}
                        onClick={() => onUse(c.key)}
                      >
                        <span className="tg-tile-top">
                          <span className="tg-tile-name">{c.label}</span>
                          {c.levelLabel && <span className="tg-chip">{c.levelLabel}</span>}
                        </span>
                        <span className="tg-preview">
                          <span className="tg-glyphs">
                            {c.glyphs.map((gly, gi) => (
                              <span className="tg-glyph" key={`${c.key}:${gi}`}>
                                <ShapePreview shape={gly.shape} color={gly.color} />
                              </span>
                            ))}
                          </span>
                          {c.extraWide > 0 && <span className="tg-more tg-more-wide">+{c.extraWide}</span>}
                          {c.extraPhone > 0 && <span className="tg-more tg-more-phone">+{c.extraPhone}</span>}
                        </span>
                        <span className="tg-tile-hint">{c.hint}</span>
                        <span className="tg-tile-meta">
                          {c.nodes} nodes · {c.edges} edges · {c.presetLabel}
                        </span>
                        <span className="tg-tile-cta">Use template</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )))}
          </div>
        </div>
      </div>
    </div>
  );
}
