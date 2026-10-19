import {useEffect, useMemo, useRef, useState} from 'react';
import {type Edge, type Node} from '@xyflow/react';
import {EXPORT_TOKENS, tokensFor} from './theme';
import {toMermaid, toMermaidSequence, fromMermaid} from './mermaid';

export type ExportScope = 'full' | 'selection';
export type ExportFormat = 'svg' | 'png' | 'json' | 'mermaid';
const THEME_CHOICES: {id: string; label: string}[] = [
  {id: 'live', label: 'live'},
  {id: 'dark', label: 'dark'},
  {id: 'light', label: 'light'},
  {id: 'paper', label: 'paper'},
  {id: 'midnight', label: 'midnight'},
  {id: 'contrast', label: 'contrast'},
];

type Props = {
  open: boolean;
  onClose: () => void;
  nodes: Node[];
  edges: Edge[];
  liveTheme: string;
  boardName?: string;
  selCount: number;
  /** Serialisers owned by App (they need the wrap ref + rf instance). */
  buildSvg: (o: {nodes: Node[]; edges: Edge[]; theme: string}) => Promise<string>;
  buildPng: (o: {nodes: Node[]; edges: Edge[]; theme: string}) => Promise<string>;
  /** AQ21-G — Import gets its own tab; JSON file picking stays in App (fileRef). */
  onImportJson: () => void;
};

/** AQ21 — the export modal. LEFT: scope + format + theme. RIGHT: a live
 *  preview of the actual artifact the Export button will download — the SAME
 *  code path, not a mock. Debounced so dragging across themes re-renders once. */
/** AR-2 — hoisted OUT of the ExportModal body: a component type declared inside
 *  the function body is a new identity every render, so React remounts the whole
 *  `.em-seg` subtree on every state change (measured 0/12 marker survival) and
 *  every CSS transition/hover/:active restarts. `selCount` and `tabRef` arrive
 *  as props; same JSX, same classes, same aria wiring as before. */
function Seg<T extends string>({value, set, options, aria, selCount, tabRef}: {
  value: T;
  set: (v: T) => void;
  options: {id: T; label: string}[];
  aria: string;
  selCount: number;
  tabRef: {current: HTMLButtonElement | null};
}) {
  return (
    <div className="em-seg" role="radiogroup" aria-label={aria}>
      {options.map(o => (
        <button
          key={o.id}
          ref={o.id === value ? tabRef : undefined}
          className={o.id === value ? 'on' : ''}
          onClick={() => set(o.id as T)}
          disabled={o.id === 'selection' && aria === 'Scope' && selCount === 0}
          title={o.id === 'selection' && selCount === 0 ? 'Nothing selected' : undefined}
        >{o.label}</button>
      ))}
    </div>
  );
}

export default function ExportModal({open, onClose, nodes, edges, liveTheme, boardName, selCount, buildSvg, buildPng, onImportJson}: Props) {
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [scope, setScope] = useState<ExportScope>('full');
  const [format, setFormat] = useState<ExportFormat>('svg');
  const [theme, setTheme] = useState('live');
  const [preview, setPreview] = useState<{kind: 'img' | 'text'; data: string; sub?: string} | null>(null);
  const [busy, setBusy] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const tabRef = useRef<HTMLButtonElement>(null);

  const scoped = useMemo(() => {
    if (scope === 'full') return {nodes, edges};
    const ids = new Set(nodes.filter(n => n.selected).map(n => n.id));
    return {
      nodes: nodes.filter(n => ids.has(n.id) || ids.has((n as {parentId?: string}).parentId ?? '')),
      edges: edges.filter(e => ids.has(e.source) && ids.has(e.target)),
    };
  }, [scope, nodes, edges]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(async () => {
      setBusy(true);
      try {
        const effTheme = theme === 'live' ? liveTheme : theme;
        if (format === 'svg') {
          const svg = await buildSvg({...scoped, theme: effTheme});
          setPreview({kind: 'img', data: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, sub: `${scoped.nodes.length} nodes · ${scoped.edges.length} edges`});
        } else if (format === 'png') {
          const url = await buildPng({...scoped, theme: effTheme});
          setPreview({kind: 'img', data: url, sub: '2× PNG'});
        } else if (format === 'json') {
          setPreview({kind: 'text', data: JSON.stringify({name: boardName, nodes: scoped.nodes, edges: scoped.edges}, null, 2).slice(0, 4000), sub: `${scoped.nodes.length} nodes · ${scoped.edges.length} edges`});
        } else {
          const isSeq = scoped.edges.some(x => (x.data as {seqMsg?: string})?.seqMsg);
          const text = isSeq
            ? toMermaidSequence(scoped.nodes, scoped.edges)
            : toMermaid(scoped.nodes, scoped.edges);
          setPreview({kind: 'text', data: text, sub: isSeq
            ? 'Mermaid sequenceDiagram — activations/fragments are not representable'
            : 'Mermaid flowchart — colours/text styles/icons are not representable'});
        }
      } catch (err) {
        setPreview({kind: 'text', data: `Preview failed: ${(err as Error)?.message ?? 'unknown'}`});
      }
      setBusy(false);
    }, 250);
    return () => window.clearTimeout(t);
  }, [open, scope, format, theme, nodes, edges, liveTheme, boardName, buildSvg, buildPng, scoped]);

  useEffect(() => {
    if (open) window.setTimeout(() => tabRef.current?.focus(), 30);
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);

  if (!open) return null;

  const doExport = async () => {
    setBusy(true);
    try {
      const effTheme = theme === 'live' ? liveTheme : theme;
      const base = (boardName?.replace(/[^\w.-]+/g, '_') || 'diagram');
      let blob: Blob; let name: string;
      if (format === 'svg') {
        blob = new Blob([await buildSvg({...scoped, theme: effTheme})], {type: 'image/svg+xml'});
        name = `${base}.svg`;
      } else if (format === 'png') {
        const url = await buildPng({...scoped, theme: effTheme});
        const bin = atob(url.split(',')[1] ?? '');
        blob = new Blob([new Uint8Array([...bin].map(c => c.charCodeAt(0)))], {type: 'image/png'});
        name = `${base}.png`;
      } else if (format === 'json') {
        blob = new Blob([JSON.stringify({name: boardName, nodes: scoped.nodes, edges: scoped.edges}, null, 2)], {type: 'application/json'});
        name = `${base}.json`;
      } else {
        const isSeq = scoped.edges.some(x => (x.data as {seqMsg?: string})?.seqMsg);
        const text = isSeq ? toMermaidSequence(scoped.nodes, scoped.edges) : toMermaid(scoped.nodes, scoped.edges);
        blob = new Blob([text], {type: 'text/plain'});
        name = `${base}.mmd`;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setBusy(false);
    }
  };

  const doImportMermaid = () => {
    const parsed = fromMermaid(importText);
    if (!parsed) { setImportMsg('Could not parse any nodes — is it a Mermaid flowchart?'); return; }
    window.dispatchEvent(new CustomEvent('gobi:mermaid-import', {detail: parsed}));
    setImportMsg(`Parsed ${parsed.nodes.length} nodes · ${parsed.edges.length} edges — inserting onto the board…`);
    window.setTimeout(onClose, 900);
  };

  return (
    <div className="sp-overlay em-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="em-modal" role="dialog" aria-label="Export or import diagram">
        <div className="em-left">
          {/* AQ21-G — Export and Import are SEPARATE tabs; mixing them in one
              column read as noise. */}
          <div className="em-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'export'} className={tab === 'export' ? 'on' : ''} onClick={() => setTab('export')}>Export</button>
            <button role="tab" aria-selected={tab === 'import'} className={tab === 'import' ? 'on' : ''} onClick={() => setTab('import')}>Import</button>
          </div>

          {tab === 'import' && (
            <div className="em-import">
              <div className="em-label">From Mermaid text</div>
              <textarea
                className="em-ta"
                placeholder={'flowchart TD\n  A[Service] -->|reads| B[(Database)]'}
                value={importText}
                onChange={ev => setImportText(ev.target.value)}
                rows={8}
                spellCheck={false}
              />
              <button className="em-go" onClick={doImportMermaid} disabled={!importText.trim()}>
                Insert onto board
              </button>
              {importMsg && <div className="em-note">{importMsg}</div>}
              <div className="em-note">Flowchart subset: node shapes, edge labels, subgraphs. Styling (classDef) is not imported.</div>

              <div className="em-label">From file</div>
              <button className="em-go secondary" onClick={onImportJson}>
                Import board JSON…
              </button>
              <div className="em-note">Replaces the current board's content with a saved .json board.</div>
            </div>
          )}

          {tab === 'export' && (<>
          <div className="em-label">Scope</div>
          <Seg<ExportScope> value={scope} set={setScope} aria="Scope" selCount={selCount} tabRef={tabRef} options={[
            {id: 'full', label: `Full board (${nodes.length})`},
            {id: 'selection', label: `Selected only (${selCount})`},
          ]} />

          <div className="em-label">Format</div>
          <Seg<ExportFormat> value={format} set={setFormat} aria="Format" selCount={selCount} tabRef={tabRef} options={[
            {id: 'svg', label: 'SVG'},
            {id: 'png', label: 'PNG'},
            {id: 'json', label: 'JSON'},
            {id: 'mermaid', label: 'Mermaid'},
          ]} />

          <div className="em-label">Theme</div>
          <Seg value={theme} set={setTheme} aria="Theme" selCount={selCount} tabRef={tabRef} options={THEME_CHOICES as {id: string; label: string}[]} />
          <div className="em-note">Preview and file both use the chosen theme — what you see is what downloads.</div>

          <button className="em-go" onClick={doExport} disabled={busy || !preview || (format === 'png' && !scoped.nodes.length)}>
            {busy ? 'Rendering…' : `Export ${format.toUpperCase()}`}
          </button>
          </>)}
        </div>

        <div className="em-right">
          <div className="em-label">Preview</div>
          <div className="em-stage" data-theme={theme === 'live' ? liveTheme : theme}>
            {preview?.kind === 'img'
              ? <img className="em-img" src={preview.data} alt="export preview" />
              : <pre className="em-code">{preview?.data ?? '…'}</pre>}
          </div>
          {preview?.sub && <div className="em-note">{preview.sub}</div>}
        </div>
      </div>
    </div>
  );
}
