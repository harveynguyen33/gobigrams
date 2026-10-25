/* ROUND BN-4 — panes split out of the former src/Settings.tsx (verbatim,
   2026-10-25). src/Settings.tsx keeps the shell and imports these back,
   so the mounted UI is unchanged.  (feature-map home: src/src/settings/panes.tsx)
 */
import {useRef} from 'react';
import {MARQUEE_OPTS} from '../marqueeMode';
import {ZORDER_OPTS} from '../zOrderMode';
import {ROADMAP, ROADMAP_REVIEWED, type RoadmapItem, type RoadmapStatus} from '../roadmap';
import {APP_VERSION} from './version';
import type {Props} from './shared';
import {Row, ToolbarChip, Toggle, Segmented, gridSizeOptions} from './controls';

export function CanvasPane({
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

export const RM_COLS: {status: RoadmapStatus; label: string; foot: string}[] = [
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

export function AboutPane({onOpenFeedback}: {onOpenFeedback: (from: HTMLElement | null) => void}) {
  /* HARVEY 2026-10-13 — the pane rewrite: wordmark + joke, bare version number,
     no Licence/Building-blocks rows (licensing is pending its own decision, and
     a displayed MIT row contradicts the anti-reverse-engineering direction),
     no self-host note (lives elsewhere when the product ships). */
  /* ROUND BH (public launch) — the entry is a BUTTON that opens the feedback
     dialog: a token-free static app cannot POST to the issues API, so the
     dialog prefills the repo's own new-issue form and the user just presses
     Submit on GitHub. The plain anchor that used to live here moved INTO the
     dialog as the no-account fallback.
     ROUND BI, ITEM 3 — the dialog now lives at APP level (one instance, two
     openers: this entry and the ? help sheet), so this button only asks App to
     open it and hands over its own element for the focus restore. */
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
        {/* AUTHOR AUDIT (2026-10-25) — one quiet line proving who built this.
            The same email chains across git history, package.json, LICENSE,
            CODEOWNERS and the GitHub account; the repo link is the source of
            truth. Displayed as text (mailto only) — no new surfaces. */}
        <Row label="By">
          <a
            className="settings-link"
            href="mailto:harvey.nguyen33@gmail.com"
          >
            Harvey Nguyen
          </a>
          {' · '}
          <a
            className="settings-link"
            href="https://github.com/harveynguyen33/gobigrams"
            target="_blank"
            rel="noreferrer"
          >
            source
          </a>
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
          onClick={() => onOpenFeedback(fbBtnRef.current)}
        >
          Feedback — report a bug or request a shape
        </button>
      </p>
      <RoadmapBlock />
    </>
  );
}
