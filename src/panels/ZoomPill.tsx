/* APP-SPLIT t_b2cad7a8 (S7) — the zoom pill + the toolbar separator, moved
   verbatim from App.tsx. The pill is this plan's FIRST real component
   extraction (not a code move): it receives exactly the ONE prop the closure
   read before (rf) and no other context, and it subscribes to transform[2]
   alone — a pan moves transform[0]/[1] only, so it cannot re-render the pill.
   sep rides along because the toolbar receives it as the {sep} prop: one line,
   no other home, and moving it alone would cost a whole module for nothing. */
import {useStore, type ReactFlowInstance} from '@xyflow/react';
import Tooltip from '../ui/Tooltip';

// ---- C5: live zoom level for the zoom pill ----
export const ZoomPill = ({rf}: {rf: ReactFlowInstance | null}) => {
  const z = useStore(s => s.transform[2]);
  return (
    <Tooltip label="Reset zoom to 100%">
      <button
        type="button"
        className="zoom-pill"
        aria-label="Reset zoom to 100%"
        onClick={() => rf?.zoomTo(1)}
      >
        {Math.round(z * 100)}%
      </button>
    </Tooltip>
  );
};

export const sep = () => <span style={{width: 1, height: 18, background: 'var(--border)', flex: 'none'}} />;
