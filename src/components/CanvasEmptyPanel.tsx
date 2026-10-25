/* CanvasEmptyPanel.tsx — ROUND BN-3 PHASE B: the empty-state panel, lifted
 *  verbatim from App()'s <ReactFlow> children (App.tsx ~4732). The GATING
 *  (`boardLoaded && nodes.length === 0`) stays in App — boot-no-flash asserts
 *  it in App.tsx — so this component renders its body only when `show` is
 *  true and App owns the predicate. No context, no store. */
import {Panel} from '@xyflow/react';

type CanvasEmptyPanelProps = {
  /** App's gate: the board load has RESOLVED and the board truly has no nodes. */
  show: boolean;
};

/** The `.canvas-empty` hero: brand mark, title, sub and hint. Must stay a
 *  direct child of <ReactFlow> (the Panel positions itself in the viewport). */
export function CanvasEmptyPanel({show}: CanvasEmptyPanelProps) {
  if (!show) return null;
  return (
    <Panel
      position="top-center"
      className="canvas-empty"
      style={{marginTop: '12vh'}}
    >
      <div className="ce-title">
        {/* ROUND BH (public launch) — the Gobigrams icon as the panel's
            natural header, above the "This board is empty" title
            (.ce-logo, 240px hero, aspect-true 657:406, tokens only). pointer-events:none is
            inherited from .canvas-empty. */}
        <img className="ce-logo" src="/brand/logo-mark.svg?v=2" alt="Gobigrams" width={240} height={148} />
        This board is empty
      </div>
      <div className="ce-sub">
        Drag a shape from the left panel onto the canvas, or
        <br />
        <b>double-click anywhere</b> to search and insert one.
      </div>
      <div className="ce-hint">
        Then drag from a node's edge handle to connect · press <kbd>?</kbd> for shortcuts
      </div>
    </Panel>
  );
}
