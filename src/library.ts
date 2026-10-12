/**
 * PACKAGE-N §7 — the user-library CLIENT (`/api/library`).
 *
 * NOT to be confused with `LIBRARY` in `presets.ts` (the 34-element shape
 * library, a compile-time constant). This module is the USER's own document:
 * the favourites they starred (§6) and — from pass 4 — their imported custom
 * shapes (§8). One singleton file on disk, one `version`, one atomic write.
 *
 * The client is deliberately thin and MIRRORS `boards.ts`: the same `req<T>`
 * helper, the same "throw on !ok so the caller can surface it" contract. The
 * server owns the envelope (`type`/`version`/`source`/`updatedAt`); the client
 * sends only the payload arrays.
 */
import {type Edge, type Node} from '@xyflow/react';

import {type PaletteItem} from './palette';
import {type CustomShape} from './customShape';

/* ---------------------------------------------------------------------------
   §6.1 — the stored item shape.

   THE DIVERGENCE FROM DRAW.IO (documented in code, spec §6): a draw.io
   scratchpad stores *styled cell snapshots that only exist after placement on
   canvas*. A Diagram Studio favourite stores the **palette identity** instead.
   `make()` is a function and is not serialisable — so a favourite stores its
   RESULT, and re-insertion (§6.5) re-derives ids and geometry from that result.

   Because the stored node carries `colorKey` (symbolic), never hex, a theme
   change recolours a favourite exactly as it recolours a board.

   TWO PAYLOAD SHAPES live in `nodes`, and both are legal:

     1. `<palette>` — the result of a palette item's `make()`, i.e. a node
        `data` object, plus `__label`. Produced by the star control (§6.3).
        `__label` is the palette item's `label` (unique across `LIBRARY`),
        stored so "is this item already a favourite?" is an exact, O(1)
        string compare instead of a deep-equal against a rebuilt payload.
        It is a MARKER, never rendered: `DiagramNode` ignores unknown keys.

     2. `<node>` — a selected canvas node, deep-copied and stripped of
        `position` / `selected` / `measured` (§6.4), plus `__rel`, its offset
        from the selection's top-left corner. Produced by the pending `+` tile.
        `__rel` is what lets a multi-node favourite keep its RELATIVE layout
        while its absolute geometry is re-derived on insert (§6.5) — it is not
        a `position` field, so the "no stored coordinates" rule still holds.
        It may be ABSENT (a single-node selection copy), in which case the
        insert re-centres that one node on the drop point.
--------------------------------------------------------------------------- */
export type FavouriteNode = Record<string, unknown>; // the RESULT of a palette item's make()

export type Favourite = {
  id: string;            // `fav_<random>` — NOT a board/node id
  name?: string;         // optional on add; required only on export
  created: number;
  nodes: FavouriteNode[];
  edges: Record<string, unknown>[];   // [] for a single palette item
};

export type LibraryDoc = {
  type: 'diagram-studio-library';
  version: 1;
  source: 'diagram-studio';
  updatedAt: number;
  favourites: Favourite[];
  shapes: CustomShape[];
};

export const LIBRARY_TYPE = 'diagram-studio-library' as const;
export const LIBRARY_SOURCE = 'diagram-studio' as const;
export const LIBRARY_VERSION = 1 as const;

/** The marker key that ties a favourite node back to a palette `label`. */
export const LABEL_KEY = '__label' as const;
/** The relative-offset key a selection copy carries (see the header comment). */
export const REL_KEY = '__rel' as const;

const rand = () => Math.random().toString(36).slice(2, 10);

/** A fresh favourite id. Never a board/node id, and never derived from one. */
export const newFavouriteId = (): string => `fav_${Date.now().toString(36)}${rand()}`;

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as any)?.error ?? `HTTP ${res.status}`);
  return data as T;
}

/** The empty document — also what the server answers when nothing is stored. */
export function emptyLibraryDoc(): LibraryDoc {
  return {
    type: LIBRARY_TYPE, version: LIBRARY_VERSION, source: LIBRARY_SOURCE,
    updatedAt: 0, favourites: [], shapes: [],
  };
}

/** Build the document the client PUTs. `updatedAt` is stamped by the SERVER;
 *  the value here is a placeholder the caller may pass for a local preview. */
export function libraryDoc(
  favourites: Favourite[],
  shapes: CustomShape[] = [],
  updatedAt = 0,
): LibraryDoc {
  return {
    type: LIBRARY_TYPE, version: LIBRARY_VERSION, source: LIBRARY_SOURCE,
    updatedAt, favourites, shapes,
  };
}

/** GET — always 200; a corrupt/hand-edited file degrades to the empty envelope
 *  server-side, so this only rejects on a genuine transport/HTTP failure. */
export const getLibrary = () => req<LibraryDoc>('/api/library');

/** PUT — rejects on any write failure (400 validation / 500 write error), which
 *  is what lets the caller show the "export it to a file" message (§7.2 #4).
 *  `req` throws, so a caller MUST catch; nothing here fails silently. */
export const saveLibrary = (doc: LibraryDoc) =>
  req<LibraryDoc>('/api/library', {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({favourites: doc.favourites, shapes: doc.shapes}),
  });

/* ---------------------------------------------------------------------------
   Pure helpers — no React, no DOM, so they are trivially testable.
--------------------------------------------------------------------------- */

/** The palette label a favourite node was starred from, if any. */
export function labelOf(node: FavouriteNode | undefined): string | undefined {
  const v = node?.[LABEL_KEY];
  return typeof v === 'string' && v ? v : undefined;
}

/** The palette identity of a whole favourite = its FIRST labelled node. A
 *  selection copy has no label and is therefore never "the starred item". */
export function favouriteLabel(fav: Favourite): string | undefined {
  return labelOf(fav.nodes[0]);
}

/** Star §6.3: the item's `make()` result, the label marker, no edges. */
export function favouriteFromItem(item: PaletteItem): Favourite {
  return {
    id: newFavouriteId(),
    name: item.label,
    created: Date.now(),
    // `make()`'s result is the plain `data` object — never a live Node, and
    // never mutated, so the favourite cannot alias canvas state.
    nodes: [{...(item.make() as unknown as FavouriteNode), [LABEL_KEY]: item.label}],
    edges: [],
  };
}

/** Is this palette item already starred? Exact label compare (see the header). */
export const isFavouriteItem = (list: Favourite[], label: string): boolean =>
  list.some(f => favouriteLabel(f) === label);

/** Un-star. Removes the item's favourite; identity by label, not by position.
 *
 *  ROUND AE — KEPT, AND NOW ONE OF TWO. It is the star control's removal arm
 *  (`toggleFavouriteItem` delegates to it) and it is still the honest answer to
 *  "remove the favourite that WAS this palette item". It is NOT safe for a
 *  favourite saved from a SELECTION: such a favourite has no `__label`, so
 *  `favouriteLabel` returns `undefined`, and a label-based removal would match
 *  EVERY unnamed favourite at once. That is why `removeFavouriteById` exists and
 *  is the path the tile control uses. */
export const removeFavouriteItem = (list: Favourite[], label: string): Favourite[] =>
  list.filter(f => favouriteLabel(f) !== label);

/** ROUND AE — remove ONE favourite by its stable `id` (`fav_<random>`).
 *
 *  WHY THIS EXISTS AT ALL. `Favourite.id` is the identity the tile already keys
 *  on (`key={f.id}`, `data-fav-id={f.id}`) and the value the drag payload
 *  carries for insertion (`dataTransfer.setData('favourite', f.id)`), so it is
 *  the one field that is guaranteed present and unique — including on a
 *  selection-saved favourite, which has no `name` and no label. Matching on the
 *  label instead would take every unnamed favourite in one call.
 *
 *  Exactly one element is removed: the filter is an equality against a unique
 *  id, so two favourites sharing a label (or sharing its ABSENCE) survive each
 *  other's removal — asserted in `checks/round-ae-favourite-id.mjs`. */
export const removeFavouriteById = (list: Favourite[], id: string): Favourite[] =>
  list.filter(f => f.id !== id);

/** The one toggle the star control needs, as data. */
export function toggleFavouriteItem(list: Favourite[], item: PaletteItem): Favourite[] {
  return isFavouriteItem(list, item.label)
    ? removeFavouriteItem(list, item.label)
    : [...list, favouriteFromItem(item)];
}

/** §6.4 — "add from selection": deep-copy the selected nodes + edges, strip
 *  `position` / `selected` / `measured`, keep each node's offset from the
 *  selection's top-left as `__rel` (see the header), and mint fresh ids.
 *
 *  Deep-copying matters: the stored payload must not alias live canvas state
 *  (a later drag would silently rewrite the favourite). */
export function favouriteFromSelection(nodes: Node[], edges: Edge[]): Favourite {
  const ids = new Set(nodes.map(n => n.id));
  const minX = Math.min(...nodes.map(n => n.position?.x ?? 0));
  const minY = Math.min(...nodes.map(n => n.position?.y ?? 0));
  // Only edges whose BOTH ends are inside the selection describe this group.
  const inner = edges.filter(e => ids.has(e.source) && ids.has(e.target));

  // Old node id -> a placeholder id local to this favourite. The insert
  // re-maps these onto fresh board ids (§6.5 #3); storing the mapping as
  // `__src` keeps the edge endpoints resolvable without keeping the ids.
  const localOf = new Map<string, string>();
  nodes.forEach((n, i) => localOf.set(n.id, `s${i}`));

  const strip = (n: Node): FavouriteNode => {
    /* Everything React Flow owns about a node ON THE CANVAS goes: the board
       `id` (AC #16 / §6.5 #3 — reusing it can collide with the board it is
       pasted into), the geometry (`position`), the view state (`selected`,
       `measured`, `dragging`, `resizing`) and the cached box (`width`/`height`).
       What is LEFT is the authored payload: `type`, `data` (colour KEYS, never
       hex), and `style` — a container's size is authored, not view state.
       `__src` takes the place of the id as the reference the edges point at. */
    const {id, position, selected, measured, width, height, dragging, resizing, ...rest} = n;
    void id; void position; void selected; void measured; void width; void height; void dragging; void resizing;
    return {
      ...deepCopy(rest),
      [REL_KEY]: {x: (n.position?.x ?? 0) - minX, y: (n.position?.y ?? 0) - minY},
      __src: localOf.get(n.id),
    };
  };

  return {
    id: newFavouriteId(),
    name: `${nodes.length} node${nodes.length === 1 ? '' : 's'}`,
    created: Date.now(),
    nodes: nodes.map(strip),
    edges: inner.map(e => {
      const {selected, ...rest} = e;
      void selected;
      return {...deepCopy(rest), source: localOf.get(e.source), target: localOf.get(e.target)};
    }),
  };
}

/** Structured clone for plain JSON payloads (no functions are ever stored). */
function deepCopy<T>(v: T): T {
  return v === null || typeof v !== 'object' ? v : JSON.parse(JSON.stringify(v));
}

/** The tile's display name: the stored name, else the palette label, else a
 *  neutral summary of what the favourite holds. */
export function favouriteName(fav: Favourite): string {
  return fav.name || favouriteLabel(fav) || `${fav.nodes.length} node${fav.nodes.length === 1 ? '' : 's'}`;
}
