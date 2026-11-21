import {useEffect, useLayoutEffect, useRef, useState} from 'react';

/**
 * F2 — Context menu for node / edge / pane right-clicks.
 * Auto-flips so it never leaves the viewport; closes on pane click, Escape,
 * wheel/scroll, window resize, or any menu action.
 */

export type CtxTarget =
  | {kind: 'node'; id: string; x: number; y: number}
  | {kind: 'edge'; id: string; x: number; y: number}
  | {kind: 'pane'; x: number; y: number};

export type CtxAction =
  | 'duplicate' | 'copy' | 'delete' | 'front' | 'back'
  | 'editLabel' | 'reverse'
  /* GROUP-OBJECT + LOCK v1 (t_c5023f3b) — 'note' was retired with the
     NOTE_ENABLED=false palette hide; the dead App handler went with it. */
  | 'group' | 'ungroup' | 'lock'
  | 'addNode' | 'paste' | 'selectAll' | 'fitView';

/* Per-selection row state, derived ONCE in useGroupLock (the menu only
   READS it — a second copy here is exactly how the rows drifted from what
   the keyboard would do). MENU-STATES (t_8b56f71a): a row can now also be
   disabled, carry a different label, and say WHY it is refused. */
export type CtxRow = {disabled?: boolean; label?: string; hint?: string};
export type CtxMenuState = Partial<Record<CtxAction, CtxRow>>;

type Item =
  | {kind: 'action'; id: CtxAction; label: string; icon?: React.ReactNode; disabled?: boolean; danger?: boolean}
  | {kind: 'sep'};

const NODE_ITEMS: Item[] = [
  {kind: 'action', id: 'duplicate', label: 'Duplicate'},
  {kind: 'action', id: 'copy', label: 'Copy'},
  {kind: 'sep'},
  /* GROUP-OBJECT + LOCK v1 (t_c5023f3b) — Group/Ungroup act on the whole
     selection; 'lock''s label flips to Unlock through the `menu` prop. */
  {kind: 'action', id: 'group', label: 'Group'},
  {kind: 'action', id: 'ungroup', label: 'Ungroup'},
  {kind: 'action', id: 'lock', label: 'Lock'},
  {kind: 'sep'},
  {kind: 'action', id: 'front', label: 'Bring to front'},
  {kind: 'action', id: 'back', label: 'Send to back'},
  {kind: 'sep'},
  {kind: 'action', id: 'delete', label: 'Delete', danger: true},
  /* 'Add note here' REMOVED (2026-10-23, HARVEY) — the Note shape is hidden
     from every create surface (NOTE_ENABLED=false); the context menu must not
     re-offer it. The handler in App.tsx ctxAction stays (dead code behind a
     removed menu row) — flagged for removal if NOTE_ENABLED ever ships false
     permanently. */
];

const EDGE_ITEMS: Item[] = [
  {kind: 'action', id: 'editLabel', label: 'Edit label'},
  {kind: 'action', id: 'reverse', label: 'Reverse direction'},
  {kind: 'sep'},
  {kind: 'action', id: 'delete', label: 'Delete', danger: true},
];

const PANE_ITEMS: Item[] = [
  {kind: 'action', id: 'addNode', label: 'Add node here'},
  {kind: 'action', id: 'paste', label: 'Paste'},
  {kind: 'sep'},
  {kind: 'action', id: 'selectAll', label: 'Select all'},
  {kind: 'action', id: 'fitView', label: 'Fit view'},
];

export default function ContextMenu({
  target, onAction, onClose, menu,
}: {
  target: CtxTarget;
  onAction: (action: CtxAction) => void;
  onClose: () => void;
  menu?: CtxMenuState;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{left: number; top: number} | null>(null);

  const items = target.kind === 'node' ? NODE_ITEMS : target.kind === 'edge' ? EDGE_ITEMS : PANE_ITEMS;

  // Measure once rendered and clamp inside the viewport (never overflow).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(target.x, window.innerWidth - r.width - 8));
    const top = Math.max(8, Math.min(target.y, window.innerHeight - r.height - 8));
    setPos({left, top});
  }, [target.x, target.y]);

  // Close on outside mousedown, Escape, scroll (wheel or scroll event), resize.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as any)) onClose();
    };
    const onWheelScroll = (e: Event) => {
      // Wheel events fire before a scroll happens — the menu must vanish.
      if (e.target instanceof Node && ref.current?.contains(e.target)) return;
      onClose();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onRes = () => onClose();
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('wheel', onWheelScroll, {passive: true, capture: true});
    window.addEventListener('scroll', onWheelScroll, {passive: true, capture: true});
    window.addEventListener('keydown', onEsc, true);
    window.addEventListener('resize', onRes);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('wheel', onWheelScroll, {capture: true} as any);
      window.removeEventListener('scroll', onWheelScroll, {capture: true} as any);
      window.removeEventListener('keydown', onEsc, true);
      window.removeEventListener('resize', onRes);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{left: pos?.left ?? target.x, top: pos?.top ?? target.y, visibility: pos ? 'visible' : 'hidden'}}
      onContextMenu={e => e.preventDefault()}
    >
      <div className="ctx-title">
        {target.kind === 'node' ? 'Node' : target.kind === 'edge' ? 'Edge' : 'Canvas'}
      </div>
      {items.map((it, i) => {
        if (it.kind === 'sep') return <div key={i} className="ctx-sep" />;
        /* MENU-STATES (t_8b56f71a): everything below is a READ of the one
           derivation — no enabled/label logic lives in the menu. */
        const row = menu?.[it.id];
        return (
          <button
            key={it.id}
            type="button"
            className={`ctx-item${it.danger ? ' danger' : ''}`}
            data-ctx-action={it.id}
            disabled={row?.disabled === true}
            onClick={() => { onAction(it.id); onClose(); }}
          >
            <span className="ctx-label">{row?.label ?? it.label}</span>
            {row?.hint && <span className="ctx-hint">{row.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}