/* DefinitionSection.tsx — DESC-1 (SPEC-NODE-DESCRIPTION D1, task t_9b50b085,
 * 2026-11-12; DA-1 t_b6d2b0a1 renamed the section and dropped the counter).
 * The inspector's Additional Description body: ONE optional paragraph per
 * card node (`data.desc`), authored here and shown on demand — the badge and
 * panel are D2, NOT this card. Nothing about `desc` is painted on the canvas;
 * unisurf-desc-data's A6 proves the rect and textContent are identical with
 * and without one.
 *
 * COMMIT DISCIPLINE (the card's rule 2): typing edits a LOCAL draft, and the
 * write happens ON BLUR — ONE pushHistory per commit, never per keystroke.
 * `update()` pushes on every call, so a keystroke-wired `onChange` would
 * flood the 50-entry undo stack; the blur gate keeps one commit = one
 * history entry.
 *
 * MOUNT = DRAFT: App keys this component by the node id, so a new selection
 * REMOUNTS with a fresh draft — no effect, no sync loop with the store echo
 * that arrives after the commit. The rows/placeholder contract is the
 * spec's own: 4 rows min, grows to 12, placeholder "Shown on demand — never
 * drawn on the canvas", and a Clear action. The character counter is GONE
 * (Harvey's v2 ask: no counter on a free-text paragraph).
 *
 * DA-3 (t_683dbdfa, 2026-11-12) — THE PANEL'S OWN COLOURS. `data.descPaint?
 * {bg?: string; fg?: string}` — each value a ColorKey or a literal #hex, the
 * node colour's own two-form model, resolved through the SAME resolver
 * (descPaintVar → resolveColor/COLOR_VAR; no second colour system). Two
 * swatch rows under the textarea (background / text), the same 12-cell row
 * the node colour uses (11 keys + the custom literal), each with a Default
 * cell that CLEARS its key — descPaintData removes empty keys and drops
 * descPaint entirely when both are gone, the same delete discipline as
 * descData's. P1–P6 live in unisurf-desc-multi. */
import {useState} from 'react';
import {isColorKey, resolveColor} from '../theme/colors';
import {swatchRow} from './swatchRow';

/** 4 rows min, grows to 12 — the spec's textarea contract (clamped). */
export const descRows = (v: string): number =>
  Math.min(12, Math.max(4, v.split('\n').length));

/** DESC-1's ONE write rule, PURE (the harness imports and asserts it): a
 *  non-empty commit stores `desc`; an EMPTY commit REMOVES the key —
 *  `'desc' in data === false` — never stores ''. App's commitDesc applies
 *  this to the selected node; the delete matters because `update()`'s spread
 *  can only overwrite a key, not drop one. */
export const descData = (
  data: Record<string, unknown>,
  v: string,
): Record<string, unknown> => {
  const d = {...data};
  if (v) d.desc = v;
  else delete d.desc;
  return d;
};

/* ---- DA-3: the panel paint ------------------------------------------ */

/** The two-form colour value: a ColorKey OR a literal #hex. */
export type DescPaint = {bg?: string; fg?: string};

const HEX_RE = /^#[0-9a-f]{3,8}$/i;

/** DA-3's ONE resolver — the SAME vocabulary the node colour uses: a key
 *  resolves through resolveColor onto its theme token (var(--c-…), so it
 *  follows the theme), a literal #hex passes through as itself. A value that
 *  is neither — or an absent one — paints NOTHING (undefined), so P6's
 *  "exactly the pre-card panel" holds even for junk in hand-edited JSON. */
export const descPaintVar = (v: string | undefined): string | undefined => {
  if (typeof v !== 'string' || !v) return undefined;
  if (!isColorKey(v) && !HEX_RE.test(v)) return undefined;
  return resolveColor(isColorKey(v) ? {colorKey: v} : {color: v});
};

/** DA-3's write rule, PURE (the harness imports it): a patch sets its key,
 *  an EMPTY value REMOVES it, and `descPaint` itself disappears when both
 *  keys are gone — `'bg' in data === false`, never ''. */
export const descPaintData = (
  data: Record<string, unknown>,
  patch: DescPaint,
): Record<string, unknown> => {
  const d = {...data};
  const next: DescPaint = {...(d.descPaint as DescPaint | undefined), ...patch};
  if (!next.bg) delete next.bg;
  if (!next.fg) delete next.fg;
  if (next.bg || next.fg) d.descPaint = next;
  else delete d.descPaint;
  return d;
};

/* ---- PANEL-SOLID (t_7d98cf2a) — the panel's OPAQUE surface ------------
 * Measured pre-fix: --panel is UNDECLARED in this app, so the default panel
 * computed backgroundColor rgba(0,0,0,0) — fully transparent, the shapes
 * behind it bled straight through (Harvey's complaint). A literal descPaint
 * hex with alpha kept its alpha. The two derivations below stay INSIDE the
 * DA-3 vocabulary (descPaintVar → resolveColor/COLOR_VAR — no second colour
 * system); they only make the resolved paint OPAQUE and legible. */
/** hex (#rgb/#rgba/#rrggbb/#rrggbbaa) → [r,g,b,a]; null when unparseable. */
const hexRgb = (v: string): [number, number, number, number] | null => {
  const m = /^#([0-9a-f]{3,8})$/i.exec(v.trim());
  if (!m) return null;
  const h = m[1];
  if (h.length === 3 || h.length === 4) {
    const s = h.split('');
    return [parseInt(s[0] + s[0], 16), parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16),
      s[3] !== undefined ? parseInt(s[3] + s[3], 16) / 255 : 1];
  }
  if (h.length === 6 || h.length === 8) {
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16),
      h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  }
  return null; /* 5/7-digit strings pass HEX_RE but are not colours */
};
/** computed 'rgb(a)(…)' → [r,g,b,a]; null when unparseable. */
const cssRgb = (s: string): [number, number, number, number] | null => {
  const m = /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/.exec(s ?? '');
  return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
};
/** WCAG 2.x relative luminance. */
const lum = (c: number[]): number => {
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (a: [number, number, number, number], b: [number, number, number, number]): number => {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
/** Resolve one CSS colour INSIDE a theme-scoped probe — applyTheme runs in
 *  an effect AFTER render, so the root still carries the PREVIOUS theme
 *  while a theme-change render computes its paint; the probe (ThemePicker's
 *  own trick: a temp [data-theme] element) reads the coming theme instead. */
const tokenIn = (theme: string, css: string, prop: 'background' | 'color' = 'background'): string => {
  const el = document.createElement('div');
  el.dataset.theme = theme;
  el.style[prop] = css;
  document.body.appendChild(el);
  const v = getComputedStyle(el)[prop];
  el.remove();
  return v;
};
/** The panel's background as an OPAQUE paint: a key stays its theme token
 *  (every --c-* is opaque by construction); an opaque literal passes
 *  through; a TRANSLUCENT literal is COMPOSITED over the theme's canvas
 *  surface colour (--bg) — the user's colour survives, the canvas does not
 *  bleed through. Junk (unparseable) paints nothing → the sheet's opaque
 *  default. Pure w.r.t. (value, theme). */
export const panelPaint = (v: string | undefined, theme: string): string | undefined => {
  const r = descPaintVar(v);
  if (!r || r.startsWith('var(')) return r;
  const c = hexRgb(r);
  if (!c) return undefined;
  if (c[3] >= 1) return r;
  const base = cssRgb(tokenIn(theme, 'var(--bg)')) ?? [11, 11, 13, 1];
  const o = [0, 1, 2].map((i) => Math.round(c[3] * c[i] + (1 - c[3]) * base[i]));
  return `rgb(${o[0]}, ${o[1]}, ${o[2]})`;
};
/** The rescue ink for a bg-only descPaint: the theme --fg when it already
 *  reads ≥4.5:1 on the resolved bg; else the theme-invariant neutral whose
 *  contrast reaches 4.5:1 — black needs bg L ≥ 0.175, white needs L ≤
 *  0.1833, the ranges OVERLAP so the 0.179 threshold always satisfies one.
 *  Returned as a --pfg value, the exact derivation the × hover uses. */
export const panelInk = (pbg: string | undefined, theme: string): string | undefined => {
  if (!pbg) return undefined;
  const bg = cssRgb(tokenIn(theme, pbg));
  if (!bg) return undefined;
  const fg = cssRgb(tokenIn(theme, 'var(--fg)', 'color'));
  if (fg && contrast(fg, bg) >= 4.5) return undefined;
  return lum(bg) > 0.179 ? 'var(--c-black)' : 'var(--c-white)';
};

export function DefinitionSection({value, onCommit, paint, onPaint}: {
  value: string;
  onCommit: (v: string) => void;
  paint?: DescPaint;
  onPaint: (patch: DescPaint) => void;
}) {
  const [draft, setDraft] = useState(value);
  const commit = () => { if (draft !== value) onCommit(draft); };
  /* One swatch row per slot — literally the SAME `swatchRow` the node colour
     uses (hoisted to swatchRow.tsx so both callers share one control, not two
     near-copies), plus a Default cell that CLEARS the slot's key. Rows are
     independent: bg and fg never read each other. */
  const paintRow = (slot: 'bg' | 'fg', label: string) => {
    const cur = paint?.[slot];
    const curKey = isColorKey(cur) ? cur : null;
    return (
      <div data-desc-paint={slot}>
        <label>{label}</label>
        {swatchRow(curKey, (k) => onPaint({[slot]: k}),
          {value: cur && !curKey ? cur : undefined, onPick: (hex) => onPaint({[slot]: hex})})}
        <button type="button" className="swatch" data-desc-paint-default={slot}
          aria-label={`Default panel ${label} (clears it)`} title="Default"
          style={{marginTop: 7, background: 'linear-gradient(to top left, transparent 47%, var(--border-strong) 48% 52%, transparent 53%)'}}
          onClick={() => onPaint({[slot]: ''})} />
      </div>
    );
  };
  return (
    <div className="field">
      <label htmlFor="insp-desc">additional description</label>
      <textarea
        id="insp-desc"
        data-desc-input="1"
        rows={descRows(draft)}
        placeholder="Shown on demand — never drawn on the canvas"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
      {/* DESC-1 — a plain flex row, NOT `.field-row`: round-rotation-range
          locates the rotation Reset as THE `.panel.right .field-row button`,
          so a second one here would break its strict-mode locator. The Clear
          action is this section's own footer, not a grid row. DA-1: the
          character counter is gone — a paragraph has no count worth seeing. */}
      <div style={{display: 'flex', alignItems: 'center', gap: 8, marginTop: 6}}>
        <button
          type="button"
          className="mbtn"
          data-desc-clear="1"
          aria-label="Clear the additional description"
          title="Clear the additional description (removes it from the document)"
          disabled={draft === '' && value === ''}
          onClick={() => { setDraft(''); if (value !== '') onCommit(''); }}
        >Clear</button>
      </div>
      {paintRow('bg', 'panel background')}
      {paintRow('fg', 'panel text')}
    </div>
  );
}
