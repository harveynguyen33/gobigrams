/* INLINE-TITLE (t_cb9335df, 2026-11-12) — the shared in-place title editor for
 * goblin cards (.node-title/.note-title/.lo-title) and custom shapes: the title
 * should be editable where it paints (Harvey: "cho phép double click vào shape
 * để edit Title trực tiếp thay vì gõ vào inspector").
 * CONTRACT (checks/unisurf-inline-title.mjs): ONE single-line <input>, absolute
 * inside the element the title paints in — the text stays in flow UNDER it, so
 * opening reflows NOTHING. Font/colour inherit; alignment is READ off the
 * parent's computed justify-content (flex-centred rows cannot inherit
 * text-align). `nodrag nopan`: a text selection is never a node drag. Enter/
 * blur commit, Escape cancels (settled — the blur after Escape settles once),
 * empty commit reverts; every keydown stops propagation.
 * EDIT-WIDTH-FLOOR (t_7574b988): width is tied to the CARD, not the text band
 * — clamp(rowW, 65% of cardW, cardW-12). Wider than the band, the editor
 * OVERFLOWS it as an overlay (centred on the title's own box for centred
 * shapes, left-aligned otherwise) instead of growing the node: the band's
 * overflow:hidden (text is clipped to the silhouette) is suspended while
 * editing and restored on unmount — paint-only, the card's rect never moves.
 * On commit the input unmounts, the title renders back in its band and the
 * node re-measures as an inspector-typed title does; no width/height is ever
 * written to the node. Long text scrolls horizontally with the caret visible.
 * OUT OF SCOPE, BY DECISION: TABLE nodes (header renames via the inspector);
 * the `label` kind keeps its ROUND S textarea (LabelNode.tsx).
 * ZERO styles.css lines (6020 hard cap): every declaration is inline. */
import {useEffect, useRef, useState} from 'react';

export function InlineTitle({value, onCommit, onCancel}: {value: string; onCommit: (v: string) => void; onCancel: () => void}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const settled = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    /* select-all on open: "double-click, type the replacement" is one stroke. */
    el.select();
    const row = el.parentElement;
    if (!row) return;
    /* Flex-centred titles cannot inherit text-align — translate the parent's
       own computed justify-content onto the caret's line. */
    const j = getComputedStyle(row).justifyContent;
    const centered = /center/.test(j);
    el.style.textAlign = centered ? 'center' : /end|right/.test(j) ? 'right' : 'left';
    /* EDIT-WIDTH-FLOOR: measure the BAND (the row's parent) and the CARD, then
       clamp; the input overlays the row absolutely, so a width beyond the band
       overflows VISUALLY — the band's silhouette clipping is suspended below. */
    const card = row.closest('.node, .note-node, .custom-shape-node');
    const band = row.parentElement;
    const bcs = band ? getComputedStyle(band) : null;
    const rowW = bcs && band ? Math.min(row.clientWidth,
      band.clientWidth - parseFloat(bcs.paddingLeft) - parseFloat(bcs.paddingRight)) : row.clientWidth;
    const cardW = (card ?? row).clientWidth;
    const w = Math.min(Math.max(rowW, Math.round(cardW * 0.65)), cardW - 12);
    el.style.minWidth = '0px';
    el.style.width = w + 'px';
    el.style.right = 'auto';
    /* Centre on the row's OWN box (clientWidth — the row can stretch past its
       band via minWidth), never on the band-limited rowW used for the clamp. */
    el.style.left = (centered ? (row.clientWidth - w) / 2 : 0) + 'px';
    const clipped: [HTMLElement, string][] = [];
    for (let n = band; card && n && card.contains(n) && n !== card; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (c.overflowX !== 'visible' || c.overflowY !== 'visible') { clipped.push([n, n.style.overflow]); n.style.overflow = 'visible'; }
    }
    return () => { for (const [n, v] of clipped) n.style.overflow = v; };
  }, []);
  const finish = (commit: boolean) => {
    if (settled.current) return;
    settled.current = true;
    if (commit) onCommit(draft);
    else onCancel();
  };
  return (
    <input
      ref={ref}
      className="title-edit nodrag nopan"
      aria-label="Edit title"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onDoubleClick={e => e.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      }}
      style={{
        /* EDIT-BALANCE (t_864a8e0c) + WIDTH-FLOOR: overlay the title row (inset
           0, border-box); the mount effect pins the width to the CARD's clamp. */
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        boxSizing: 'border-box', minWidth: 80,
        margin: 0, padding: '0 2px', border: 'none', outline: 'none',
        borderRadius: 3, background: 'var(--surface)',
        color: 'inherit', font: 'inherit', textAlign: 'inherit',
        boxShadow: '0 0 0 2px var(--sel)', zIndex: 20,
      } as React.CSSProperties}
    />
  );
}

export default InlineTitle;
