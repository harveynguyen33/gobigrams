# PACKAGE-M — Theme becomes ONE Settings entry (modal)

**Sources (read these — they carry the approved look and the evidence):**
- `/home/harvey/diagram-studio-research/mockup-M.html` — the approved interactive sketch. Variant
  **C · Modal** is the target (the A popover and B drawer are rejected). Read its `[data-theme]` blocks,
  `.modal/.mnav/.tgrid/.tslot/.mini` CSS and the `getTok()` probe — they are the visual + behavioural
  reference. **Do not copy the sketch's chrome** (`.sketchbar`, the variant switcher) and **do not copy
  its probe placement** (`document.body.dataset.theme`) — see §5.
- `/home/harvey/diagram-studio-research/shots/theme-settings-C-scaled.png` (Appearance pane) and
  `theme-settings-C-connections.png` (a second pane) — the approved screenshots. The scrim covers the
  **centre canvas column only**; the left palette and right inspector stay live and undimmed.
- `PACKAGE-L-SPEC.md` (spec format + tone), `HANDOFF.md` (state, conventions, the L1 theme layer).
- `src/theme.ts`, `src/styles.css`, `src/App.tsx`, `src/SearchPalette.tsx`, `src/IconPicker.tsx`,
  `src/Tour.tsx`, `src/Checklist.tsx`, `src/ContextMenu.tsx`.

**Goal:** the six-button `theme-seg` strip leaves the canvas for good. The theme becomes **one** setting
inside a single, self-explanatory **Settings modal** reached from one `⚙ Settings` toolbar button —
an entry point with room to grow (7 categories), so this tool can be handed to other people without a
tour explaining where the theme went. Everything generic: no owner-specific content, no company names,
real docs. English artifacts. No new npm dependency.

**Do NOT regress:** undo/redo, box-select, align/distribute, resize, snap, alignment guides, search
palette, icon picker, edge inspector + all six flow modes, tooltips, boards CRUD + autosave, PNG/SVG/JSON
export + JSON import, hover choreography + perf guard, the tour, the checklist, the preset chips,
L1 theme persistence + board-level theme suggestion, export theming.

---

## 0. Approved decisions (Harvey, 2026-09-14) — implement exactly
- **D1 — nav is 7 groups** (Appearance, Canvas, Connections, Editor, Export, Keyboard, About) with the
  nav search box. Confirmed.
- **D2 — the `--acc-soft` dark-theme bug IS fixed inside M** (Harvey chose option 1). Change the dark
  block in `src/styles.css` to a real value:
  `--acc-soft: rgba(245, 78, 0, 0.14); --acc-tint: rgba(245, 78, 0, 0.14);` (replacing the two
  self-referencing lines `--acc-soft: var(--acc-tint);` and `--acc-tint: var(--acc-tint);`).
  This is an intentional visual side effect: `.pchip.on` (preset chip) and any `.on` using `--acc-soft`
  will now show the accent tint in dark (previously transparent) — report it as intentional, not a bug.
  The other 4 theme blocks are unchanged.

## 1. Goal + scope

### Ships in M (required)
- **M1 — one entry point.** The `.theme-seg` block is **deleted** from `src/App.tsx` and from
  `src/styles.css`. One `⚙ Settings` button joins the floating toolbar (last item, after `Export ▾`).
- **M2 — the Settings modal.** New `src/Settings.tsx`: centred modal over the canvas column, a
  **left nav with a search box and 7 categories** (Appearance, Canvas, Connections, Editor, Export,
  Keyboard, About), a right content pane, Esc + backdrop close, focus trap, focus restore.
- **M3 — the theme picker as an Appearance card grid.** New `src/ThemePicker.tsx`: `System` + the 5
  fixed themes as preview **cards** — each card paints a mini-diagram thumbnail **with that theme's real
  tokens** and shows a checkmark when selected. Clicking a card switches the live theme immediately
  through the **existing** `setMode → useEffect → applyTheme` path (no fork).
- **M4 — the other 6 panes render only truthful, already-existing content** (see §1.2). No dead
  controls, no fake toggles.
- **M5 — docs.** `README.md` documents Settings + the cards; the in-app `?` cheat sheet and the tour's
  toolbar step point at the new button (see §9).

### 1.1 Explicitly NOT in M
The other toolbar toggles (snap, alignment guides, prevent-cycles, one-input, proximity connect,
reduce-motion) **stay on the toolbar**. M does not move them. (Optional stretch, only if trivial and
only for reduce-motion — §7.)

### 1.2 What each pane renders in M (minimal, honest, zero dead UI)
| Nav id | Pane in M | Content |
|---|---|---|
| `appearance` | **Full** | the theme card grid (M3) + one sentence of help |
| `canvas` | Read-only status | rows showing the **live** state of Snap to grid / Alignment guides / Reduce motion, each with a small `toolbar` chip, + footnote "These controls live on the canvas toolbar today; they move into Settings in a later release." |
| `connections` | Read-only status | same pattern for Prevent cycles / One input per node / Proximity connect |
| `editor` | Read-only status | Autosave (always on) / Double-click canvas to insert / Board preset (shows the current `presetId`) |
| `export` | Static info | the four real export actions exist — list formats (PNG 2×, SVG, JSON, Import JSON) as plain rows, no buttons |
| `keyboard` | **Full (static)** | the real shortcut list — the SAME rows as the `?` cheat sheet in `App.tsx` and the README table |
| `about` | **Full (static)** | app name, one-line description, `Version 0.1.0`, MIT note, and the LAN-usage hint |

Every read-only row is **display only** — no `<button>`, no toggle, no cursor:pointer. A control that
looks clickable and does nothing is worse than no control.

---

## 2. Component design

### 2.1 File split (5 touched, 2 new)
```
src/Settings.tsx        NEW  — modal shell: overlay, nav, search, pane router, focus trap
src/ThemePicker.tsx     NEW  — radiogroup card grid + useThemePreviews() (the token probe)
src/theme.ts            EDIT — additive only: THEME_CARDS (labels/notes/auto flag)
src/App.tsx             EDIT — delete .theme-seg, add button + state + render + key guards
src/styles.css          EDIT — delete .theme-seg*, add .settings-*
README.md               EDIT — Settings + theme cards, generic wording
```
Why two new files and not one: the probe + grid are the only genuinely new mechanism in M (and the only
thing a test needs to poke); keeping them in `ThemePicker.tsx` keeps `Settings.tsx` a dumb shell that
later panes can be appended to without touching theme code.

### 2.2 `src/Settings.tsx`

```ts
export type SettingsCat = 'appearance' | 'canvas' | 'connections' | 'editor' | 'export' | 'keys' | 'about';

export const SETTINGS_CATS: {id: SettingsCat; icon: React.ReactNode; name: string}[] = [...7 entries, in order];

type Props = {
  open: boolean;
  onClose: () => void;
  /** the user's stored preference (Mode) — the picker writes back through this */
  mode: Mode;
  onMode: (m: Mode) => void;
  /** the theme actually painted right now (resolveMode(mode)) — only for the System card */
  resolved: ThemeName;
  /** live values for the read-only rows (canvas / connections / editor panes) */
  status: {snap: boolean; alignGuides: boolean; animate: boolean; noCycles: boolean; oneIn: boolean; proximity: boolean; preset: string; autosave: boolean};
  /** optional: return focus to the toolbar button on close */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
};

export default function Settings({open, onClose, mode, onMode, resolved, status, returnFocusTo}: Props)
```
Behaviour (mirror `SearchPalette.tsx` / `IconPicker.tsx`, which are the established modal patterns):
- `if (!open) return null;` — mounts only while open (same as `SearchPalette`'s `{searchPos && …}`).
- **Overlay**: `<div className="settings-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>`
  with `onDoubleClick={e => e.stopPropagation()}` (SearchPalette does this so the canvas double-click
  "insert node" can never fire through the overlay). Inner `.settings-modal` is a separate element, so a
  click on it is never `e.target === e.currentTarget` — no extra `stopPropagation` needed.
- **Dialog semantics**: `role="dialog" aria-modal="true" aria-labelledby="settings-title"` on
  `.settings-modal`; the pane `<h2 id="settings-title">` carries the category name.
- **Esc**: one `document.addEventListener('keydown', onKey, true)` (capture, like `ContextMenu`) while
  open → `if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }`. Capture +
  `stopPropagation` is what keeps App's global Escape handler (App.tsx ~1408) from *also* running and
  clearing the node selection behind the modal. App also gets a guard (§3.3) — belt and braces.
- **Focus**: on open, `setTimeout(() => searchRef.current?.focus(), 10)` (IconPicker's pattern, so the
  element exists after paint). Trap Tab: collect `modal.querySelectorAll('button:not([disabled]), input, [href], select, textarea')`,
  and on Tab/Shift+Tab at the ends, wrap to first/last. While open, `document.activeElement` is never
  outside `.settings-modal`.
- **Focus restore**: on unmount, `returnFocusTo?.current?.focus()`.
- **Nav search**: an `<input className="settings-search" placeholder="Search settings…">` at the top of
  the nav. In M it **filters the 7 nav groups by name only** (exactly what the mockup does), and the
  placeholder says "…"; a row-level index is a follow-up (§7). Enter jumps to the first match; the pane
  switches; the query is kept.
- **Nav items**: `<button type="button" className="settings-nav-item" data-settings-cat={id} aria-current={current}>`
  with an icon (`lucide-react`, already a dependency) + the name. The active one gets `.on`.
- **Nav note**: `<div className="settings-nav-note">7 groups · room to grow</div>` — generic, self-explanatory.
- **Pane scroll**: `.settings-main` is `overflow-y: auto`; the modal has a fixed height (mockup 460px,
  clamped) so a growing pane never resizes the window.
- **No entrance animation in M** (the approved mockup has none). If one is added later it must be gated
  on `prefers-reduced-motion: no-preference`.

### 2.3 `src/ThemePicker.tsx`

```ts
export type PreviewTokens = {
  bg: string; surface: string; border: string; fg: string; dim: string;
  dot: string; acc: string; accent: string; violet: string; cyan: string; slate: string;
};

/** Reads every theme's tokens off a scoped hidden probe. Memoised per open. */
export function useThemePreviews(active: boolean): Record<ThemeName, PreviewTokens>;

type Props = {
  mode: Mode;
  onMode: (m: Mode) => void;
  /** the currently painted theme — the System card previews THIS resolution */
  resolved: ThemeName;
};

export default function ThemePicker({mode, onMode, resolved}: Props)
```
Markup:
- `<div className="settings-grid" role="radiogroup" aria-label="Theme">`
- one `<button type="button" role="radio" aria-checked={mode === card.id} data-theme-card={card.id} className="settings-card …">`
  per entry, in **mockup order: System first, then Dark, Light, Paper, Midnight, Contrast**.
- card content: `.settings-card-mini` (the thumbnail, §2.4) + `.settings-card-cap` with
  `.settings-card-name` (System/Dark/…), `.settings-card-mode` (`auto` | `fixed`, mono micro-label) and
  `.settings-card-check` (a `Check` from lucide-react, rendered only when selected).
- keyboard: radios are a radiogroup, so add roving tabindex + ArrowLeft/ArrowRight
  (`ArrowRight`/`ArrowDown` → next, `ArrowLeft`/`ArrowUp` → previous, Home/End) and
  `setMode` on arrow. One Tab stop for the whole grid.
- The **System card previews the current OS resolution** (`resolved`), because that is the honest thing
  to show — the mockup painted it with `dark` tokens only as a shortcut. Its `mode` label is `auto` and
  the caption may add `(now: dark)` for clarity; the other five are `fixed`.

### 2.4 The mini-thumbnail (visual contract)
Per card, `height: 76px` (mockup `.mini`), painted purely from `PreviewTokens`:
1. a `--dots` radial-gradient at `14px 14px` (a scaled-down canvas),
2. three absolutely-positioned rounded rects with `border: 1.5px solid` in the theme's
   `accent` / `violet` / `cyan` and a translucent fill, at the mockup's `left/top/width/height`
   percentages (10/34, 52/16, 34/62) — i.e. a generic 3-box diagram, no product-specific labels,
3. the card's own background is the theme's `bg`.

This is what makes the difference obvious at a glance: with six of these, `paper` vs `light` vs
`midnight` is decidable without switching.

---

## 3. Exact changes to `App.tsx`

### 3.1 REMOVE (App.tsx ~1804–1818)
Delete the comment block *"L1: theme picker — dark / light / system / paper …"* and the entire
`<div className="theme-seg" role="group" aria-label="Theme"> … </div>` element (the `THEMES.map`).
After this, `<div className="toolbar">` directly follows `<main className="canvas-wrap" …>`.
Also drop `THEMES` from the import on line ~29 (it becomes unused in App; it stays exported by
`theme.ts` for `ThemePicker`). Keep `loadMode, resolveMode, saveMode, applyTheme, readToken,
EXPORT_TOKENS, Mode, ThemeName`.

### 3.2 ADD
1. Imports: `import Settings from './Settings';`, `import {Settings as SettingsIcon} from 'lucide-react';`
   (`Settings` is a real lucide icon name — confirm against `src/lucideIcons.ts`/the installed version
   before use; fall back to `SlidersHorizontal` / `Cog` if not).
2. State, next to the existing theme state (~286):
   ```ts
   const [settingsOpen, setSettingsOpen] = useState(false);
   const settingsBtnRef = useRef<HTMLButtonElement>(null);
   ```
   **Do not touch** the existing `mode` / `theme` state or its two `useEffect`s (286–305). The modal
   drives `setMode` and nothing else — one resolution path, one persistence key.
3. Toolbar button — last child of `.toolbar` (after the `Export ▾` dropdown wrapper, ~1920):
   ```tsx
   {sep()}
   <Tooltip label="Settings — theme, canvas, connections, keyboard">
     <button
       type="button"
       ref={settingsBtnRef}
       className="tbtn-dd settings-btn"
       data-settings-btn
       aria-label="Settings"
       aria-haspopup="dialog"
       aria-expanded={settingsOpen}
       onClick={() => { setPop(false); setSettingsOpen(true); }}
     ><SettingsIcon size={14} /> Settings</button>
   </Tooltip>
   ```
   Reusing `.tbtn-dd` keeps it visually identical to `Export ▾` (the approved screenshot shows a
   bordered chip with a glyph + the word). `data-settings-btn` is the stable test hook.
4. Render, in the same overlay group as `SearchPalette` (~2040), so it is inside `.canvas-wrap` and
   therefore dims **only the canvas column** — exactly the approved screenshot:
   ```tsx
   <Settings
     open={settingsOpen}
     onClose={() => setSettingsOpen(false)}
     mode={mode}
     onMode={setMode}
     resolved={theme}
     status={{snap, alignGuides, animate, noCycles, oneIn, proximity, preset: presetId, autosave: true}}
     returnFocusTo={settingsBtnRef}
   />
   ```

### 3.3 Keyboard guards (required)
App's global keydown (`useEffect` at ~1381) must become inert while the modal is open:
- right after `if (isEditable(e.target)) return;` add `if (settingsOpen) return;`
  — this is what stops bare `d` / `z` / `?` / arrows from duplicating a node, undoing, or opening the
  help popover while the user is tabbing through the nav.
- add `settingsOpen` to that effect's dependency array.
- the `Escape` branch (~1408) gains `if (settingsOpen) { setSettingsOpen(false); return; }` **first**, so
  the intended order is: settings → search palette → help → boards → clear selection.
- React Flow's own `deleteKeyCode={['Delete','Backspace']}` needs no change: the modal is not a React
  Flow child and the App guard does not apply to it, but React Flow only fires on focused nodes; the
  focus trap keeps focus inside the modal, so `Del` cannot reach the canvas. Verify this in AC12.

### 3.4 Do NOT do
Do not lift `mode` into a new context/store, do not add a second localStorage key, do not make the theme
picker write `document.documentElement` directly, do not move the `applyTheme` call out of the effect,
do not delete `THEMES` from `theme.ts`.

---

## 4. Exact changes to `styles.css`

### 4.1 DELETE
The whole L1 theme-picker block (lines ~1227–1240) — the comment line *"L1: theme picker + preset
picker…"* is edited (keep the preset half), and `.theme-seg`, `.theme-seg button`,
`.theme-seg button:hover`, `.theme-seg button.on` are removed. Keep `.preset-bar` / `.pchip` untouched.
After M there must be **zero** `.theme-seg` rules and zero `.theme-seg` elements in the DOM.

### 4.2 ADD — a `PACKAGE-M` section at the end of `styles.css`
Tokens only — **never a literal hex, never a literal rgba**; only `var(--…)` and `color-mix` over tokens.

| Class | Role | Tokens to use |
|---|---|---|
| `.settings-overlay` | absolute full-cover scrim over `.canvas-wrap`, grid-centred | `--scrim` |
| `.settings-modal` | the dialog card | `--surface` `--border-strong` `--shadow-pop` |
| `.settings-nav` | left column | `--elevated` `--border` `--dim2` |
| `.settings-search` | nav search field | `--surface` `--border` `--fg` `--dim` |
| `.settings-nav-item` | nav row | `--dim` `--fg` |
| `.settings-nav-item:hover` | hover | `--surface` |
| `.settings-nav-item.on` | active row | `--acc` + an accent tint |
| `.settings-nav-note` | the "room to grow" footnote | `--dim` `--mono` |
| `.settings-main` | right pane, `overflow-y:auto` | `--surface` |
| `.settings-h` / `.settings-sub` | pane heading + subtitle | `--fg` / `--dim` `--mono` |
| `.settings-grid` | 3-column card grid | — |
| `.settings-card` | a theme card | `--border` `--surface` |
| `.settings-card:hover` | hover | `--border-strong` |
| `.settings-card.on` | selected card | `--acc` + accent tint |
| `.settings-card-mini` | the thumbnail frame | `--border` |
| `.settings-card-cap/-name/-mode` | caption row | `--fg` / `--dim` `--mono` |
| `.settings-card-check` | the ✓ | `--acc` |
| `.settings-empty` | empty/no-match state | `--dim` `--mono` |
| `.settings-close` | the ✕ in the header | `--dim` → `--fg` |
| `.settings-probe` | the hidden probe wrapper (§5) | — |
| `.settings-btn` | the toolbar button (only if `.tbtn-dd` needs a tweak) | `--acc` for the `.on`/open state |

Layout numbers come from the approved mockup/screenshots: modal `width: 720px; max-width: calc(100% - 48px);
height: 460px; max-height: calc(100% - 48px); display: flex; overflow: hidden`;
nav `width: 190px; flex: none; border-right: 1px solid var(--border); padding: 12px 8px`;
main `flex: 1; padding: 18px 22px; overflow-y: auto`; grid `display: grid;
grid-template-columns: 1fr 1fr 1fr; gap: 12px`; card `border: 1.5px solid var(--border); border-radius: 11px;
padding: 10px; cursor: pointer`; mini `height: 76px; border-radius: 7px; border: 1px solid var(--border);
position: relative; overflow: hidden; margin-bottom: 8px`.

**z-index:** `.settings-overlay { z-index: 70 }`. Justification by the live ladder —
`.toolbar`/`.preset-bar` 5, `.sel-bar`/`.help-btn` 6, `.help-pop`/`.pop` 30, `.sp-overlay` 40,
`.ctx-menu` 60, `.tooltip` 9999, `.tour-overlay` 10000. 70 sits above every canvas surface **and** above
the context menu (so a stale right-click menu can never float over the dialog) while staying under the
tooltip layer and the Tour, so a tooltip rendered from inside the modal still shows.

### 4.3 Token names to use (never invent, never hardcode)
`--bg --surface --elevated --border --border-strong --fg --dim --dim2 --acc --sel --green --red --danger
--card --scrim --panel-glass --panel-glass-strong --dots --shadow --shadow-strong --shadow-pop --shadow-sm
--shadow-toolbar --mono --sans --on-acc --on-acc-hover --edge-text-bg
--c-accent --c-green --c-cyan --c-violet --c-amber --c-slate`

`--acc-soft` is available for accent tints in 4 of the 5 themes — **see the pitfall in §8.2 before using
it in the dark theme.**

---

## 5. Theme-card preview technique — RECOMMENDED: the scoped hidden probe

**Use a hidden probe element inside the modal, one child per theme, each carrying `data-theme`, and read
computed values with `getComputedStyle`. Never touch `document.documentElement`.**

### Shape of it
```tsx
// inside ThemePicker.tsx
const PROBE_TOKENS = ['--bg','--surface','--border','--fg','--dim','--dots',
                      '--acc','--c-accent','--c-violet','--c-cyan','--c-slate'] as const;

function useThemePreviews(active: boolean): Record<ThemeName, PreviewTokens> {
  const ref = useRef<HTMLDivElement>(null);
  const [previews, setPreviews] = useState<Record<ThemeName, PreviewTokens>>(EMPTY);
  useLayoutEffect(() => {
    if (!active || !ref.current) return;
    const next = {...EMPTY};
    for (const t of ['dark','light','paper','midnight','contrast'] as ThemeName[]) {
      const el = ref.current.querySelector<HTMLElement>(`[data-theme="${t}"]`);
      if (!el) continue;
      const cs = getComputedStyle(el);
      next[t] = {
        bg: cs.getPropertyValue('--bg').trim(),
        surface: cs.getPropertyValue('--surface').trim(),
        border: cs.getPropertyValue('--border').trim(),
        fg: cs.getPropertyValue('--fg').trim(),
        dim: cs.getPropertyValue('--dim').trim(),
        dot: cs.getPropertyValue('--dots').trim(),
        acc: cs.getPropertyValue('--acc').trim(),
        accent: cs.getPropertyValue('--c-accent').trim(),
        violet: cs.getPropertyValue('--c-violet').trim(),
        cyan: cs.getPropertyValue('--c-cyan').trim(),
        slate: cs.getPropertyValue('--c-slate').trim(),
      };
    }
    setPreviews(next);
  }, [active]);
  const probe = (
    <div ref={ref} className="settings-probe" aria-hidden="true">
      {(['dark','light','paper','midnight','contrast'] as ThemeName[]).map(t => (
        <span key={t} data-theme={t} />
      ))}
    </div>
  );
  return {previews, probe};   // or keep the probe JSX in the hook's caller
}
```
`.settings-probe { position: absolute; width: 0; height: 0; overflow: hidden; opacity: 0; pointer-events: none; }`
plus `aria-hidden="true"` — it is renderable and measurable but invisible, unfocusable and inert.

### Why this and not the alternatives
- **It is exact.** The thumbnail paints the *actual* shipped values — including `color-mix()` results
  such as `--acc-soft` and any future token edit. Verified live on the current build: a scoped
  `<div data-theme="light">` inside the running page resolves `--bg #f7f7f8`, `--surface #ffffff`,
  `--c-accent #9a3412`, `--dots rgba(24,27,.10)`; `midnight` → `#0a0f1e` / `#121a2e` / `#ff7a45`;
  `contrast` → `#000000` / `#ffff00` / `rgba(255,255,255,.25)`. So the `[data-theme]` attribute selector
  works on any subtree, not just `<html>`.
- **No leak.** The probe writes `data-theme` on a descendant of the modal, so `document.documentElement.dataset.theme`
  is untouched, `.dark` is untouched, React Flow's `colorMode` (driven by App's `themeIsDark`) is
  untouched, `readToken()` and both export paths (`readToken`/`EXPORT_TOKENS`) still read the live theme,
  and no theme can flash onto the chrome.
- **One source of truth.** The alternative — a static TS token map (`THEME_TOKENS = {dark: {bg: '#0b0b0d', …}}`)
  — duplicates 5 × ~25 values that already live in `styles.css`. It would drift silently on the next
  token edit, which is exactly the failure PACKAGE-L's token layer exists to prevent. Rejected.
- **Cost.** One `useLayoutEffect` reading 11 properties × 5 elements, only while the modal is open
  (memoised on `active`). Negligible, and it happens behind the dialog, not on the canvas hot path.

### The one thing you must NOT copy from the mockup
`mockup-M.html` implements `getTok()` by `document.body.appendChild(el)` and setting
`document.body.dataset.theme` for the live switch. In the real app: **never set `data-theme` on `<body>`
or `documentElement` from the picker**, and never leave the probe outside the modal subtree. `applyTheme`
in `theme.ts` is the only writer of `documentElement.dataset.theme` / `.dark` (PACKAGE-L §L1, HANDOFF
L1 row) — the picker must go through `setMode` and let the existing effect call it.

---

## 6. Acceptance criteria (measurable — every one must be measured in a browser, not asserted)

**DOM shape**
1. `document.querySelectorAll('.theme-seg').length === 0` and `.theme-seg button` → 0.
2. `.toolbar` contains exactly **one** `[data-settings-btn]`, with `textContent` containing "Settings",
   `aria-haspopup="dialog"`, `aria-expanded="false"` when closed.
3. With the modal closed there is no `[role="dialog"]` in the DOM at all.

**Open / close**
4. Clicking `[data-settings-btn]` mounts exactly one `[role="dialog"][aria-modal="true"]` whose
   `aria-labelledby` resolves to the visible pane heading; the button's `aria-expanded === "true"`.
5. `.settings-overlay` is inside `.canvas-wrap` (assert `overlay.closest('.canvas-wrap') !== null`).
6. Pressing `Escape` closes it: `.settings-overlay` gone, and `document.activeElement` is
   `[data-settings-btn]`.
7. Clicking the backdrop (a click dispatched on `.settings-overlay` itself, as the coordinate centre of
   the overlay outside the card) closes it; a click on `.settings-modal` does **not**.
8. The modal is centred and clamped: `cardRect` is within the canvas column and
   `cardRect.height <= columnRect.height - 48`.

**Nav**
9. Exactly **7** `[data-settings-cat]` items, in order
   `appearance, canvas, connections, editor, export, keys, about`, each a `<button>`; `role="dialog"`'s
   label matches the active one.
10. The search input exists; typing "conn" switches the pane to Connections; typing "App" switches to
    Appearance; a query matching nothing leaves the current pane and shows no error.
11. Each of the 6 non-Appearance panes renders a heading + its rows and logs **zero** React warnings /
    console errors when opened in turn (check the console, not just the DOM).

**The theme cards and the live switch**
12. The Appearance pane has exactly **6** `[data-theme-card]` radios inside `[role="radiogroup"][aria-label="Theme"]`,
    ids `system, dark, light, paper, midnight, contrast` in that order; exactly one has
    `aria-checked="true"`, and that one contains a visible `.settings-card-check`.
13. Every card's thumbnail is painted: for each card, the `.settings-card-mini` computed
    `background-color` differs across cards and equals that theme's `--bg` — specifically
    dark `rgb(11,11,13)`, light `rgb(247,247,248)`, paper `rgb(246,241,231)`, midnight `rgb(10,15,30)`,
    contrast `rgb(0,0,0)`; and each card's three thumbnail boxes use that theme's `--c-accent/-violet/-cyan`.
14. **Previewing does not theme the app.** Record `document.documentElement.dataset.theme` and
    `document.documentElement.className` before opening, open the modal, wait 2 animation frames, and
    assert they are unchanged. Also assert the probe is **inside** `.settings-modal` and
    `document.documentElement.dataset.theme !== <a probed theme id ≠ current>` while the probe shows that
    theme (i.e. no leak). Assert `document.querySelector('.settings-probe')` has `aria-hidden="true"` and
    zero client rects.
15. Clicking the **Midnight** card: within 250 ms (allow one frame + effect) —
    `document.documentElement.dataset.theme === 'midnight'`,
    `document.documentElement.classList.contains('dark') === true`,
    `localStorage.getItem('diagram-studio:theme') === 'midnight'`,
    the live root's `--bg` computed becomes `#0a0f1e`, the canvas background becomes `rgb(10,15,30)`,
    an existing node's resolved accent border colour changes to midnight's `--c-*` value, **and** an
    export path agrees (the exported SVG contains `fill="#0a0f1e"`).
16. The modal itself re-themes live **without unmounting**: capture the `.settings-modal` element
    reference before the click and assert `document.body.contains(sameRef) === true` and its computed
    `--surface` is now `#121a2e`. (This is the "chrome re-themes live" promise from the mockup.)
17. The card that is selected after the click is `midnight` with `aria-checked="true"` and the ✓.
18. **Persistence across reload:** with mode `paper`, reload the page → `dataset.theme === 'paper'`,
    `localStorage['diagram-studio:theme'] === 'paper'`, and the Paper card is the checked one. With mode
    `system`, reload → `dataset.theme` equals the OS resolution and the System card is checked.
19. **Other themes still work end-to-end:** selecting each of the 5 fixed themes yields the same
    `--c-accent` sequence the L1 report measured (`#f54e00 → #9a3412 → #8a2e05 → #ff7a45 → #ffff00`) and
    the same `--bg` sequence (`rgb(11,11,13) → rgb(247,247,248) → rgb(246,241,231) → rgb(10,15,30) → rgb(0,0,0)`),
    and the board-level suggestion still only lands while the mode is `system`.

**Selected-card legibility (catches the §8.2 pitfall)**
20. In the **dark** theme, `getComputedStyle(document.querySelector('.settings-card.on')).backgroundColor`
    is **not** `rgba(0, 0, 0, 0)` — the selected card must read as selected in every one of the 5 themes
    (assert for all 5).

**Keyboard / a11y**
21. `Tab` from the last focusable element inside the modal moves focus to the first (and `Shift+Tab` from
    the first moves to the last): assert `document.activeElement` is always inside `.settings-modal` after
    10 forward and 10 backward tabs.
22. `ArrowRight` on a focused theme card selects the next theme (and `Home`/`End` jump to first/last).
23. With the modal open, pressing `d`, `z` and `?` (outside the search input) does **not** duplicate a
    node, does not change `canUndo`, and does not open the help popover — node and edge counts are
    identical before and after.
24. No axe-level violations introduced: the dialog has an accessible name; no `aria-*` attribute
    references a missing id; no focusable element has zero size (`document.querySelectorAll('.settings-probe *').length` is excluded by `aria-hidden`+zero-size).

**Gates / no regression**
25. `npx tsc --noEmit` = 0 · `npx vite build` = 0.
26. `package.json` `dependencies`/`devDependencies` are **unchanged** (no new npm dep).
27. Undo/redo, box-select, the search palette (double-click canvas), the icon picker, edge labels, the
    preset chips, the tour and the checklist behave as before; the demo board **"Kafka rebalance"** ends
    clean at **3 nodes / 2 edges**, and any board created while testing is deleted.
28. `README.md` mentions the Settings button and the six theme cards; the `?` cheat sheet and the tour's
    toolbar step both point at Settings.

---

## 7. Out of scope (do NOT do in M)

- **Moving the toolbar toggles.** Snap, alignment guides, prevent-cycles, one-input, proximity connect
  and reduce-motion stay on the toolbar. The Canvas / Connections / Editor panes show their live state
  **read-only** and say the move is coming. *Optional stretch, only if it is genuinely trivial:* wire
  **reduce-motion only** into the Editor or Canvas pane, because `useAnimationGating` already exposes
  `toggle` / `auto` / `override` / `resetOverride` and persisting is one call — a real toggle there is a
  ≤10-line change with no new state. Nothing else gets a control in M.
- **A row-level settings search.** The nav search filters the 7 groups only (as approved). Do not build a
  settings-row index.
- **Any board/JSON schema change.** No new `BoardDoc` field, no change to `vite.config.ts`'s boards API,
  no change to the preset spine.
- **New npm dependencies.** Icon, dialog, trap and probe are all doable with what is installed
  (`lucide-react`, `react`, DOM APIs).
- **A settings store/context, a second persistence key, or a theme written outside `applyTheme`.**
- **Restyling the rest of the app** while in there. M touches the canvas toolbar's tail, the overlay group
  and the L1 `.theme-seg` rules; nothing else.
- **Git commits** (Harvey's convention) and **touching any file outside the 6 listed in §2.1**.

---

## 8. Risks / pitfalls

**8.1 The hidden probe vs React Flow's `colorMode`.** App passes `colorMode={themeIsDark ? 'dark' : 'light'}`
(§2078). React Flow themes only its own `--xy-*` vars and the `.dark` class, and the class is toggled by
`applyTheme`. Because the probe lives inside the modal and never writes to `<html>`/`<body>`, the two can
never disagree. The trap is a "clever" refactor: probing by cloning the theme onto `<body>` (the mockup's
shortcut) would apply `[data-theme]` at body scope, re-theme the whole UI *and* shadow
`documentElement.dataset.theme`, breaking `applyTheme`, `readToken`, both exports and `themeIsDark` in one
move. Probe inside the subtree only, and remove/hide it when the modal closes.

**8.2 `--acc-soft` is BROKEN in the dark theme (measured, live).** In `:root, [data-theme="dark"]`:
`--acc-soft: var(--acc-tint)` and `--acc-tint: var(--acc-tint)` — a **self-reference cycle**, so both
resolve to the empty string. Consequence on the current build: `.theme-seg button.on` and `.pchip.on` have
`background-color: rgba(0, 0, 0, 0)` in dark (only their text colour changes), while `.tbtn-icon.on`
correctly uses `--sel-soft` and shows `rgba(59,130,246,.14)`. The other four themes are fine
(`--acc-soft: color-mix(in srgb, var(--acc) 10%, transparent)`).
**Required:** the new `.settings-card.on` / `.settings-nav-item.on` must be legible in all 5 themes —
either use `background: color-mix(in srgb, var(--acc) 14%, transparent)` directly in the settings rules,
or (recommended, 2 lines in `styles.css`) fix the dark block to
`--acc-soft: rgba(245, 78, 0, 0.14); --acc-tint: rgba(245, 78, 0, 0.14);`.
If the 2-line fix is taken, note it is a **visual change** to `.pchip.on` (the preset chip gains its
intended accent tint in dark) — flag it in the report as an intentional side effect. AC20 exists to force
this decision.

**8.3 z-index ladder.** Use 70 for `.settings-overlay` (§4.2). Two real interactions: (a) a context menu
opened *before* the modal could otherwise float above it — 70 > 60 fixes it; (b) the tooltip layer
(9999) stays above so a tooltip inside the modal is visible, and the Tour (10000) stays above so an
auto-started tour is never hidden behind the dialog. Check the tour's auto-start: it runs once (keyed off
`diagram-studio:tour-seen`) on first load; if it ever starts while the modal is open, close the modal or
defer the tour — do not leave the dialog under the spotlight.

**8.4 Escape + shortcut double-handling.** App's global keydown must be inert while the modal is open
(§3.3: the `if (settingsOpen) return;` guard + `settingsOpen` in the deps) and Settings' own listener
should use capture + `stopPropagation`. Without both, one Escape closes the modal *and* clears the node
selection behind it, and bare `d` while tabbing the nav duplicates a node — an invisible, reportable bug.

**8.5 Generic for other users (the shareability bar).** No owner-specific or company wording anywhere:
pane copy is product-generic, the thumbnail is an abstract 3-box diagram (no "Kafka", no real system
names), the theme notes describe the *look* (e.g. `Dark — default · low light`, `Paper — warm · documents
/ PDF`, `Contrast — high contrast · accessibility`), and every control is labelled by what it does. A
first-time reader should know what a card does without a tour. Keep the nav note honest ("7 groups · room
to grow") or drop it in favour of plain copy.

**8.6 Two sources of theme copy.** `theme.ts` exports `THEMES: {id, label}` with lowercase labels used by
the old strip. M adds `THEME_CARDS` (display name, note, auto flag) — the picker must read
`THEME_CARDS`, not hardcode strings, so the names live in one place. Keep `THEMES` exported (removing it
would break nothing today but is an unnecessary breaking change to a public module).

**8.7 About-pane version string.** `tsconfig.json` has no `resolveJsonModule` and `include: ["src"]`, so
`import pkg from '../package.json'` will not type-check. Use a plain `const APP_VERSION = '0.1.0';` in
`Settings.tsx` with a comment to bump it alongside `package.json` — do **not** change `tsconfig.json` for
this.

**8.8 Shortcut-list drift.** The Keyboard pane will be the **third** copy of the shortcut list (README
table, the `?` cheat sheet, the pane). Copy the exact rows, and flag in the report that extracting one
shared `SHORTCUTS` const is the right follow-up (out of scope for M, §7).

**8.9 `--acc-soft` inside `color-mix`/`var()` fallbacks.** Do not write `var(--acc-soft, #f54e00)` style
fallbacks — a literal hex fallback defeats the token system (PACKAGE-L's audit removed exactly these).

**8.10 The scrim covers the canvas column only.** That is the approved design (screenshot: palette and
inspector stay live) and it falls out of rendering `<Settings>` inside `.canvas-wrap`. If the product
later wants a whole-window modal, it is a one-line move to the app root — but do not do it in M, and do
not "fix" the column-scoped scrim as if it were a bug.

**8.11 Headless verification note (from HANDOFF).** A hidden headless tab never fires `ResizeObserver`,
so React Flow renders **no edges** while nodes still appear. Call `Page.bringToFront` before measuring
anything edge-related. The dev server is `http://192.168.33.200:5200/` (never `localhost` to Harvey).
Remember the demo board must be restored clean (3n/2e) and test boards deleted.

---

## 9. Docs to update (part of M, still generic)

- **`README.md`** — a new "Settings" paragraph: the `⚙ Settings` button opens the Settings dialog with
  seven categories; Appearance holds the theme cards (System + Dark/Light/Paper/Midnight/Contrast), and
  the theme applies to the canvas, the panels **and every export**. Update the source-layout tree with
  `Settings.tsx` + `ThemePicker.tsx`, and adjust "Customising the look" to mention the cards while keeping
  the tokens-first explanation.
- **`src/App.tsx` `?` cheat sheet** — no new row needed for theming; the cheat sheet is shortcuts only.
  If a Settings row is added, it must match the README table exactly.
- **`src/Tour.tsx`** — the existing `.toolbar` step's body currently says
  *"Undo, snap, alignment guides, auto-layout, and Export (PNG / SVG / JSON)."* Extend it to
  *"… and Settings — where the theme, canvas and keyboard options live."* One line; do **not** add a 9th
  step in M.
- **`HANDOFF.md` / `DEV-NOTES.md`** — the implementer may add a short M section; the orchestrator owns
  the final HANDOFF rewrite.

---

## 10. Suggested implementation order (verify after each step)

1. **M-A** `styles.css`: delete `.theme-seg*`, add the `PACKAGE-M` `.settings-*` block (+ the §8.2 decision).
   Nothing renders it yet → `tsc`/`build` = 0, app visually unchanged except the strip's rules are gone.
2. **M-B** `theme.ts`: add `THEME_CARDS` (additive).
3. **M-C** `ThemePicker.tsx`: the probe hook + the card grid. Verify AC12/13/14 in isolation (mount it
   temporarily in the toolbar area if needed, then remove that harness).
4. **M-D** `Settings.tsx`: shell, nav, search, the 7 panes (Appearance = `ThemePicker`), focus trap.
5. **M-E** `App.tsx`: delete the strip, add the button + state + render + the keyboard guards.
6. **M-F** docs (`README.md`, tour line) and the cosmetic cleanup (drop the now-unused `THEMES` import).
7. **M-G** full verification pass (§6, all 28) + report.

## 11. Report format (what the implementer hands back)

A table per step (M-A…M-F) with the **measured** evidence — the exact DOM query, the exact computed
value, the exact `localStorage` read — not a description of the code. Then a short deviations list
(what differs from this spec and why), and an explicit statement of what could **not** be verified
headlessly (e.g. a real focus-ring visual check, trackpad behaviour). If any acceptance criterion was not
measurable, say so instead of claiming it.
