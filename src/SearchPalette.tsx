import {useEffect, useMemo, useRef, useState} from 'react';
import {type PaletteItem, TYPE_LABEL, SOURCE_PURPOSE} from './palette';
import {COLOR_VAR} from './colors';
import {ShapePreview} from './shapes';
import {matchesQuery} from './paletteSearch';

type Props = {
  /** Insert the palette item at the double-clicked flow position.
   *  PACKAGE-N 2b: the payload is the item's unique `label`, not its index. The
   *  index was only ever valid because the caller rendered the SAME list it
   *  resolved against; the left panel now renders a FILTERED subset of the one
   *  library, so a rendered index no longer equals a library index and an
   *  index-based insert would silently create the wrong shape. */
  onInsert: (label: string) => void;
  onClose: () => void;
  /** The item set to search. §9: search runs over the WHOLE library — the one
   *  caller passes `LIBRARY`, so this modal can never offer fewer shapes than
   *  the left panel's omnibox does. */
  items?: PaletteItem[];
};

/**
 * Searchable node-insert palette (D1).
 * Opened by double-clicking empty canvas. Enter inserts the highlighted item,
 * arrow keys navigate, Esc / backdrop click closes.
 */
export default function SearchPalette({onInsert, onClose, items: source}: Props) {
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // No index survives here: the list is a pure projection of `source`, and the
  // insert payload is the label. Keeping an index around would keep the exact
  // trap PACKAGE-N 2b removes — a rendered position mistaken for a library one.
  //
  // PACKAGE-N 2c: the MATCHING RULE now lives in `paletteSearch.ts` and is
  // shared with the left panel's omnibox, so the modal and the sidebar can never
  // drift into two subtly different definitions of "matches". That moved the
  // filter from `label || hint || shape` to `label || hint || aliases[] ||
  // geometry` — "cylinder" and "subroutine" now find their shapes here too.
  const items = useMemo(() => {
    const all = source ?? [];
    if (!q.trim()) return all;
    return all.filter(p => matchesQuery(p, q));
  }, [q, source]);

  useEffect(() => { setHi(0); }, [q]);

  // keep the highlighted row in view when navigating with arrows
  useEffect(() => {
    listRef.current?.querySelector('.sp-item.on')?.scrollIntoView({block: 'nearest'});
  }, [hi]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[hi]) onInsert(items[hi].label); }
  };

  return (
    <div
      className="sp-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onDoubleClick={e => e.stopPropagation()}
    >
      <div className="sp-card">
        <input
          ref={inputRef}
          className="sp-input"
          placeholder="Search shapes…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={onKey}
        />
        <div className="sp-list" ref={listRef}>
          {items.map((p, idx) => (
            <button
              type="button"
              key={`${p.label}-${idx}`}
              className={`sp-item${idx === hi ? ' on' : ''}`}
              onMouseEnter={() => setHi(idx)}
              onClick={() => onInsert(p.label)}
            >
              <span className="pal-swatch">
                {p.kind === 'label'
                  ? <span style={{color: COLOR_VAR[p.colorKey]}}>T</span>
                  : <ShapePreview shape={p.shape} color={COLOR_VAR[p.colorKey]} />}
              </span>
              <span className="pal-meta">
                <span>{p.label}</span><small>{p.hint}</small>
                {/* HARVEY 2026-10-13 — source badge + one-line purpose: four
                    diagram languages share one search, so near-identical
                    shapes (three cylinders for "datab") must say WHO they are
                    and WHAT they are for, or the list is a guessing game. */}
                <small className="sp-src">
                  {p.types.map(t => TYPE_LABEL[t]).join(' · ')}
                  {' — '}{p.purpose ?? SOURCE_PURPOSE[p.category]}
                </small>
              </span>
            </button>
          ))}
          {!items.length && <div className="sp-empty">No shape matches “{q}”.</div>}
        </div>
        <div className="sp-foot"><kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>Enter</kbd> insert · <kbd>Esc</kbd> close</div>
      </div>
    </div>
  );
}
