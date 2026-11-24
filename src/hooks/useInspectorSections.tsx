/**
 * JSX-SPLIT P0 (t_5c2d6fad) — the inspector-section registration machinery,
 * moved VERBATIM out of App.tsx (L1769-1842 at 83d9b69). Every inspector
 * branch registers its section bodies through `secBody` and paints them
 * through `renderSections`; P1-P3's extracted children each call THIS hook,
 * so the registry never crosses a component boundary as a fresh-identity
 * prop (that would defeat every child's memo).
 *
 * NAME DEVIATION, measured: the plan names the export
 * `useInspectorSections(ctx)`, but that name is LIVE in
 * src/canvas/inspectorState.ts (PACKAGE-P fold state, imported by App and
 * probed by checks/package-p-inspector.mjs), so a same-name export would
 * collide at the import site. The export is `useInspectorSectionRegistry`;
 * the FILE PATH stays where the plan puts it, with the S2/S3-precedent
 * extension .tsx — `renderSections` returns JSX and .ts cannot parse it.
 *
 * ZERO JSX CHANGE: the hook owns no state and reads no React lifecycle — it
 * is a per-render factory over the ctx (the registry map, the guards and the
 * painter were all fresh-per-render closures in App too, so the render
 * topology is unchanged; the four renderSections() call sites and every
 * secBody registration stay in App verbatim).
 */
import type * as React from 'react';
import {MarkerType} from '@xyflow/react';
import type {Edge} from '@xyflow/react';
import {Section} from '../pickers/Section';
import {SECTION_TITLES} from '../canvas/inspectorOptions';
import type {SectionId, InspectorSection} from '../canvas/inspector';

export type InspectorSectionRegistryCtx = {
  /** The ordered section list for the current inspector target (§D). */
  inspSections: InspectorSection[];
  /** The selected edge, for the cardinality folded readout. */
  selectedEdge: Edge | null;
  /** The edge's flow kind/count, for the flow folded readout. */
  eFlow: string;
  eFlowCount: number;
  /** Fold state, read straight off useInspectorSections() in the caller. */
  isCollapsed: (id: SectionId) => boolean;
  toggleSection: (id: SectionId) => void;
};

export function useInspectorSectionRegistry(ctx: InspectorSectionRegistryCtx) {
  const {inspSections, selectedEdge, eFlow, eFlowCount, isCollapsed, toggleSection} = ctx;
  /* ---- PACKAGE-P §A.1/§D: the ordered render ----------------------------
     Each branch REGISTERS its section bodies into `sectionBody` and then prints
     `renderSections()` — the ORDER comes from `inspSections`, i.e. from
     `src/inspector.ts` §D, not from the order the branches happen to build them
     in. That is the whole point of the pass: reordering the panel is now an edit
     to one array in a pure module, not a re-shuffle of 500 lines of JSX.

     `data-section` lands on every rendered section (§F.3 asserts the ordered
     list); `data-collapsed` is the literal `'false'` because there is no fold UI
     yet — §C's trigger rows and the `diagram-studio:inspector-sections`
     persistence are PASS 3. `data-collapsed-default` carries §A.3's truth table
     as data so pass 3 reads it instead of re-deriving it. */
  const sectionBody: Record<string, React.ReactNode> = {};
  const secBody = (id: SectionId, node: React.ReactNode) => { sectionBody[id] = node; };
  /** A branch is SHARED by several target kinds, so it may only REGISTER a body
   *  for a section the DECISION actually lists. `renderSections()` filters as
   *  well, but relying on that filter alone would hide the mistake: the body
   *  would still be built — its controlled reads and derived values evaluated —
   *  for a panel that never paints it. So the gate is expressed against
   *  `inspSections`, the same ordered list the painter walks: one source of
   *  truth, never a second copy of the ERD rule. */
  const hasSection = (id: SectionId) => inspSections.some(s => s.id === id);
  /* A section is only PAINTED when the current branch REGISTERED a body for it.
     `content` and `style` are goblin-only; `table`/`columns`/`showMode` are
     table-only; on a fresh board the fallback target is `{kind:'label'}`, whose
     `text` body the label branch registers. A section with no body would be an
     empty shell with a title, so it is skipped rather than rendered blank. */
  /* PASS 3 §C — THE FOLDED ROW'S CURRENT VALUE. A fold that hid the thing it
     controls would be a lie; both readouts read the SAME node/edge data the
     expanded controls bind to, so there is no second source to drift. `label`
     names the value for assistive tech without turning it into the button's
     accessible name, which stays the section title. */
  const CROW_WORD: Record<string, string> = {
    one: 'one', zeroOrOne: 'zero or one', many: 'many', zeroOrMany: 'zero or many',
  };
  const crowWord = (end: unknown): string => {
    const k = typeof end === 'string' ? end : '';
    if (!k) return 'none';
    return CROW_WORD[k] ?? (k === MarkerType.ArrowClosed ? 'arrow' : k);
  };
  /* `count` is a field of exactly three flows (the stepper renders for
     dots/icon/event, App.tsx:4570), so the readout reports a number only where
     the expanded body would show one. */
  const flowReadout = () =>
    eFlow === 'none' ? 'off'
      : (eFlow === 'dots' || eFlow === 'icon') ? `on · ${eFlowCount}`
      : 'on';
  const FOLDED_READOUT: Partial<Record<SectionId, {node: React.ReactNode; label: string}>> = {
    cardinality: {
      node: <>
        {crowWord((selectedEdge?.markerStart as any)?.type)}
        {' → '}
        {crowWord((selectedEdge?.markerEnd as any)?.type)}
      </>,
      label: 'ends',
    },
    flow: {node: flowReadout(), label: 'flow'},
  };
  const renderSections = () => inspSections
    .filter(s => sectionBody[s.id] != null)
    .map(s => (
      <Section
        key={s.id}
        id={s.id}
        title={SECTION_TITLES[s.id]}
        collapsedDefault={s.collapsedDefault}
        collapsed={isCollapsed(s.id)}
        onToggle={toggleSection}
        readout={FOLDED_READOUT[s.id]?.node}
        readoutLabel={FOLDED_READOUT[s.id]?.label}
      >
        {sectionBody[s.id]}
      </Section>
    ));
  return {secBody, hasSection, renderSections};
}
