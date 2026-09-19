/* PACKAGE-P §A.1/§A.2/§D — the inspector's SECTION DECISION, as pure data.

   WHY THIS FILE EXISTS. The inspector body was ~500 lines of hard-coded branch
   JSX inside App.tsx, three branches deep (`edgeMode ? … : selCount >= 2 ? …
   : selected.type === 'table' ? …`), and the per-shape truth was implicit in
   whichever fields that branch happened to render. The upstream pattern this
   copies (`shapeActionPredicates.ts:88` → `getShapeActionPredicates()`) is the
   opposite: ONE function returns a predicate object, ONE ordered list drives the
   render, and no new conditional is ever scattered into render code.

   This module is therefore REACT-FREE and JSX-FREE on purpose. It answers
   exactly two questions — "which sections, in what order" (§A.1, §D) and "which
   content fields does this shape actually render" (§A.2) — and nothing else.
   `src/App.tsx` consumes the answers. If a future pass needs a third question
   answered, it belongs here, not in the render.

   SOURCE OF THE PREDICATES (§A.2), i.e. WHY the three shapes below are special:
   `src/DiagramNode.tsx` renders a DIFFERENT field set per shape — the note
   branch (`:239-258`) has no metric and no `IconGlyph`, the group branch
   (`:260-276`) has neither kicker nor metric, and `body: 'label-only'`
   (`:309-318`) collapses back to icon + title + sub. "All 19 shapes show the
   same Content panel" was precisely the gap this package closes. */

import type {Shape} from './shapes';

/** The discriminated selection the inspector must render for. */
export type InspectorTarget =
  | {kind: 'edge'; /** §A.3 writes the Cardinality condition as
       *  `kind === 'edge' && preset.id === 'erd'`, so the preset is part of the
       *  TARGET, not a second gate in the render. A non-ERD edge has no
       *  crow's-foot notation to offer, so the section is absent from the list
       *  entirely rather than rendered empty. */
      presetId?: string}
  | {kind: 'table'}
  | {kind: 'label'}
  | {kind: 'goblin'; shape: Shape; body: 'card' | 'label-only'};

/** Every section the inspector can render, across all four target kinds. */
export type SectionId =
  | 'content' | 'text' | 'style'                    // goblin (+ label for `text`)
  | 'table' | 'columns' | 'showMode'                // table
  | 'label' | 'line' | 'markers' | 'cardinality' | 'flow';   // edge

export type InspectorSection = {
  id: SectionId;
  /** Whether the section starts folded behind a trigger (§A.3 / §C). */
  collapsedDefault: boolean;
};

/* ---------------------------------------------------------------------------
   §A.2 — the field-level predicates.

   These are the `comparisons.ts` equivalent: the render layer consumes them as
   `hasKicker(t) && <Field name="kicker" />`, the same shape as upstream's
   `predicates.x && renderAction(x)`. They are exported (not module-private) so
   a harness can assert the truth table directly instead of counting rendered
   labels in a browser.
--------------------------------------------------------------------------- */

/** kicker renders for card + actor + note — NOT `group`, NOT `label-only`. */
export const hasKicker = (t: InspectorTarget) =>
  t.kind === 'goblin' && t.shape !== 'group' && t.body !== 'label-only';

/** metric + metricUnit render for card + actor only — NOT note, NOT group,
 *  NOT `label-only`. (`DiagramNode.tsx:313-318`; the note branch has none and
 *  the group branch has none.) */
export const hasMetric = (t: InspectorTarget) =>
  t.kind === 'goblin' && t.shape !== 'group' && t.shape !== 'note' && t.body !== 'label-only';

/** icon renders for card + actor + group + label-only — NOT `note`, whose
 *  branch draws no `IconGlyph` at all (`DiagramNode.tsx:267,291,309`). */
export const hasIcon = (t: InspectorTarget) =>
  t.kind === 'goblin' && t.shape !== 'note';

/* ---------------------------------------------------------------------------
   §A.3 / §C — which sections START folded.

   TWO, and only two: the "rarely changed" edge pair. Everything else opens.
   Read as a Record so a missing id is a type error rather than a silent `false`
   — pass 3 persists user overrides of these defaults, so the default set has to
   be enumerable, not implied.
--------------------------------------------------------------------------- */
export const COLLAPSED_DEFAULT: Record<SectionId, boolean> = {
  content: false,
  text: false,
  style: false,
  table: false,
  columns: false,
  showMode: false,
  label: false,
  line: false,
  markers: false,
  cardinality: true,
  flow: true,
};

/** The two sections that start folded, named once so a harness can assert the
 *  set without re-listing every id. */
export const FOLDED_BY_DEFAULT: SectionId[] = (Object.keys(COLLAPSED_DEFAULT) as SectionId[])
  .filter(id => COLLAPSED_DEFAULT[id]);

const sec = (id: SectionId): InspectorSection => ({id, collapsedDefault: COLLAPSED_DEFAULT[id]});

/* ---------------------------------------------------------------------------
   §A.1 — the single dispatch point.

   ORDER IS §D, and §D is OUR decision (upstream's order is fixed and its panel
   is top-LEFT; ours is right-hand and driver is what a solution architect does
   on the board). Per kind:

     edge   Label → Line → Markers → Cardinality → Flow animation
            naming an edge first; line style/colour next; arrowheads set once per
            edge type; cardinality + flow are set once when the diagram is laid
            out, so they sink to the bottom AND fold (§A.3).
     table  Table → Columns → Show mode          (unchanged from today)
     goblin Content → [Text] → Style
            the node's reason to exist, then text formatting, then the shape
            (picked at creation, rarely changed — but colour is frequent, so the
            section stays open while its `body` switch folds behind it).

   TWO DELIBERATE PASS-1 OMISSIONS, both stated as omissions rather than
   half-built sections:

   1. `text` IS NOT RETURNED FOR A GOBLIN. §A.3 gives every goblin a Text
      section, but the Text section is PASS 2 (§E) and the task scope for this
      pass is §A + §B + §D. Returning an id the render layer cannot paint would
      make this function's answer disagree with the panel — the worst possible
      state for the thing whose whole job is to be the single source of truth.
      PASS 2 INSERTS `text` BETWEEN `content` AND `style` HERE. Nothing else
      about the ordering changes.
   2. `text` IS RETURNED FOR A LABEL, and it is the section that already exists
      today: §D calls a label's pair "Text → Text style", which in the current
      source is the single `label` branch (`App.tsx:4517-4530`) holding the
      4-row `<textarea>`. That textarea is explicitly NOT removed in this pass
      (§E.3.1 removes it in pass 2, in the same pass as its replacement), so the
      section keeps its current id and its current contents. It is NOT
      `kind: 'goblin'`, so it is never asked for a Content or Style section.
--------------------------------------------------------------------------- */
export function getInspectorSections(target: InspectorTarget): InspectorSection[] {
  switch (target.kind) {
    case 'edge': {
      /* ORDER (per the header note above — `text` sits between content and style
         for a goblin, which is why THAT branch is written out rather than zipped
         from a single array). The edge list is the §D order, with Cardinality
         gated on the preset exactly as §A.3 states it. */
      const ids: SectionId[] = ['label', 'line', 'markers'];
      if (target.presetId === 'erd') ids.push('cardinality');
      ids.push('flow');
      return ids.map(sec);
    }
    case 'table':
      return (['table', 'columns', 'showMode'] as const).map(sec);
    case 'label':
      return (['text'] as const).map(sec);
    case 'goblin':
      return (['content', 'style'] as const).map(sec);
  }
}
