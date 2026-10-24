# PALETTE-2 — Excalidraw & tldraw: how they organise shapes, libraries and custom content

Research for **Diagram Studio** (React Flow editor, `/home/harvey/projects/tech-goblin/lab/diagram-studio`).
Brief: `PALETTE-BRIEF.md`. Cluster: the two other mature infinite-canvas tools.

**User decision taken into account (out-of-band, 2026-09-16):** Harvey has chosen the **Excalidraw
library model** as the shape to follow — a personal reusable library separate from any document,
with import/export as a file. This report therefore goes **deep on Excalidraw** and reports tldraw
only for what it teaches about presenting many shapes in a picker (tldraw's section is short by design).

Method note: all Excalidraw/tldraw claims below are read from the tools' own source on GitHub
(`master` / `main` as of this run) or their official docs. Where I read a live artifact (an actual
`.excalidrawlib` file) that is stated. Version checked: `@excalidraw/excalidraw` **0.18.0**
(`packages/excalidraw/package.json`).

---

## 1. Excalidraw — the LIBRARY mechanism (deep dive)

### 1.1 Where the library lives in the UI

The library is **not** in the left toolbar. It is a **sidebar** with two tabs, and its tab list is
literally `CANVAS_SEARCH_TAB` and `LIBRARY_SIDEBAR_TAB` (`LIBRARY_SIDEBAR_TAB = "library"`). The
sidebar is docked to the **right** by default (`position: absolute; right: 0`) and RTL-mirrors to the
left. It can be opened three ways: the header tab trigger, the `DefaultSidebar.Trigger` button in the
top-right (title string `toolBar.library` = **"Library"**), or `excalidrawAPI.updateScene({ appState:
{ openSidebar: "library" } })` / `updateLibrary({ ..., openLibraryMenu: true })`.

- https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/constants.ts (`LIBRARY_SIDEBAR_TAB`, `CANVAS_SEARCH_TAB`, `DEFAULT_SIDEBAR`)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/DefaultSidebar.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/LayerUI.tsx (`title={capitalizeString(t("toolBar.library"))}`)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/Sidebar/Sidebar.scss (`right: 0`, `--right-sidebar-width`)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/Sidebar/SidebarTrigger.tsx

The sidebar is not a free-floating panel: it only docks when the editor is wide enough —
`canFitSidebar: editorWidth > sidebarBreakpoint` (right-sidebar breakpoint or
`MQ_RIGHT_SIDEBAR_MIN_WIDTH`). When it cannot fit, dropping an item closes it.

- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx (`canFitSidebar: editorWidth > sidebarBreakpoint`; `addElementsFromPasteOrLibrary`)

### 1.2 What a library IS, structurally

A library is a **flat, ordered array of `LibraryItem`s, persisted independently of any document**
(`LibraryPersistedData = { libraryItems: LibraryItems }`). The item type is exact:

```ts
export type LibraryItem = {
  id: string;
  status: "published" | "unpublished";
  elements: readonly NonDeleted<ExcalidrawElement>[];
  created: number;      // epoch ms
  name?: string;
  error?: string;
};
export type LibraryItems = readonly LibraryItem[];
```

- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/types.ts (`LibraryItem`, `LibraryItems`, `LibraryItemsSource`)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/library.ts (`LibraryPersistedData`, `Library` class, `mergeLibraryItems`, `distributeLibraryItemsOnSquareGrid`)

Five consequences worth copying:

1. **A library item is a list of plain Excalidraw elements** — no new shape type, no code, no
   renderer registration. Anything the canvas can draw, the library can hold (subject to the
   exclusion in §1.6).
2. **Items keep absolute x/y of the original drawing.** Nothing is normalised on capture; centring
   happens at insert time (§1.5). An item is therefore "free-floating geometry + nothing else".
3. **Order is meaningful and newest-first.** `mergeLibraryItems`: "Unique items in otherItems array
   are sorted first" → `[...newItems, ...localItems]`; the add action likewise prepends
   `[newItem, ...items]`.
4. **Two implicit sections, by `status`, not by category.** The UI renders a header **"Personal
   Library"** (`labels.personalLib`) for all non-`published` items and a second header
   **"Excalidraw Library"** (`labels.excalidrawLib`) for `published` ones (i.e. items that came in
   from the public repository and were marked published). There is **no user-created grouping** —
   and an open feature request asks for exactly that: *"Being able to create custom libraries
   instead of having everything mixed up in a 'Personal Library' would be great."*
   - https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/LibraryMenuItems.tsx
   - https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/locales/en.json (`labels.personalLib`, `labels.excalidrawLib`)
   - https://github.com/excalidraw/excalidraw/issues/10334
5. **Identity/dedup.** Uniqueness of an item is decided by element **ids + `versionNonce`** in order
   (`isUniqueItem`), and a content hash `getLibraryItemHash` = `` `${item.id}:${item.name||""}:${hashElementsVersion(item.elements)}` `` drives persistence diffs and save-skipping.

### 1.3 How a user ADDS an item (the exact mechanism)

Two entry points, both producing the same `LibraryItem`:

**(a) From a canvas selection** — `actionAddToLibrary` (`packages/excalidraw/actions/actionAddToLibrary.ts`):

- it collects `app.scene.getSelectedElements({ includeBoundTextElement: true, includeElementsInFrames: true })`;
- it **rejects** the whole selection if any element type is in `LIBRARY_DISABLED_TYPES`;
- it builds `{ id: randomId(), status: "unpublished", elements: selectedElements.map(deepCopyElement), created: Date.now() }`
  and prepends it via `app.library.getLatestLibrary().then(items => app.library.setLibrary([newItem, ...items]))`;
- on success it toasts **"Added to library"** (`toast.addedToLibrary`); on failure it shows
  `alerts.errorAddingToLibrary` = **"Couldn't add item to the library"**.

This same action is exposed on the **canvas context menu** (labelled `labels.addToLibrary` =
**"Add to library"**), and it is also driven from the sidebar's *pending* slot: while you have a
selection the library shows a pulsing 55×55 tile with a `+` adder; clicking it calls the same
`onAddToLibraryClick → onAddToLibrary(pendingElements)`. The empty-state hint spells the flow out:
**"Select an item on canvas to add it here, or install a library from the public repository,
below."** / **"Select an item on canvas to add it here."**

- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/actions/actionAddToLibrary.ts
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/LibraryMenu.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/LibraryUnit.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx (context menu includes `actionAddToLibrary`)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/locales/en.json (`library.hint_emptyLibrary`, `library.hint_emptyPrivateLibrary`, `toast.addedToLibrary`)

**(b) From an imported file** — an `.excalidrawlib` can be:
- opened via the library dropdown (**"Open"**, `buttons.load`), which is `fileOpen({ description: "Excalidraw library files" })` → `library.updateLibrary({ libraryItems: file, merge: true, openLibraryMenu: true })`;
- **dragged/dropped onto the canvas** — `App.handleAppOnDrop` → `loadSceneOrLibraryFromBlob` detects `isValidLibrary` and calls `this.library.updateLibrary({ libraryItems: file, merge: true, openLibraryMenu: true })`;
- **or installed by URL** — `parseLibraryTokensFromUrl()` reads `?addLibrary=` / `#addLibrary=`, fetches the URL, and merges **with a confirmation prompt**: `updateLibrary({ libraryItems: promise, prompt: true, merge: true, defaultStatus: "published", openLibraryMenu: true })`. Alert text: **"This will add {{numShapes}} shape(s) to your library. Are you sure?"**

  URL allow-listing is enforced by `ALLOWED_LIBRARY_URLS = ["excalidraw.com", "raw.githubusercontent.com/excalidraw/excalidraw-libraries"]` and `validateLibraryUrl()`; otherwise it throws `Invalid or disallowed library URL`.

- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/library.ts (`parseLibraryTokensFromUrl`, `validateLibraryUrl`, `ALLOWED_LIBRARY_URLS`, `updateLibrary` prompt path)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/blob.ts (`loadSceneOrLibraryFromBlob`, `isValidLibrary` branch)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx (`loadFileToCanvas`, drop handler)
- https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/constants.ts (`URL_HASH_KEYS.addLibrary`, `URL_QUERY_KEYS.addLibrary`)

### 1.4 How the library is STORED locally, and exported/imported as a file

**Stored — two eras, one shape:**

| | Where | Key | Code |
|---|---|---|---|
| Current (app) | **IndexedDB** via `idb-keyval` | DB `excalidraw-library-db`, store `excalidraw-library-store`, data key `libraryData` | `LibraryIndexedDBAdapter` |
| Legacy (migrated) | `localStorage` | `excalidraw-library` (`STORAGE_KEYS.__LEGACY_LOCAL_STORAGE_LIBRARY`) | `LibraryLocalStorageMigrationAdapter` |
| Host app (embedders) | anywhere | supplied by you | `LibraryPersistenceAdapter { load, save }` / `LibraryMigrationAdapter` |

The app wires it as `useHandleLibrary({ excalidrawAPI, adapter: LibraryIndexedDBAdapter, migrationAdapter: LibraryLocalStorageMigrationAdapter })`. Writes are **diffed, queued and serialised** (`updateQueue`, `persistLibraryUpdate`, `AdapterTransaction.queue`) and **skipped when the content hash is unchanged** — explicitly to survive multiple editors/tabs sharing one DB. Failure surfaces as
**"Couldn't save library to storage. Please save your library to a file locally to make sure you don't lose changes."** (`errors.saveLibraryError`).

- https://github.com/excalidraw/excalidraw/blob/master/excalidraw-app/data/LocalData.ts (`LibraryIndexedDBAdapter`, `LibraryLocalStorageMigrationAdapter`)
- https://github.com/excalidraw/excalidraw/blob/master/excalidraw-app/app_constants.ts (`STORAGE_KEYS.IDB_LIBRARY = "excalidraw-library"`, `__LEGACY_LOCAL_STORAGE_LIBRARY`)
- https://github.com/excalidraw/excalidraw/blob/master/excalidraw-app/App.tsx (`useHandleLibrary` call)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/library.ts (`LibraryPersistenceAdapter`, `persistLibraryUpdate`, `getLibraryItemsHash`)
- https://github.com/excalidraw/excalidraw/blob/master/excalidraw-app/data/LocalData.ts (doc comment: "some state is saved separately (collab username, library) … we also save different data to different storage (localStorage, indexedDB)")

**Exported as a file — the `.excalidrawlib` container (exact schema):**

```
{ "type": "excalidrawlib", "version": 2, "source": "<app url>", "libraryItems": [ {id,status,elements,created,name}, ... ] }
```

- `serializeLibraryAsJSON()` writes `{ type: EXPORT_DATA_TYPES.excalidrawLibrary /* "excalidrawlib" */, version: VERSIONS.excalidrawLibrary /* 2 */, source: getExportSource(), libraryItems }`;
- `saveLibraryAsJSON()` saves it via the File System Access API (`fileSave`, name `library`, extension `excalidrawlib`, description **"Excalidraw library file"**, MIME `application/vnd.excalidrawlib+json`);
- **Reading accepts v1 as well as v2**: `isValidLibrary` requires `type === "excalidrawlib"` and `version === 1 || version === 2`; v1 files store a bare `library: ExcalidrawElement[][]` (no ids/names/status), and `parseLibraryJSON` handles `data.libraryItems || data.library`, then `restoreLibraryItems(…, defaultStatus)` re-ids and re-`created`-stamps legacy raw arrays.
- The export/Open labels are **"Save to…"** (`buttons.export`) and **"Open"** (`buttons.load`) in the library's overflow menu; exporting a *selection* exports only the checked items, otherwise `library.getLatestLibrary()`.

I verified the container by fetching real published libraries from GitHub:

| File | `type`/`version` | item shape | observed content |
|---|---|---|---|
| `libraries/cloud/cloud.excalidrawlib` | `excalidrawlib` / **1** | raw element arrays under `"library"` | 1 item, `line` + `ellipse` elements, `groupIds: ["pt3wb4Syv55xaohDRJ8-K"]`, absolute x/y ~700–900 |
| `libraries/ad115/music-notation.excalidrawlib` | `excalidrawlib` / **2** | `libraryItems[].{id,status,elements,created,name}` | 23 items, all named, `status: "published"` |
| `libraries/coexist/mq.excalidrawlib` | `excalidrawlib` / **2** | same | 6 items, `line`/`text`/`rectangle`/`diamond` |
| `libraries/aretecode/decision-flow-control.excalidrawlib` | `excalidrawlib` / **1** | raw arrays | 8 items, `diamond`/`text`/`arrow`/`ellipse` |

- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/json.ts (`isValidLibrary`, `serializeLibraryAsJSON`, `saveLibraryAsJSON`)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/blob.ts (`parseLibraryJSON`, `getMimeType` → `MIME_TYPES.excalidrawlib` for `.excalidrawlib`)
- https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/constants.ts (`EXPORT_DATA_TYPES.excalidrawLibrary`, `VERSIONS.excalidrawLibrary: 2`, `STRING_MIME_TYPES.excalidrawlib`)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/restore.ts (`restoreLibraryItem`, `restoreLibraryItems` — v1 migration)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/LibraryMenuHeaderContent.tsx (Open / Save to… / publish / reset menu)
- Live artifacts: https://github.com/excalidraw/excalidraw-libraries (repo contents fetched via GitHub API this run)

**Shared publicly:** from the library dropdown, checking items reveals **"Rename or publish"**
(`buttons.publishLibrary`) → a Publish dialog (`publishDialog.title` = "Publish library") where
**each item needs a name** (`publishDialog.errors.required` = "Required"; *"Each library item must
have its own name so it's filterable"*) plus library name/description; it POSTs to a review queue
("Your library has been submitted for review"). The community repository is
[excalidraw-libraries](https://github.com/excalidraw/excalidraw-libraries) and the browse button
links to `libraries.excalidraw.com` with `?target=…&referrer=…&useHash=true&token=<editor id>&theme=…&version=…`
(the `token` is what suppresses the merge prompt when you install into the same editor instance:
`shouldPrompt = idToken !== excalidrawAPI.id`).

- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/PublishLibrary.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/LibraryMenuBrowseButton.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/library.ts (`shouldPrompt`)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/locales/en.json (`publishDialog.*`, `publishSuccessDialog.title`)

### 1.5 How an item goes back onto the canvas (the layout-safety part)

Three paths, all of which **re-position and re-identify** the stored geometry:

1. **Click an item** → `onItemClick → onInsertLibraryItems(getInsertedElements(id))` → `App.onInsertElements` → `addElementsFromPasteOrLibrary({ elements, position: "center", files: null })`.
   `getInsertedElements` first runs `duplicateElements({ type: "everything", elements: item.elements, randomizeSeed: true, preserveFrameChildrenOrder: true })` — comment: *"duplicate each library item before inserting on canvas to confine ids and bindings to each library item. See #6465"*.
2. **Drag an item onto the canvas** → the drag payload is only ids: `dataTransfer.setData(MIME_TYPES.excalidrawlibIds, JSON.stringify({ itemIds }))` ("we want to serialize just the ids so the operation is fast and there's no race condition"); the drop handler filters `getLatestLibrary()` by those ids, duplicates them, and lays them out with `distributeLibraryItemsOnSquareGrid`.
3. **Multi-item insert / paste of library JSON** → `distributeLibraryItemsOnSquareGrid(libraryItems)`: `ITEMS_PER_ROW = ceil(sqrt(n))`, `PADDING = 50`, per-row max height and per-column max width computed from `getCommonBoundingBox`, each item centred in its cell, then offset so each item starts at 0 — i.e. **the library decides the layout grid, the item's own coordinates are ignored for placement**.
   Then in `addElementsFromPasteOrLibrary`: `restoreElements(...)` → `getCommonBounds` → target point (`"center"` / `"cursor"` / drop clientX/Y) → `getGridPoint(dx, dy, gridSize)` → each element rewritten `x + gridX - minX`, `y + gridY - minY` → `duplicateElements({ randomizeSeed: true })` → `syncMovedIndices` → `getTopLayerFrameAtSceneCoords` + `addElementsToFrame` if dropped over a frame → `scene.replaceAllElements` → new elements become the selection. Nothing about the viewport is changed; the existing scene is untouched apart from appended elements.

- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/library.ts (`distributeLibraryItemsOnSquareGrid`)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx (`onInsertElements`, `addElementsFromPasteOrLibrary`, `handleAppOnDrop` library branch)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/LibraryMenuItems.tsx (`getInsertedElements`, `onItemDrag`)
- https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/constants.ts (`MIME_TYPES.excalidrawlibIds`)

### 1.6 USER-SUPPLIED IMAGES and arbitrary drawn selections — the flexibility, and its one hard limit

- **Arbitrary drawn selection: yes, by design.** Any selection of elements can be captured (freehand
  `freedraw`, lines, arrows, text, frames — `includeElementsInFrames: true`, bound text included).
  There is no minimum size, no grid requirement, no naming requirement for *private* use.
- **A pasted SVG string is converted to an image element**: `if (trimmedText.startsWith("<svg") && …) imageFiles.push(SVGStringToFile(trimmedText))`; dropped/opened `.svg`/`.png` files go through `insertImages` / `loadFromBlob` and become `image` elements with `fileId`s in the scene's `files` map.
- **But `image` is an explicitly disabled library type.**
  `LIBRARY_DISABLED_TYPES = new Set(["iframe", "embeddable", "image"])`, and the error strings are:
  `errors.libraryElementTypeError.image` = **"Support for adding images to the library coming soon!"**,
  `embeddable` = "Embeddable elements cannot be added to the library.", `iframe` = "IFrame elements cannot be added to the library."
  A user reported exactly this flow in the tracker: *"I dragged two icons to the excalidraw canvas and
  then grouped them and then click on the + in the personal library section and got … 'Support for
  adding images to the library is coming soon'"* — issue still open, no assignee.
- **Practical consequence / workaround** [partly UNVERIFIED — I confirmed the code paths, not a
  hands-on run]: an imported raster/SVG *image* cannot be a library item, but the **same visual can be
  re-drawn on the canvas as native Excalidraw elements** (the published `cloud` library is exactly
  that: a `line` + `ellipse` cloud, not an image), and any *selection of drawn elements* is
  library-able. So the flexibility Excalidraw gives is "**anything you can draw natively, including
  a hand-drawn/imported-then-traced icon**", plus "**your own `.excalidrawlib` file**", and **not**
  "any bitmap you drag in".
  - https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/constants.ts (`LIBRARY_DISABLED_TYPES`)
  - https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/actions/actionAddToLibrary.ts (rejection loop)
  - https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/locales/en.json (`errors.libraryElementTypeError.*`)
  - https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx (`SVGStringToFile` paste path, `insertImages`, `initializeImage`)
  - https://github.com/excalidraw/excalidraw/issues/8245
  - https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/hooks/useLibraryItemSvg.ts — **how the thumbnail is made**: `exportToSvg({ elements, files: null, renderEmbeddables: false, skipInliningFonts: true })`, cached in a `Map` keyed by item id (`libraryItemSvgsCache`), batch-rendered **17 items per batch (64 when cached)** — another reason images-in-library are hard: `files: null` means no image bytes are available to render a tile.

### 1.7 Search inside the library

There **is** search in the library sidebar, and it is **name-only**:

- input placeholder **"Search library"** (`library.search.inputPlaceholder`); while searching the
  heading becomes **"Library matches"**, empty → **"No matching items found..."**, plus a
  **"Clear search"** button and a literal `<kbd>esc</kbd> to clear` hint;
- `filteredItems = libraryItems.filter(item => item.name?.trim() && deburr(item.name.toLowerCase()).includes(deburr(query)))` — **unnamed items are invisible to search**, which is why publishing enforces names.

- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/LibraryMenuItems.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/locales/en.json (`library.search.*`)

### 1.8 Host-app API for a library (what Diagram Studio would consume if it were Excalidraw)

Documented surface: `initialData.libraryItems`, `onLibraryChange(libraryItems)`,
`libraryReturnUrl`, `updateLibrary({ libraryItems, merge, prompt, openLibraryMenu, defaultStatus })`,
`useHandleLibrary({ excalidrawAPI, adapter, migrationAdapter, validateLibraryUrl })`, exported utils
`mergeLibraryItems`, `getLibraryItemsHash`, `serializeLibraryAsJSON`, `loadLibraryFromBlob`,
`restoreLibraryItems`, `parseLibraryTokensFromUrl`, plus per-element `customData: Record<string, any>`
("use this to add any extra information you need to keep track of" — and the docs explicitly say it
can be added "using `updateScene` / `updateLibrary`"). This is the whole "personal library" contract,
and it fits in a page.

- https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/ (`onLibraryChange`, `libraryReturnUrl`, `customData`)
- https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/initialdata (`libraryItems`)
- https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api (`updateLibrary`)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/index.tsx (public exports)

---

## 2. Excalidraw — is the left toolbar grouped or flat? How does it handle many tools?

**It is a fixed, flat, hand-written set — and its answer to "too many tools" is a hidden "More tools"
dropdown, not categories.**

- The desktop toolbar is an explicit JSX list in `Toolbar.tsx`: `PenModeButton`, `LockButton`, divider,
  `HandToolButton`, selection (or `SelectionToolPopover`/`LassoToolButton`), `RectangleToolButton`,
  `DiamondToolButton`, `EllipseToolButton`, `ArrowToolButton`, `LineToolButton`, freedraw,
  `TextToolButton`, `StickyNoteToolButton`, `EraserToolButton`, divider, **`ExtraToolsDropdown`**.
- Overflow items are pulled out of the toolbar into `ExtraToolsDropdown`, whose trigger
  `title = t("toolBar.extraTools")` = **"More tools"** and which renders a flat `DropdownMenu.Content`
  of `DropdownMenu.Item`s (image, frame, embeddable, laser, bucket fill, "Draw to shape", mermaid to
  excalidraw, …), each with a `shortcut` badge. The trigger icon **swaps** to the last-used overflow
  tool's icon (`imageToolSelected ? ImageIcon : frameToolSelected ? frameToolIcon : … : DotsIcon`) —
  a nice convention: the "more" button remembers.
- The tool registry `TOOLS` (`Tools.tsx`) carries `{ icon, letterKey?, numericKey?, shiftKey?, fillable }`
  and assigns the digit row: 1 select, 2 rectangle, 3 diamond, 4 ellipse, 5 arrow, 6 line, 7 freedraw,
  8 text, **9 image**, 0 eraser. There is **no category, no group, no collapse, no search** anywhere in
  the tool system.
- Mobile is a different component (`MobileToolbar.tsx`) with **width-driven collapse**: `WIDTH = 36`,
  `GAP = 4`, `MIN_TOOLS = 7`; text/image/frame each pop out of the "more" menu only when
  `toolbarWidth >= MIN_WIDTH + n*(WIDTH+GAP)`; related tools are already fused into a **`ToolPopover`**
  (rectangle/diamond/ellipse as `SHAPE_TOOLS`; arrow/line as `LINEAR_ELEMENT_TOOLS`) — i.e. Excalidraw
  *does* group shapes, but as a "last-used + popover" cluster rather than a labelled section, and only
  on the small-screen toolbar.
- Keyboard-only alternative: a **Command Palette** exists, with a `library` entry in its command map
  (`CP.tsx`: `library: "Library"`), which is the closest thing to a searchable "shape" surface.

**Exact UI strings** (from `locales/en.json`, usable verbatim): `toolBar.extraTools` = "More tools",
`toolBar.library` = "Library", `toolBar.selection` = "Selection", `toolBar.rectangle` = "Rectangle",
`toolBar.frame` = "Frame tool", `toolBar.bucketfill` = "Bucket fill", `toolBar.autoshape` =
"Draw to shape", `toolBar.mergeToExcalidraw`-adjacent = "Mermaid to Excalidraw",
`toolBar.convertElementType` = "Toggle shape type", `toolBar.lock` = "Keep selected tool active after
drawing", `labels.addToLibrary` = "Add to library", `labels.removeFromLibrary` = "Remove from library",
`buttons.resetLibrary` = "Reset library", `buttons.publishLibrary` = "Rename or publish",
`buttons.export` = "Save to...", `buttons.load` = "Open", `library.noItems` = "No items added yet...".

One conflict to note: the **library README says the library opens "by clicking on the 'library' button
or typing `9`"**, but in current source `9` is bound to the **image** tool (`TOOLS.image.numericKey =
KEYS["9"]`, also shown in the Help dialog: `<Shortcut label={t("toolBar.image")} shortcuts={[KEYS["9"]]} />`),
while the library trigger carries a literal `aria-keyshortcuts="0"` that is not wired to any
documented action. **[UNVERIFIED] which key, if any, opens the library in 0.18.0** — treat the README
line as historical.

- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/Toolbar.tsx (`ExtraToolsDropdown`)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/MobileToolbar.tsx (`MIN_TOOLS`, `ToolPopover`, `extraTools`)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/ToolPopover.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/Tools.tsx (`TOOLS` registry, `numericKey`)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/HelpDialog.tsx (digit-row shortcuts)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/Sidebar/SidebarTrigger.tsx (`aria-keyshortcuts="0"`)
- https://github.com/excalidraw/excalidraw-libraries/blob/master/README.md ("by clicking on the 'library' button or typing `9`")
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/locales/en.json

---

## 3. tldraw — how shapes are presented, and what happens with many/custom shapes (short)

tldraw is an **SDK**, not an app, and it has **no shape library feature**. Its shape surface is a
**fixed toolbar** plus a **contextual style panel**, and every "custom content" story is a
compile-time code story.

**Presentation of shapes.**

- Default toolbar (`DefaultToolbarContent`) is a flat hand-written list of ~30 tool items
  (`SelectToolbarItem`, `HandToolbarItem`, `DrawToolbarItem`, `EraserToolbarItem`, `ArrowToolbarItem`,
  `TextToolbarItem`, `NoteToolbarItem`, `AssetToolbarItem`, `RectangleToolbarItem`, `EllipseToolbarItem`,
  `TriangleToolbarItem`, … `FrameToolbarItem`). The 20 geometric forms live under **one** `geo` shape
  type and one toolbar entry each.
- **Overflow is the only grouping mechanism visible by default**: `DefaultToolbar` defaults are
  `minItems = 4, minSizePx = 310, maxItems = 8, maxSizePx = 470`; `OverflowingToolbar` walks the DOM,
  computes `itemsToShow = Math.floor(modulate(size, [minSizePx, maxSizePx], [minItems, maxItems], true))`
  and moves the rest into a `'toolbar overflow'` popover, **keeping the most recently used overflow
  item visible in the main row**. Breakpoints: `PORTRAIT_BREAKPOINTS = [0,389,436,476,580,640,840,1023]`,
  `PORTRAIT_BREAKPOINT.TABLET = 6`.
- **Grouping is available but must be authored**: wrapping items in `TldrawUiMenuGroup` "draws a
  divider between groups"; the docs' "Toolbar groups" example ships groups literally named
  `orientation`, `controls`, `pens`, `shapes`, `arrows`. There is **no collapsible section, no
  category list, no palette search** — no documented "shape picker" other than the style panel's
  `StylePanelDropdownPicker` for the `geo` style ("type='menu'"), which does become the place custom
  geo types appear.
- Asset/insert menu: the media tool is a single toolbar item (`id: 'asset'`, label `tool.media`,
  icon `tool-media`, `kbd: 'cmd+u,ctrl+u'`) that opens a file picker (`helpers.insertMedia()`); images
  become `image` shapes referencing an `asset` record. Assets are stored per document — in memory as
  data URLs via `inlineBase64AssetStore`, in **IndexedDB alongside the document when a
  `persistenceKey` is set** ("With a `persistenceKey`, assets are stored in the browser's IndexedDB
  alongside the document"), or in your own backend via `TLAssetStore { upload, resolve, remove }`.
  **There is no asset palette / reuse surface** — "Multiple shapes can reference the same asset" but
  the user has no library UI.

**Custom shapes: code-registered, not user-authored.**

- A custom shape = a `ShapeUtil` subclass (`type`, `static props` validators, `getDefaultProps`,
  `getGeometry`, `component`, `getIndicatorPath`) passed to `<Tldraw shapeUtils={[MyShapeUtil]} />`;
  a tool = a `StateNode` subclass passed to `tools`, plus a `tools` UI override + a `Toolbar`
  component override + an `assetUrls.icons` entry for the icon.
- A custom *form* of the built-in geo shape is the nearest thing to "add your own shape without a
  new type": `GeoShapeUtil.configure({ customGeoTypes: { 'rounded-rect': { getPath, snapType, icon,
  defaultSize, onDoubleClick } } })`, and those "appear in the style panel's geo picker alongside the
  built-in shapes".
- **[No published "shape library" pattern found]** — I searched tldraw.dev's sitemap (0 URLs containing
  "library") and its docs/examples for a shape-library/personal-library concept and found none;
  custom content = registering utils at editor construction. Persistence is the document snapshot
  (`getSnapshot` → `{document, session}`, `persistenceKey`, IndexedDB per key), not a separate
  reusable library file you can hand to another user.

**Documented limits and the collision rules (the "don't break the canvas" answer).**

| Rule | Mechanism | Source |
|---|---|---|
| Shape type identity is a **compile-time string**; core types cannot be replaced | `checkShapesAndAddCore` **throws** `Shape type "X" is a core shapes type and cannot be overridden` and `Shape type "X" is defined more than once` | https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/config/defaultShapes.ts |
| A shape record without its util **cannot render** — it throws instead of degrading | `Editor.getShapeUtil`: `if (!shapeUtil) throw new Error('No shape util found for type "X"')` | https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/editor/Editor.ts |
| Custom geo type keys that collide with built-ins are **silently dropped with a console warning** | `customGeoTypes` filter: `key "X" collides with a built-in geo type and will be ignored. Please use a unique name.` | https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/shapes/geo/GeoShapeUtil.tsx |
| Hard counts | `maxShapesPerPage: 4000`, `maxPages: 40`, `maxFilesAtOnce: 100` (options, fixed at init, readonly); over the shape cap the editor fires `max-shapes` and shows an alert (`alertMaxShapes`) | https://tldraw.dev/sdk-features/options, https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/options.ts, https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/editor/Editor.ts |
| Shape prop changes need versioned **migrations** to stay loadable | `createShapePropsMigrationIds` / `createShapePropsMigrationSequence`, attached as `static migrations`; scopes `record`/`store`/`storage`; snapshots migrate automatically | https://tldraw.dev/sdk-features/persistence |
| Layout safety is geometric, per shape | `getGeometry()` is required and drives hit-testing/bounds; `resizeBox`/`Rectangle2d`/`isFilled` etc. — a shape that returns bad geometry breaks selection, not the whole board | https://tldraw.dev/docs/shapes |

---

## 4. Side-by-side on the question that matters

| Question | Excalidraw | tldraw |
|---|---|---|
| Is there a **personal library** the user builds? | **Yes**, first-class: `LibraryItem[]` (`id, status, elements, created, name?`) stored separately from any document, in IndexedDB (app) or your adapter (host) | **No.** Custom content = registered `ShapeUtil`s; assets live per-document (IndexedDB with `persistenceKey`) |
| Can the user **add an item without code**? | **Yes** — select anything on canvas, "Add to library" / click `+`; or import an `.excalidrawlib` | **No** — needs a code change + rebuild |
| Can the library be **exported/imported as a file**? | **Yes** — `.excalidrawlib`, `{type,version,source,libraryItems}`, v1+v2 read, `Save to…` / `Open` / drag-drop / `?addLibrary=` URL | **No** equivalent (whole-document snapshot only) |
| **Searchable**? | Yes, by item **name** (name-less items are not findable) | n/a (no library; toolbar has no search) |
| **Grouped / categorised**? | Not by the user — two implicit sections "Personal Library" / "Excalidraw Library" by `status`; grouping is an open feature request | `TldrawUiMenuGroup` dividers only (author-time) |
| Many items? | **4-column grid, incremental rendering** (`17` per batch, `64` when the SVG cache is warm), vertical scroll, SVG thumbnails from `exportToSvg`, cached by item id | Toolbar overflow popover driven by available pixels (`4–8` items) |
| How does a custom item avoid breaking layout? | Insert is **re-derived**: duplicates with new ids/seeds (`#6465`), re-centred on a square grid or around the drop point snapped to `getGridPoint`, indices synced, and added to a frame if dropped on one. Stored coordinates never dictate placement | By contract: required `getGeometry`, prop validators, migrations; a missing util **throws** `No shape util found for type "X"` |
| What can't go in? | `image` / `embeddable` / `iframe` — `"Support for adding images to the library coming soon!"` (open issue #8245) | anything without a registered util |

---

## 5. Recommendation (this cluster)

**Follow Excalidraw's library model — it is the only one of the two that is a *user-facing, document-independent,
file-portable, code-free* favourites store, which is exactly what Harvey asked for and explicitly not
draw.io's drag-here scratchpad.** Adopt these six specific ideas, in this order of value:

1. **Model a favourite as plain node/edge payloads, not as a node type.** Excalidraw's item is
   `{id, status, elements, created, name?}` where `elements` are ordinary drawing elements. Diagram
   Studio already has `make()` returning node data (brief §"What exists today"), so a favourite can be
   `{id, name, created, nodes:[…], edges:[…]}` with the palette item's `{shape, colorKey, kind, size}`
   serialised inside — meaning **the app needs no new renderer to display a favourite**, and existing
   colour-key rules (`--c-*` tokens, boards store keys not hex) keep working. This is the single most
   important lesson from Excalidraw.
2. **Store the library in one file, separate from boards**, e.g. `library.json` beside `boards/<id>.json`
   served by the same Vite middleware (the app's current storage idiom per the brief), and expose the
   same three verbs Excalidraw has: **add from selection**, **Open (import, merge)**, **Save to…
   (export)** — with `merge: true` semantics on import, and the *newest-first* ordering convention
   (`[...newItems, ...oldItems]`).
3. **Copy the "pending" affordance verbatim.** Excalidraw shows a pulsing `+` tile at the top of the
   library while there is a selection, and the hint "Select an item on canvas to add it here." That is
   a zero-menu, discoverable favourite-add that costs one button — ideal for the left panel.
4. **Insert must re-derive geometry, never trust stored coordinates.** Do what
   `addElementsFromPasteOrLibrary` does: re-centre on the drop point, snap to the grid, re-generate
   ids, then select the inserted nodes. This is Harvey's "không phá layout là chính" requirement
   satisfied structurally rather than by validation rules.
5. **Name is what makes search work** — adopt Excalidraw's exact convention: search filters on item
   `name` only, items with no name are not findable, and any share/publish path *requires* a name
   ("Each library item must have its own name so it's filterable"). For a local-only v1, make naming
   optional on add but prompt on export.
6. **Give the "many items" case a grid + incremental render + thumbnail cache**, not a smarter
   taxonomy: 4-column grid (`grid-template-columns: 1fr 1fr 1fr 1fr`), scroll-y, ~17-item batches,
   thumbnails cached per item id. Excalidraw proves a flat, searchable, thumbnail grid scales; its own
   users are the ones asking for categories (issue #10334), so categories are a **later** layer on top
   of a working library, not the v1 design.

**Where to deliberately diverge from Excalidraw, for Diagram Studio:**

- **Allow images in a favourite if feasible.** Excalidraw's hardest limitation is `LIBRARY_DISABLED_TYPES`
  including `image`, with thumbnails generated via `exportToSvg({ files: null })`. Harvey's ask #3 is
  explicitly "add their own icons/shapes". If a favourite can be an SVG, a small raster icon, or an
  image node, Diagram Studio would be *better* than the model it copies — and because boards are local
  JSON with no backend, inlining an icon as an SVG string (or a data URL under a size cap) is cheap.
  Record this as an intentional improvement, and keep Excalidraw's exclusion behaviour only as the
  fallback error text pattern.
- **Keep the left panel grouped for BUILT-INS** (Harvey's ask #1, draw.io-like) while the
  **Favourites section is a flat grid** (Excalidraw-like) — the two asks are compatible: categories for
  the shipped vocabulary, favourites for the personal one. Excalidraw's own two-section pattern
  ("Personal Library" / "Excalidraw Library", both flat grids under a bold header) is the precedent for
  a header + grid layout inside a categorised sidebar.
- **Reuse the existing `.sp-overlay` insert palette for the library's search** rather than building a
  second search UI — Excalidraw's library search (`"Search library"`, "Library matches", `esc to clear`)
  is a thin filter over the same grid.

**From tldraw, take exactly two UI patterns (nothing else):**

- **The "more tools" trigger that shows the last-used hidden tool's icon** (`ExtraToolsDropdown`'s icon
  swap, and `OverflowingToolbar`'s "most recently active item from the overflow being shown in the main
  toolbar"). If Diagram Studio hides low-frequency palette items behind a "More" control, this makes
  the control self-explanatory.
- **Width-driven overflow with an explicit budget** (`minItems`/`maxItems`/`minSizePx`/`maxSizePx` +
  `modulate()`), so a palette never overflows its panel at phone width — useful given the project also
  ships responsive/tablet work.
  **Do not** copy tldraw's custom-content model for user-added elements: it requires code, has no
  exportable library file, and **throws** (`No shape util found for type "X"`) when a document meets a
  shape whose util is absent — the opposite of what a shared, generic, local-first editor needs.

---

## Sources

Excalidraw — source (`excalidraw/excalidraw`, `master`):
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/types.ts — `LibraryItem`, `LibraryItems`, `LibraryItemsSource`
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/library.ts — `Library`, `LibraryPersistenceAdapter`, `mergeLibraryItems`, `isUniqueItem`, `getLibraryItemHash`, `persistLibraryUpdate`, `distributeLibraryItemsOnSquareGrid`, `validateLibraryUrl`, `ALLOWED_LIBRARY_URLS`, `parseLibraryTokensFromUrl`, `useHandleLibrary`
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/json.ts — `isValidLibrary`, `serializeLibraryAsJSON`, `saveLibraryAsJSON`
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/blob.ts — `parseLibraryJSON`, `loadLibraryFromBlob`, `loadSceneOrLibraryFromBlob`, `getMimeType`
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/types.ts — `ExportedLibraryData`, `ImportedLibraryData`, `ExcalidrawLibraryIds`
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/restore.ts — `restoreLibraryItem(s)` (v1 migration)
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/actions/actionAddToLibrary.ts
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/LibraryMenu.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/LibraryMenuItems.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/LibraryMenuHeaderContent.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/LibraryMenuControlButtons.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/LibraryMenuBrowseButton.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/LibraryMenuSection.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/LibraryUnit.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/LibraryMenu.scss , `LibraryMenuItems.scss`, `LibraryUnit.scss`
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/PublishLibrary.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/DefaultSidebar.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/Sidebar/Sidebar.tsx , `SidebarTrigger.tsx`, `Sidebar.scss`
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/LayerUI.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/Toolbar.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/MobileToolbar.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/ToolPopover.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/Tools.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/HelpDialog.tsx
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx — `handleAppOnDrop`, `insertImages`, `addElementsFromPasteOrLibrary`, `onInsertElements`, `canFitSidebar`, `loadFileToCanvas`
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/hooks/useLibraryItemSvg.ts
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/locales/en.json
- https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/package.json
- https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/constants.ts
- https://github.com/excalidraw/excalidraw/blob/master/excalidraw-app/data/LocalData.ts
- https://github.com/excalidraw/excalidraw/blob/master/excalidraw-app/app_constants.ts
- https://github.com/excalidraw/excalidraw/blob/master/excalidraw-app/App.tsx

Excalidraw — docs, releases, community:
- https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/ (`onLibraryChange`, `libraryReturnUrl`, `customData`)
- https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/initialdata (`libraryItems`)
- https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api (`updateLibrary`)
- https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/export (`exportToSvg`/`exportToCanvas` used for thumbnails)
- https://docs.excalidraw.com/docs/codebase/json-schema (element schema, `created` semantics incl. "insert from a library")
- https://github.com/excalidraw/excalidraw-libraries/blob/master/README.md
- https://github.com/excalidraw/excalidraw-libraries (193 library directories; `.excalidrawlib` + preview image)
- https://github.com/excalidraw/excalidraw/issues/8245 (images-in-library message; open)
- https://github.com/excalidraw/excalidraw/issues/10334 (request for multiple custom libraries; open)
- https://libraries.excalidraw.com

tldraw — source (`tldraw/tldraw`, `main`):
- https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/ui/components/Toolbar/DefaultToolbar.tsx (`minItems=4, minSizePx=310, maxItems=8, maxSizePx=470`)
- https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/ui/components/Toolbar/OverflowingToolbar.tsx (`modulate`, `collectItems`, `lastActiveOverflowItem`, `'toolbar overflow'`)
- https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/ui/components/Toolbar/DefaultToolbarContent.tsx
- https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/ui/hooks/useTools.tsx (`TLUiToolItem`, `geo` tools, `asset`/`tool.media`)
- https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/ui/constants.ts (`PORTRAIT_BREAKPOINTS`)
- https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/config/defaultShapes.ts (`checkShapesAndAddCore` throws)
- https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/editor/Editor.ts (`getShapeUtil` throws `No shape util found for type`, `alertMaxShapes`, `maxShapesPerPage` usage)
- https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/options.ts (`maxShapesPerPage: 4000`, `maxFilesAtOnce: 100`, `maxPages: 40`)
- https://github.com/tldraw/tldraw/blob/main/packages/editor/src/lib/config/createTLStore.ts (`createTLStore`, `createTLSchemaFromUtils`, `inlineBase64AssetStore`)
- https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/shapes/geo/GeoShapeUtil.tsx (`customGeoTypes` collision warning)
- https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/shapes/geo/getGeoShapePath.ts (`defaultGeoTypeDefinitions`)

tldraw — docs:
- https://tldraw.dev/docs/shapes
- https://tldraw.dev/sdk-features/shapes
- https://tldraw.dev/sdk-features/default-shapes (13 shape types; 5 loose categories)
- https://tldraw.dev/sdk-features/geo-shape (20 forms; `customGeoTypes`)
- https://tldraw.dev/docs/tools
- https://tldraw.dev/sdk-features/options (limits table)
- https://tldraw.dev/sdk-features/persistence (`persistenceKey`, snapshots, migrations)
- https://tldraw.dev/sdk-features/assets (`TLAssetStore`, IndexedDB with `persistenceKey`)
- https://tldraw.dev/examples/ui/add-tool-to-toolbar
- https://tldraw.dev/examples/ui/toolbar-groups (`TldrawUiMenuGroup` dividers)
- https://tldraw.dev/features/composable-primitives/ui-and-menus ("Intelligent overflow management")
