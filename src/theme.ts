/* PACKAGE-L / L1 — theme foundation.
 *
 * Two consumers, one resolution:
 *   1. Our own tokens — keyed off `document.documentElement.dataset.theme`.
 *   2. React Flow's chrome — keyed off the `.dark` class (it only themes its
 *      own ~24 --xy-* variables; that is why we also override the handful of
 *      --xy-* variables we care about from our own tokens in styles.css).
 *
 * React Flow's `colorMode="system"` writes nothing to `document`, so we resolve
 * `system` ourselves (matchMedia) and pass only 'light' / 'dark' down to it.
 */

export type ThemeName = 'dark' | 'light' | 'paper' | 'midnight' | 'contrast';

/** A user preference: a concrete theme, or "follow the OS". */
export type Mode = 'system' | ThemeName;

export const THEMES: {id: Mode; label: string}[] = [
  {id: 'dark', label: 'dark'},
  {id: 'light', label: 'light'},
  {id: 'system', label: 'system'},
  {id: 'paper', label: 'paper'},
  {id: 'midnight', label: 'midnight'},
  {id: 'contrast', label: 'contrast'},
];

/** M — the display copy for the Settings → Appearance theme cards.
 *  The card grid reads THIS, not hardcoded strings, so the names live in one
 *  place (the lowercase `THEMES` labels above are the legacy strip's).
 *  `auto` marks the entry that follows the OS instead of pinning a theme. */
export type ThemeCard = {
  id: Mode;
  /** Display name on the card. */
  name: string;
  /** One-line description of the LOOK (product-generic, no system names). */
  note: string;
  /** true for the System card — its preview follows the current resolution. */
  auto: boolean;
};

export const THEME_CARDS: ThemeCard[] = [
  {id: 'system',   name: 'System',   note: 'follow the OS setting',      auto: true},
  {id: 'dark',     name: 'Dark',     note: 'default · low light',        auto: false},
  {id: 'light',    name: 'Light',    note: 'bright · office / print',    auto: false},
  {id: 'paper',    name: 'Paper',    note: 'warm · documents / PDF',     auto: false},
  {id: 'midnight', name: 'Midnight', note: 'deep blue · long sessions',  auto: false},
  {id: 'contrast', name: 'Contrast', note: 'high contrast · accessibility', auto: false},
];

const THEME_IDS: ThemeName[] = ['dark', 'light', 'paper', 'midnight', 'contrast'];
/** ITEM 1 — EXPORTED because the pre-paint boot script in `index.html`'s <head>
 *  cannot import it: it reads the same key by literal. `checks/theme-boot-sync.mjs`
 *  asserts the two literals are equal, so a rename of this key cannot silently
 *  desync the document's pre-paint theme from React's first commit. */
export const MODE_KEY = 'diagram-studio:theme';

/** Dark-ish themes share React Flow's `.dark` chrome. */
export const isDarkTheme = (t: ThemeName): boolean =>
  t === 'dark' || t === 'midnight' || t === 'contrast';

export const prefersDark = (): boolean => {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return true; }
};

export function isThemeName(v: unknown): v is ThemeName {
  return typeof v === 'string' && (THEME_IDS as string[]).includes(v);
}
export function isMode(v: unknown): v is Mode {
  return v === 'system' || isThemeName(v);
}

/** 'system' → the OS preference; anything else → itself. */
export function resolveMode(mode: Mode): ThemeName {
  if (mode !== 'system') return mode;
  return prefersDark() ? 'dark' : 'light';
}

/** Write the resolved theme to the document: our tokens + React Flow's class. */
export function applyTheme(t: ThemeName): void {
  const root = document.documentElement;
  root.dataset.theme = t;
  root.classList.toggle('dark', isDarkTheme(t));
}

export function loadMode(): Mode {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    if (isMode(raw)) return raw;
  } catch { /* ignore */ }
  return 'system';
}

/** Has the user ever made an EXPLICIT theme choice?
 *  `loadMode()` alone cannot tell "never chose" from "chose System" — both
 *  return 'system'. Board/preset theme suggestions use this guard so they only
 *  ever land for a user who has never picked a theme. */
export function hasStoredMode(): boolean {
  try { return localStorage.getItem(MODE_KEY) !== null; } catch { return false; }
}

export function saveMode(mode: Mode): void {
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
}

/** Read a live token value off the root element (used by the exports). */
export function readToken(name: string, fallback = ''): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch { return fallback; }
}

/** Every token the exporter needs inlined so a standalone SVG still resolves
 *  `var(--…)` — node accents come from data, the rest cascade from the theme. */
export const EXPORT_TOKENS = [
  '--bg', '--surface', '--elevated', '--border', '--border-strong', '--fg', '--dim', '--dim2',
  '--acc', '--acc-soft', '--sel', '--sel-soft', '--green', '--red', '--danger', '--card',
  '--c-accent', '--c-green', '--c-cyan', '--c-violet', '--c-amber', '--c-slate',
] as const;
