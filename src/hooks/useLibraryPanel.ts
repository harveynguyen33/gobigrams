/* src/hooks/useLibraryPanel.ts — APP-SPLIT S4 (t_7c67b8cd), moved VERBATIM
 * from src/app/App.tsx L1925-2410 (the plan's L1985-2470 minus the 60-line
 * S1-S3 shift): the library/asset panel cluster — the favourites + shapes
 * useState pair, their refs, the /api/library load effect, the localStorage
 * persist lane, the favourite/custom-shape insert handlers and the
 * shape-zone drop surface.
 *
 * CENSUS READ SET (checks/app-census.mjs at 1403a5b) — everything the span
 * read from App scope that is NOT its own state travels in as an explicit
 * ctx argument (LibraryPanelCtx below), one property per read:
 *   rf, wrap               — flow instance + viewport wrap (insert/drop aim)
 *   flash                  — App's toast lane
 *   pushHistory            — App's undo lane (one step per insert)
 *   tickTask               — App's task-meter lane
 *   nextId                 — App's id factory
 *   addNodeByLabel         — the palette's fallback insert path
 *   gridSize               — the snap grid (load parse + new shapes)
 *   LIBRARY                — the preset palette table (imported by App from
 *                            ../presets; a table, not state, so it rides in)
 *   nodesRef, edgesRef     — the board's live mirrors
 *   setNodes, setEdges     — the board's state doors
 * Module-scope reads that were ALREADY imports (library, parseCustomShapeEntry,
 * newCustomShape, SHAPE_MAX_INPUT_BYTES, SHAPE_REJECT_MESSAGE, CustomShape,
 * FavouriteNode, PaletteItem, Node/Edge) are imported here directly, exactly
 * as App imported them — nothing rides in through App.
 *
 * RENDER RULE (the first state-owning seam of the split): this hook owns the
 * block's two useState pairs; identities, setters and update timing are the
 * block's own, moved verbatim. No new context, no provider, no subscription.
 * The ctx object is argument-passing only — destructured once at the top and
 * never handed to a child. dragTypes / shapeZoneProps / onDrop were
 * per-render fresh in App and stay per-render fresh here: memoising them
 * would be a behaviour change, not a move.
 *
 * RETURN TUPLE — the 15 names the rest of App still reads (census external
 * readers): favourites, shapes, toggleFavourite, removeFavourite, isStarred,
 * addFavouriteFromSelection, insertFavourite, insertCustomShape,
 * removeCustomShape, importInputRef, openShapeImport, onImportInputChange,
 * shapeZoneProps, onDrop, removeGuard. App destructures them at the same
 * scope depth the block lived at. removeGuard rides out because its consumer
 * noteRemove stays in App (the history lane's merge pair is not split). */
import {useCallback, useEffect, useRef, useState} from 'react';
import {type Edge, type Node, type ReactFlowInstance} from '@xyflow/react';
import {type PaletteItem} from '../theme/palette';
import {type FavouriteNode} from '../board/library';
import * as library from '../board/library';
import {newCustomShape, parseCustomShapeEntry, SHAPE_MAX_INPUT_BYTES, type CustomShape} from '../nodes/customShape';
import {SHAPE_REJECT_MESSAGE} from '../board/boardConstants';

export interface LibraryPanelCtx {
  rf: ReactFlowInstance | null;
  wrap: React.RefObject<HTMLDivElement | null>;
  flash: (msg: string) => void;
  pushHistory: () => void;
  tickTask: (t: string) => void;
  nextId: () => number;
  addNodeByLabel: (label: string, pos?: {x: number; y: number}) => void;
  gridSize: number;
  LIBRARY: PaletteItem[];
  nodesRef: React.RefObject<Node[]>;
  edgesRef: React.RefObject<Edge[]>;
  setNodes: (u: Node[] | ((ns: Node[]) => Node[])) => void;
  setEdges: (u: Edge[] | ((es: Edge[]) => Edge[])) => void;
}

export function useLibraryPanel(ctx: LibraryPanelCtx) {
  const {rf, wrap, flash, pushHistory, tickTask, nextId, addNodeByLabel, gridSize, LIBRARY,
    nodesRef, edgesRef, setNodes, setEdges} = ctx;

  const [favourites, setFavourites] = useState<library.Favourite[]>([]);
  /** Mirror of `favourites` for the persist step (same pattern as `nodesRef`):
   *  the write reads the list React has actually COMMITTED, never a closure
   *  copy that a same-tick second edit could have made stale. */
  const favouritesRef = useRef<library.Favourite[]>(favourites);
  favouritesRef.current = favourites;

  /* ---------------------------------------------------------------------
     PACKAGE-N §8.1–§8.2 pass 4b — the USER'S IMPORTED SHAPES, state only.

     Same three rules as the favourites block above, for the same reasons:

     1. THE PANEL NEVER WAITS ON THE NETWORK. `shapes` starts `[]` and the
        mount GET only ever REPLACES it on success; a failed GET leaves an
        empty list, never an error state.
     2. STATE IS OPTIMISTIC. Importing a shape updates `shapes` immediately and
        persists in the background; a failed PUT keeps the local change.
     3. THE WRITE READS THE COMMITTED LIST FROM A REF (`shapesRef`), so a
        persist deferred past the commit can never serialise a stale array.

     ONE EXTRA RULE HERE — §8.2 rule 8, THE STORED FILE IS UNTRUSTED. Whatever
     `/api/library` hands back goes through `parseCustomShapeEntry` before it
     reaches this state: a hand-edited, foreign or older-build entry is dropped
     (and so never reaches the canvas). This is the cheap structural gate; the
     component renders through `svgDataUri` into an `<img>`, which is the
     second, independent guard.
     --------------------------------------------------------------------- */
  const [shapes, setShapes] = useState<CustomShape[]>([]);
  /** Mirror of `shapes` for the persist step — see `favouritesRef`. */
  const shapesRef = useRef<CustomShape[]>(shapes);
  shapesRef.current = shapes;

  useEffect(() => {
    let alive = true;
    library.getLibrary()
      .then(doc => {
        if (!alive) return;
        setFavourites(Array.isArray(doc?.favourites) ? doc.favourites : []);
        // §8.2 rule 8 — gate EVERY stored entry, keep only what parses.
        const stored = Array.isArray((doc as any)?.shapes) ? (doc as any).shapes : [];
        const parsed: CustomShape[] = [];
        for (const entry of stored) {
          const res = parseCustomShapeEntry(entry, gridSize);
          if (res.ok) parsed.push(res.shape);
        }
        setShapes(parsed);
      })
      .catch(() => { /* offline / not yet stored — an empty panel is correct */ });
    return () => { alive = false; };
    /* DELIBERATELY mount-only (the block's deps are unchanged from the
       favourites-only version). `gridSize` is read here only to CLAMP the size
       of a shape off disk, and any pitch yields a legal clamped size; adding it
       to the deps would re-fetch on every pitch change and clobber optimistic
       local state with the server copy — a worse failure than a stale clamp
       that the next load corrects anyway. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Persist the library. Always called with the lists the caller has ALREADY
   *  decided to commit — never with a ref read at write time.
   *
   *  WHY THE LISTS ARE ARGUMENTS (measured bug, 2026-09-17): the write used to
   *  read `shapesRef.current` after a `setTimeout(0)`. That is only correct when
   *  the mutation happens in a SYNCHRONOUS event handler, because then React
   *  commits before the timer fires. The IMPORT path is different: it awaits
   *  `file.text()`, so it resumes as a microtask — the timer (a macrotask) fires
   *  FIRST, reading the ref before React has committed. Measured: the PUT left at
   *  **+2 ms carrying the PRE-import list**, while the DOM committed the new count
   *  at **+27 ms**. The visible effect was a server library permanently one
   *  import behind the panel (panel 4 / server 3), and a reload silently lost the
   *  newest shape. Passing the lists explicitly removes the dependency on WHEN
   *  the caller resumed.
   *
   *  It sends the CURRENT favourites too: the PUT replaces the whole document,
   *  so a shapes-only write would blank the user's favourites. */
  const persistLibrary = useCallback(async (
    favourites: library.Favourite[],
    shapes: CustomShape[],
  ) => {
    try {
      await library.saveLibrary(library.libraryDoc(favourites, shapes));
    } catch {
      // §7.2 #4 — never fail silently. Excalidraw's wording: the store is not
      // the user's only copy, and a file export is the escape hatch.
      flash("Couldn't save the library. Export it to a file so you don't lose changes.");
    }
  }, [flash]);

  /** The ONE way favourites change: a PURE updater, then a persist.
   *
   *  The updater must be pure because `setFavourites` updaters run TWICE under
   *  StrictMode. It must also read `prev` rather than a closure copy: two star
   *  clicks landing in one tick would otherwise both compute from the list as
   *  it was before the first one, and the second would silently drop the first
   *  (verified live — Queue vanished when Queue and Service were toggled in the
   *  same tick). The write therefore CANNOT live inside the updater; it is
   *  deferred past the commit and carries the list computed HERE.
   *
   *  `favouritesRef` is advanced SYNCHRONOUSLY, before `setState`, so a second
   *  mutation in the same tick computes from the first one's result instead of
   *  from stale state. React re-assigns the ref on the next render anyway, so
   *  the early write is invisible and only closes the window. */
  const mutateFavourites = useCallback(
    (updater: (prev: library.Favourite[]) => library.Favourite[]) => {
      const next = updater(favouritesRef.current);
      favouritesRef.current = next;
      setFavourites(next);
      window.setTimeout(() => { void persistLibrary(next, shapesRef.current); }, 0);
    },
    [persistLibrary],
  );

  /** §6.3 — the star control. Add when absent, remove when present. */
  const toggleFavourite = useCallback((item: PaletteItem) => {
    mutateFavourites(prev => library.toggleFavouriteItem(prev, item));
  }, [mutateFavourites]);

  /** ROUND AB, ITEM 2 — remove ONE favourite from the strip.
   *  ROUND AE — RE-KEYED ON THE ID, AND EVERY TILE NOW CARRIES IT.
   *
   *  The tile calls exactly this, through the same `mutateFavourites` writer the
   *  palette star uses, so the strip and the star cannot drift and the write
   *  keeps the ref-synchronous + deferred-persist contract.
   *
   *  WHY IT IS NO LONGER THE LABEL. A favourite saved from a SELECTION has no
   *  `__label`, so `favouriteLabel` returns `undefined` for it — and matching on
   *  that would remove EVERY unnamed favourite in one call. Round AB therefore
   *  rendered the control only where a label existed, which left a
   *  selection-saved favourite with NO removal path at all. `f.id` is the one
   *  field that is always present and unique (the tile already keys on it and
   *  the drag payload already carries it), so it is the honest identity.
   *
   *  The label-based `library.removeFavouriteItem` is NOT dead: it is still the
   *  arm of `toggleFavouriteItem`, i.e. what the palette star removes through.
   *  This function reaches `removeFavouriteById` instead, so there are two
   *  library helpers and ONE app-level removal, not a third mechanism. */
  const removeFavourite = useCallback((id: string) => {
    mutateFavourites(prev => library.removeFavouriteById(prev, id));
  }, [mutateFavourites]);

  const isStarred = useCallback(
    (label: string) => library.isFavouriteItem(favourites, label),
    [favourites],
  );

  /** §6.4 — the pending `+` tile: "add from selection". The stored payload
   *  carries each node's offset from the selection's corner (`__rel`), so the
   *  group keeps its internal layout while the insert re-derives the absolute
   *  geometry onto the drop point (§6.5). Prepend — the newest is on top. */
  const addFavouriteFromSelection = useCallback(() => {
    const selNodes = nodesRef.current.filter(n => n.selected);
    if (!selNodes.length) return;
    const ids = new Set(selNodes.map(n => n.id));
    // Built OUTSIDE the updater (it reads refs, not state) — the updater below
    // only has to be pure, not to re-derive the payload.
    const fav = library.favouriteFromSelection(selNodes, edgesRef.current.filter(
      e => ids.has(e.source) && ids.has(e.target),
    ));
    mutateFavourites(prev => [fav, ...prev]);
    flash(`Saved ${selNodes.length} node${selNodes.length === 1 ? '' : 's'} to Favourites`);
  }, [mutateFavourites, flash]);

  /** §6.5 — insert a favourite. NEVER trust stored geometry: re-generate ids,
   *  re-centre on the drop point, snap to `gridSize`, then select what landed.
   *
   *  A single-node favourite that still carries its palette label goes through
   *  the ONE canonical palette payload (`LIBRARY.find`), so the `Table`/erd
   *  special case and the container sizing in `addNodeByLabel` apply verbatim.
   *  Anything else is re-derived from the stored payload: shape, colourKey and
   *  the node `type` all come from data, and the geometry from the drop point. */
  const insertFavourite = useCallback((fav: library.Favourite, pos?: {x: number; y: number}) => {
    const label = library.favouriteLabel(fav);
    /* §6.5 step 2 — SNAP TO THE GRID. Unconditional, and deliberately NOT tied
       to the `snap` toolbar toggle: `addNodeByLabel` inserts at the raw drop
       point, but a favourite's geometry is stored as offsets only, so the drop
       point is the ONE thing that decides where the group lands. AC #17 tests
       this, so the favourite path always quantises to `gridSize`. */
    const snapTo = (v: number) => Math.round(v / gridSize) * gridSize;
    const drop = pos ?? (rf
      ? rf.screenToFlowPosition({
        x: (wrap.current?.clientWidth ?? 900) / 2,
        y: (wrap.current?.clientHeight ?? 600) / 2,
      })
      : {x: 480, y: 300});

    if (label && fav.nodes.length === 1) {
      // Identity path: the palette item rebuilds the payload, so no stored
      // field is trusted, and `Table` / group sizing / flowchart handles all
      // keep working because this IS the add path.
      const item = LIBRARY.find(p => p.label === label);
      if (item) {
        const before = new Set(nodesRef.current.map(n => n.id));
        addNodeByLabel(label, {x: snapTo(drop.x), y: snapTo(drop.y)});
        // §6.5 step 4 — select what landed. The insert commits to state a tick
        // later than this call, so the selection follows on the next tick.
        window.setTimeout(() => {
          const added = nodesRef.current.filter(n => !before.has(n.id)).map(n => n.id);
          if (!added.length) return;
          const ids = new Set(added);
          setNodes(ns => ns.map(n => ids.has(n.id) ? {...n, selected: true} : {...n, selected: false}));
        }, 0);
        return;
      }
      // A stored label that no longer exists in the library falls through to
      // the generic path rather than silently inserting nothing.
    }

    pushHistory();
    tickTask('node');
    const idMap = new Map<string, string>();
    const stored = fav.nodes as FavouriteNode[];
    /* §6.5 step 1 — RE-CENTRE. `__rel` is a node's offset from the favourite's
       own top-left, so the group's BOUNDING BOX CENTRE is what lands on the
       drop point: the offsets are kept exact (the internal layout is the one
       thing worth preserving) and only the anchor is quantised to the grid. */
    const offs = stored.map(n => {
      const rel = (n as any)[library.REL_KEY];
      return rel && typeof rel.x === 'number' && typeof rel.y === 'number'
        ? {x: rel.x, y: rel.y}
        : null;
    });
    const known = offs.filter(Boolean) as {x: number, y: number}[];
    const centre = known.length
      ? {
        x: (Math.min(...known.map(o => o.x)) + Math.max(...known.map(o => o.x))) / 2,
        y: (Math.min(...known.map(o => o.y)) + Math.max(...known.map(o => o.y))) / 2,
      }
      : {x: 0, y: 0};
    const anchor = {x: snapTo(drop.x) - centre.x, y: snapTo(drop.y) - centre.y};

    const newNodes: Node[] = stored.map((storedNode, i) => {
      /* Two stored payload shapes are legal (see `library.ts`): a plain palette
         payload, or a stripped node wrapper. `payload` is whichever object
         actually holds the node `data`; the marker keys are dropped from it. */
      const payload = (storedNode?.data ?? storedNode) as any;
      const {[library.LABEL_KEY]: _l, [library.REL_KEY]: _r, __src: _s, ...payloadData} = payload;
      void _l; void _r; void _s;
      const rel = offs[i] ?? {x: 0, y: 0};
      // §6.5 step 3 — RE-GENERATE IDS. Never reuse a stored one: it may collide
      // with an id already on this board.
      const id = `n${nextId()}`;
      // A selection copy stores no board id at all, so `__src` is its only
      // reference; `storedNode.id` covers a hand-written library file that did
      // keep one.
      // `FavouriteNode` is `Record<string, unknown>`: the reference fields are unknown
      // until narrowed. `String()` is the honest key-maker (the old code relied on `any`).
      idMap.set(String(storedNode.__src ?? storedNode.id ?? i), id);
      return {
        id,
        type: (storedNode.type ?? 'goblin') as string,
        position: {x: anchor.x + rel.x, y: anchor.y + rel.y},
        data: payloadData,
        // A selection copy keeps its own `style` (a container's size); a
        // palette payload never had one, so nothing is invented here.
        ...(storedNode.style ? {style: storedNode.style} : null),
        selected: true,
      } as Node;
    });

    const newEdges: Edge[] = (fav.edges ?? []).map((se: Edge) => {
      const {selected: _sel, ...rest} = se;
      void _sel;
      const src = idMap.get(se.source) ?? idMap.get(String(se.source));
      const tgt = idMap.get(se.target) ?? idMap.get(String(se.target));
      return src && tgt ? ({...rest, id: `e${nextId()}`, source: src, target: tgt, selected: false} as Edge) : null;
    }).filter(Boolean) as Edge[];

    setNodes(ns => [...ns.map(n => (n.selected ? {...n, selected: false} : n)), ...newNodes]);
    if (newEdges.length) setEdges(es => [...es, ...newEdges]);
  }, [addNodeByLabel, gridSize, pushHistory, setNodes, setEdges, rf, tickTask]);

  /* =====================================================================
     PACKAGE-N §8.1–§8.3 pass 4b — CUSTOM-SHAPE library mutations.

     `insertCustomShape` is the CANVAS half (the import UI is pass 4c): it is
     the only place a custom shape becomes a node. Two §6.5 rules carry over
     from the favourite path verbatim — the id is re-derived from the module
     counter and the position is re-quantised to the grid, because a stored
     coordinate is not a thing to trust.
     ===================================================================== */

  /** Insert an imported shape at `pos` (or the viewport centre), grid-quantised. */
  const insertCustomShape = useCallback((shape: CustomShape, pos?: {x: number; y: number}) => {
    pushHistory();
    tickTask('node');
    // §6.5 step 2 — SNAP TO THE GRID, unconditionally: the drop point is the
    // only thing that decides where this lands, so it is the thing quantised.
    /* AUDIT-7 — wrap-centre as a CLIENT coord (see the favourite twin above). */
    const wr2 = wrap.current?.getBoundingClientRect();
    const raw = pos ?? (rf && wr2
      ? rf.screenToFlowPosition({x: wr2.left + wr2.width / 2, y: wr2.top + wr2.height / 2})
      : {x: 480, y: 300});
    let p = {x: Math.round(raw.x / gridSize) * gridSize, y: Math.round(raw.y / gridSize) * gridSize};
    // AQ19 — centre the custom shape under the cursor (its own size is known).
    p = {x: Math.round(p.x - shape.w / 2), y: Math.round(p.y - shape.h / 2)};
    // §6.5 step 3 — RE-GENERATE THE ID. Never a stored one.
    const id = `n${nextId()}`;
    setNodes(ns => [...ns, {
      id,
      type: 'customshape',
      position: p,
      selected: false,
      // §8.3 — the size came from `clampShapeSize` at import, so it is already
      // quantised and inside 32–512; since ROUND BE (2026-10-23) the live
      // resizer carries only the 32px floor — no ceiling, like every goblin node.
      style: {width: shape.w, height: shape.h},
      data: {svg: shape.data, viewBox: shape.viewBox, title: shape.title, colorKey: shape.colorKey},
    } as Node]);
  }, [gridSize, pushHistory, setNodes, rf, tickTask]);

  /** The ONE way `shapes` changes: a PURE updater, then a persist — the same
   *  contract as `mutateFavourites`, for the same StrictMode reason. The write
   *  is deferred past the commit and reads the committed list from `shapesRef`;
   *  it sends the CURRENT favourites with it, so the two halves of the library
   *  document are never written apart. */
  const mutateShapes = useCallback(
    (updater: (prev: CustomShape[]) => CustomShape[]) => {
      /* The ref is advanced SYNCHRONOUSLY, before `setState` — see the
         measured race documented on `persistLibrary`. The import path resumes
         from `await file.text()`, so reading the ref at write time would read
         the PRE-import list. Computing `next` here and passing it makes the
         write independent of when React commits. */
      const next = updater(shapesRef.current);
      shapesRef.current = next;
      setShapes(next);
      window.setTimeout(() => { void persistLibrary(favouritesRef.current, next); }, 0);
    },
    [persistLibrary],
  );

  /** §8.1 — drop an imported shape from the library, then persist.
   *
   *  IDENTITY NOTE: a `CustomShape` has NO id field (the spec's §8.1 store is
   *  `{title, tags, data, w, h, aspect, colorKey, viewBox, sanitizer,
   *  sanitizedAt, created}`). `created` is the epoch-ms stamp taken once at
   *  import, which makes it the entry's stable, unique identity; the `title`
   *  is also accepted so a caller holding only a label can still remove it. */
  const removeCustomShape = useCallback((id: string) => {
    const matches = (s: CustomShape) => String(s.created) === id || s.title === id;
    if (!shapesRef.current.some(matches)) return;   // nothing to remove, nothing to persist
    mutateShapes(prev => prev.filter(s => !matches(s)));
  }, [mutateShapes]);

  /* =====================================================================
     PACKAGE-N §8.1–§8.3 pass 4c — the IMPORT UI.

     One file → one stored shape, and ONE path does it (`importShapeFile`): the
     hidden picker, the drop zone in the panel and a file dropped on the canvas
     all funnel through it, so all three gate, parse and report identically.
     ===================================================================== */

  /** The hidden `<input type=file>`; `display:none` inputs can only be opened
   *  programmatically, so every "import" affordance clicks this one node. */
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const openShapeImport = useCallback(() => { importInputRef.current?.click(); }, []);

  /** §8.1 — the one place a `File` becomes a stored shape.
   *
   *  ORDER MATTERS: the type gate comes first. A PNG is not an oversized SVG,
   *  it is the wrong kind of file, and answering it with the size limit would
   *  send the user off editing dimensions that were never the problem. The
   *  size gate is then measured on the `File` itself, so a 40 MB file is
   *  rejected without ever being read into memory. */
  const importShapeFile = useCallback(async (file: File) => {
    const name = file.name || '';
    if (!/\.svg$/i.test(name) && file.type !== 'image/svg+xml') {
      flash('Only .svg files can be imported.');
      return;
    }
    if (file.size > SHAPE_MAX_INPUT_BYTES) {
      flash(SHAPE_REJECT_MESSAGE['too-large']);
      return;
    }
    let raw: string;
    try {
      raw = await file.text();
    } catch {
      flash("Couldn't read that file.");
      return;
    }
    // §8.1 — naming is OPTIONAL (settled): the file's own name is the title,
    // minus the extension, with a neutral fallback. No prompt, ever.
    const title = name.replace(/\.svg$/i, '').trim() || 'Imported shape';
    const res = newCustomShape({raw, title, colorKey: 'cyan', gridSize});
    // The `'reason' in` discriminant is the idiom `customShape.ts` itself uses
    // (see `newCustomShape`); a rejection is ALWAYS reported, because the toast
    // is the only feedback there is — silence would look like a dead button.
    if ('reason' in res) {
      flash(SHAPE_REJECT_MESSAGE[res.reason]);
      return;
    }
    const shape = res.shape;
    // Prepend: the newest import is the one the user is about to place.
    mutateShapes(prev => [shape, ...prev]);
    flash(`Imported “${shape.title}”.`);
  }, [flash, gridSize, mutateShapes]);

  const onImportInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Cleared BEFORE the read: choosing the same file twice must fire `change`
    // twice, and a retained value silently swallows the second pick.
    e.target.value = '';
    if (file) void importShapeFile(file);
  }, [importShapeFile]);

  /** Resolve a dragged custom-shape payload — the sanitised markup itself —
   *  back to its stored entry, then insert it at `pos`.
   *
   *  IDENTITY: the payload carries no id (a `CustomShape` has none), and the
   *  markup is exactly what the library holds, so matching on `data` is exact.
   *  Read through the ref so this stays a stable callback. */
  const dropCustomShape = useCallback((payload: string, pos?: {x: number; y: number}) => {
    const found = shapesRef.current.find(s => s.data === payload);
    if (found) insertCustomShape(found, pos);
  }, [insertCustomShape]);

  /** The `DataTransfer` type list, normalised — `types` is a `DOMStringList`
   *  in older DOM libs and a readonly array in newer ones, so it is copied
   *  into a plain array and both shapes work. */
  const dragTypes = (e: React.DragEvent): string[] => {
    const t = e.dataTransfer?.types;
    return t ? Array.from(t as ArrayLike<string>) : [];
  };

  /** The panel drop zone's own drop path. It cannot be omitted: the zone lives
   *  in the left panel, and `main` (which owns the canvas drop) is a SIBLING,
   *  so a file dropped there bubbles to no handler at all. It is wired through
   *  `shapeZoneProps` below rather than a second JSX drop attribute, keeping
   *  the canvas `onDrop` the single drop path in this file. */
  const onShapeZoneDragOver = useCallback((e: React.DragEvent) => {
    // Claim the event ONLY when it carries OS files — an ordinary node drag
    // passing over the panel must not be treated as an import.
    if (dragTypes(e).includes('Files')) e.preventDefault();
  }, []);

  const onShapeZoneDrop = useCallback((e: React.DragEvent) => {
    if (!dragTypes(e).includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) void importShapeFile(file);
  }, [importShapeFile]);

  const shapeZoneProps = {onDragOver: onShapeZoneDragOver, onDrop: onShapeZoneDrop};

  // ---- drag & drop from palette ----
  const onDrop = useCallback((e: React.DragEvent) => {
    // A file dropped anywhere on the canvas is an IMPORT (§8.1), not a node
    // placement — same path as the picker.
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (!e.dataTransfer.types || dragTypes(e).includes('Files'))) {
      e.preventDefault();
      void importShapeFile(droppedFile);
      return;
    }
    e.preventDefault();
    if (!rf || !wrap.current) return;
    const favId = e.dataTransfer.getData('favourite');
    const label = e.dataTransfer.getData('palette');
    const cust = e.dataTransfer.getData('customshape');
    if (!favId && !label && !cust) return;
    /* AQ18 — raw client coords: screenToFlowPosition subtracts the pane rect
       itself; the extra `- b.left/- b.top` double-subtracted the wrap offset
       and every palette drop landed up-left of the cursor (same defect AUDIT-7
       fixed for the ctx-menu path — this sibling was missed). */
    const p = rf.screenToFlowPosition({x: e.clientX, y: e.clientY});
    // §6.5 — a favourite drop re-derives the geometry at the drop point; the
    // payload carried only the favourite's ID, never a stored coordinate.
    if (cust) {
      // The custom-shape payload IS the sanitised markup: it carries no id,
      // and the store holds exactly this string, so it resolves back exactly.
      dropCustomShape(cust, p);
      return;
    }
    if (favId) {
      const fav = favourites.find(f => f.id === favId);
      if (fav) insertFavourite(fav, p);
      return;
    }
    addNodeByLabel(label, p);
  }, [rf, favourites, insertFavourite, dropCustomShape, importShapeFile]);

  // ---- record history on destructive changes only ----
  // Node and edge removals arrive as separate callbacks for one Del press,
  // so a short guard merges them into a single history entry.
  const removeGuard = useRef(false);

  return {favourites, shapes, toggleFavourite, removeFavourite, isStarred, addFavouriteFromSelection,
    insertFavourite, insertCustomShape, removeCustomShape, importInputRef, openShapeImport,
    onImportInputChange, shapeZoneProps, onDrop, removeGuard};
}
