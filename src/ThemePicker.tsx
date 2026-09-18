import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Check} from 'lucide-react';
import {THEME_CARDS, resolveMode, type Mode, type ThemeName} from './theme';

/**
 * M3 — the Appearance pane's theme picker.
 *
 * Six preview CARDS (System + the five fixed themes). Each card paints a tiny
 * generic diagram with THAT theme's real tokens, so paper vs light vs midnight
 * is decidable before you switch.
 *
 * The tokens come off a scoped hidden probe: one `[data-theme="…"]` element per
 * theme, INSIDE the modal subtree, read with `getComputedStyle`. This is exact
 * — it reflects whatever `styles.css` ships today, including `color-mix()`
 * results — and it never writes `data-theme` to `<html>` or `<body>`.
 * `applyTheme` in theme.ts stays the only writer of the document theme; this
 * component only ever calls `onMode`.
 */

export type PreviewTokens = {
  bg: string; surface: string; border: string; fg: string; dim: string;
  dot: string; acc: string; accent: string; violet: string; cyan: string; slate: string;
};

/** The five fixed themes the probe reads (System is not a paint — it resolves). */
const FIXED: ThemeName[] = ['dark', 'light', 'paper', 'midnight', 'contrast'];
const PROBE_THEMES: ThemeName[] = FIXED;

const EMPTY_TOKENS: PreviewTokens = {
  bg: '', surface: '', border: '', fg: '', dim: '', dot: '',
  acc: '', accent: '', violet: '', cyan: '', slate: '',
};

const EMPTY: Record<ThemeName, PreviewTokens> = {
  dark: EMPTY_TOKENS, light: EMPTY_TOKENS, paper: EMPTY_TOKENS,
  midnight: EMPTY_TOKENS, contrast: EMPTY_TOKENS,
};

const read = (cs: CSSStyleDeclaration, name: string) => cs.getPropertyValue(name).trim();

/**
 * Reads every fixed theme's tokens off the scoped probe. Runs only while the
 * modal is open (`active`), memoised on `active`.
 */
function useThemePreviews(active: boolean) {
  const probeRef = useRef<HTMLDivElement>(null);
  const [previews, setPreviews] = useState<Record<ThemeName, PreviewTokens>>(EMPTY);

  useLayoutEffect(() => {
    if (!active || !probeRef.current) return;
    const next: Record<ThemeName, PreviewTokens> = {...EMPTY};
    for (const t of PROBE_THEMES) {
      const el = probeRef.current.querySelector<HTMLElement>(`[data-theme="${t}"]`);
      if (!el) continue;
      const cs = getComputedStyle(el);
      next[t] = {
        bg: read(cs, '--bg'),
        surface: read(cs, '--surface'),
        border: read(cs, '--border'),
        fg: read(cs, '--fg'),
        dim: read(cs, '--dim'),
        dot: read(cs, '--dots'),
        acc: read(cs, '--acc'),
        accent: read(cs, '--c-accent'),
        violet: read(cs, '--c-violet'),
        cyan: read(cs, '--c-cyan'),
        slate: read(cs, '--c-slate'),
      };
    }
    setPreviews(next);
  }, [active]);

  const probe = (
    <div ref={probeRef} className="settings-probe" aria-hidden="true">
      {PROBE_THEMES.map(t => <span key={t} data-theme={t} />)}
    </div>
  );

  return {previews, probe};
}

/** The miniature diagram: a panel strip plus 3 rounded boxes across a
 *  scaled-down canvas, in ONE card.
 *
 *  The left strip is painted with the theme's PANEL colour (`--surface`) and
 *  carries a few abstract rows, so the surface-vs-canvas contrast is decidable
 *  per theme — the box colours alone never showed it. The strip takes the left
 *  quarter; the dot grid and the three boxes live on the canvas side only.
 *  Everything is painted from the probed tokens (per-card inline variables),
 *  because one theme's tokens are being shown inside another theme's card. */
function Mini({t}: {t: PreviewTokens}) {
  return (
    <div
      className="settings-card-mini"
      style={{
        background: t.bg,
        ['--mini-dot' as string]: t.dot,
        ['--mini-surface' as string]: t.surface,
        ['--mini-border' as string]: t.border,
        ['--mini-fg' as string]: t.fg,
      }}
    >
      <div className="settings-mini-dots" />
      <div className="settings-mini-side" aria-hidden="true">
        <i style={{width: '62%'}} />
        <i style={{width: '78%'}} />
        <i style={{width: '50%'}} />
      </div>
      <span className="settings-mini-box" style={{left: '33%', top: '14%', width: '28%', height: '24%', ['--mini-nc' as string]: t.accent}} />
      <span className="settings-mini-box" style={{left: '66%', top: '8%', width: '28%', height: '24%', ['--mini-nc' as string]: t.violet}} />
      <span className="settings-mini-box" style={{left: '50%', top: '62%', width: '28%', height: '24%', ['--mini-nc' as string]: t.cyan}} />
    </div>
  );
}

/**
 * @param mode     the stored preference (what the user picked — may be 'system')
 * @param onMode   the ONLY way this component changes the theme
 * @param resolved the theme actually painted right now (recorded on the note)
 * @param active   true while the modal is open (the probe only reads then)
 */
export default function ThemePicker({
  mode, onMode, resolved, active = true,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
  resolved: ThemeName;
  active?: boolean;
}) {
  const {previews, probe} = useThemePreviews(active);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /** What the OS resolves to RIGHT NOW — the System card previews THIS, not the
   *  live pick: "System" means "follow the OS", and picking a fixed theme does
   *  not change the OS preference. */
  const [osTheme, setOsTheme] = useState<ThemeName>(() => resolveMode('system'));
  useEffect(() => {
    if (!active) return;
    const mq = (() => {
      try { return window.matchMedia('(prefers-color-scheme: dark)'); } catch { return null; }
    })();
    if (!mq) return;
    const onChange = () => setOsTheme(resolveMode('system'));
    setOsTheme(resolveMode('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [active]);

  /** The System card previews the OS resolution — the honest thing to show. */
  const tokensFor = useCallback((card: typeof THEME_CARDS[number]): PreviewTokens => {
    const t = card.auto ? osTheme : (card.id as ThemeName);
    return previews[t] ?? EMPTY_TOKENS;
  }, [previews, osTheme]);

  /** Roving tabindex: exactly one radio is in the Tab order at a time. */
  const selectedIdx = useMemo(() => {
    const i = THEME_CARDS.findIndex(c => c.id === mode);
    return i < 0 ? 0 : i;
  }, [mode]);
  const [focusIdx, setFocusIdx] = useState(selectedIdx);
  useEffect(() => { setFocusIdx(selectedIdx); }, [selectedIdx]);

  const pick = useCallback((i: number) => {
    const card = THEME_CARDS[i];
    if (!card) return;
    setFocusIdx(i);
    onMode(card.id);
    // keep the DOM focus on the card the arrow keys just moved to
    cardRefs.current[i]?.focus();
  }, [onMode]);

  const onKey = useCallback((e: React.KeyboardEvent, i: number) => {
    const last = THEME_CARDS.length - 1;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': e.preventDefault(); pick(Math.min(i + 1, last)); break;
      case 'ArrowLeft': case 'ArrowUp': e.preventDefault(); pick(Math.max(i - 1, 0)); break;
      case 'Home': e.preventDefault(); pick(0); break;
      case 'End': e.preventDefault(); pick(last); break;
      default: break;
    }
  }, [pick]);

  return (
    <>
      {probe}
      <div className="settings-grid" role="radiogroup" aria-label="Theme">
        {THEME_CARDS.map((card, i) => {
          const on = mode === card.id;
          const t = tokensFor(card);
          return (
            <button
              key={card.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${card.name} — ${card.note}${card.auto ? ` (now: ${osTheme})` : ''}`}
              data-theme-card={card.id}
              className={`settings-card${on ? ' on' : ''}`}
              tabIndex={i === focusIdx ? 0 : -1}
              ref={el => { cardRefs.current[i] = el; }}
              onClick={() => pick(i)}
              onKeyDown={e => onKey(e, i)}
            >
              <Mini t={t} />
              <span className="settings-card-cap">
                <span className="settings-card-name">{card.name}</span>
                {card.auto && <span className="settings-card-mode">auto</span>}
                {on && <span className="settings-card-check" data-theme-check><Check size={14} /></span>}
              </span>
            </button>
          );
        })}
      </div>
      <div className="settings-note" data-theme-preview-note={resolved}>
        A theme applies to the canvas, the panels and every export. Click a card
        to apply it straight away — System follows your operating system; on
        this device it would use<b> {nowLabel(osTheme)}</b>.
      </div>
    </>
  );
}

function nowLabel(t: ThemeName): string {
  return THEME_CARDS.find(c => c.id === t)?.name ?? t;
}
