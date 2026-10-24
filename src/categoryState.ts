/**
 * PACKAGE-N pass 2b — the left panel's collapsible CATEGORY state + persistence.
 *
 * A sibling of `panelCollapse.ts` on purpose. `diagram-studio:panels` answers
 * "is the left/right PANEL docked or hidden" (panel-level); this key answers
 * "which CATEGORY SECTIONS inside the left panel are folded". Two keys keep the
 * two concerns independent: collapsing a category must not collapse the panel,
 * and collapsing the panel must not reset a category.
 *
 * ONE durable map, ONE key. `collapsed[cat] === true` is the ONLY thing that can
 * mean "this section is folded". A MISSING entry is not "closed" — it means the
 * user has not decided yet, and the section then follows the ACTIVE board's
 * preset: the preset's namesake category is open, every other category starts
 * folded (the board has one home section; the other seven are noise until asked
 * for).
 *
 * PACKAGE-N 2c removed the panel's own `FilterId` view control, so the "active
 * view" that resolves a missing entry is now simply the board's `PresetId` —
 * one fewer concept, and the board can no longer disagree with the panel.
 *
 * Resolving "missing" per render is what lets ONE global map serve all five
 * preset views without writing a default into storage the first time the app
 * opens, and without a category the user never touched looking "decided".
 *
 * The map is GLOBAL, never tier-scoped: a category folded on desktop stays
 * folded in the tablet drawer and the phone sheet, which render the same body.
 */
import {useCallback, useEffect, useState} from 'react';
import {type PaletteCategory} from './palette';
import {type PresetId} from './presets';

/** ONE namespaced key (`diagram-studio:` matches PANELS_KEY in panelCollapse.ts,
 *  MODE_KEY in theme.ts and ANIMATE_KEY in choreography.ts). */
export const CATEGORIES_KEY = 'diagram-studio:categories';

/** The CANONICAL section order. It is fixed this pass — user reordering is not
 *  in scope (synthesis §3), which is why no `libraryOrder` key is persisted. */
export const CATEGORY_ORDER: PaletteCategory[] = [
  'basic', 'flowchart', 'data-storage', 'architecture', 'c4', 'entities', 'groups', 'annotations', 'sequence',
];

/** The real display names for the 8 section headers. */
export const CATEGORY_LABEL: Record<PaletteCategory, string> = {
  basic: 'Basic',
  flowchart: 'Flowchart',
  'data-storage': 'Data & storage',
  architecture: 'Architecture',
  c4: 'C4',
  entities: 'Entities',
  groups: 'Groups & boundaries',
  annotations: 'Annotations',
  sequence: 'Sequence',
};

/** A view id that resolves a not-yet-decided section: the board's own preset.
 *  PACKAGE-N 2c deleted the panel's separate `FilterId` union (`all` + the four
 *  types + `custom`) along with the chip filter it existed to drive — the
 *  board's `PresetId` is now the only view, so `custom` (Mixed) is covered here
 *  where it previously needed its own case. */
export type ViewId = PresetId;

export type CategoryState = {
  /** Manual fold, per section. `true` = collapsed. A missing key = "undecided". */
  collapsed: Partial<Record<PaletteCategory, boolean>>;
};

export const DEFAULT_CATEGORY_STATE: CategoryState = {collapsed: {}};

/** The section a board's preset opens by itself: its namesake. A preset with no
 *  namesake resolves to the first section — one open section, never eight. */
export function defaultOpenCategory(view: ViewId): PaletteCategory {
  switch (view) {
    case 'flowchart':
      return 'flowchart';
    case 'c4':
      return 'c4';
    case 'erd':
      return 'entities';
    case 'custom':
      return 'basic';
    case 'architecture':
      return 'architecture';
    default:
      return 'basic';
  }
}

/** Tolerant parse: never throw on a hand-edited or half-written value, and never
 *  trust the shape. An entry is kept only for a KNOWN `PaletteCategory` and only
 *  for a real boolean; an unknown id, a non-boolean or a malformed object is
 *  dropped instead of trusted (an unknown key would silently fold nothing).
 *
 *  An explicit `false` IS kept, on purpose. "Missing" means "the user has not
 *  decided", which resolves against the active board's preset; a stored `false`
 *  means "the user opened this one by hand" and must survive a reload even when
 *  the board moves on to a preset whose namesake is a different section —
 *  dropping it would fold a section the user had deliberately opened. */
export function parseCategoryState(raw: string | null): CategoryState {
  if (!raw) return DEFAULT_CATEGORY_STATE;
  try {
    const v = JSON.parse(raw) as {collapsed?: unknown} | null;
    const src = v?.collapsed;
    const collapsed: Partial<Record<PaletteCategory, boolean>> = {};
    if (src && typeof src === 'object') {
      const bag = src as Record<string, unknown>;
      for (const cat of CATEGORY_ORDER) {
        const val = bag[cat];
        if (val === true || val === false) collapsed[cat] = val;
      }
    }
    return {collapsed};
  } catch {
    return DEFAULT_CATEGORY_STATE;
  }
}

export function loadCategoryState(): CategoryState {
  try {
    return parseCategoryState(localStorage.getItem(CATEGORIES_KEY));
  } catch {
    // private mode / storage disabled — the app still works, just never remembers
    return DEFAULT_CATEGORY_STATE;
  }
}

export function saveCategoryState(state: CategoryState): void {
  try {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(state));
  } catch { /* storage full or disabled — folding still works for this session */ }
}

/** The one rule, as data. A stored decision wins; with none, the ACTIVE view's
 *  namesake section is the only one open. Shared by the render and the toggle so
 *  a click can never contradict what the user is looking at. */
export function isCategoryOpenIn(state: CategoryState, view: ViewId, cat: PaletteCategory): boolean {
  const stored = state.collapsed[cat];
  if (stored !== undefined) return !stored;
  return cat === defaultOpenCategory(view);
}

export type CategoryCollapse = {
  state: CategoryState;
  /** Flip one section, against what is VISIBLE right now (the `view` resolves
   *  a not-yet-decided section, so the first click on a folded section opens it
   *  instead of writing the fold it already has). */
  toggleCategory: (view: ViewId, cat: PaletteCategory) => void;
  isCategoryOpen: (view: ViewId, cat: PaletteCategory) => boolean;
};

/** Owns the state and mirrors every change into localStorage. */
export function useCategoryCollapse(): CategoryCollapse {
  const [state, setState] = useState<CategoryState>(loadCategoryState);

  useEffect(() => { saveCategoryState(state); }, [state]);

  const toggleCategory = useCallback((view: ViewId, cat: PaletteCategory) => {
    setState(s => ({
      collapsed: {...s.collapsed, [cat]: isCategoryOpenIn(s, view, cat)},
    }));
  }, []);

  const isCategoryOpen = useCallback(
    (view: ViewId, cat: PaletteCategory) => isCategoryOpenIn(state, view, cat),
    [state],
  );

  return {state, toggleCategory, isCategoryOpen};
}
