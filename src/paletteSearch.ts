/**
 * PACKAGE-N pass 2c — the left panel's SHAPE SEARCH predicate.
 *
 * The panel's omnibox and the insert modal (`SearchPalette`) both answer "does
 * this element match what the user typed?", so the rule lives here ONCE instead
 * of being spelled out twice with a chance to drift. `SearchPalette` renders its
 * own overlay/layout (it stays the modal it is) but imports THIS predicate.
 *
 * The fields searched are the whole model, deliberately:
 *
 *   label    the element's own name        ("Database")
 *   hint     the human sub-line             ("cylinder · datastore")
 *   aliases  retired names + synonyms       ("cyl", "db", "subroutine", "diamond")
 *   geometry the shape word                 ("cylinder", "hexagon", "diamond")
 *
 * `aliases` and `geometry` are what make the search feel like draw.io's: a user
 * types the SHAPE they can see ("cylinder") at least as often as the semantic
 * name, and the retired labels from the PACKAGE-N renames (Subprocess → Predefined
 * process) stay findable instead of punishing muscle memory.
 *
 * RANKING IS DELIBERATELY ABSENT (spec §9.1): a plain case-insensitive
 * `includes()` per field. No scorer, no weights, no prefix/length tiebreak. That
 * ladder is a later pass; shipping it now would be untested cleverness.
 */
import {type PaletteCategory, type PaletteItem} from './palette';

/** The normalised haystack for one element: every searchable field, lowercased.
 *  Built per call rather than cached — the library is 34 static objects and a
 *  cache keyed on object identity would be more machinery than the saving. */
const haystack = (p: PaletteItem): string =>
  [p.label, p.hint, ...(p.aliases ?? []), p.geometry ?? '']
    .filter(Boolean)
    .join(' \u0000 ')
    .toLowerCase();

/** Does ONE element match the query? The single predicate the panel and the
 *  modal share. An empty/whitespace needle matches everything (the caller
 *  decides what to do with "everything" — the panel restores its accordion). */
export function matchesQuery(item: PaletteItem | undefined, query: string): boolean {
  if (!item) return false;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return haystack(item).includes(needle);
}

/** The matching subset, in LIBRARY order. Filtering never REORDERS: the panel
 *  groups the result by category afterwards and a stable input order is what
 *  makes that grouping deterministic. */
export function searchLibrary(items: PaletteItem[], query: string): PaletteItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter(p => haystack(p).includes(needle));
}

/** One rendered group: the category, its header text, and the rows in it. */
export type CategoryGroup = {
  cat: PaletteCategory;
  label: string;
  items: PaletteItem[];
};

/** Group rows by category in CANONICAL order (§2), for the flat search-result
 *  list. `CATEGORY_ORDER`/`CATEGORY_LABEL` are passed in rather than imported so
 *  this stays a pure function of its arguments — the caller already owns the
 *  canonical order (categoryState.ts) and a second copy of it here could drift.
 *
 *  An empty group is DROPPED: while searching, an "Annotations (0)" drawer would
 *  be noise, and the un-filtered accordion gets the all-8 guarantee by being
 *  built from the plain library instead.
 *
 *  Rows keep the order they arrive in, so a group's rows never shuffle between
 *  keystrokes beyond what the filter itself removed. */
export function groupByCategory(
  items: PaletteItem[],
  order: PaletteCategory[],
  labelOf: Record<PaletteCategory, string>,
): CategoryGroup[] {
  return order
    .map(cat => ({
      cat,
      label: labelOf[cat],
      items: items.filter(p => p.category === cat),
    }))
    .filter(g => g.items.length > 0);
}
