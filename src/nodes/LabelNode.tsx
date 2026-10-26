import {memo, useEffect, useRef, useState} from 'react';
import {NodeResizer, type NodeProps} from '@xyflow/react';
import {textStyleVars, alignForBody, vAlignForBody, type TextStyle} from '../textStyle';
import {paintRotation, rotateTransform} from '../rotation';
import {RotateGrip} from '../components/RotateGrip';

/* ITEM 2b (2026-09-18) — THE AUTO-SHOW NODE TOOLBAR IS GONE FROM THIS KIND TOO.

   `src/nodes/DiagramNode.tsx` documents the removal in full (its header, and the
   button-by-button mapping of every action to the route that survives). This
   file now follows it, so all three node kinds behave the same: the floating
   action strip that used to appear above a SELECTED label never renders.

   WHAT WENT WITH THE RENDER: the strip was the only reader of the `__toolbar`
   slot this module declared, so the slot, its `ToolbarActions` type and the two
   now-unused imports went too — and `App.tsx` stopped injecting the value into
   every node's `data` (there is no consumer left). A dangling TYPE would have
   been a lie about a capability that no longer exists, which is why the slot is
   gone rather than merely unused.

   NOTHING BECAME UNREACHABLE: every one of the six buttons had a non-toolbar
   route before this change — duplicate (⌘/Ctrl+D), copy (⌘/Ctrl+C), delete
   (Del), and "add note here" / "bring to front" / "duplicate" / "copy" / "delete"
   on the right-click context menu. No route was added, because none was needed.
*/

/* ROUND R (2026-09-18) — THE LABEL IS RESIZABLE.

   Harvey: "For Text shape, I think it can be scale if needed." The label kind
   was the one kind with no resizer at all — not a disabled setting, an absent
   component. It is a different component from `DiagramNode`, so it never reached
   that file's RESIZABLE gate and never rendered a `<NodeResizer>`.

   THE FLOORS ARE SMALLER THAN A DIAGRAM NODE'S (140x80), because a text label is
   not a service box and must be allowed to read as a caption. They are derived
   from the box it actually draws, not picked by eye:

     VERTICAL — the box is `font-size: 13px; line-height: 1.5` with `padding: 4px`
     top and bottom, so one line occupies 19.5px and the padding adds 8px. 48 =
     8 + 2 x 19.5, i.e. the floor is exactly TWO wrapped lines. It is also > 2 x 22:
     each corner grip paints 10px and carries a 6px negative-inset `::after` hit
     area (~22px, see `styles.css` C-FIX-3), so 48px keeps the top and bottom
     grips from overlapping into one ungrabbable blur. A floor of 80 (the diagram
     value) would be an empty box for a one-line caption.

     HORIZONTAL — 80: the same overlap test (80 > 2 x 22) and ~9 monospace
     characters of text run (80 - 12px padding = 68 / ~7.8px per char) so the
     floor is still a label rather than a sliver. It is deliberately ABOVE the
     sheet's `min-width: 60px`, which stays and keeps its old job: it is the floor
     for a label that has NO stored size (the demo board's `n100` and the flowchart
     `a11` template annotation are both in that state), where no resizer has run
     and nothing else would stop the box collapsing to its content.

   THE CLASS NAMES ARE THE SAME TWO `DiagramNode` PASSES, on purpose. Not cosmetic:
   `styles.css` `.resize-line { border-width: 0 !important }` is what suppresses
   React Flow's own 1px `variant: Line` border, which painted a SECOND selection
   border on top of the `.label-node.selected` ring — the "2 borders" defect.
   Different class names would silently re-enable it. */

/** Free-text annotation node. No handles, no chrome — plain text on the canvas. */
export type LabelKind = {
  text: string;
  /** ROUND S — injected per-node by App's `rfNodes` memo, exactly like the
   *  edge label's `onCommitLabel` in `rfEdges`. Props do NOT reach inside a
   *  custom node component, so a callback has to travel through `data`. */
  onCommitText?: (id: string, v: string) => void;
  /** ROUND S — review mode, threaded through `data` for the same reason (the
   *  read-only flag had to reach the edge renderer this way too — fix L). */
  readOnly?: boolean;
  /** ROUND ROTATE — geometry rotation (absent = 0) + App's grip writer. */
  rotation?: number;
  __rotate?: (id: string, phase: 'start' | 'delta' | 'end' | 'cancel', delta: number) => void;
  /** PACKAGE-P §E.2 — the Text section's stored style, same shape and same
   *  lazy-write discipline as the goblin kind (`src/textStyle.ts`). Absent on
   *  every board written before PACKAGE-P, and an absent one renders exactly as
   *  today: `textStyleVars` returns `{}` and the sheet's fallbacks win. */
  textStyle?: TextStyle;
};

/** PACKAGE-P §E.3(b) — the inspector panel, as a selector.
 *  The Text section's controls live inside this element, so "the pointer is
 *  inside the inspector" is a DOM question with a DOM answer rather than a
 *  prop threaded down from App. `src/App.tsx` renders the panel as
 *  `<aside className="panel right">`; if that class ever changes, the hold
 *  silently stops arming — which is why `checks/package-p-inspector.mjs`
 *  asserts BOTH halves (this string and the `<aside>` that carries it). */
const INSPECTOR_HOLD_SELECTOR = '.panel.right';

const LabelNode = memo(({id, data, selected}: NodeProps) => {
  const d = data as unknown as LabelKind;
  /* PACKAGE-P §E.2 — same custom properties, same one-spread mechanism as
     `src/nodes/DiagramNode.tsx`, so the Text section styles this kind with the same
     four writes it uses on a goblin. Empty object when nothing is stored.

     A label kind has NO `body`, so its inherited align is the plain one:
     `.label-node { text-align: var(--ts-align, left) }` (`styles.css:3307-3308`)
     — i.e. `alignForBody(undefined)`. Passing it (rather than letting the
     model assume) keeps this renderer and the panel on one answer.

     ROUND Z FIX 2 — the vertical default is passed the same way, and for a
     label it is `top`: `.label-node` is a plain `display: flex` column whose
     content starts at its `padding-top`, so `vAlignForBody(undefined)` is `top`
     — NOT the `middle` a single global constant used to claim. Reading the
     default off the target is what keeps the no-write state painting what the
     box already paints. */
  const tsVars = textStyleVars(d.textStyle, alignForBody(undefined), vAlignForBody(undefined));

  // Same gate as `DiagramNode`: the resizer exists only while selected. In
  // read-only review mode nothing can become selected (`elementsSelectable`
  // is false and the mode's toggle clears an existing selection), so this
  // branch cannot be reached there — see the round report.
  const resizer = selected ? (
    <NodeResizer
      minWidth={80}
      minHeight={48}
      lineClassName="resize-line"
      handleClassName="resize-handle"
    />
  ) : null;

  /* ROUND S (2026-09-18) — DOUBLE-CLICK TO TYPE IN PLACE.

     Harvey: "Với Text element, tôi muốn double click and input text inside
     directly too same as text for line connection." — the edge label's inline
     editor, on this node kind. Multi-line, so the editor is a <textarea>, not
     an <input> (the orchestrator's choice): a caption is allowed to contain a
     line break, and an <input> cannot hold one.

     THE SHAPE IS COPIED FROM `src/GoblinEdge.tsx` ON PURPOSE — local
     `editing`/`draft` state, a ref, a focus/select effect, `commit()` /
     `cancel()`, `onBlur` commits, Escape cancels. Two editors that behave
     differently for the same gesture would be the real defect.

     THE GESTURE IS FREE TO TAKE: App.tsx:3765 early-returns from the canvas
     insert palette while the target is inside `.react-flow__node`, so a
     double-click on this node never opened anything before and cannot now.

     ENTER IS NOT HIJACKED — it inserts a newline, because this is a textarea.
     COMMIT IS ⌘/Ctrl+Enter; Escape cancels; a click away (blur) commits. That
     is the one deliberate divergence from the edge editor, which is a
     single-line <input> and can therefore commit on a bare Enter. */
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);

  /* PACKAGE-P §E.3(b) — HOLD THE BLUR-COMMIT WHILE THE POINTER IS IN THE PANEL.

     THE DEFECT THIS CLOSES: the Text section only works "while typing" if
     clicking one of its controls does not end the edit. The editor is INSIDE
     the node, so as soon as the pointer lands on the panel React Flow drops the
     node selection and the textarea blurs — and `onBlur` commits, mid-edit,
     before the user's chosen Bold/colour/size is even applied to the node they
     are still typing into.

     THE MECHANISM is the one the spec names (`temporarilyDisableSubmit`,
     X1 §2.5.4): arm a HOLD on a pointerdown that lands inside the inspector,
     release it on pointerup/pointercancel. It is armed at the WINDOW in the
     CAPTURE phase and reads `event.target`, not the node's own box, because the
     press happens outside this element entirely — a listener on the node could
     not see it at all.

     WHY WINDOW AND NOT THE PANEL ELEMENT: the panel is mounted before any node
     is, so there is no ref to reach it from here, and adding one would be a
     second thing that can drift from the `<aside>` it points at. One selector
     string, asserted by the harness, is the smaller contract.

     THE HANDLERS BELOW ARE UNCHANGED, ON PURPOSE: `onBlur` still commits,
     Escape still cancels, ⌘/Ctrl+Enter still commits (§E.3, "deliberately NOT
     changing"). The hold is a guard AROUND them — it only decides whether THIS
     one blur is a commitment or an interruption. */
  const holdCommit = useRef(false);
  useEffect(() => {
    if (!editing) {
      holdCommit.current = false;
      return;
    }
    const insidePanel = (e: Event) =>
      !!(e.target as Element | null)?.closest?.(INSPECTOR_HOLD_SELECTOR);
    const onDown = (e: Event) => { holdCommit.current = insidePanel(e); };
    const onUp = () => { holdCommit.current = false; };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      // The panel can be collapsed/unmounted mid-edit; a stale hold would then
      // swallow the next real blur, so leaving edit mode always disarms.
      holdCommit.current = false;
    };
  }, [editing]);

  // One reader for the mode, used by the gesture — same as GoblinEdge's `ro`.
  const ro = !!d.readOnly;

  useEffect(() => {
    // The `select()` mirrors GoblinEdge's focus effect. `focus` alone would
    // leave the caret wherever it landed; selecting the whole caption is what
    // makes "double-click, type the replacement" work in one stroke.
    if (editing) window.setTimeout(() => area.current?.select(), 10);
  }, [editing]);

  const shown = d.text || 'Text';

  /* THE WRITE TARGETS `id`, THE DOUBLE-CLICKED NODE — not whichever node is
     selected. `id` is React Flow's `NodeProps.id`, i.e. the identity of THIS
     rendered node, and the whole editor lives inside its `onDoubleClick`, so
     the two can only ever agree. It would still be wrong to read App's `sel`
     closure here: React Flow can re-render this node outside a selection
     change, and the editor would then write to a different node than the one
     under the pointer. */
  const commit = () => {
    setEditing(false);
    if (draft !== (d.text ?? '')) d.onCommitText?.(id, draft);
  };

  const cancel = () => {
    setDraft(d.text ?? '');
    setEditing(false);
  };

  /* ROUND ROTATE — same root transform scheme as DiagramNode (see there):
     the transform rides the tsVars object so the exact `style={tsVars`
     literal the renderers use is kept. */
  const rotT = rotateTransform(paintRotation(d as {rotation?: number}));
  if (rotT) (tsVars as Record<string, string>).transform = rotT;
  const grip = selected && d.__rotate ? (
    <RotateGrip nodeId={id} rotation={d.rotation ?? 0}
      onGesture={(phase, delta) => d.__rotate!(id, phase, delta)} />
  ) : null;
  return (
    <div
      className={`label-node${selected ? ' selected' : ''}${editing ? ' editing' : ''}`}
      style={tsVars as React.CSSProperties}
      onDoubleClick={e => {
        // The node is draggable; without this the gesture also reaches the
        // pane / NodeWrapper. Same stop as GoblinEdge's label.
        e.stopPropagation();
        // Review mode: the caption stays READABLE, its editor never opens.
        if (ro) return;
        setDraft(d.text ?? '');
        setEditing(true);
      }}
      /* ROUND V — the tooltip has to be narrower than the box it describes.
         The fixed caption this replaces was 65 characters wide, i.e. wider than
         a small label's whole box, and `overflow: hidden` suppresses the native
         tooltip of an element that actually overflows — so it would vanish
         exactly on the labels that need it. The stored TEXT is always narrower
         than the thing it describes; the hint rides along only while it fits. */
      title={editing || ro ? undefined : `${shown}${shown.length <= 24 ? '  ·  Double-click to edit' : ''}`}
    >
      {resizer}
      {grip}
      {editing ? (
        /* `nodrag` — measured in @xyflow/system's useDrag: a pointerdown whose
           target matches `.nodrag` is dropped by the d3-drag filter, and
           without that class a text selection inside the textarea would be
           read as a node DRAG and the text could not be selected at all. The
           `stopPropagation` above does NOT cover this: React Flow's drag
           listener is on the wrapper, capturing at the native level. */
        <textarea
          ref={area}
          className="edge-label-input node-label-input nodrag"
          value={draft}
          rows={Math.max(1, draft.split('\n').length)}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { if (!holdCommit.current) commit(); }}
          onKeyDown={e => {
            // `isEditable` in App.tsx keeps every app shortcut inert while this
            // is focused, so Escape/⌘Z reach ONLY this handler.
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          }}
        />
      ) : (
        /* ROUND V — the read-only text gets its OWN box (`.label-text`) rather
           than sharing the root's. It is a plain block filling the root, so it
           wraps and clips exactly like the bare text did, but this root's border
           stays unclipped — which is what keeps the four resize grips (10px
           squares centred on that border) fully grabbable. */
        <div className="label-text">{shown}</div>
      )}
    </div>
  );
});

export default LabelNode;
