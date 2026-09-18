import {memo} from 'react';
import {NodeResizer, type NodeProps} from '@xyflow/react';

/* ITEM 2b (2026-09-18) — THE AUTO-SHOW NODE TOOLBAR IS GONE FROM THIS KIND TOO.

   `src/DiagramNode.tsx` documents the removal in full (its header, and the
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
};

const LabelNode = memo(({data, selected}: NodeProps) => {
  const d = data as unknown as LabelKind;

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

  return (
    <div className={`label-node${selected ? ' selected' : ''}`}>
      {resizer}
      {d.text || 'Text'}
    </div>
  );
});

export default LabelNode;
