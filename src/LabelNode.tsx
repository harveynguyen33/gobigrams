import {memo} from 'react';
import {type NodeProps} from '@xyflow/react';

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

/** Free-text annotation node. No handles, no chrome — plain text on the canvas. */
export type LabelKind = {
  text: string;
};

const LabelNode = memo(({data, selected}: NodeProps) => {
  const d = data as unknown as LabelKind;
  return (
    <div className={`label-node${selected ? ' selected' : ''}`}>
      {d.text || 'Text'}
    </div>
  );
});

export default LabelNode;
