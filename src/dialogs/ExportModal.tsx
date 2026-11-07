import {useEffect, useMemo, useRef, useState, type RefObject} from 'react';
import {type Edge, type Node} from '@xyflow/react';
import {X} from 'lucide-react';
import {EXPORT_TOKENS, tokensFor} from '../theme/theme';
import {toMermaid, toMermaidSequence, fromMermaid} from '../gobi/mermaid';
import {trackExport} from '../app/analytics';

export type ExportScope = 'full' | 'selection';
export type ExportFormat = 'svg' | 'png' | 'pdf' | 'json' | 'mermaid';
/* AR-9 — one pluraliser for every count string ("1 node · 0 edges"), so no
   branch hand-writes its own. */
const count = (n: number, unit: string): string => `${n} ${unit}${n === 1 ? '' : 's'}`;

/* MERMAID-OFF (t_d616040c, 2026-11-07) — the ⇅ → Import → "From Mermaid text"
 * door does not do what the UI promises (Harvey's verdict after real use).
 * ONE flag: flip to true and the whole door returns with no other edit. */
const MERMAID_IMPORT_ENABLED = false;

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
  /** MODAL-DOORS (2026-11-03) — the ⇅ toolbar trigger that opened this
   * dialog; focus returns to it on close (the BoardDialog/Settings contract). */
  returnFocusTo?: RefObject<HTMLElement | null>;
  nodes: Node[];
  edges: Edge[];
  liveTheme: string;
  boardName?: string;
  selCount: number;
  /** Serialisers owned by App (they need the wrap ref + rf instance). */
  buildSvg: (o: {nodes: Node[]; edges: Edge[]; theme: string; outline?: boolean}) => Promise<string>;
  buildPng: (o: {nodes: Node[]; edges: Edge[]; theme: string}) => Promise<string>;
  /** ROUND C — the print route: App owns window/printView (the modal is
   *  DOM-only). Receives the SAME svg string the .svg download gets. */
  printPdf: (o: {nodes: Node[]; edges: Edge[]; theme: string; outline?: boolean}) => Promise<void>;
  /** AQ21-G — Import gets its own tab; JSON file picking stays in App (fileRef). */
  onImportJson: () => void;
  onExported: () => void;  // ONBOARD-P7 — an export COMPLETED: App ticks the checklist's export task
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

/* TOOLBAR-V1 — the tab the user last chose. A PREFERENCE (still applies on
 * every visit), so it is kept in localStorage; a fresh profile has no key and
 * falls back to the board-content default (empty -> Import, else Export). */
const EXPORT_TAB_KEY = 'diagram-studio:export-tab';

/** The remembered tab (a PREFERENCE), or null when this profile never chose one. */
const storedTab = (): 'export' | 'import' | null => {
  try {
    const v = localStorage.getItem(EXPORT_TAB_KEY);
    return v === 'import' || v === 'export' ? v : null;
  } catch { return null; } /* private mode / SSR */
};

export default function ExportModal({open, onClose, returnFocusTo, nodes, edges, liveTheme, boardName, selCount, buildSvg, buildPng, printPdf, onImportJson, onExported}: Props) {
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [scope, setScope] = useState<ExportScope>('full');
  const [format, setFormat] = useState<ExportFormat>('svg');
  const [theme, setTheme] = useState('live');
  /* ROUND C — "Outline text" (OFF by default: selectable text unless asked
   * otherwise — Harvey's requirement; Figma defaults the other way because
   * it optimises for print). Present for SVG; the PDF print route renders
   * the SAME svg string, so it inherits whatever this is set to. */
  const [outline, setOutline] = useState<boolean>(false);
  const [preview, setPreview] = useState<{kind: 'img' | 'text'; data: string; sub?: string} | null>(null);
  /* AR-3 — ONE `busy` state used to serve two meanings ("a preview is
   * rebuilding" and "a download is in flight"), so the primary button's label
   * flipped to "Rendering…" on every preview rebuild (measured). The preview
   * effect now drives only `previewBusy`; only `exportBusy` (doExport) may
   * change the button's label or disabled state. `Seg` and the tabs read
   * neither flag. */
  const [previewBusy, setPreviewBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  /* GOBI-2 — the `.gobi` door's own state. The error shape is declared HERE
   * rather than imported from src/gobi on purpose: a type import is still a
   * static import of the compiler module, and the modal must reach the
   * compiler only through import() (checks/round-gobi-door.mjs A3/A4). */
  const [gobiText, setGobiText] = useState('');
  const [gobiErrors, setGobiErrors] = useState<{line: number; col: number; message: string}[]>([]);
  const [gobiNote, setGobiNote] = useState<string | null>(null);
  /* IMPORT-REENTRY — one dispatch per dialog session. The ref is the real
   * latch (it must engage SYNCHRONOUSLY: a double-click's second activation
   * can land before the first handler's `await import()` resolves, so a
   * state-only guard races); the state only renders it as disabled. The
   * error branch resets both so a failed paste can be fixed and retried,
   * and the unmount-on-close resets them for the next session. */
  const [gobiSent, setGobiSent] = useState(false);
  const gobiSentRef = useRef(false);
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
      setPreviewBusy(true);
      try {
        const effTheme = theme === 'live' ? liveTheme : theme;
        if (format === 'svg') {
          const svg = await buildSvg({...scoped, theme: effTheme, outline});
          setPreview({kind: 'img', data: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, sub: `${count(scoped.nodes.length, 'node')} · ${count(scoped.edges.length, 'edge')}`});
        } else if (format === 'png') {
          const url = await buildPng({...scoped, theme: effTheme});
          setPreview({kind: 'img', data: url, sub: '2× PNG'});
        } else if (format === 'pdf') {
          /* the print view previews the same SVG it will print */
          const svg = await buildSvg({...scoped, theme: effTheme, outline});
          setPreview({kind: 'img', data: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, sub: 'Print view — opens the print dialog'});
        } else if (format === 'json') {
          setPreview({kind: 'text', data: JSON.stringify({name: boardName, nodes: scoped.nodes, edges: scoped.edges}, null, 2).slice(0, 4000), sub: `${count(scoped.nodes.length, 'node')} · ${count(scoped.edges.length, 'edge')}`});
        } else {
          const isSeq = scoped.edges.some(x => (x.data as {seqMsg?: string})?.seqMsg);
          const text = isSeq
            ? toMermaidSequence(scoped.nodes, scoped.edges)
            : toMermaid(scoped.nodes, scoped.edges);
          setPreview({kind: 'text', data: text, sub: isSeq
            ? 'Mermaid sequenceDiagram — activations/fragments are not representable'
            : 'Mermaid flowchart — colors/text styles/icons are not representable'});
        }
      } catch (err) {
        setPreview({kind: 'text', data: `Preview failed: ${(err as Error)?.message ?? 'unknown'}`});
      }
      setPreviewBusy(false);
    }, 250);
    return () => window.clearTimeout(t);
  }, [open, scope, format, theme, nodes, edges, liveTheme, boardName, buildSvg, buildPng, scoped, outline]);

  /* MODAL-DOORS (2026-11-03) — the focus lands on the active tab when the
   * dialog opens; Escape closes on the DOCUMENT CAPTURE phase with
   * stopPropagation (the BoardDialog/Settings contract). The old window-bubble
   * listener was churned away mid-event by App's own Escape re-render
   * (measured: a trusted Escape left the dialog open at HEAD); the capture
   * form stops App's handler from ever seeing the key. The listener reads the
   * ref, never its own deps, so it is bound once per open. */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (open) window.setTimeout(() => tabRef.current?.focus(), 30);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      closeRef.current();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);
  /* MODAL-DOORS — this component stays mounted while closed, so the focus
   * return fires on the open -> false EDGE (BoardDialog restores on unmount;
   * that form cannot apply here). */
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) returnFocusTo?.current?.focus();
    wasOpen.current = open;
  }, [open, returnFocusTo]);

  /* TOOLBAR-V1 — OPEN on the tab that matches the board. The user's last choice
     is a PREFERENCE and wins on a returning visit; with no stored choice an
     EMPTY board opens on Import (nothing to take out) and a board with content
     opens on Export.
     Resolved during RENDER on the `open` EDGE (React's adjust-state-on-a-prop-
     change pattern), not in an effect: this component stays mounted while
     closed, so an effect commits once with the PREVIOUS open's tab and then
     flips — the first PAINTED frame showed the wrong tab and pane (measured
     with a rAF sampler: Export before Import on an empty board). A `nodes`
     dep would re-flip the tab while the user is mid-export. */
  const [openSeen, setOpenSeen] = useState(false);
  if (open !== openSeen) {
    setOpenSeen(open);
    if (open) setTab(storedTab() ?? (nodes.length === 0 ? 'import' : 'export'));
  }

  /** A tab click is a CHOICE: it becomes the persisted preference. */
  const chooseTab = (t: 'export' | 'import') => {
    setTab(t);
    try { localStorage.setItem(EXPORT_TAB_KEY, t); } catch { /* private mode */ }
  };

  if (!open) return null;

  const doExport = async () => {
    setExportBusy(true);
    try {
      const effTheme = theme === 'live' ? liveTheme : theme;
      const base = (boardName?.replace(/[^\w.-]+/g, '_') || 'diagram');
      let blob: Blob; let name: string;
      if (format === 'svg') {
        blob = new Blob([await buildSvg({...scoped, theme: effTheme, outline})], {type: 'image/svg+xml'});
        name = `${base}.svg`;
      } else if (format === 'pdf') {
        /* Harvey-approved route (i): the print dialog, not a download.
           printPdf builds the same svg string (theme/scope/outline baked
           in) inside App and hands it to the print view. */
        await printPdf({nodes: scoped.nodes, edges: scoped.edges, theme: effTheme, outline});
        trackExport('pdf'); onExported();   // ONBOARD-P6 funnel · ONBOARD-P7 checklist tick
        return;
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
      trackExport(format); onExported();   // ONBOARD-P6 funnel · ONBOARD-P7 checklist tick
    } finally {
      setExportBusy(false);
    }
  };

  const doImportMermaid = () => {
    const parsed = fromMermaid(importText);
    if (!parsed) { setImportMsg('Could not parse any nodes — is it a Mermaid flowchart?'); return; }
    window.dispatchEvent(new CustomEvent('gobi:mermaid-import', {detail: parsed}));
    setImportMsg(`Parsed ${count(parsed.nodes.length, 'node')} · ${count(parsed.edges.length, 'edge')} — inserting onto the board…`);
    window.setTimeout(onClose, 900);
  };

  /* GOBI-2 — the `.gobi` door. Same tab, same event, one undo entry; the
   * ONLY differences from the Mermaid box are the language and the fact that
   * the compiler is the app's own (so a bad paste comes back as structured
   * errors instead of a re-parse). The compiler arrives through import(): the
   * modal never statically imports src/gobi, so this door costs the main
   * bundle nothing until someone pastes. CORE-STEP2: the compiler returns
   * the neutral GobiDocument and the canvas adapter (also lazy, also off
   * the boot path) is the ONE place that maps it to a React-Flow board. */
  const doImportGobi = async () => {
    /* IMPORT-REENTRY — the synchronous latch: ONE dispatch per dialog
     * session. Without it the 900ms success-note window leaves the button
     * live with the compiled text still in the box, and the second click of
     * a double-click re-imports the same document (measured 4n/2e). */
    if (gobiSentRef.current) return;
    gobiSentRef.current = true;
    setGobiSent(true);
    setGobiErrors([]);
    setGobiNote(null);
    const {compileGobi} = await import('@techgoblin/gobi-core');
    const res = compileGobi(gobiText);
    if (res.ok === false) {
      /* NOTHING is dispatched: the board is untouched and the errors ARE the
       * answer — one row per error, line:column first. The latch releases:
       * the user fixes the text and clicks again. */
      gobiSentRef.current = false;
      setGobiSent(false);
      setGobiErrors(res.errors);
      return;
    }
    const {toBoardDoc} = await import('../gobi/adapterCanvas');
    const board = toBoardDoc(res.doc);
    window.dispatchEvent(new CustomEvent('gobi:mermaid-import', {detail: {from: 'gobi', board}}));
    setGobiNote(`Compiled ${count(board.nodes.length, 'node')} · ${count(board.edges.length, 'edge')} — inserting onto the board…`);
    window.setTimeout(onClose, 900);
  };

  return (
    <div className="sp-overlay em-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="em-modal" role="dialog" aria-label="Export or import diagram">
        {/* MODAL-DOORS — the one visible exit, same .em-close as the Share
            dialog so the two doors read as one family. */}
        <button type="button" className="em-close" aria-label="Close" onClick={onClose}><X size={14} /></button>
        {/* TOOLBAR-V1 — the tabs are the FIRST thing you see: ONE segmented
            control above both columns (before this they were two small
            underline buttons buried in the left column). Export and Import are
            the same dialog, two halves — the entry's tooltip says so. */}
        <div className="em-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'export'} className={tab === 'export' ? 'on' : ''} onClick={() => chooseTab('export')}>Export</button>
          <button role="tab" aria-selected={tab === 'import'} className={tab === 'import' ? 'on' : ''} onClick={() => chooseTab('import')}>Import</button>
        </div>

        <div className="em-cols">
        <div className="em-left">

          {tab === 'import' && (
            <div className="em-import">
              {/* MERMAID-OFF — gated, not deleted; the flag comment at the top
                  of this file says why and what flipping it restores. */}
              {MERMAID_IMPORT_ENABLED && (<>
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
              </>)}

              {/* GOBI-2 — the .gobi door, beside Mermaid (same tab, same import
                  event, same one-undo-step contract). Errors replace the note
                  row: one line per compile error, line:col first, and NOTHING
                  reached the canvas. */}
              <div className="em-label">From .gobi text</div>
              <textarea
                className="em-ta"
                placeholder={'board "Kafka rebalance storm"\ndirection LR\nbroker = service "Broker" icon:server color:amber\nbroker -> orders "append" flow:dots'}
                value={gobiText}
                onChange={ev => setGobiText(ev.target.value)}
                rows={8}
                spellCheck={false}
              />
              <button className="em-go" onClick={doImportGobi} disabled={!gobiText.trim() || gobiSent}>
                Import .gobi
              </button>
              {gobiErrors.length > 0 && (
                <ul className="em-errs" role="alert">
                  {gobiErrors.map((e, i) => (
                    <li className="em-err" key={`${e.line}:${e.col}:${i}`}>
                      <span className="em-err-at">{e.line}:{e.col}</span> {e.message}
                    </li>
                  ))}
                </ul>
              )}
              <div className="em-note">{gobiNote ?? 'Gobigrams’ own text format — compiles onto this board in one undo step.'}</div>

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
            {id: 'pdf', label: 'PDF'},
            {id: 'json', label: 'JSON'},
            {id: 'mermaid', label: 'Mermaid'},
          ]} />
          {format === 'pdf' && <div className="em-note">PDF (opens the print dialog — choose Save as PDF). The browser embeds the fonts; text stays selectable.</div>}

          {/* ROUND C — "Outline text": exact-typography mode for SVG (and the
              PDF print view, which renders the same string). OFF by default:
              selectable text unless asked otherwise. Outlining turns every
              text row into glyph paths (HarfBuzz — the canvas's own shaper),
              so the file paints identically everywhere, but the text is no
              longer selectable (the source stays in data-text). */}
          {(format === 'svg' || format === 'pdf') && (
            <>
              <label className="em-note" style={{display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer'}}>
                <input type="checkbox" checked={outline} onChange={e => setOutline(e.target.checked)} />
                Outline text (glyph paths — exact everywhere, not selectable)
              </label>
              {/* HARVEY 2026-10-22: what the option is FOR, in place — the full
                  text also lives in the README ("When to outline"). */}
              <div className="em-note" style={{paddingLeft: 22, marginTop: -2}}>
                Turns each text row into shapes: the file opens identically on any machine, even with no font
                installed, and gets smaller than an embedded font. Use it for a file you send to a client, print,
                or import into Figma/Illustrator. You cannot select or copy the text afterwards (the strings are
                still kept in the SVG for search and tooling).
              </div>
            </>
          )}

          <div className="em-label">Theme</div>
          <Seg value={theme} set={setTheme} aria="Theme" selCount={selCount} tabRef={tabRef} options={THEME_CHOICES as {id: string; label: string}[]} />
          <div className="em-note">Preview and file both use the chosen theme — what you see is what downloads.</div>

          {/* AR-3 — reads `exportBusy` only; a preview rebuild must not change
              this button's label or disabled state. */}
          <button className="em-go" onClick={doExport} disabled={exportBusy || !preview || (format === 'png' && !scoped.nodes.length)}>
            {exportBusy ? 'Rendering…' : `Export ${format.toUpperCase()}`}
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
    </div>
  );
}
