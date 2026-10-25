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

/** ROUND AK, AK-8 — `presetId` WAS A FIELD HERE, AND IT IS GONE.

 *  It existed for exactly ONE consumer: the Cardinality gate, which §A.3 wrote
 *  as `kind === 'edge' && preset.id === 'erd'`. That is the SAME board-level key
 *  the deleted `labelPresets` used, and it has the same defect: `preset` is ONE
 *  string on the BOARD document, so a board holding a flowchart template AND a
 *  C4 template makes it a lie about half its edges. With the gate re-keyed onto
 *  the EDGE's own data (`hasCrowFootEnds` below) nothing reads `presetId`, so
 *  the field is REMOVED rather than left as an unused hook a future pass might
 *  reach for by habit.
 *
 *  NOTHING ELSE IN THE TREE CONSUMES IT — verified by grep: `presetId` appears
 *  in `App.tsx` only as the board-preset STATE (`const [presetId, setPresetId]
 *  = useState<PresetId>`, `adoptBoardPreset`, the save payload), which is board
 *  metadata and unrelated to this target type. The panel still needs that state
 *  for the palette / legend / template defaults; it simply no longer hands it to
 *  the section decision. */

/** The discriminated selection the inspector must render for. */
export type InspectorTarget =
  | {kind: 'edge';
      /** ROUND AK, AK-8 — THE CARDINALITY GATE, READ FROM THE EDGE ITSELF.
       *  `true` when the edge carries a crow's-foot marker on EITHER end. The
       *  predicate is computed by the caller from the selected edge's own
       *  `markerStart` / `markerEnd` (`isCrowFoot()` in `src/Crowfoot.tsx`), so a
       *  section can no longer appear or vanish because of the board's preset.
       *
       *  THE CONSEQUENCE IS DELIBERATE (spec §2): a plain C4 board whose edge has
       *  no crow's-foot LOSES the Cardinality section — correct, it has no
       *  cardinality to express — and an ERD-styled edge on a non-ERD board
       *  GAINS it, which is the fix Harvey's question asks for. */
      hasCrowFootEnds?: boolean}
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

/* ROUND AG2, ITEM 1 — `sub` renders for the NON-flowchart goblins only.

   HARVEY'S QUESTION: "flowchart có cần phải có sub label ko hay chỉ cần 1 label
   là đủ (title)". The answer from the notation is NO, and it is verified rather
   than assumed. Mermaid's flowchart nodes take ONE label — `id1[This is the text
   in the box]` — and to get two lines you embed a break inside that SAME label;
   there is no second-label concept. draw.io's flowchart stencil ships
   `value=''` with no second-label slot at all (it has `labelPosition` and
   `verticalLabel`, i.e. position and rotation, never a sub-label). So the field
   was offering a slot the notation does not have, and the editor's own data
   agrees: every flowchart entry is created through `fc()` / `flowNode()` in
   `src/presets.ts`, both of which hard-code `sub: ''` and `body: 'label-only'`
   (one centred sentence), so a flowchart node has never shipped with a sub.

   IT IS NOT DEAD UI IN GENERAL, WHICH IS WHY THE RULE IS NARROW. The SAME
   `data.sub` on a Lane ("role"), a C4 container ("technology") or a C4 boundary
   ("boundary") is real, populated text that paints — measured. Only the
   flowchart vocabulary is excluded.

   WHY THE RULE KEYS ON THE SHAPE, NOT THE ACTIVE PRESET. Two reasons, either one
   sufficient: (a) the goblin target this function is handed is
   `{kind, shape, body}` — it carries no preset id, so a preset-keyed rule could
   not be expressed without widening `InspectorTarget` for the benefit of one
   predicate; (b) even with the preset it would be wrong, because `process` and
   the rest of the flowchart vocabulary are ALSO offered by the Mixed ("custom")
   palette, so a board on `custom` would keep the field the user asked to remove.
   The shape is the only key that answers the question for every palette.

   WHY THE LIST IS DECLARED HERE RATHER THAN IMPORTED. `FLOWCHART_EXTRA_SHAPES`
   lives in `src/shapes.tsx`, which is JSX: a `.ts` module cannot import it under
   Node's type-stripping, and importing a `.tsx` module from `.ts` needs
   `allowImportingTsExtensions`, which this project's tsconfig does not set. This
   module already names its special shapes as literals for exactly this reason
   (`t.shape !== 'group'`, `t.shape !== 'note'`); the table below is that same
   convention carried to a set. `checks/round-ag2-copy-sub-swatch.mjs` asserts it
   still covers every id `FLOWCHART_EXTRA_SHAPES` declares, so the two cannot
   drift apart in either direction.

   THE DATA IS UNTOUCHED. This hides a FIELD; it does not remove `sub` from the
   node data model or from the renderer. A board that already carries a `sub` on
   a flowchart node still paints it (both branches of `src/DiagramNode.tsx`) —
   asserted by server-rendering the shipped painter in the round's harness. */
export const NO_SUB_SHAPES: Shape[] = [
  /* the ten ISO 5807 shapes */
  'terminator', 'process', 'decision', 'io', 'document', 'subprocess',
  'manual', 'delay', 'connector', 'preparation',
  /* ROUND AD's six additions */
  'offpage', 'manualinput', 'display', 'storeddata', 'looplimit', 'internalstorage',
];

/** `sub` renders for a non-flowchart goblin: a Lane's `role`, a C4 container's
 *  `technology`, a C4 boundary's `boundary`. A flowchart node has one label, so
 *  it does not. */
export const hasSub = (t: InspectorTarget) =>
  t.kind === 'goblin' && !NO_SUB_SHAPES.includes(t.shape);

/** ROUND AI, ITEM 2 — `body` (`card` | `label-only`) renders for the nineteen
 *  non-flowchart goblins only. Harvey: "Với flowchart tôi nghĩ k cần dùng card!"
 *
 *  THE DATA IS UNTOUCHED, exactly as `hasSub` leaves `sub` alone. This hides a
 *  FIELD; it does not remove `body` from the node model or from the painter. A
 *  flowchart node that already carries `body: 'card'` still paints as a card —
 *  `src/DiagramNode.tsx`'s two branches are unchanged — asserted in
 *  `checks/round-ai-body-valign.mjs` (ai2-6) by server-rendering the shipped
 *  painter, so hiding the control cannot rewrite the value.
 *
 *  IT REUSES `NO_SUB_SHAPES` RATHER THAN NAMING THE SIXTEEN AGAIN. The two
 *  questions have the same answer for the same reason — a flowchart shape has
 *  one centred label and nothing to sub or to switch — and this project has
 *  already paid for a second copy of a shape list drifting away from the first.
 *  `checks/round-ag2-copy-sub-swatch.mjs` keeps `NO_SUB_SHAPES` covering every
 *  id `FLOWCHART_EXTRA_SHAPES` declares, so this predicate inherits that guard. */
export const hasBody = (t: InspectorTarget) =>
  t.kind === 'goblin' && !NO_SUB_SHAPES.includes(t.shape);

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

   PASS 2 COMPLETED THE ONE OMISSION THIS FUNCTION EVER HAD. §A.3 gives every
   goblin a Text section and every label one; until now the goblin list carried
   only `content` and `style`, because returning an id the render layer cannot
   paint would make this function's answer disagree with the panel — the worst
   possible state for the module whose whole job is to be the single source of
   truth. The Text section (§E — size / weight / colour / align, persisted as
   `node.data.textStyle`) now HAS a painter and a body, so `text` is returned
   for a goblin and sits BETWEEN `content` and `style`, exactly where the
   omission note promised it would go. Nothing else about the ordering changed.

   A LABEL'S `text` SECTION IS NOW THE SAME SECTION, not a namesake. It used to
   be the `label` branch's 4-row `<textarea>` — a SECOND writer for the `text`
   the in-place editor on the canvas writes (`src/LabelNode.tsx`). §E.3 removes
   that textarea in the same pass that lands its replacement, so a label target
   renders size / weight / colour / align here and has exactly ONE text editor:
   the in-place one. It is still NOT `kind: 'goblin'`, so it is never asked for
   a Content or Style section.
--------------------------------------------------------------------------- */
export function getInspectorSections(target: InspectorTarget): InspectorSection[] {
  switch (target.kind) {
    case 'edge': {
      /* ORDER (per the header note above — `text` sits between content and style
         for a goblin, which is why THAT branch is written out rather than zipped
         from a single array). The edge list is the §D order.

         ROUND AK, AK-8 — CARDINALITY IS NOW GATED ON THE EDGE, NOT THE PRESET.
         It used to read `target.presetId === 'erd'`, i.e. the BOARD's diagram
         type — the same board-level key the deleted `labelPresets` gate used, and
         wrong for the same reason: one board can hold a flowchart template AND a
         C4 template, so `preset` is a lie about half its edges. The condition is
         now `hasCrowFootEnds`, computed by the caller from the SELECTED EDGE's own
         `markerStart` / `markerEnd` via `isCrowFoot()` — the precedent §A.2 set for
         nodes (`hasSub` keys on the SHAPE, "because even with the preset it would
         be wrong"). §A.3's consequence is accepted deliberately: a C4 edge with no
         crow's-foot loses the section, an ERD-styled edge on a non-ERD board gains
         it.

         ROUND AM, AM-2 — `text` NOW SITS IN THIS LIST, and its POSITION is the
         whole argument for it. The header note above states the goblin order as
         `content → text → style` and gives the reason: a target's reason to exist
         first, then how its text is FORMATTED, then the shape/line it is painted
         with. An edge's equivalent of "content" is its LABEL — the words on the
         line, which is the one thing an edge carries that a user reads — so the
         edge order is the same ladder read in the edge's own vocabulary:
         `label → text → line → markers → [cardinality] → flow`.

         WHY IT IS NOT APPENDED AT THE END (the tempting one-line change). An
         appended `text` would put "how big is the text" AFTER "what colour is the
         line", "which arrowheads" and "which cardinality" — i.e. three sections
         about the PATH between the label and the control that formats that label.
         The goblin branch could zip its ids from one array; this one is written
         out precisely because `text`'s index is a decision and a decision belongs
         where a reader can see it.

         THE SECTION IS NOT A NAMESAKE OF THE GOBLIN'S. Both read the SAME
         `TextStyle` model and the SAME `textStyleVars` emitter (`src/textStyle.ts`
         — one text vocabulary, deliberately not a second), but an edge label is
         an inline chip with no padded box to align INSIDE, so this target renders
         SIZE / WEIGHT / FONT and never ALIGN or vAlign. That omission is a fact
         about the label, not an unfinished row: its position is the drag gesture
         (`data.labelOffset`), which is a different affordance from `text-align`.
         The edge's text COLOUR also stays where it already is — `labelTextKey` in
         the LABEL section — so the colour control is not duplicated here. */
      const ids: SectionId[] = ['label', 'text', 'line', 'markers'];
      if (target.hasCrowFootEnds) ids.push('cardinality');
      ids.push('flow');
      return ids.map(sec);
    }
    case 'table':
      return (['table', 'columns', 'showMode'] as const).map(sec);
    case 'label':
      return (['text'] as const).map(sec);
    case 'goblin':
      return (['content', 'text', 'style'] as const).map(sec);
  }
}
