/**
 * src/panels/LibraryBody.tsx — the LEFT panel body (JSX-SPLIT P3, t_5c2d6fad,
 * 2026-11-22). Moved VERBATIM from App.tsx: the `.panel-body` div (325 lines,
 * incl. its guideline comment) plus the renderPaletteRow rider with its
 * docblock (60 lines). Census: 26 props MEASURED (the plan estimated 21 —
 * the rider's closures addNodeByLabel/isStarred/toggleFavourite ride in, and
 * shapeZoneProps arrives as its TWO useCallback-stable fields: the spread
 * object is rebuilt locally below, honouring useLibraryPanel's S4 measured
 * render rule "wrapper objects stay fresh INSIDE the hook"). React.memo with
 * a plain shallow comparator — the child receives NO node/edge input (the
 * library panel is canvas-independent), so unlike the inspector panels there
 * is no rf .selected rewrite seam. App's third stabilisation feeds the rider:
 * addNodeByLabel is a useMemo over the makeAddNodeByLabel factory (a
 * per-render factory call was a fresh identity — memo-killer).
 */
import * as React from 'react';
import {ChevronDown, X} from 'lucide-react';
import type {CustomShape} from '../nodes/customShape';
import * as library from '../board/library';
import type {PaletteItem, PaletteCategory} from '../theme/palette';
import type {CategoryGroup} from '../theme/paletteSearch';
import type {PresetId} from '../presets';
import {COLOR_VAR} from '../theme/colors';
import {CUST_DROP_HINT} from '../canvas/inspectorOptions';
import {ShapePreview} from '../nodes/shapes';
import {favouritePreview, TableGlyph} from '../board/boardUtils';
import {svgDataUri} from '../nodes/customShape';

export type LibraryBodyProps = {
  /** Library state — the useLibraryPanel useState pair. */
  favourites: library.Favourite[];
  shapes: CustomShape[];
  toggleFavourite: (item: PaletteItem) => void;
  removeFavourite: (id: string) => void;
  isStarred: (label: string) => boolean;
  addFavouriteFromSelection: () => void;
  insertFavourite: (fav: library.Favourite, pos?: {x: number; y: number}) => void;
  insertCustomShape: (shape: CustomShape, pos?: {x: number; y: number}) => void;
  removeCustomShape: (id: string) => void;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  openShapeImport: () => void;
  onImportInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** The two useCallback-stable shape-zone fields (S4 rule: the wrapper
      object stays fresh inside the hook; rebuilt locally below). */
  shapeZoneDragOver: (e: React.DragEvent) => void;
  shapeZoneDrop: (e: React.DragEvent) => void;
  /** Search box state (App state). */
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  /** The active preset id (App state) — also the category-collapse ViewId. */
  presetId: PresetId;
  /** Count of currently selected nodes (the "+ Add selection" chip). */
  selCount: number;
  /** True while the search is showing results (App state). */
  searching: boolean;
  searchRef: React.RefObject<HTMLInputElement | null>;
  /** Category collapse (useCallback in useCategoryCollapse). */
  isCategoryOpen: (view: PresetId, cat: PaletteCategory) => boolean;
  toggleCategory: (view: PresetId, cat: PaletteCategory) => void;
  /** Derived per-preset default-open category (useMemo in App). */
  defaultOpen: PaletteCategory;
  /** The whole library in 8 canonical sections (useMemo in App). */
  librarySections: CategoryGroup[];
  /** Search results grouped (useMemo in App). */
  searchGroups: CategoryGroup[];
  /** The palette-insert closure, useMemo-stabilised over the factory. */
  addNodeByLabel: (label: string, pos?: {x: number; y: number}) => void;
};

/* Plain shallow equality: every prop is a state value, a setter, a
   useCallback/useMemo product, a ref, or a primitive. There is NO node/edge
   input here — the library panel is canvas-independent — so unlike the
   inspector panels' comparators there is no rf .selected rewrite to absorb. */
const libPropsEqual = (a: LibraryBodyProps, b: LibraryBodyProps) =>
  a.favourites === b.favourites && a.shapes === b.shapes
  && a.toggleFavourite === b.toggleFavourite && a.removeFavourite === b.removeFavourite
  && a.isStarred === b.isStarred && a.addFavouriteFromSelection === b.addFavouriteFromSelection
  && a.insertFavourite === b.insertFavourite && a.insertCustomShape === b.insertCustomShape
  && a.removeCustomShape === b.removeCustomShape && a.importInputRef === b.importInputRef
  && a.openShapeImport === b.openShapeImport && a.onImportInputChange === b.onImportInputChange
  && a.shapeZoneDragOver === b.shapeZoneDragOver && a.shapeZoneDrop === b.shapeZoneDrop
  && a.query === b.query && a.setQuery === b.setQuery && a.presetId === b.presetId
  && a.selCount === b.selCount && a.searching === b.searching && a.searchRef === b.searchRef
  && a.isCategoryOpen === b.isCategoryOpen && a.toggleCategory === b.toggleCategory
  && a.defaultOpen === b.defaultOpen && a.librarySections === b.librarySections
  && a.searchGroups === b.searchGroups && a.addNodeByLabel === b.addNodeByLabel;

export default React.memo(function LibraryBody({
  favourites, shapes, toggleFavourite, removeFavourite, isStarred,
  addFavouriteFromSelection, insertFavourite, insertCustomShape,
  removeCustomShape, importInputRef, openShapeImport, onImportInputChange,
  shapeZoneDragOver, shapeZoneDrop, query, setQuery, presetId, selCount,
  searching, searchRef, isCategoryOpen, toggleCategory, defaultOpen,
  librarySections, searchGroups, addNodeByLabel,
}: LibraryBodyProps) {
  /* S4 measured rule: the wrapper object stays fresh INSIDE useLibraryPanel;
     the fields arrive as stable props and the spread site stays verbatim. */
  const shapeZoneProps = {onDragOver: shapeZoneDragOver, onDrop: shapeZoneDrop};
  /** =====================================================================
   *  PACKAGE-N pass 2c — ONE palette row, rendered from the data alone.
   *
   *  Deliberately a local function, not a component: it closes over
   *  `addNodeByLabel`, `isStarred` and `toggleFavourite`, so extracting it to a
   *  module would mean threading three callbacks through props for no gain.
   *
   *  `dimmed` is §9's "collapsed category still contributes hits". While
   *  searching, a row whose category is folded renders at reduced opacity
   *  instead of vanishing — the hit is never HIDDEN, only de-emphasised, which
   *  is the difference between "your shape is not here" and "your shape is
   *  here, in a section you folded".
   *
   *  THE ROW IS glyph + label + hint + star. Revision 3 removed the `types[]`
   *  BADGE this used to render; `types[]` is still on the item (the model's
   *  membership field) but nothing paints it, so a single-type element no
   *  longer repeats its own category back at the user.
   *  ===================================================================== */
  const renderPaletteRow = (p: PaletteItem, key: string, dimmed = false) => (
    <div
      key={key}
      className={`pal-item${dimmed ? ' pal-dimmed' : ''}`}
      draggable
      data-label={p.label}
      data-dimmed={dimmed ? 'true' : undefined}
      // pass 2b — the payload is the item's unique LABEL, never an index: the
      // panel no longer renders the same array it resolves against, so a
      // rendered index and a library index are different numbers.
      onDragStart={e => e.dataTransfer.setData('palette', p.label)}
      onDoubleClick={() => addNodeByLabel(p.label)}
      title="Drag onto the canvas or double-click to add"
    >
      <div className="pal-swatch">
        {p.kind === 'label'
          ? <span style={{color: COLOR_VAR[p.colorKey]}}>T</span>
          : p.label === 'Table'
            ? <TableGlyph color={COLOR_VAR[p.colorKey]} />
            : <ShapePreview shape={p.shape} color={COLOR_VAR[p.colorKey]} />}
      </div>
      <div className="pal-meta">
        <span>{p.label}</span>
        <small>{p.hint}</small>
      </div>
      {/* §6.3 — star / pin. `onPointerDown` stops the drag-from-row gesture so a
          star click can never start dragging the shape underneath it. */}
      <button
        type="button"
        className={`pal-star${isStarred(p.label) ? ' on' : ''}`}
        data-star={p.label}
        aria-pressed={isStarred(p.label)}
        aria-label={isStarred(p.label)
          ? `Remove ${p.label} from Favourites`
          : `Add ${p.label} to Favourites`}
        title={isStarred(p.label) ? 'Remove from Favourites' : 'Add to Favourites'}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); toggleFavourite(p); }}
      >{isStarred(p.label) ? '★' : '☆'}</button>
    </div>
  );


  return (
        <div className="panel-body">
          {/* PACKAGE-N §4.1 (Revision 3) — THREE sections in ONE scroll
              container, in this order: search → favourites → categories.
              The omnibox is now IN this pass; the type-filter row that used to
              sit between favourites and categories is GONE (see the state block
              above for the measurement that removed it). */}

          {/* ---- SEARCH (§4.1 #1, §9) -------------------------------------
              Pinned at the top so it stays the panel's first control, and
              BEFORE Favourites: the field searches the shape LIBRARY, and a
              query is a stronger statement of intent than a favourite tile.
              It searches the WHOLE library, never the current view — a hit for
              a shape is always reachable, whatever is folded. ---- */}
          <div className="lib-search">
            <input
              ref={searchRef}
              type="search"
              className="lib-search-input"
              data-lib-search="true"
              placeholder="Search shapes…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search shapes by name, shape or synonym"
              onKeyDown={e => {
                // Escape clears first and stops there, so it never also falls
                // through to the app's own "deselect" Escape behind it.
                if (e.key === 'Escape' && query) {
                  e.stopPropagation();
                  setQuery('');
                }
              }}
            />
          </div>

          {/* ---- FAVOURITES (§6) ------------------------------------------
              Rendered only when there is something to show: a favourite, or a
              live selection (which makes the pending `+` tile meaningful). An
              empty section would be a permanent, useless header. ---- */}
          {(favourites.length > 0 || selCount > 0) && (
            <div className="fav-sec" data-fav-count={favourites.length} data-sel-count={selCount}>
              <div className="sec-label">Favourites</div>
              <div className="fav-grid">
                {/* §6.4 — the pending `+`: "add from selection", one click, no
                    menus. Only while a selection exists on the canvas. */}
                {selCount > 0 && (
                  <button
                    type="button"
                    className="fav-tile fav-pending"
                    data-fav-pending="true"
                    aria-label={`Save the ${selCount} selected node${selCount === 1 ? '' : 's'} to Favourites`}
                    title={`Add ${selCount} selected node${selCount === 1 ? '' : 's'} to Favourites`}
                    onClick={addFavouriteFromSelection}
                  >
                    <span className="fav-glyph" aria-hidden="true">+</span>
                    <span className="fav-name">Add selection</span>
                  </button>
                )}
                {favourites.map(f => (
                  <button
                    type="button"
                    key={f.id}
                    className="fav-tile"
                    data-fav-id={f.id}
                    data-fav-label={library.favouriteLabel(f) ?? ''}
                    draggable
                    // §6.5 — a drop re-derives the geometry; only the IDENTITY
                    // travels in the payload, never a stored coordinate.
                    onDragStart={e => e.dataTransfer.setData('favourite', f.id)}
                    onDoubleClick={() => insertFavourite(f)}
                    title={`Add “${library.favouriteName(f)}” to the canvas — click, double-click or drag`}
                    onClick={() => insertFavourite(f)}
                  >
                    <span className="fav-glyph" aria-hidden="true">{favouritePreview(f)}</span>
                    <span className="fav-name">{library.favouriteName(f)}</span>
                    {/* ROUND AB, ITEM 2 — REMOVE FROM THE STRIP.
                        ROUND AE — EVERY TILE NOW CARRIES IT, AND IT REMOVES BY ID.
                        Harvey: "tôi muốn shape trong favorite cũng có thể có
                        icon để click remove khỏi favorite". Until ROUND AB the
                        only way out of Favourites was the star on the palette
                        row, which means scrolling the library back to the item
                        you just removed from your shortlist.

                        ROUND AB RENDERED THIS ONLY WHERE A LABEL EXISTED, because
                        the removal matched by label and a selection-saved
                        favourite has none — so the control was absent on exactly
                        the tiles that had no other way out. ROUND AE keys the
                        removal on `f.id` (see `removeFavourite` above), so the
                        condition is gone: every tile has a `×`, including the
                        ones saved from a selection.

                        WHAT IT STOPS, and nothing else. The tile inserts on
                        `click` (and double-click, and drag), so this control
                        stops: `click` (the whole point — a remove must never
                        also insert), `dblclick` (a fast double-tap on the `×`
                        would otherwise reach the tile's insert), and
                        `dragstart` (mousedown on a child of a `draggable`
                        button can begin the tile's drag, and the drag is what
                        actually inserts on canvas drop). `keydown` stops its
                        own Enter / Space so the key that activates the `×`
                        cannot also reach a handler behind it.

                        ALWAYS VISIBLE, at low emphasis (opacity .6) — not
                        hover-only. This project treats tablet and phone as in
                        scope, and there is no hover on a tablet: a
                        hover-revealed control would be unreachable there. The
                        `:focus-within` / `:hover` rules in `styles.css` only
                        raise its emphasis, so touch users get the same target a
                        mouse user does.

                        A `<span role="button" tabIndex={0}>` rather than a
                        nested `<button>`: identical to `.cust-remove` on the
                        custom-shape tiles 40 lines below, so the two grids of
                        tiles stay one control vocabulary — and a nested
                        interactive element would be invalid inside the tile's
                        own `<button>`.

                        THE REMOVAL ITSELF IS NOT REIMPLEMENTED: it calls
                        `removeFavourite` → the SAME `mutateFavourites` write
                        path the palette star uses, now ending in
                        `library.removeFavouriteById`. */}
                    <span
                      className="fav-remove"
                      role="button"
                      tabIndex={0}
                      data-fav-remove={f.id}
                      aria-label={`Remove ${library.favouriteName(f)} from Favourites`}
                      title={`Remove ${library.favouriteName(f)} from Favourites`}
                      onClick={e => {
                        e.stopPropagation();
                        removeFavourite(f.id);
                      }}
                      onDoubleClick={e => e.stopPropagation()}
                      onDragStart={e => { e.preventDefault(); e.stopPropagation(); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          removeFavourite(f.id);
                        }
                      }}
                      ><X size={12} strokeWidth={2.5} /></span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ---- CUSTOM SHAPES (§4.1 item 3, §8.1–§8.3) --------------------
              ALWAYS rendered, unlike Favourites above it: this section owns
              the IMPORT control, and that control is the only way a first
              shape can ever exist. An empty section here is not a useless
              header — it is the door.

              The artwork is drawn from `svgDataUri` through an `<img>`, never
              as markup: the data: URI context disables scripts and external
              fetches, which is the second guard behind the sanitiser. ---- */}
          <div className="cust-shapes" data-cust-count={shapes.length}>
            <div className="cust-head">
              <span className="sec-label">Custom shapes</span>
              <button
                type="button"
                className="cust-import"
                data-custom-import-btn="true"
                aria-label="Import an SVG file as a custom shape"
                title="Import an SVG file as a custom shape"
                onClick={openShapeImport}
              >
                Import
              </button>
            </div>
            {/* Visually hidden, but the ONE picker every affordance clicks. */}
            <input
              ref={importInputRef}
              type="file"
              accept=".svg,image/svg+xml"
              className="cust-file"
              data-custom-import-input="true"
              aria-label="Choose an SVG file to import"
              onChange={onImportInputChange}
            />
            <div className="cust-grid">
              {shapes.map(s => (
                <button
                  type="button"
                  key={String(s.created)}
                  className="fav-tile cust-tile"
                  data-custom-shape={String(s.created)}
                  data-custom-title={s.title}
                  draggable
                  // §8.1 — the payload is the sanitised MARKUP, not an id: the
                  // stored entry has no id field, and the canvas resolves this
                  // exact string back to the entry it already holds.
                  onDragStart={e => e.dataTransfer.setData('customshape', s.data)}
                  onDoubleClick={() => insertCustomShape(s)}
                  /* ROUND BE (2026-10-23, Harvey: a single click must NOT
                     insert — parity with the palette). The onClick here used to
                     insert immediately, which the palette rows
                     (`renderPaletteRow`: drag or double-click, no onClick) and
                     the canvas both punish — one stray click littered the
                     board. This tile now follows the PALETTE convention, not
                     the favourites' (which are click-to-insert by design, and
                     stay so). Double-click and drag still work unchanged. */
                  title={`Drag onto the canvas or double-click to add “${s.title}”`}
                >
                  <span className="fav-glyph" aria-hidden="true">
                    <img src={svgDataUri(s.data)} alt="" className="cust-art" />
                  </span>
                  <span className="fav-name">{s.title}</span>
                  {/* `created` is the stable identity — the store has no id. */}
                  <span
                    className="cust-remove"
                    role="button"
                    tabIndex={0}
                    aria-label={`Remove ${s.title}`}
                    title={`Remove ${s.title}`}
                    onClick={e => {
                      e.stopPropagation();
                      removeCustomShape(String(s.created));
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        removeCustomShape(String(s.created));
                      }
                    }}
                    ><X size={12} strokeWidth={2.5} /></span>
                </button>
              ))}
              {/* The drop zone is ALWAYS a tile, and always LAST: it is the
                  whole grid while the library is empty, and the "add the next
                  one" cell once shapes exist. Without it the second import
                  would only be reachable through the button. */}
              <button
                type="button"
                className={`cust-drop${shapes.length ? ' cust-drop-compact' : ''}`}
                data-custom-dropzone="true"
                aria-label={CUST_DROP_HINT}
                title={CUST_DROP_HINT}
                onClick={openShapeImport}
                {...shapeZoneProps}
              >
                <span className="cust-drop-glyph" aria-hidden="true">+</span>
                <span className="cust-drop-text">Drop an SVG here, or Import</span>
              </button>
            </div>
          </div>

          {/* ---- THE LIBRARY -------------------------------------------------
              TWO states, ONE list of 8 categories (§2, canonical order):

                query EMPTY     the normal accordion. All 8 sections always
                                render with their full counts — nothing filters
                                them any more, so a category can never be absent.
                query NON-EMPTY a flat result list grouped by category. A hit
                                whose category is COLLAPSED renders DIMMED, not
                                hidden (§9): collapsing a section must never
                                hide a search hit, or the user concludes the app
                                does not have the shape at all. Empty categories
                                are dropped here (a "(0)" header is noise);
                                clearing the field restores the accordion with
                                its persisted fold state untouched. ---- */}
          <div className="sec-label">Shapes</div>

          {searching ? (
            <div className="lib-cats" data-searching="true">
              {searchGroups.map(({cat, label, items}) => (
                <div className="lib-cat" key={cat} data-cat={cat} data-search-group={cat}>
                  <div className="lib-search-head">
                    <span className="lib-cat-name">{label}</span>
                    <span className="lib-cat-n" data-group-count={items.length}>{items.length}</span>
                  </div>
                  <div className="palette">
                    {items.map(p => {
                      // Dimmed IFF the user folded this section. The fold is
                      // read from the same persisted map the accordion uses, so
                      // the two states can never disagree.
                      const folded = !isCategoryOpen(presetId, cat);
                      return renderPaletteRow(p, `${cat}-${p.label}`, folded);
                    })}
                  </div>
                </div>
              ))}
              {/* A quiet line, not an error: an unmatched query is a normal
                  state (the library is 34 fixed elements). */}
              {searchGroups.length === 0 && (
                <div className="lib-no-match" data-no-match="true">No shape matches</div>
              )}
            </div>
          ) : (
            <div className="lib-cats">
              {librarySections.map(({cat, label, items}) => {
                const open = isCategoryOpen(presetId, cat);
                return (
                  <div className="lib-cat" key={cat} data-cat={cat}>
                    <button
                      type="button"
                      className="lib-cat-head"
                      aria-expanded={open}
                      data-cat-head={cat}
                      data-open={open ? 'true' : 'false'}
                      data-default-open={cat === defaultOpen ? 'true' : undefined}
                      onClick={() => toggleCategory(presetId, cat)}
                    >
                      <ChevronDown size={13} className={`lib-chev${open ? ' open' : ''}`} />
                      <span className="lib-cat-name">{label}</span>
                      <span className="lib-cat-n" data-cat-count={cat}>{items.length}</span>
                    </button>
                    {open && (
                      <div className="palette">
                        {items.map(p => renderPaletteRow(p, `${cat}-${p.label}`))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* The old sidebar guideline block lived here. Harvey: it ate panel
              space for information that belongs in the help surface ("choáng
              chỗ bỏ qua"). Every row it carried is now in the `?` sheet,
              Settings → Shortcuts AND the README table — verified one-for-one —
              so removing it loses nothing. Do not re-add a permanent hint block
              to the panel; put new guidance in those three surfaces instead. */}
        </div>
  );
}, libPropsEqual);
