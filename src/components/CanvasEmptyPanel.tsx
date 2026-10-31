/* CanvasEmptyPanel.tsx — ROUND BN-3 PHASE B: the empty-state panel, lifted
 *  verbatim from App()'s <ReactFlow> children (App.tsx ~4732). The GATING
 *  (`boardLoaded && nodes.length === 0`) stays in App — boot-no-flash asserts
 *  it in App.tsx — so this component renders its body only when `show` is
 *  true and App owns the predicate. No context, no store.
 *  ONBOARD-P3 (2026-10-31): the copy says what the product is FOR and offers the
 *  template route. `onBrowseTemplates` is App's ONE gallery opener — the same
 *  callback the boards menu calls, never a second path. */
import {Panel} from '@xyflow/react';

type CanvasEmptyPanelProps = {
  /** App's gate: the board load has RESOLVED and the board truly has no nodes. */
  show: boolean;
  /** opens the templates gallery (App's `openTemplates`). */
  onBrowseTemplates: () => void;
};

/** The `.canvas-empty` hero: brand mark, title, sub, the two ways in and a hint.
 *  Must stay a direct child of <ReactFlow>. `.canvas-empty` is pointer-events:none
 *  so clicks reach the canvas; the action row opts back IN or the button is dead. */
export function CanvasEmptyPanel({show, onBrowseTemplates}: CanvasEmptyPanelProps) {
  if (!show) return null;
  return (
    <Panel position="top-center" className="canvas-empty" style={{marginTop: '12vh'}}>
      <div className="ce-title">
        {/* ROUND BH — the Gobigrams icon as the panel's natural header above the
            title (.ce-logo, 240px hero, aspect-true 657:406, tokens only). */}
        <img className="ce-logo" src="/brand/logo-mark.svg?v=2" alt="Gobigrams" width={240} height={148} />
        Draw your system
      </div>
      <div className="ce-sub">Boxes, arrows, and what flows between them.</div>
      <div className="ce-actions">
        <button type="button" className="ce-btn" onClick={onBrowseTemplates}>Start from a template</button>
        <span className="ce-or">or drag a shape from the left</span>
      </div>
      <div className="ce-hint">
        Then drag from a node's edge handle to connect · press <kbd>?</kbd> for shortcuts
      </div>
    </Panel>
  );
}
