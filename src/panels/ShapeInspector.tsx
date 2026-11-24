/**
 * JSX-SPLIT P1 (t_5c2d6fad) — the inspector's shape branch, moved VERBATIM
 * out of App.tsx (interior byte-for-byte; only docblocks + derived locals
 * are new). Census: 13 props MEASURED (the plan estimated 17 — inspTarget
 * is a branch constant derived inside; tsShown/tsStored/tsAlignDefault/
 * tsVAlignDefault/eFlow/eFlowCount derive from selected/selectedEdge +
 * module fns). The registry comes from the P0 hook INSIDE the child —
 * secBody/hasSection/renderSections never cross as fresh-identity props;
 * commitDesc/commitDescPaint moved with the branch (DESC-1/DA-3), their
 * nodes.find read becoming `selected.data` (App's `selected` IS that find).
 * update is useCallback-stabilised in App; the mount has no inline arrow
 * or object literal. NAME/PATH DEVIATIONS recorded on the P0 module apply.
 */
import * as React from 'react';
import type {Edge, Node} from '@xyflow/react';
import type {NodeKind} from '../nodes/DiagramNode';
import type {LabelKind} from '../nodes/LabelNode';
import {asShape, type Shape} from '../nodes/shapes';
import {
  getInspectorSections, hasKicker, hasSub, hasMetric, hasBody, hasIcon,
  type InspectorTarget, type SectionId,
} from '../canvas/inspector';
import {buildTsBody} from '../canvas/inspectorSections';
import {
  alignForBody, vAlignForBody, readTextStyle, mergeTextStyle,
  TEXT_ALIGN_OPTS, type TextStyle,
} from '../layout/textStyle';
import {C4, isC4Type, type DiagramPreset} from '../presets';
import {isColorKey, resolveColor, resolveColorKey} from '../theme/colors';
import {KEY_NOTE_TEXT} from '../theme/colorKeyNote';
import {DefinitionSection, descData, descPaintData, type DescPaint} from '../components/DefinitionSection';
import IconPicker from '../ui/IconPicker';
import {ShapesPicker, ToggleRow, RotationRow, type PickerOption} from '../ui/InspectorPickers';
import {norm180} from '../hooks/useRotation';
import {swatchRow} from '../components/swatchRow';
import {useInspectorSectionRegistry} from '../hooks/useInspectorSections';

/** The goblin `body` switch (§B #12) — TWO options, not nineteen. */
const BODY_OPTS: PickerOption[] = [
  {v: 'card', label: 'card', art: null},
  {v: 'label-only', label: 'label only', art: null},
];

export type ShapeInspectorProps = {
  /** The selected node object (App's `selected` — nodes.find(n => n.id === sel)). */
  selected: Node;
  sel: string | null;
  /** BODY toggle, in state per ROUND AD ITEM 5(a). */
  bodyModeOpen: boolean;
  setBodyModeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  keyNoteShown: boolean;
  dismissKeyNote: () => void;
  /** The board preset (App's useMemo'd getPreset). */
  preset: DiagramPreset;
  /** The single node-data write lane (useCallback-stabilised in App). */
  update: (patch: Partial<NodeKind> | Partial<LabelKind>) => void;
  /** The selected edge — the P0 registry's folded-readout input. */
  selectedEdge: Edge | null;
  /** Fold state, App's single useInspectorSections() instance. */
  isCollapsed: (id: SectionId) => boolean;
  toggleSection: (id: SectionId) => void;
  /** The commit riders' lanes (DESC-1/DA-3). */
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  pushHistory: () => void;
};

/* rf churns node.selected + re-creates .data with equal content on selection
   gestures, and React may discard useCallback caches (measured: update churned
   with deps untouched). §3.1 comparator: shallow everywhere, shallow-CONTENT
   on node/edge .data, `update` equal while `sel`+`pushHistory` hold. */
const sameDataShallow = (x: unknown, y: unknown) => x === y || (!!x && !!y && typeof x === 'object' &&
  Object.keys(x as object).length === Object.keys(y as object).length && Object.keys(x as object).every((k) => (x as Record<string, unknown>)[k] === (y as Record<string, unknown>)[k]));
const shapePropsEqual = (a: ShapeInspectorProps, b: ShapeInspectorProps) =>
  a.sel === b.sel && a.bodyModeOpen === b.bodyModeOpen && a.keyNoteShown === b.keyNoteShown
    && a.setBodyModeOpen === b.setBodyModeOpen && a.dismissKeyNote === b.dismissKeyNote
    && a.preset === b.preset && a.isCollapsed === b.isCollapsed
    && a.toggleSection === b.toggleSection && a.setNodes === b.setNodes
    && a.pushHistory === b.pushHistory && (a.update === b.update || (a.sel === b.sel && a.pushHistory === b.pushHistory))
    && sameDataShallow(a.selected?.data, b.selected?.data) && sameDataShallow(a.selectedEdge?.data, b.selectedEdge?.data);

export default React.memo(function ShapeInspector({
  selected, sel, bodyModeOpen, setBodyModeOpen, keyNoteShown, dismissKeyNote,
  preset, update, selectedEdge, isCollapsed, toggleSection, setNodes, pushHistory,
}: ShapeInspectorProps) {
  /* The shape arm of App's conditional chain — a branch CONSTANT, derived
     (spec §3.1: identical ⇒ derive inside, drop the prop). */
  const inspTarget: InspectorTarget = {
    kind: 'goblin', shape: asShape((selected.data as any).shape),
    body: (((selected.data as any).body ?? 'card') as 'card' | 'label-only'),
  };
  /* COMMIT RIDERS moved from App (DESC-1/DA-3), reading selected.data. */
  const commitDesc = (v: string) => {
    if (!sel) return;
    const cur = ((selected.data as {desc?: string} | undefined)?.desc ?? '');
    if (cur === v) return; /* a no-op blur pushes no history */
    pushHistory();
    setNodes(ns => ns.map(n => n.id === sel
      ? {...n, data: descData({...n.data}, v) as NodeKind} : n));
  };
  const commitDescPaint = (patch: DescPaint) => { /* DA-3 — commitDesc's lane; descPaintData's delete rule clears keys */
    if (!sel) return;
    pushHistory();
    setNodes(ns => ns.map(n => n.id === sel
      ? {...n, data: descPaintData({...n.data}, patch) as NodeKind} : n));
  };
  /* S3's text-style block, shape side: defaults read the goblin body, the
     stored field reads `selected.data`, the write goes through `update`. */
  const tsAlignDefault = alignForBody(inspTarget.kind === 'goblin' ? inspTarget.body : undefined);
  const tsVAlignDefault = vAlignForBody(inspTarget.kind === 'goblin' ? inspTarget.body : undefined);
  const tsStored = (selected.data as any)?.textStyle as TextStyle | undefined;
  const tsShown = readTextStyle(tsStored, tsAlignDefault, tsVAlignDefault);
  const writeTextStyle = (patch: Partial<TextStyle>) => {
    // undefined result means "nothing left to store" — the key is dropped
    // rather than left as an empty object, so `textStyle: undefined` never
    // reaches a board file.
    update({textStyle: mergeTextStyle(tsStored, patch, tsAlignDefault, tsVAlignDefault)} as any);
  };
  /* S3's ctx-taking factory — the text body is BUILT here, never passed in. */
  const ALIGN_OPTS: PickerOption[] = TEXT_ALIGN_OPTS.map(o => ({v: o.v, label: o.label, art: null}));
  const tsBody = buildTsBody({tsShown, writeTextStyle, ALIGN_OPTS});
  /* P0's registry hook — secBody/hasSection/renderSections are made HERE.
     eFlow/eFlowCount derive from selectedEdge exactly as App derived them. */
  const {secBody, hasSection, renderSections} = useInspectorSectionRegistry({
    inspSections: getInspectorSections(inspTarget),
    selectedEdge,
    eFlow: (((selectedEdge?.data as any)?.flow ?? 'none') as string),
    eFlowCount: (((selectedEdge?.data as any)?.flowCount ?? 3) as number),
    isCollapsed, toggleSection,
  });
  return (
    <>
              {/* ROUND Y, ITEM 3 — THE GOBLIN SHAPE BADGE IS GONE. It printed the
                  SHAPE's machine name (`service`, `queue`, `note`…) above the
                  panel, and the Style section's own shape picker already names
                  that same shape in the same panel — the trigger reads out
                  `current.label` (InspectorPicker' `icon-trigger-name`), so the
                  badge was a second, less readable copy of the control's own
                  readout. Nothing is disambiguated by it: a goblin's sections
                  (Content / Text / Style) name the target kind the same way they
                  do for every other kind. Deleted with its 12px spacer.

                  THE C4 CHIP STAYS AND IS THE ONE SURVIVOR — it is not a kind
                  label. `{C4[...].kicker}` states the node's C4 ROLE, which
                  NOTHING else prints. The spacer became PART of that
                  conditional: with the shape badge gone the chip is now
                  the only reason the spacer has to exist. */}
              {preset.id === 'c4' && isC4Type((selected.data as any).c4Type) && (
                <>
                  <span className="badge preset">
                    {C4[(selected.data as any).c4Type as keyof typeof C4].kicker}
                  </span>
                  <div style={{height: 12}} />
                </>
              )}
              {preset.note && <div className="preset-warn" style={{padding: '0 0 10px'}}>{preset.note}</div>}
              {(() => { secBody('content', <>
                {hasKicker(inspTarget) && (
                  <div className="field">
                    <label>kicker</label>
                    <input
                      value={((selected.data as any).kicker ?? '') as string}
                      onChange={e => update({kicker: e.target.value} as any)}
                    />
                  </div>
                )}
                {/* ROUND AG2, ITEM 1 — ONE label is enough for a flowchart
                    node (Mermaid/draw.io), so `sub` is gated on the §A.2
                    field predicate; the predicate hides the FIELD only: a
                    node that already carries a `sub` still paints it. */}
                {(['title', 'sub'] as const).filter(f => f !== 'sub' || hasSub(inspTarget)).map(f => (
                  <div className="field" key={f}>
                    <label>{f}</label>
                    <input
                      value={((selected.data as any)[f] ?? '') as string}
                      onChange={e => update({[f]: e.target.value} as any)}
                    />
                  </div>
                ))}
                {hasMetric(inspTarget) && (
                  <div className="field-row">
                    <div className="field">
                      <label>metric</label>
                      <input
                        value={((selected.data as any).metric ?? '') as string}
                        onChange={e => update({metric: e.target.value} as any)}
                      />
                    </div>
                    <div className="field">
                      <label>unit</label>
                      <input
                        value={((selected.data as any).metricUnit ?? '') as string}
                        onChange={e => update({metricUnit: e.target.value} as any)}
                      />
                    </div>
                  </div>
                )}
              </>); return null; })()}
              {/* DESC-1 — the Additional Description body, keyed by the node id so a new selection REMOUNTS with a fresh draft (no store-echo sync). DA-3: paint/onPaint wire the two panel-colour rows. */}
              {(() => { secBody('definition', <DefinitionSection key={sel ?? 'd'} value={((selected.data as any).desc ?? '') as string} onCommit={commitDesc} paint={(selected.data as any).descPaint} onPaint={commitDescPaint} />); return null; })()}
              {/* PACKAGE-P §E.1/§A.3 — the Text section, BETWEEN Content and
                  Style (the order is `src/inspector.ts`'s, not this file's).
                  `tsBody` is the one body both targets register: a goblin here,
                  a label in the branch above. */}
              {(() => { secBody('text', tsBody); return null; })()}
              {(() => { secBody('style', <>
                <div className="field">
                  <label>shape</label>
                  <ShapesPicker
                    value={asShape((selected.data as any).shape)}
                    onChange={v => update({shape: v as Shape} as any)}
                    color={resolveColor(selected.data as any)}
                  />
                </div>
                {/* ROUND ROTATE — the Rotation row lives in Rows.tsx
                    (RotationRow): App.tsx must carry no numeric input element
                    (a package-p invariant), and the row is presentational. */}
                <RotationRow
                  value={(((selected.data as any).rotation as number | undefined) ?? 0)}
                  onChange={v => update({rotation: v === 0 ? undefined : norm180(v)} as any)}
                />
                {/* HARVEY 2026-10-14 — the cylinder's plain option: drops the
                    two inner arcs (database / storeddata only); a cleared
                    shape leaves the flag stored but unread. */}
                {(() => {
                  const sh = asShape((selected.data as any).shape);
                  if (sh !== 'database' && sh !== 'storeddata') return null;
                  const on = (selected.data as any).plainCylinder !== false;
                  return (
                    <div className="field">
                      {/* HARVEY-CHOSEN LABEL — "Details" generalises to other
                          shapes with optional inner lines. */}
                      <label>details</label>
                      <ToggleRow
                        value={on ? 'plain' : 'disks'}
                        onChange={v => update({plainCylinder: v === 'plain'} as any)}
                        options={[
                          {v: 'disks', label: 'Full', art: null},
                          {v: 'plain', label: 'Minimal', art: null},
                        ]}
                        title="Details: Full keeps the inner lines, Minimal draws a bare shape"
                      />
                    </div>
                  );
                })()}
                {/* §C READ LITERALLY: the `body` toggle sits behind the Style
                    section's trigger as a SECOND-LEVEL disclosure inside Style
                    (never folding Style itself — §A.3/§F.4); the row's readout
                    is the CURRENT value; session-scoped open state. */}
                {/* ROUND AI, ITEM 2 — the row is GATED on `hasBody`, not
                    deleted: flowchart shapes dropped the card capability
                    ("Với flowchart tôi nghĩ k cần dùng card!"). The gate is the
                    predicate; the DATA is untouched, so a flowchart node
                    already carrying `body: 'card'` keeps painting as a card. */}
                {hasBody(inspTarget) && (
                <div className="field">
                  <button
                    type="button"
                    className="field-toggle-trigger"
                    aria-expanded={bodyModeOpen}
                    aria-controls="insp-body-toggle"
                    onClick={() => setBodyModeOpen(o => !o)}
                  >
                    <span className="insp-sec-caret" aria-hidden="true">{bodyModeOpen ? '▾' : '▸'}</span>
                    <span className="field-toggle-label">
                      body: {(((selected.data as any).body ?? 'card') as string)}
                    </span>
                  </button>
                  {bodyModeOpen && (
                    <div id="insp-body-toggle">
                      <ToggleRow
                        value={(((selected.data as any).body ?? 'card') as string)}
                        onChange={v => update({body: v as 'card' | 'label-only'} as any)}
                        options={BODY_OPTS}
                        title="Body"
                      />
                    </div>
                  )}
                </div>
                )}
                {/* §A.2: `note` draws no IconGlyph, so the field is absent —
                    not disabled — for exactly that shape. */}
                {hasIcon(inspTarget) && (
                  <div className="field">
                    <label>icon</label>
                    <IconPicker
                      value={((selected.data as any).icon ?? '') as string}
                      onPick={name => update({icon: name ?? ''} as any)}
                    />
                  </div>
                )}
                <div className="field">
                  <label>color</label>
                  {swatchRow(
                    resolveColorKey(selected.data as any),
                    k => update({colorKey: k, color: undefined} as any),
                    /* ROUND AO, AO-1c — THE LITERAL PATH, THE EXACT INVERSE OF THE
                       KEY WRITE ABOVE. Picking a custom hex CLEARS the symbolic key
                       and stores `color`. `resolveColor` then returns the literal
                       (`isColorKey(colorKey)` is false, so it falls through to the
                       `d.color` branch) and `resolveColorKey` returns `null` for an
                       arbitrary hex, so no hue swatch lights and the custom cell
                       takes the `.on` ring instead. Picking any KEY afterwards runs
                       the key write, which clears `color` — that is the whole
                       "back to a theme colour" path, so no separate reset control
                       is needed. THEME HONESTY: a literal cannot follow a theme; a
                       custom colour stays exactly as chosen across a theme switch,
                       which is the honest consequence of choosing one. */
                    {value: (selected.data as any).color, onPick: hex => update({color: hex, colorKey: undefined} as any)},
                  )}
                </div>
                {/* ROUND AD, ITEM 5(a) — the colour-key note: visible,
                    dismissible (persisted key), one line, no focus steal. */}
                {keyNoteShown && (
                  <div className="key-note" data-key-note="true">
                    <span className="key-note-text">{KEY_NOTE_TEXT}</span>
                    <span
                      className="key-note-x"
                      role="button"
                      tabIndex={0}
                      aria-label="Dismiss the color-key note"
                      title="Dismiss the color-key note"
                      onClick={dismissKeyNote}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          dismissKeyNote();
                        }
                      }}
                    >×</span>
                  </div>
                )}
              </>); return null; })()}
              {renderSections()}
    </>
  );
}, shapePropsEqual);
