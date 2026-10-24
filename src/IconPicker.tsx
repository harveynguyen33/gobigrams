import {useEffect, useMemo, useRef, useState} from 'react';
import {ICON_NAMES, ICONS, iconLabel, lucideByName} from './lucideIcons';

type Props = {
  /** Stored icon value: a kebab-case lucide name, or a raw unicode glyph. */
  value: string;
  /** null clears the icon. */
  onPick: (name: string | null) => void;
};

const MAX_RESULTS = 300;

/**
 * Icon picker popover for node data.icon.
 * Search over the curated lucide set; anything that is not a lucide name is
 * rendered as plain text so the old unicode glyphs keep working.
 */
export default function IconPicker({value, onPick}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    const t = window.setTimeout(() => searchRef.current?.focus(), 10);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
      window.clearTimeout(t);
    };
  }, [open]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = needle ? ICON_NAMES.filter(n => n.includes(needle)) : ICON_NAMES;
    return all.slice(0, MAX_RESULTS);
  }, [q]);

  const Current = lucideByName(value);

  return (
    <div className="icon-field" ref={box}>
      <button
        type="button"
        className={`icon-trigger${open ? ' on' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Choose an icon"
      >
        <span className="icon-trigger-glyph">
          {Current ? <Current size={17} /> : (value || '–')}
        </span>
        <span className="icon-trigger-name">{value || 'none'}</span>
        <span className="icon-trigger-caret">▾</span>
      </button>

      {open && (
        <div className="icon-pop">
          <input
            ref={searchRef}
            className="icon-search"
            placeholder="Search icons…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && results[0]) { onPick(results[0]); setOpen(false); }
            }}
          />
          <div className="icon-grid">
            <button
              type="button"
              className={`icon-cell none${!value ? ' on' : ''}`}
              title="No icon"
              onClick={() => { onPick(null); setOpen(false); }}
            >
              none
            </button>
            {results.map(name => {
              const Ico = ICONS[name];
              return (
                <button
                  type="button"
                  key={name}
                  className={`icon-cell${value === name ? ' on' : ''}`}
                  title={name}
                  onClick={() => { onPick(name); setOpen(false); }}
                >
                  <Ico size={20} />
                </button>
              );
            })}
            {!results.length && <div className="icon-empty">No icon matches “{q}”.</div>}
          </div>
          <div className="icon-foot">
            <input
              className="icon-raw"
              placeholder="or type a glyph"
              value={Current ? '' : value}
              maxLength={3}
              onChange={e => onPick(e.target.value || null)}
              onKeyDown={e => { if (e.key === 'Enter') setOpen(false); }}
            />
            <span>{results.length} of {ICON_NAMES.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export {iconLabel};
