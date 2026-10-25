import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Palette, Frame, Cable, Keyboard, Info, X} from 'lucide-react';
import ThemePicker from './ThemePicker';
import {type Mode, type ThemeName} from './theme';
/* ROUND AA, ITEM 2 — the marquee mode's values and its plain-language option
   labels. Imported rather than re-declared: the control, the persisted value
   and the React Flow prop must resolve through ONE definition. */
import {MARQUEE_OPTS, type MarqueeMode} from './marqueeMode';
/* CONFIG ROUND (2026-10-23) — the z-order display mode's values and labels.
   Same one-definition rule as the marquee's. */
import {ZORDER_OPTS, type ZOrderMode} from './zOrderMode';
/* PACKAGE-R — the roadmap surface's data. A pure, React-free module: the block
   further down this file is its only reader in the app. */
/* ROUND BN-4 — Props moved to ./settings/shared; the two largest panes
   (Canvas, About+Roadmap) moved verbatim to ./settings/panes. */
import type {Props} from './settings/shared';
import {Row, ToolbarChip, Toggle, Segmented, dblRangeOptions} from './settings/controls';
import {APP_VERSION} from './settings/version';
import {CanvasPane, AboutPane} from './settings/panes';
/* ROUND BH — the in-app feedback dialog (public launch). ROUND BI, ITEM 3: the
 *  dialog itself now mounts ONCE in App.tsx (the ? help sheet is its second
 *  entry point), so Settings only forwards the opener through `onOpenFeedback`;
 *  the component import lives in App.tsx. */

/**
 * M2 — the Settings dialog.
 *
 * One entry point in the canvas toolbar opens this centred modal: a left nav
 * with a search box and five categories, a right content pane, Esc + backdrop
 * close, a focus trap and focus restore.
 *
 * The dialog is rendered INSIDE `.canvas-wrap`, so the scrim covers the canvas
 * column only — the palette and the inspector stay live and undimmed. That is
 * the approved design, not an oversight.
 *
 * Everything except Appearance and the Connections rules is display-only in
 * the canvas toolbar. No dead buttons, no fake toggles. The theme and the
 * three connection rules are the real settings here, and they change through
 * the same `setMode → effect → applyTheme` / App-state paths the rest of the
 * app uses — this file never touches `document.documentElement`.
 */

/** The About pane's version. Bump this together with package.json's `version`
 *  (tsconfig.json has no `resolveJsonModule`, so it cannot be imported). */


export type SettingsCat =
  | 'appearance' | 'canvas' | 'connections' | 'keys' | 'about';

export const SETTINGS_CATS: {id: SettingsCat; icon: React.ReactNode; name: string}[] = [
  {id: 'appearance',  icon: <Palette size={15} />,          name: 'Appearance'},
  {id: 'canvas',      icon: <Frame size={15} />,            name: 'Canvas'},
  {id: 'connections', icon: <Cable size={15} />,            name: 'Connections'},
  {id: 'keys',        icon: <Keyboard size={15} />,         name: 'Shortcuts'},
  {id: 'about',       icon: <Info size={15} />,             name: 'About'},
];


/* ITEM 6b (2026-09-18) — EXPORTED so `BoardDialog.tsx` reuses this exact
 * definition instead of copying it. One selector, one meaning of "focusable":
 * a second copy would drift and the trap would disagree with itself. */
export const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* ---------- small presentational helpers (display-only rows) ---------- */

/** Real keyboard combos. `keys` holds ONE token per key; they render as kbd chips.
 *  Every token here is a key (or a modifier) the app's handler actually reads —
 *  a pointer gesture must never appear in this list. */
const SHORTCUTS_KEYS: {what: string; keys: string[]}[] = [
  {what: 'Undo',                     keys: ['⌘/Ctrl', 'Z']},
  {what: 'Redo',                     keys: ['⌘/Ctrl', '⇧', 'Z']},
  {what: 'Delete selection',         keys: ['Del']},
  {what: 'Copy / paste / duplicate', keys: ['⌘/Ctrl', 'C', 'V', 'D']},
  {what: 'Deselect',                 keys: ['Esc']},
  {what: 'Fit view to diagram',      keys: ['⇧', '1']},
  {what: 'Toggle read-only review mode', keys: ['⇧', '2']},
  {what: 'Nudge selection',          keys: ['←↑↓→']},
  {what: 'Collapse / expand both panels', keys: ['⌘/Ctrl', '⌃', '⇧', '\\']},
  {what: 'Toggle left panel',            keys: ['⌘/Ctrl', '⌃', '⇧', '[']},
  {what: 'Toggle right panel',           keys: ['⌘/Ctrl', '⌃', '⇧', ']']},
];

/** Pointer gestures — NOT keys. Rendered as plain tokens, never as kbd chips.
 *  `how` holds one gesture phrase per token; the `·` between them is drawn by
 *  the renderer, never stored here (it is a separator, not a token). */
const SHORTCUTS_MOUSE: {what: string; how: string[]}[] = [
  {what: 'Insert node',       how: ['double-click canvas']},
  {what: 'Connect nodes',     how: ['drag from a node edge']},
  {what: 'Edit a connection', how: ['click the edge']},
  {what: 'Select multiple',   how: ['⌘/Ctrl + click']},
  {what: 'Rename connection', how: ['double-click the label']},
];
/* Deliberately trimmed: `Multi-select box`, `Pan` and `Zoom` are self-evident
 *  from the canvas itself (and the canvas navigation the app documents
 *  elsewhere), so listing them was over-information. The `?` helper in App.tsx
 *  carries the SAME list — if you add or remove a row here, change it there in
 *  the same edit (item 4). Do not re-add those three anywhere.
 *
 *  ROUND AA, ITEM 2 — `Multi-select box` STAYS OFF THIS LIST, deliberately.
 *  The marquee's new behaviour is a SETTING (Canvas → Marquee selection), which
 *  is where a user changes it, and it is a real control rather than a
 *  description. A gesture row here would only restate the gesture; it could not
 *  say which of the two modes is active, and the row that was trimmed was
 *  trimmed precisely because it was over-information. So no row is re-added and
 *  no new token is invented — the setting IS the discoverable surface. */

/* ---------- the panes ---------- */

function AppearancePane(props: Pick<Props, 'mode' | 'onMode' | 'resolved'>) {
  return (
    <>
      <h2 className="settings-h" id="settings-title">Appearance</h2>
      <p className="settings-sub">Pick the look of the whole workspace.</p>
      <ThemePicker
        mode={props.mode}
        onMode={props.onMode}
        resolved={props.resolved}
        active
      />
    </>
  );
}


function ConnectionsPane({
  noCycles, onNoCycles, oneIn, onOneIn, dblConnect, onDblConnect, dblRange, onDblRange,
}: Pick<Props, 'noCycles' | 'onNoCycles' | 'oneIn' | 'onOneIn' | 'dblConnect' | 'onDblConnect' | 'dblRange' | 'onDblRange'>) {
  return (
    <>
      <h2 className="settings-h" id="settings-title">Connections</h2>
      <p className="settings-sub">Rules applied while you draw edges.</p>
      <div className="settings-rows">
        <Row label="Prevent cycles" hint="block a connection that loops back on itself">
          <Toggle
            label="Prevent cycles"
            value={noCycles}
            onToggle={() => onNoCycles(v => !v)}
          />
        </Row>
        <Row label="One input per node" hint="a target accepts a single incoming edge">
          <Toggle
            label="One input per node"
            value={oneIn}
            onToggle={() => onOneIn(v => !v)}
          />
        </Row>
        {/* HARVEY 2026-10-13 — Proximity connect REMOVED (feature retired). The
            replacement is dblclick-on-a-handle -> nearest-shape connect, and it
            is a real control: default ON, with an adjustable reach. */}
        <Row label="Connect on handle double-click" hint="double-click a connection dot to join the nearest shape within reach">
          <Toggle
            label="Connect on handle double-click"
            value={dblConnect}
            onToggle={() => onDblConnect(!dblConnect)}
          />
        </Row>
        {dblConnect && (
          <Row label="Connect reach" hint="how far (in canvas px) the nearest shape may be; beyond it nothing connects">
            <Segmented
              label="Connect reach"
              options={dblRangeOptions(dblRange)}
              value={dblRange}
              onPick={onDblRange}
            />
          </Row>
        )}
      </div>
      <div className="settings-note">
        Rules applied while you draw. They apply to the whole board and can be changed at any time.
      </div>
    </>
  );
}

function KeyboardPane() {
  return (
    <>
      <h2 className="settings-h" id="settings-title">Shortcuts</h2>
      <p className="settings-sub">Every shortcut and gesture, in one place.</p>
      <div className="settings-rows">
        <div className="settings-group">Keyboard</div>
        {SHORTCUTS_KEYS.map(s => (
          <Row
            key={s.what}
            label={s.what}
            hint={s.what === 'Nudge selection' ? '1px per keypress, 10px with ⇧' : undefined}
          >
            <span className="help-keys">
              {s.keys.map((k, i) => <kbd key={`${s.what}-${i}`}>{k}</kbd>)}
            </span>
          </Row>
        ))}
      </div>
      <div className="settings-rows">
        <div className="settings-group">Mouse &amp; trackpad</div>
        {SHORTCUTS_MOUSE.map(g => (
          <Row key={g.what} label={g.what}>
            {/* plain text tokens, never kbd chips: these are gestures, not keys.
                The `·` is a separator BETWEEN tokens, never a token of its own. */}
            <span className="gesture">
              {g.how.map((h, i) => (
                <Fragment key={`${g.what}-${i}`}>
                  {i > 0 && ' · '}
                  <span className="gesture-token">{h}</span>
                </Fragment>
              ))}
            </span>
          </Row>
        ))}
      </div>
    </>
  );
}

/* PACKAGE-R — the three columns, in render order (Now → Next → Exploring).
 *  `label` is the HEADING TEXT and is the thing that carries status: the dot is
 *  `aria-hidden` supporting decoration, so the block is still fully readable by
 *  colour-blind and screen-reader users with the dots removed. `foot` is the one
 *  italic line under each column. `status` is the stored key from roadmap.ts. */

/* ---------- the shell ---------- */

export default function Settings({
  open, onClose, mode, onMode, resolved,
  noCycles, onNoCycles, oneIn, onOneIn,
  dblConnect, onDblConnect, dblRange, onDblRange,
  gridSize, onGridSize, alignGuides, onAlignGuides, animate, onAnimate,
  highlight, onHighlight,
  marquee, onMarquee,
  zOrder, onZOrder,
  pngScale, onPngScale, pngPad, onPngPad,
  autosave, onAutosave,
  returnFocusTo,
  boardPng,
  onOpenFeedback,
}: Props) {
  const [cat, setCat] = useState<SettingsCat>('appearance');
  const [query, setQuery] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Keep the latest onClose for the document-level listener without re-binding.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Esc (capture + stopPropagation) and the Tab focus trap. Capture is what
  // stops App's global Escape handler from ALSO clearing the node selection
  // behind the dialog; App carries a second guard of its own.
  useEffect(() => {
    if (!open) return;
    const onDocKey = (e: KeyboardEvent) => {
      /* ROUND BH — while the feedback dialog is open, ITS capture listener
         owns Escape and Tab (it registered later, but ours runs first, so we
         must stand down entirely): Escape closes ONLY the dialog, and our Tab
         trap must not fight the dialog's from behind. Same shape as App's
         boardDlg guard. */
      if (document.querySelector('[data-feedback-dialog]')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const els = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null || el === document.activeElement);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = active ? modal.contains(active) : false;
      if (e.shiftKey) {
        if (!inside || active === first) { e.preventDefault(); last.focus(); }
      } else if (!inside || active === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onDocKey, true);
    return () => document.removeEventListener('keydown', onDocKey, true);
  }, [open]);

  // Focus the search field once the element exists after paint (IconPicker's pattern).
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  // Focus restore: hand the caret back to the toolbar button that opened us.
  useEffect(() => {
    if (!open) return;
    return () => { returnFocusTo?.current?.focus(); };
  }, [open, returnFocusTo]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return SETTINGS_CATS;
    return SETTINGS_CATS.filter(c => c.name.toLowerCase().includes(needle));
  }, [query]);

  // The nav search filters the five groups by name and jumps to the first hit.
  // A query that matches nothing leaves the current pane alone (no error).
  const onQuery = useCallback((v: string) => {
    setQuery(v);
    const needle = v.trim().toLowerCase();
    if (!needle) return;
    const hit = SETTINGS_CATS.find(c => c.name.toLowerCase().includes(needle));
    if (hit) setCat(hit.id);
  }, []);

  const jumpToFirst = useCallback(() => {
    if (matches[0]) setCat(matches[0].id);
  }, [matches]);

  if (!open) return null;

  const active = SETTINGS_CATS.find(c => c.id === cat) ?? SETTINGS_CATS[0];

  const pane = (() => {
    switch (cat) {
      case 'appearance':  return <AppearancePane mode={mode} onMode={onMode} resolved={resolved} />;
      case 'canvas':      return (
        <CanvasPane
          gridSize={gridSize}
          onGridSize={onGridSize}
          alignGuides={alignGuides}
          onAlignGuides={onAlignGuides}
          animate={animate}
          onAnimate={onAnimate}
          highlight={highlight}
          onHighlight={onHighlight}
          marquee={marquee}
          onMarquee={onMarquee}
          zOrder={zOrder}
          onZOrder={onZOrder}
          pngScale={pngScale}
          onPngScale={onPngScale}
          pngPad={pngPad}
          onPngPad={onPngPad}
          autosave={autosave}
          onAutosave={onAutosave}
        />
      );
      case 'connections': return (
        <ConnectionsPane
          noCycles={noCycles}
          onNoCycles={onNoCycles}
          oneIn={oneIn}
          onOneIn={onOneIn}
          dblConnect={dblConnect}
          onDblConnect={onDblConnect}
          dblRange={dblRange}
          onDblRange={onDblRange}
        />
      );
      case 'keys':        return <KeyboardPane />;
      case 'about':       return <AboutPane onOpenFeedback={onOpenFeedback} />;
      default:            return <AppearancePane mode={mode} onMode={onMode} resolved={resolved} />;
    }
  })();

  return (
    <div
      className="settings-overlay"
      data-settings-overlay
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onDoubleClick={e => e.stopPropagation()}
    >
      <div
        ref={modalRef}
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        data-settings-modal
      >
        <div className="settings-nav">
          <input
            ref={searchRef}
            className="settings-search"
            type="text"
            placeholder="Search settings…"
            aria-label="Search settings"
            value={query}
            onChange={e => onQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') jumpToFirst(); }}
          />
          <div className="settings-nav-list">
            {matches.map(c => (
              <button
                key={c.id}
                type="button"
                className={`settings-nav-item${c.id === cat ? ' on' : ''}`}
                data-settings-cat={c.id}
                aria-current={c.id === cat ? 'page' : undefined}
                onClick={() => setCat(c.id)}
              >
                {c.icon}
                <span>{c.name}</span>
              </button>
            ))}
            {!matches.length && (
              <div className="settings-empty">No category matches “{query}”.</div>
            )}
          </div>

        </div>

        <div className="settings-main" data-settings-pane={cat}>
          <button
            type="button"
            className="settings-close"
            aria-label="Close settings"
            onClick={onClose}
          ><X size={15} /></button>
          {pane}
        </div>
      </div>
    </div>
  );
}
