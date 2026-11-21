/**
 * PACKAGE-P PASS 3 — inspector section fold state + persistence.
 *
 * SIBLING OF `panelCollapse.ts`, deliberately the same shape: ONE namespaced
 * key, a tolerant parse, a `try`/`catch` on write, and a hook that loads once
 * and saves on change. These two are the only modules that own durable panel-UI
 * state, so a reader who has seen one has seen the other.
 *
 * BOOLEAN CONVENTION — `true` means COLLAPSED. That is the direction of
 * `COLLAPSED_DEFAULT` in `src/inspector.ts` (imported here, never copied), so
 * the stored JSON, the §A.3 default table and the rendered `data-collapsed`
 * attribute all speak the same language and nothing in the chain has to negate
 * anything. Expanding a section stores `false` for it.
 *
 * WHY THERE IS NO SECOND DEFAULT TABLE. The default for an absent key — and for
 * any single section id missing from a present key — is `COLLAPSED_DEFAULT[id]`
 * read from `src/inspector.ts`. A second copy of the two folded ids is the exact
 * bug class this pass exists to avoid: §A.3 would then have two homes and a
 * later edit would fold different sections depending on which home was read.
 * The ids are enumerated from `Object.keys(COLLAPSED_DEFAULT)`, so a section
 * added to that Record is parsed here without a line changing in this file.
 */
import {useCallback, useEffect, useState} from 'react';
import {COLLAPSED_DEFAULT, type SectionId} from './inspector';

/** ONE namespaced key (`diagram-studio:` matches PANELS_KEY in panelCollapse.ts,
 *  MODE_KEY in theme.ts and ANIMATE_KEY in choreography.ts). */
export const SECTIONS_KEY = 'diagram-studio:inspector-sections';

/** Per-section fold state. Every id in `SectionId` is always present, so the
 *  render layer never has to ask whether a section's flag was ever written. */
export type SectionState = Record<SectionId, boolean>;

const SECTIONS = Object.keys(COLLAPSED_DEFAULT) as SectionId[];

/** The defaults, DERIVED from the truth table — not a second list of the folded
 *  pair. A fresh profile therefore shows exactly what §A.3 says it shows. */
export function defaultSectionState(): SectionState {
  return {...COLLAPSED_DEFAULT};
}

/** Tolerant parse: never throw on a hand-edited, half-written or wrong-typed
 *  value, and never trust the shape.
 *
 *  Dropped on purpose:
 *   · An unknown section id — written by a build that had a section this one
 *     does not, or typed by hand. There is no such section to fold, so there is
 *     nothing to remember. It is dropped, not kept "just in case": keeping it
 *     would put a stranger's key back into every subsequent save.
 *   · A non-boolean value — a string, a number, `null`. `"false"` is TRUTHY in
 *     JS, so coercing instead of rejecting would silently collapse a section the
 *     user opened. The value is ignored and the section falls back to its
 *     default.
 *
 *  A missing id also falls back to `COLLAPSED_DEFAULT[id]`, while a value the
 *  user really did write survives untouched — which is what makes the §F.5
 *  round-trip exact rather than merely plausible. */
export function parseSectionState(raw: string | null | undefined): SectionState {
  const fallback = defaultSectionState();
  if (!raw) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  /* `null`, a bare string/number and an ARRAY all parse without throwing and are
     all the wrong shape — an array especially, since `typeof [] === 'object'`. */
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return fallback;
  const map = parsed as Record<string, unknown>;
  const out = defaultSectionState();
  for (const id of SECTIONS) {
    const v = map[id];
    if (typeof v === 'boolean') out[id] = v;  // a real decision, kept as written
  }
  return out;
}

export function loadSectionState(): SectionState {
  try {
    return parseSectionState(localStorage.getItem(SECTIONS_KEY));
  } catch {
    /* private mode / storage disabled — the panel still folds, it just forgets */
    return defaultSectionState();
  }
}

export function saveSectionState(state: SectionState): void {
  try {
    localStorage.setItem(SECTIONS_KEY, JSON.stringify(state));
  } catch { /* storage full or blocked — folding still works for this session */ }
}

/** The ONE transition, exported so a harness can EXECUTE the toggle instead of
 *  re-implementing it. The hook below calls this and nothing else flips a
 *  section, so the executed transition is the shipped one. */
export function toggleSectionState(state: SectionState, id: SectionId): SectionState {
  return {...state, [id]: !state[id]};
}

export type InspectorSections = {
  /** Live fold state, one entry per section id. `true` = collapsed. */
  state: SectionState;
  /** Flip one section — the only writer of the fold state. */
  toggleSection: (id: SectionId) => void;
  /** The same question `data-collapsed` answers, asked in TSX, so the attribute
   *  and the body's presence in the tree cannot disagree. */
  isCollapsed: (id: SectionId) => boolean;
};

/** Owns the state and mirrors every change into storage. The fold state is per
 *  SECTION ID and global to the panel — not per node — deliberately: a fold is a
 *  statement about how the user reads the panel, and re-folding Cardinality on
 *  every edge click would make the persisted value meaningless. */
export function useInspectorSections(): InspectorSections {
  const [state, setState] = useState<SectionState>(loadSectionState);

  useEffect(() => { saveSectionState(state); }, [state]);

  const toggleSection = useCallback((id: SectionId) => {
    setState(s => toggleSectionState(s, id));
  }, []);

  const isCollapsed = useCallback((id: SectionId) => state[id], [state]);

  return {state, toggleSection, isCollapsed};
}
