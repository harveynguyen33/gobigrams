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
import {ROADMAP, SHIPPED, ROADMAP_REVIEWED, type RoadmapItem, type RoadmapStatus} from './roadmap';
/* ROUND BH — the in-app feedback dialog (public launch). Opened from the About
 *  pane below; mirrors BoardDialog's accessibility contract. */
import FeedbackDialog from './FeedbackDialog';

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
const APP_VERSION = '0.1.0';

export type SettingsCat =
  | 'appearance' | 'canvas' | 'connections' | 'keys' | 'about';

export const SETTINGS_CATS: {id: SettingsCat; icon: React.ReactNode; name: string}[] = [
  {id: 'appearance',  icon: <Palette size={15} />,          name: 'Appearance'},
  {id: 'canvas',      icon: <Frame size={15} />,            name: 'Canvas'},
  {id: 'connections', icon: <Cable size={15} />,            name: 'Connections'},
  {id: 'keys',        icon: <Keyboard size={15} />,         name: 'Shortcuts'},
  {id: 'about',       icon: <Info size={15} />,             name: 'About'},
];

type Props = {
  open: boolean;
  onClose: () => void;
  /** the user's stored preference (Mode) — the picker writes back through this */
  mode: Mode;
  onMode: (m: Mode) => void;
  /** the theme actually painted right now (resolveMode(mode)) — for the System card */
  resolved: ThemeName;
  /** the connection rules — real controls, owned by App (session state) */
  noCycles: boolean;
  onNoCycles: React.Dispatch<React.SetStateAction<boolean>>;
  oneIn: boolean;
  onOneIn: React.Dispatch<React.SetStateAction<boolean>>;
  dblConnect: boolean;
  onDblConnect: (v: boolean) => void;
  dblRange: number;
  onDblRange: (n: number) => void;

  /** M4: the canvas snap-grid pitch — the NUMBER. The on/off toggle stays on
   *  the toolbar (so this row is not a duplicate control); App owns the value
   *  and clamps it, this file only reads it and asks for a new one. */
  gridSize: number;
  onGridSize: (n: number) => void;
  alignGuides: boolean;
  onAlignGuides: React.Dispatch<React.SetStateAction<boolean>>;
  /** PACKAGE-S §S-2 — export defaults (persisted in App via prefs.ts). */
  pngScale: number;
  onPngScale: (n: number) => void;
  pngPad: number;
  onPngPad: (n: number) => void;
  /** PACKAGE-S §S-3 — the autosave control (default ON). */
  autosave: boolean;
  onAutosave: React.Dispatch<React.SetStateAction<boolean>>;
  /** effective motion flag (`animate === true` means motion is ON) — the row
   *  reads "Reduce motion", i.e. the inverse. The setter is useAnimationGating's
   *  existing toggle, so the persisted override stays in one place. */
  animate: boolean;
  onAnimate: () => void;
  /** F — the hover edge-highlight option (default OFF). App owns the persisted
   *  flag via useHoverHighlight; this row only reads it and asks to flip it. */
  highlight: boolean;
  onHighlight: () => void;
  /** ROUND AA, ITEM 2 — THE MARQUEE SELECTION MODE. A real, persisted, live
   *  control: App owns the value through `useMarqueeMode` (which also owns the
   *  React Flow prop), and this row is the discoverable surface. The values are
   *  the stored tokens; `MARQUEE_OPTS` carries the plain-language names that
   *  print on the buttons. NOT a gesture row in the Shortcuts pane — see the
   *  `SHORTCUTS_MOUSE` comment below for why that list stays as it is. */
  marquee: MarqueeMode;
  onMarquee: (m: MarqueeMode) => void;
  /** CONFIG ROUND (2026-10-23) — the z-order display mode (Canvas pane). App
   *  owns the persisted value through `useZOrderMode`, which also owns the
   *  React Flow prop; this row is the discoverable surface. */
  zOrder: ZOrderMode;
  onZOrder: (m: ZOrderMode) => void;
  /** return focus to the toolbar button on close */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
  /** ROUND BI — the current board as a PNG data URL, through App's existing
   *  export path (buildPng). Null on an empty board: the feedback dialog's
   *  screenshot helper then renders nothing. */
  boardPng?: (() => Promise<string>) | null;
};

/* ITEM 6b (2026-09-18) — EXPORTED so `BoardDialog.tsx` reuses this exact
 * definition instead of copying it. One selector, one meaning of "focusable":
 * a second copy would drift and the trap would disagree with itself. */
export const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* ---------- small presentational helpers (display-only rows) ---------- */

/** M4 — Canvas → Grid size: the standard snap pitches the segmented control
 *  offers, in ascending order. `16` is the app's default and must stay in this
 *  list. The list lives here (not in App) because it is presentation, not app
 *  state. */
const GRID_SIZES = [8, 16, 20, 32, 64] as const;

/** The options the Grid size control renders. `gridSize` is App state, so a
 *  value from outside the list is possible in principle: a fixed list that
 *  matches nothing would show no selection at all, so a stray value is appended
 *  as its own segment and the control still shows what the board actually uses.
 *  No clamp or rounding is invented — this only reports the value. */
function gridSizeOptions(current: number): number[] {
  if ((GRID_SIZES as readonly number[]).includes(current)) return [...GRID_SIZES];
  return [...GRID_SIZES, current];
}

/* HARVEY 2026-10-13 — the dblclick auto-connect reach, in the same segmented
   style as Grid size. 150–800 px, and a stray stored value still shows. */
const DBL_RANGES = [150, 200, 300, 400, 600, 800] as const;

function dblRangeOptions(current: number): number[] {
  if ((DBL_RANGES as readonly number[]).includes(current)) return [...DBL_RANGES];
  return [...DBL_RANGES, current];
}

function Row({label, hint, children}: {label: string; hint?: string; children?: React.ReactNode}) {
  return (
    <div className="settings-row">
      <span className="settings-row-label">
        {label}
        {hint && <span className="settings-row-hint">{hint}</span>}
      </span>
      <span className="settings-row-val">{children}</span>
    </div>
  );
}

/** Marks a row whose control ALSO lives on the toolbar (not "only there"). */
function ToolbarChip() {
  return <span className="settings-chip" title="Also available on the canvas toolbar">toolbar</span>;
}

/** A real on/off control (role=switch) for the settings that moved off the
 *  toolbar. The value and its setter are owned by App; this is presentation. */
function Toggle({label, value, onToggle}: {
  label: string; value: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      className={`settings-toggle${value ? ' on' : ''}`}
      aria-label={label}
      aria-checked={value}
      onClick={onToggle}
    >
      <span className="settings-toggle-knob" aria-hidden="true" />
    </button>
  );
}

/** A segmented control (role=radiogroup + role=radio): one tap picks a value
 *  and the current one is always visible. Mirrors ThemePicker's card grid —
 *  roving tabindex, so exactly one segment is in the Tab order, and
 *  ArrowLeft/ArrowRight/Home/End move the selection and fire `onPick`.
 *
 *  ROUND AA, ITEM 2 — GENERIC OVER THE VALUE TYPE, NOT DUPLICATED FOR STRINGS.
 *  The Canvas group's first row (Grid size) is a list of NUMBERS and the new
 *  marquee row is a list of MODE STRINGS (`touch` / `enclose`), so the same
 *  radiogroup had to serve both. A second, near-identical control would be the
 *  actual defect here — two roving-tabindex implementations that can drift
 *  apart — so the component is generic and `String(n)` names each segment. The
 *  call sites are unchanged in shape.
 *
 *  `labelOf` is the one addition that genericness needs: the marquee row's
 *  VALUES are the stored tokens (`touch` / `enclose`) while the WORDS on the
 *  buttons are the plain-language names. Printing the raw token would put
 *  `enclose` in front of the user; the stored value stays the token. Absent, it
 *  is `String(n)` — byte-identical to what every existing row printed. */
function Segmented<T extends string | number>({label, options, value, onPick, labelOf}: {
  label: string;
  options: readonly T[];
  value: T;
  onPick: (n: T) => void;
  labelOf?: (n: T) => string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIdx = Math.max(0, options.indexOf(value));
  const [focusIdx, setFocusIdx] = useState(selectedIdx);
  useEffect(() => { setFocusIdx(selectedIdx); }, [selectedIdx]);

  const pick = useCallback((i: number) => {
    const n = options[i];
    if (n === undefined) return;
    setFocusIdx(i);
    onPick(n);
    refs.current[i]?.focus();
  }, [options, onPick]);

  const onKey = useCallback((e: React.KeyboardEvent, i: number) => {
    const last = options.length - 1;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': e.preventDefault(); pick(Math.min(i + 1, last)); break;
      case 'ArrowLeft': case 'ArrowUp': e.preventDefault(); pick(Math.max(i - 1, 0)); break;
      case 'Home': e.preventDefault(); pick(0); break;
      case 'End': e.preventDefault(); pick(last); break;
      default: break;
    }
  }, [options, pick]);

  return (
    <div className="settings-seg" role="radiogroup" aria-label={label}>
      {options.map((n, i) => {
        const on = n === value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={labelOf ? labelOf(n) : String(n)}
            className={`settings-seg-btn${on ? ' on' : ''}`}
            tabIndex={i === focusIdx ? 0 : -1}
            ref={el => { refs.current[i] = el; }}
            onClick={() => pick(i)}
            onKeyDown={e => onKey(e, i)}
          >{labelOf ? labelOf(n) : n}</button>
        );
      })}
    </div>
  );
}

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

function CanvasPane({
  gridSize, onGridSize, alignGuides, onAlignGuides, animate, onAnimate, highlight, onHighlight,
  marquee, onMarquee, zOrder, onZOrder, pngScale, onPngScale, pngPad, onPngPad, autosave, onAutosave,
}: Pick<Props, 'gridSize' | 'onGridSize' | 'alignGuides' | 'onAlignGuides' | 'animate' | 'onAnimate' | 'highlight' | 'onHighlight' | 'marquee' | 'onMarquee' | 'zOrder' | 'onZOrder' | 'pngScale' | 'onPngScale' | 'pngPad' | 'onPngPad' | 'autosave' | 'onAutosave'>) {
  return (
    <>
      <h2 className="settings-h" id="settings-title">Canvas</h2>
      <p className="settings-sub">How the drawing surface behaves.</p>
      <div className="settings-rows">
        <Row label="Grid size" hint="the snap grid pitch in pixels; the visible dot grid uses the same value">
          <Segmented
            label="Grid size"
            options={gridSizeOptions(gridSize)}
            value={gridSize}
            onPick={onGridSize}
          />
        </Row>
        {/* PACKAGE-S §S-3 — the autosave control. Default ON = the historical
            behaviour; OFF stops the debounced write and the save indicator shows
            `unsaved` until Save / Cmd+S flushes. */}
        <Row label="Autosave" hint="write the board automatically as you work; off means you save with Cmd+S and the indicator shows when work is unsaved">
          <Toggle label="Autosave" value={autosave} onToggle={() => onAutosave(v => !v)} />
        </Row>
        {/* PACKAGE-S §S-2 — export defaults. Defaults (2x / 48) are today's
            hard-coded values, so a user who never opens Settings sees no change. */}
        <Row label="PNG export scale" hint="resolution multiplier for Export PNG: 1x fastest and smallest, 3x sharpest">
          <Segmented
            label="PNG export scale"
            options={['1x', '2x', '3x']}
            value={`${pngScale}x`}
            onPick={(v) => onPngScale(parseInt(v, 10))}
          />
        </Row>
        <Row label="Export padding" hint="empty space around the diagram in the exported image, in pixels">
          <Segmented
            label="Export padding"
            options={['24', '48', '96']}
            value={String(pngPad)}
            onPick={(v) => onPngPad(parseInt(v, 10))}
          />
        </Row>
        <Row label="Alignment guides" hint="dashed guides appear when a node lines up with a neighbour that is close by">
          <Toggle label="Alignment guides" value={alignGuides} onToggle={() => onAlignGuides(v => !v)} />
          <ToolbarChip />
        </Row>
        <Row label="Reduce motion" hint="hide edge and handle animation">
          <Toggle label="Reduce motion" value={!animate} onToggle={() => onAnimate()} />
        </Row>
        {/* ROUND AA, ITEM 2 — the marquee mode, a real control in the Canvas
            group. Values print as plain language (`Touch` / `Enclose`) while the
            stored token stays `touch` / `enclose`, and the hint states what each
            one does in the terms Harvey used when he asked for it. */}
        <Row label="Marquee selection" hint="what a drag-box on the empty canvas picks up">
          <Segmented
            label="Marquee selection"
            options={MARQUEE_OPTS.map(o => o.v)}
            value={marquee}
            onPick={onMarquee}
            labelOf={v => MARQUEE_OPTS.find(o => o.v === v)?.label ?? String(v)}
          />
        </Row>
        {/* CONFIG ROUND (2026-10-23) — the z-order display mode. Default is
            'wysiwyg' (True layers): the canvas paints the STORED stack order and
            selecting never reorders, so Bring to front / Send to back are always
            exactly what they say. 'Lift on select' restores the library's
            select-raises behaviour for anyone who prefers the pop. */}
        <Row label="Layer display" hint="whether selecting a node raises it above its neighbours">
          <Segmented
            label="Layer display"
            options={ZORDER_OPTS.map(o => o.v)}
            value={zOrder}
            onPick={onZOrder}
            labelOf={v => ZORDER_OPTS.find(o => o.v === v)?.label ?? String(v)}
          />
        </Row>
        <Row label="Highlight connections" hint="brighten the edges that touch the hovered node">
          <Toggle label="Highlight connections" value={highlight} onToggle={() => onHighlight()} />
        </Row>
      </div>
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
const RM_COLS: {status: RoadmapStatus; label: string; foot: string}[] = [
  {status: 'now',   label: 'Now',       foot: 'Being worked on right now.'},
  {status: 'next',  label: 'Next',      foot: 'Planned, not started.'},
  {status: 'later', label: 'Exploring', foot: 'Under consideration — may not ship.'},
];

/**
 * PACKAGE-R — the roadmap block.
 *
 * Every column heading is TEXT, every item carries the confidence WORD and the
 * area tag, so no status is encoded by colour alone (a11y SC 1.4.1). The block
 * is real DOM text and links nowhere outside the app.
 */
function RoadmapBlock() {
  return (
    <div className="rm">
      <div className="settings-group">Roadmap</div>
      <div className="rm-cols">
        {RM_COLS.map((c) => {
          const items = ROADMAP.filter((i) => i.status === c.status);
          return (
            <div className="rm-col" key={c.status}>
              <h3 className="rm-colhead">
                {/* decoration only — the label beside it is the status */}
                <span className={`rm-dot ${c.status}`} aria-hidden="true" />
                <span className="rm-collabel">{c.label}</span>
                <span className="rm-colcount">{items.length}</span>
              </h3>
              <ul className="rm-items">
                {items.map((it: RoadmapItem) => (
                  <li className="rm-item" key={it.title}>
                    <span className="rm-title">{it.title}</span>
                    <span className="rm-desc">{it.desc}</span>
                    <span className="rm-chips">
                      <span className={`rm-chip rm-chip-conf ${it.confidence}`}>{it.confidence}</span>
                      <span className="rm-chip">{it.area}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="rm-foot">{c.foot}</p>
            </div>
          );
        })}
      </div>
      {/* HARVEY 2026-10-13 — the Shipped list is gone from the pane ("quá xấu").
          The data lives on in `src/roadmap.ts` (SHIPPED) so a future surface can
          bring it back without re-typing history. */}
      <p className="rm-reviewed">last reviewed {ROADMAP_REVIEWED}</p>
    </div>
  );
}

function AboutPane({boardPng}: {boardPng?: (() => Promise<string>) | null}) {
  /* HARVEY 2026-10-13 — the pane rewrite: wordmark + joke, bare version number,
     no Licence/Building-blocks rows (licensing is pending its own decision, and
     a displayed MIT row contradicts the anti-reverse-engineering direction),
     no self-host note (lives elsewhere when the product ships). */
  /* ROUND BH (public launch) — the entry is now a BUTTON that opens the
     feedback dialog (src/FeedbackDialog.tsx): a token-free static app cannot
     POST to the issues API, so the dialog prefills the repo's own new-issue
     form and the user just presses Submit on GitHub. The plain anchor that
     used to live here moved INTO the dialog as the no-account fallback. */
  const [fbOpen, setFbOpen] = useState(false);
  const fbBtnRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <h2 className="settings-h" id="settings-title">About</h2>
      {/* ROUND BH (public launch) — the Gobigrams icon above the wordmark
          line (public/brand/logo.svg, the ROUND BF brand asset). Tokens-only
          sizing in styles.css (.about-logo); alt names the product. */}
      <img className="about-logo" src="/brand/lockup.svg" alt="Gobigrams" width={280} height={213} />
      <p className="settings-sub">
        <b>Gobigrams</b> — diagrams drawn by a goblin with a grudge and a ruler.
        Surprisingly straight lines. Zero patience for messy boxes.
      </p>
      <div className="settings-rows">
        <Row label="Version">
          <span className="settings-state">{APP_VERSION}</span>
        </Row>
      </div>
      {/* PUBLIC LAUNCH — the in-app feedback entry. One quiet line at the very
          bottom of the About pane (LESS intrusive than the ? cheatsheet, whose
          rows are width-budgeted by checks/package-o-metrics.mjs item 3 and
          carry the same info as Settings → Shortcuts — a feedback row there
          would break that pairing). ROUND BH: the link became this button +
          dialog; the outbound anchor surface moved into the dialog's fallback
          (see round-bg bg4's re-anchor). */}
      <p className="settings-feedback">
        <button
          type="button"
          ref={fbBtnRef}
          className="settings-feedback-btn"
          onClick={() => setFbOpen(true)}
        >
          Feedback — report a bug or request a shape
        </button>
      </p>
      {fbOpen && (
        <FeedbackDialog
          onCancel={() => setFbOpen(false)}
          returnFocusTo={fbBtnRef}
          boardPng={boardPng}
        />
      )}
      <RoadmapBlock />
    </>
  );
}

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
      case 'about':       return <AboutPane boardPng={boardPng} />;
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
