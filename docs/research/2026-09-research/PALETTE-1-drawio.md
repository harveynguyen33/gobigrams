# PALETTE-1 — diagrams.net / draw.io left-sidebar shape palette

Cluster: **draw.io / diagrams.net** — the tool Harvey named as the reference.
Version studied: `jgraph/drawio` branch `dev`, HEAD `f3abfe0` ("31.4.5 release", 2026-09-08) and the live
app at `app.diagrams.net` opened on 2026-09-16.

Sources are the project's own code and docs. Every claim carries a URL or a repo path+symbol you can
`grep` yourself. Anything I could not confirm is marked `[UNVERIFIED]`.

Repo files are cited as `jgraph/drawio@dev:src/main/webapp/...` — read them from
`https://github.com/jgraph/drawio/blob/dev/<path>`.

---

## 1. How the left sidebar is organised

### 1.1 Three layers, not one

The panel stacks **three different kinds of thing** in one scroll container, and it is important not to
collapse them into one concept:

| Layer | What it is | Where it comes from |
|---|---|---|
| Shape search / omnibox field | An input pinned at the top, id `geOmniSearch` | `Sidebar.prototype.addSearchPalette` — `jgraph/drawio@dev:src/main/webapp/js/grapheditor/Sidebar.js` |
| Scratchpad | One user-owned library | `.scratchpad` storage file, see §3 |
| Shape libraries (palettes) | N collapsible sections, each a grid of shape thumbnails | `Sidebar.prototype.addPalette` / `addPaletteFunctions` |
| `+ More Shapes` button | Footer button opening the library-enable dialog | `Sidebar.prototype.createMoreShapes`; label resource `moreShapes=More Shapes` |

Docs confirmation of the layering: "The scratchpad is usually found at the top of the left panel, above
the shape libraries and below the *Search Shapes* field."
(<https://www.drawio.com/docs/manual/editor/panels/scratchpad/>)

### 1.2 Categories ARE collapsible sections

Each palette renders as `<a class="geTitle">` followed by a sibling `<div class="geSidebar">` holding the
thumbnails (`Sidebar.prototype.addPalette`). The fold handler is installed as the title's `click`
listener (`Sidebar.prototype.addFoldingHandler`, grapheditor/Sidebar.js) and simply flips
`content.style.display` between `''` and `'none'`, swapping an arrow-right / arrow-down background image.

Collapse state is **persisted**: the diagramly layer overrides `Sidebar.prototype.setContentVisible` to
call `editorUi.setLibraryExpanded(content._paletteId, visible)`, which writes to
`mxSettings.settings.collapsedLibraries` (`Sidebar.prototype.setContentVisible`,
`jgraph/drawio@dev:src/main/webapp/js/diagramly/Sidebar.js`; `getCollapsedLibraries` /
`setCollapsedLibraries` in `jgraph/drawio@dev:src/main/webapp/js/diagramly/Settings.js`).

Extra affordances on a section title:

- **Right-click a palette title** → a popup with `Collapse` / `Expand`, then `Collapse All` /
  `Expand All`, then `Reset` (the Reset item only shows when a custom library order is stored). Labels
  from `jgraph/drawio@dev:src/main/webapp/resources/dia.txt`: `collapse=Collapse`,
  `collapseAll=Collapse All`, `expand=Expand`, `expandAll=Expand All`, `reset=Reset`.
- **Drag a section title vertically to reorder palettes**, persisted via `mxSettings.setLibraryOrder`.
  The title tooltip is the resource string `reorder=Drag to reorder`; the hint is installed as
  `elt.setAttribute('title', mxResources.get('reorder'))` in `Sidebar.prototype.createTitle`.
- Content is **lazily built**: `Sidebar.prototype.virtualPalettes` / `virtualThumbs`
  (IntersectionObserver-gated) delay thumbnail creation until a palette scrolls into view. ChangeLog:
  "Lazy sidebar palette init for expanded shape libraries [jgraph/drawio#5690]" (30.3.9, 14-JUL-2026).
- Thumbnail cell size defaults: `Sidebar.prototype.thumbWidth = 38` / `thumbHeight = 38`; the
  Simple/Sketch themes override to `32` / `30`. Configurable via `thumbWidth` / `thumbHeight`.

### 1.3 Enabling / disabling whole libraries

Clicking `+ More Shapes` runs the `shapes` action, which opens `MoreShapesDialog`
(`jgraph/drawio@dev:src/main/webapp/js/diagramly/Menus.js`, action `'shapes'`;
dialog at `jgraph/drawio@dev:src/main/webapp/js/diagramly/Dialogs.js`, `var MoreShapesDialog`).

Dialog behaviour, read from the code:

- Title is the resource `shapes=Shapes`.
- Left column = sections; each entry is a `div.geMoreShapesItem` containing a **checkbox** plus a label.
  `checkbox.checked = editorUi.sidebar.isEntryVisible(entry.id)`.
- Right pane = a preview of the currently highlighted library (`entry.image`, or `entry.desc` text, or
  the string `noPreview`).
- **Double-clicking an entry row toggles its checkbox** (`mxEvent.addListener(option, 'dblclick', ...)`).
- Footer checkboxes: `labels=Labels` (controls whether shape names are printed under thumbnails;
  `Sidebar.prototype.sidebarTitles`) and `rememberThisSetting=Remember This Setting` (only rendered when
  `isLocalStorage || mxClient.IS_CHROMEAPP`, i.e. when the setting can actually persist).
- Footer buttons: `cancel=Cancel`, `apply=Apply`.
- On Apply: the checked IDs are joined and passed to `sidebar.showEntries(libs, remember, true)`, which
  writes `mxSettings.setLibraries(entries)` + `mxSettings.save()` when `remember` is set.
- Inline preview of the whole 66-entry dialog: the item `title` attribute is
  `entry.title + ' (' + entry.id + ')'`, so hovering `General` shows `General (general)`.

`showEntries` resolution order (important for anyone copying this): if no explicit list is given, it
prefers the `libs` URL parameter, else `mxSettings.getLibraries()`, else `Sidebar.prototype.defaultEntries`.

### 1.4 EXACT category names

**Two different name sets.** Do not conflate them.

**(a) Section names in the sidebar itself** (what the user sees as collapsible headers in a default
install). Live-read from `app.diagrams.net`, 2026-09-16, `.geTitle` elements that are visible:

```
Scratchpad, General, Misc, Advanced, Basic, Arrows, Flowchart, Entity Relation, UML
```

That matches `Sidebar.prototype.defaultEntries = 'general;uml;er;bpmn;flowchart;basic;arrows2'`
(`jgraph/drawio@dev:src/main/webapp/js/diagramly/Sidebar.js`) plus Scratchpad. Documented default in the
configuration reference: `defaultLibraries` — "The default value is
`"general;uml;er;bpmn;flowchart;basic;arrows2"`"
(<https://www.drawio.com/docs/reference/configure-diagram-editor/#libraries>).

Display titles come from resources in `jgraph/drawio@dev:src/main/webapp/resources/dia.txt` (quoted
verbatim; the key on the left is the resource key, the value is the English UI string):

| Resource key | English title |
|---|---|
| `general` | `General` |
| `misc` | `Misc` |
| `advanced` | `Advanced` |
| `basic` | `Basic` |
| `arrows` | `Arrows` |
| `flowchart` | `Flowchart` |
| `entityRelation` | `Entity Relation` |
| `uml` | `UML` |
| `scratchpad` | `Scratchpad` |
| `search` | `Search` |
| `searchShapes` | `Search Shapes` |
| `moreShapes` | `More Shapes` |

Note `General`, `Misc`, `Advanced` are all ONE config entry internally:
`{id: 'general', libs: ['general', 'misc', 'advanced']}` — enabling "General" in More Shapes turns on all
three headers at once, and `isEntryVisible('general')` returns the visibility of the *first* palette only
(`config.libs[0]`).

Only `General` is expanded on load; `Misc`, `Advanced`, `Basic`, `Arrows`, `Flowchart`, `Entity Relation`
and `UML` are collapsed. Source: `addGeneralPalette(true)`, `addMiscPalette(false)`,
`addAdvancedPalette(false)`, `addBasicPalette` → `addStencilPalette(..., false, ...)`,
`addUmlPalette(false)`, flowchart palette `false`. Confirmed live: only the `General` content div had a
non-zero height on a fresh editor.

**(b) Section names in the More Shapes dialog** — 5 groups, live-read from
`.geMoreShapesSectionHeader`:

```
Standard, Software, Networking, Business, Other
```

These are declared in `Sidebar.prototype.updateEntries` in the diagramly layer. The first group is built
as `stdEntries`; the rest are the outer array titles `mxResources.get('software')`, `networking`,
`business`, `other` (`dia.txt`: `software=Software`, `networking=Networking`, `business=Business`,
`other=Other`). The `Standard` group is `standard=Standard` and contains
`general, basic, arrows (id arrows2), clipart, flowchart` — in that order.

The dialog carried **66 entries** at the time of reading. A representative slice, quoted exactly:

```
General, Basic, Arrows, Clipart, Flowchart, Active Directory, Android, Atlassian,
Atlassian (legacy), Bootstrap, C4, Data Flow Diagram, Entity Relation, iOS, Mockups,
Sitemap, Salesforce, UML 2.5, UML, Alibaba Cloud, ...
```

Under *Software*: `C4`, `Data Flow Diagram`, `Sitemap`, `Salesforce`, `UML 2.5`, `UML`, `Mockups`, `iOS`,
`Bootstrap`, `Android`, `Active Directory`, `Atlassian`.
Under *Networking*: `AWS`, `AWS 3D`, `Azure`, `CAE`, `Cisco`, `Cisco 19`, `Cisco Safe`, `Cumulus`,
`Citrix`, `Dynamics365`, `GCP`, `GCP Icons`, `IBM`, `IBM Cloud`, `Kubernetes`, `Network 2025`,
`Network 2018`, `Office`, `OpenStack`, `Rack`, `SAP`, `Veeam`, `VMware`.
Under *Business*: `ArchiMate 4`, `Archimate 3.2`, `ArchiMate 2.1`, `BPMN 2.0`, `SysML`,
`Value Stream Mapping`.
Under *Other*: `Cabinets`, `Infographic`, `EIP`, `Electrical`, `Floorplans`, `Fluid Power (ISO 1219)`,
`GMDL`, `Process Engineering`, `Threat Modeling`, `Web Icons`, `Signs`.

**Sub-sections inside one library.** A library that ships several stencil files renders as multiple
headers with a ` / ` separator, not as nested trees. Examples from the live sidebar:

```
Azure / AI and Machine Learning, Azure / Analytics, ..., Azure / Web
BPMN 2.0  General, BPMN 2.0  Tasks, BPMN 2.0  Choreographies, BPMN 2.0  Events, BPMN 2.0  Gateways
Rack / HPE Aruba / Switches
Clipart / Computer, Clipart / Finance, ...
AWS17 / Analytics, AWS18 / …, AWS / ..., AWS (retired)
```

The separator comes from `addStencilPalette(id, title, ...)` where `title` is built as
`packageName + ' / ' + libTitle`; e.g. `BPMN 2.0 \ General` in
`jgraph/drawio@dev:src/main/webapp/js/diagramly/sidebar/Sidebar-BPMN.js`
(`this.addPalette('bpmn2General', 'BPMN 2.0 \\ General', false, ...)`) — note the source uses a
backslash, the rendered UI shows `/` `[UNVERIFIED]` where exactly the backslash is normalised.

There is **no nesting beyond one level**: `AWS / Compute` is a sibling of `AWS / Storage`, not a child.

### 1.5 Ordering and insertion rules

- Custom libraries appear **at the top of the left panel below the Scratchpad**
  (<https://www.drawio.com/docs/manual/advanced/custom-shape-libraries/>).
- `appendCustomLibraries` (config, default `false`) moves them **after** the built-ins instead
  (`Sidebar.prototype.initPalettes`: `if (!this.appendCustomLibraries) { this.addCustomEntries(); }`
  … `if (this.appendCustomLibraries) { this.addCustomEntries(); }`).
- `expandLibraries` (config, default `true`) controls whether libraries start expanded.
- `inlineExtIcons` (default `false`) embeds icon-search results as data URIs instead of URL references.

---

## 2. Search over shapes

### 2.1 The field

One input, `id="geOmniSearch"`, placeholder + tooltip = the resource `typeSlashToSearch`, whose English
value is `Type / to search` (`dia.txt`). Added by `Sidebar.prototype.addSearchPalette`.

The docs describe it as a two-in-one control:
- **type a shape name + Enter** → matching shapes appear below the field, with a `More Results`
  (`moreResults=More Results`) button. "This will search for shape that have names that match as well as
  those with alternate names that match."
  (<https://www.drawio.com/docs/manual/shapes/>)
- **the same field also** opens dialogs / applies styles / generates a diagram, and it remembers the last
  five actions you selected (<https://www.drawio.com/docs/manual/editor/panels/search-omnibox/>).
- Right-clicking a search result opens a context menu — ChangeLog: "Adds context menu for shape search
  results" (13.6.7, 08-SEP-2020); that menu offers `Search Images` (`searchImages=Search Images`,
  `addImages=Add Images`) and library actions.
- `search-shapes=value` starts the editor with a value already in the box
  (<https://www.drawio.com/doc/faq/supported-url-parameters>).

### 2.2 What search actually matches — the mechanism

Search is **tag-based**, not name-based. The index is a flat map
`Sidebar.prototype.taglist` built with `Object.create(null)` (explicit comment: "must not resolve to
inherited members", i.e. `__proto__` must not match), keyed by **lower-cased tag strings** mapping to
`{entries: [fn, …]}`.

How tags get in. Every palette item is registered through `Sidebar.prototype.addEntry(tags, fn)`.
`createVertexTemplateEntry(style, w, h, value, title, showLabel, showTitle, tags)` does:

```js
if (tags != null && title != null) { tags += ' ' + title; }
tags = (tags != null && tags.length > 0) ? tags : ((title != null) ? title.toLowerCase() : '');
```

So **the display title is always appended to the tag string**, and if no tags are supplied the title
lower-cased *is* the tag string. Example from the General palette — the Rectangle entry is registered
with the tag string `rect rectangle box`, the Diamond with
`diamond rhombus if condition decision conditional question test`, the Cylinder with
`cylinder data database`. These are visible in the source in `Sidebar.prototype.addGeneralPalette`.

So the index is: **shape display name + author-supplied synonym tags** (and, for stencil palettes, the
package and stencil names run through `Sidebar.prototype.getTagsForStencil`, which turns
`mxgraph.cisco.routers` + `Router` into `cisco`, `routers`, `router`). There is **no separate
user-editable tag model** — `tags` are baked in at palette-registration time.

### 2.3 Matching tiers and scoring

`Sidebar.prototype.searchEntries` → `matchTermEntries(term, reverseMap)` returns four tiers:

| Tier | Score | How it matches |
|---|---|---|
| `exact` | +1.0 | full tag string equals the term |
| `prefix` | +0.8 | term occurs inside a tag **at a word boundary** (`isTagMatchBoundary`: index 0, a non-alphanumeric char, or a letter↔digit transition) |
| `substring` | +0.6 | term occurs inside a tag elsewhere, but only if `term.length >= 4` (`minInnerLength`), to avoid noise |
| `phonetic` | +0.5 | `Editor.soundex(term)` (trailing digits stripped) hits a Soundex key |

Then multi-term queries attempt a strict **AND** across terms; if that fails it falls back to scoring all
single-term candidates. Each shape scores at most once per term (its best tier). Ties are broken by
`getEntrySearchWeight`, a per-library weight table, "so that entries from superseded libraries appear
after equally scored entries from their replacements" (ChangeLog 31.0.0, 23-JUL-2026).

Other index behaviour worth copying:

- **Compound tokens are split**: `splitCompoundToken('pid2misc')` → `['pid','misc']`,
  `'discInst'` → `['disc','inst']` (camelCase and letter↔digit boundaries). ChangeLog: "feat: improve
  shape search with scored fallback and compound token splitting" (29.7.0, 08-APR-2026).
- **Soundex variants of every tag are indexed too** — `addEntry` pushes
  `Editor.soundex(tmp[i].replace(/\.*\d*$/,''))` as an extra key.
- **i18n**: a reverse map from the localised resource string back to the English key
  (`getResourceReverseMap`), plus Soundex on the translation, so a translated term finds English tags.
  ChangeLog: "Improved localized shape search using fast, local reverse lookup for available resources
  [jgraph/drawio#5518]" (29.7.0).
- **Duplicate results are deduped by `elt.innerHTML`** in the render loop, and the result carries
  `result.parentLibraries` so a shape found in several libraries is reported as one thumbnail with
  multiple parents.
- **Page size is computed from panel width**, not a constant:
  `count = 4 * Math.max(1, Math.floor(this.container.clientWidth / (this.thumbWidth + 10)))` — "Shows 4
  rows (minimum 4 results)".

### 2.4 Closed libraries ARE searched

`Sidebar.prototype.searchClosedLibraries = true`. Shapes from libraries that are currently disabled are
still returned; they are rendered **dimmed** via `elt.style.opacity = this.closedLibraryOpacity` when
`isEntryIgnored(result, false)` is true. The docs echo this: search looks "in both open and closed shape
libraries" (<https://www.drawio.com/docs/manual/shapes/shape-search/>).

When a search term matches a *library name* rather than a shape, draw.io shows **library chips** above
the results — "Offers built-in libraries as chips in shape search" (ChangeLog 30.4.1, 21-JUL-2026).
Chip matching is on words of `entry.title + ' ' + entry.id`, exact for short tokens and bidirectional
prefix otherwise (`isLibraryChipMatch`); max 4 chips (`Sidebar.prototype.maxSearchResultChips = 4`),
with stopwords `['and','the','for','with','off','from']` and an exclusion list starting
`['uml','aws3','aws4b','aws4r','cisco', ...]`. Clicking a chip calls `enableLibraryEntry(id)`, which
turns the library on, persists the change exactly like the More Shapes dialog, and scrolls to it.

### 2.5 Remote / icon search

Shape search merges in results from **draw.io's own icon service**: `getIconSearchUrl(...)` is queried
when `isIconServiceEnabled()` and fewer than `count / 4` local results were found
(`Sidebar-diagramly.js`). The response is JSON with `images` and optional `sets`; matched *sets* are
offered so a user can install a whole icon set from the result list.

Limitations, quoted from the docs: "External clipart libraries are only available via draw.io's servers.
These are not searchable if you are using the following: draw.io Desktop application; draw.io app for
Atlassian Confluence or Jira Data Center; `lockdown` option to restrict data transmission."
(<https://www.drawio.com/docs/manual/shapes/shape-search/>)

A second, separate search mode exists: "**Search Images**" (omnibox menu item) bypasses the local index
entirely and queries the icon provider directly (`imagesOnly` flag → `searchIcons`).
ChangeLog: "Add Search Images option to shape search omnibox [jgraph/drawio#5294]" (30.2.6, 24-JUN-2026).

### 2.6 Custom libraries are indexed too

`EditorUi.prototype.libraryLoaded` calls
`this.sidebar.setCurrentSearchEntryLibrary(file.getHash(), file.getHash())` before adding the library's
entries, so every shape in an open custom library is registered into `taglist` with the library as its
`parentLibraries`. A `<mxlibrary>` node's optional `tags` attribute is applied to all its entries
(<https://www.drawio.com/docs/reference/format-custom-shape-library/>). URL-backed custom libraries are
preloaded into the index up to `Sidebar.prototype.maxPreloadCount = 20` unless the entry sets
`"prefetch": true`.

---

## 3. What the SCRATCHPAD actually is (and what it is NOT)

This is the section that matters most for the redesign, because Harvey's brief describes something
*different*.

### 3.1 draw.io's own definition

> "The scratchpad is your personal shape library where you can add the styled shapes or groups of shapes
> that you use the most often. You can drag a shape/group of shapes from the drawing canvas onto your
> scratchpad, and then drag new copies from the scratchpad back onto the drawing canvas whenever you need
> them."
> — <https://www.drawio.com/docs/manual/editor/panels/scratchpad/>

Also called "This temporary shape library" in the shapes-panel page
(<https://www.drawio.com/docs/manual/editor/panels/shapes-panel/>). So the docs themselves are ambiguous
in tone ("personal shape library" / "temporary shape library"), but the **mechanism is unambiguous**.

### 3.2 The mechanism, precisely

| Aspect | Reality | Source |
|---|---|---|
| What can be added | **Only shapes/groups that already exist on the drawing canvas.** Drag them onto the scratchpad, or select them and click the `+` in the scratchpad header. There is no "add this palette item to scratchpad" affordance. | docs above; `EditorUi.prototype.libraryLoaded` installs the `+` button and sets `this.addSelectionToScratchpad = addSelection` only when `file.title == '.scratchpad'` |
| Where it is stored | IndexedDB database `database`, object store `files` (keyPath `title`), key `.scratchpad`; falls back to `localStorage` when IndexedDB is unavailable | `EditorUi.prototype.openDatabase` (`indexedDB.open('database', 2)`, `db.createObjectStore('files', {keyPath: 'title'})`); `StorageFile.getFileContent` → `ui.getDatabaseItem(title, …, 'files')`, else `ui.getLocalData(title, success)` |
| Data format | Exactly the same `<mxlibrary>` XML as a custom shape library — `EditorUi.prototype.emptyLibraryXml = '<mxlibrary>[]</mxlibrary>'` | `EditorUi.prototype.emptyLibraryXml`; `toggleScratchpad` resets to it when content is null or starts with `<mxfile` |
| How it is modelled | As a `StorageLibrary` file whose hash is `'L.scratchpad'` | `StorageLibrary.prototype.getHash` → `'L' + encodeURIComponent(this.title)`; `EditorUi.prototype.toggleScratchpad` → `this.loadLibrary(new StorageLibrary(this, xml, '.scratchpad'))` |
| Autosave | Yes — `StorageLibrary.prototype.isAutosave` returns `true` | `jgraph/drawio@dev:src/main/webapp/js/diagramly/StorageLibrary.js` |
| Visibility | Toggled via `View > Scratchpad` (menu item `scratchpad`, a toggle action whose selected-state is `editorUi.scratchpad != null`) | `jgraph/drawio@dev:src/main/webapp/js/diagramly/Menus.js`, action `'scratchpad'`; docs: `View > Scratchpad` |
| Not available when | `isScratchpadEnabled()` is `isLocalStorage \|\| mxClient.IS_CHROMEAPP` — i.e. it needs local browser storage | `EditorUi.prototype.isScratchpadEnabled` |
| Entries are untitled by default | "By default, shapes added to the scratchpad are untitled." Rename by editing the library (pencil icon), where each entry also gets a delete cross and drag-to-reorder. | docs, scratchpad page |
| Export | Edit pencil → **Export** → saves an `.xml` (`.drawiolib, .xml` are the registered library file types) — the scratchpad's content becomes an ordinary custom shape library | docs; `Editor.prototype.libraryFileTypes = [{description: 'Library (.drawiolib, .xml)', extensions: ['drawiolib','xml']}]` |
| Durability warning | "The Scratchpad contents are saved in your browser - if you clear your browser's cookies and browsing data, any shapes stored in the Scratchpad will be deleted. Make sure you export the scratchpad to a custom shape library if you want to keep these shapes." | <https://www.drawio.com/docs/manual/editor/panels/shapes-panel/> |
| Context-menu insertion | `addToScratchpad` is in the canvas right-click menu when a selection exists (`this.actions.get('addToScratchpad').setEnabled(ss.cells.length > 0)`) | `jgraph/drawio@dev:src/main/webapp/js/diagramly/Menus.js`, `EditorUi.js` |

### 3.3 The precise difference from what Harvey asked for

Harvey's scratchpad = **"a place to keep the shapes the user LIKES"** — a favourites library.

draw.io's scratchpad is:

1. **Canvas-first, not palette-first.** You cannot favourite a built-in palette item directly. You must
   first drop a rectangle onto the canvas, then drag that instance onto the scratchpad. A palette-only
   workflow is impossible.
2. **A snapshot store, not a reference store.** What is saved is a *copy of the styled cell*, including
   its colour and label. Two users favouriting "the same" `Rectangle` get differently-styled entries.
   (This is arguably good for Diagram Studio, whose colour keys already decouple style from shape.)
3. **One flat bucket.** No groups, no sub-sections, no reordering across categories beyond manual
   drag-reorder inside the single grid, no per-entry tags beyond the export path.
4. **Volatile by design** — the docs call it "temporary" and direct you to export to a *custom library*
   for anything you want to keep or share.
5. **Not searched by name.** Entries are untitled until you name them, and the naming UI is a separate
   "edit mode" behind the pencil icon.

So in Diagram Studio terms: draw.io's scratchpad is closest to **"pin a canvas instance"**, while
Harvey's is **"star a palette definition"**. A favourites library should be built as a *reference* to a
palette descriptor (`{shape, colorKey, kind, size}`), persisted the same way boards are, and should be
addable from the palette itself with a star/pin affordance — three properties draw.io's scratchpad does
not have.

Worth borrowing anyway: export/import of the favourites set as a single file (draw.io's `.xml`
round-trip is the mechanism that makes the scratchpad shareable at all), and a `+`/edit mode with
rename + reorder.

---

## 4. How CUSTOM SHAPES work

draw.io has **three distinct** custom-shape mechanisms. They are not variations of one feature.

### 4.1 Inline stencil: `shape=stencil(<value>)`

The style key can carry a whole shape definition inline:

> "Adds custom stencils defined via `shape=stencil(value)` style. The value is a base64 encoded,
> compressed and URL encoded XML definition of the shape according to the stencil definition language of
> mxGraph."
> — `jgraph/drawio@dev:src/main/webapp/js/grapheditor/Graph.js`,
> `mxCellRenderer.prototype.createShape` override

Decoding is `mxUtils.parseXml(Graph.decompress(stencil))` → `new mxShape(new mxStencil(doc.documentElement))`.
The editor's own default for a newly created custom shape is
`EditorUi.prototype.defaultCustomShapeStyle = 'shape=stencil(<base64>);whiteSpace=wrap;html=1;'`
(`jgraph/drawio@dev:src/main/webapp/js/diagramly/EditorUi.js`).

Created interactively via `Arrange > Insert > Shape` — "the *Edit Shape* dialog where you can see the XML
structure of the shape (stencil)" (`EditShapeDialog`,
`jgraph/drawio@dev:src/main/webapp/js/diagramly/Dialogs.js`). The dialog has a **Preview** button and
writes back with `targetGraph.setCellStyles(mxConstants.STYLE_SHAPE, 'stencil(' + newValue + ')', [targetCell])`.

**Consequence:** the shape definition lives *in the board file*, in the cell's style string. No external
file, no registry — but also nothing to reuse across boards except by copy-paste or by saving into a
library.

### 4.2 Named stencil sets: `shape=mxgraph.<package><stencil>`

A stencil XML file is registered into a global registry:

```js
mxStencilRegistry.addStencil(packageName + stencilName.toLowerCase(), new mxStencil(shape));
```

where `packageName` is the `<shapes name="...">` attribute lower-cased plus a `.`, and `stencilName` is
the `<shape name="...">` attribute with spaces replaced by `_`
(`mxStencilRegistry.parseStencilSet` in `jgraph/drawio@dev:src/main/webapp/js/grapheditor/Graph.js`).

Examples in the shipping files:

- `src/main/webapp/stencils/flowchart.xml` opens `<shapes name="mxGraph.flowchart">` →
  the palette entry style is `shape=mxgraph.flowchart.annotation_1`
- `src/main/webapp/stencils/basic.xml` opens `<shapes name="mxgraph.basic">` →
  `shape=mxgraph.basic.4_point_star`

The palette registration is mechanical — `Sidebar.prototype.addStencilPalette`:

```js
mxStencilRegistry.loadStencilSet(stencilFile, function(packageName, stencilName, displayName, w, h) {
    fns.push(this.createVertexTemplateEntry('shape=' + packageName + stencilName.toLowerCase() + style,
        Math.round(w * scale), Math.round(h * scale), '', stencilName.replace(/_/g, ' '), null, null,
        this.filterTags(tmp.join(' '))));
}, true, true);
```

Note the **thumbnail size comes from the stencil's own `w`/`h` attributes**, not from a constant:
`parseStencilSet` passes `w`/`h` and defaults both to `80` when absent.

The registry explicitly uses a null-prototype map: "The stencils map has no prototype so that stencil
names from untrusted cell styles or library files cannot resolve or overwrite inherited members of
Object.prototype (eg. `__proto__` or `constructor`)"
(`jgraph/drawio@dev:src/main/webapp/mxgraph/src/shape/mxStencilRegistry.js`). ChangeLog 31.0.0 also
records a security fix: "Fixes crafted-diagram DoS from prototype-member shape/marker/style names".

`mxStencil.allowEval = false` by default; the editor keeps it off when offline
(`mxStencilRegistry.allowEval = mxStencilRegistry.allowEval && !this.isOfflineApp()`).

### 4.3 Custom libraries: the `<mxlibrary>` file

This is the persistence format that matters.

> "A custom library file is an XML file, which must have an enclosing `<mxlibrary>` node containing a
> JSON array and follow a specific format. The node has an optional `tags` attribute for searching
> library entries in the sidebar."
> — <https://www.drawio.com/docs/reference/format-custom-shape-library/>

Required properties per entry: `h` (height px), `w` (width px), and **either `<xml>` or `<data>`**.

- `<xml>` — an `<mxGraphModel>` description of the shape, group or whole diagram. May be compressed
  (raw base64) or uncompressed (**then it must be escaped**: `<`→`&lt;`, `>`→`&gt;`, `"`→`\"`).
  Set `compressXml=true` in configuration to compress on export by default.
- `<data>` — an image, as a data URI, e.g. `"data:image/png,[...]"`. Requires the sibling attributes
  `"aspect"` (`"fixed"` locks the ratio) and `"style"` (extra style keys appended to the default image
  cell style, e.g. `"resizable=0;rotatable=0;"` to prevent resizing and rotating).

Optional per entry: `"title"` (hover text) and `"tags"` (space-separated; **all tags from the library are
added to each entry**).

Reference implementations from the project's own repo:
`https://raw.githubusercontent.com/jgraph/drawio-libs/review/libs/templates.xml` (xml properties, whole
template diagrams) and
`https://raw.githubusercontent.com/jgraph/drawio-libs/review/libs/chart-icons.xml` (data properties, icons).

**Reading side**, from `EditorUi.prototype.loadLibrary`:

```js
var doc = mxUtils.parseXml(file.getData());
if (doc.documentElement.nodeName == 'mxlibrary') {
    var images = JSON.parse(mxUtils.getTextContent(doc.documentElement));
    this.libraryLoaded(file, images, doc.documentElement.getAttribute('title'),
        expand, doc.documentElement.getAttribute('tags'));
} else { throw {message: mxResources.get('notALibraryFile')}; }
```

**Writing side**, `EditorUi.prototype.createLibraryDataFromImages` builds
`<mxlibrary>` + `JSON.stringify(images, null, 2)`, uncompressing entries first when
`!Editor.defaultCompressed`.

**Rendering side**, `EditorUi.prototype.addLibraryEntries` branches per entry:

- `img.data != null` → style string
  `'shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;'`
  `+ (img.aspect=='fixed' ? 'aspect=fixed;' : '') + 'image=' + data + ';' + (img.style||'')`
- `img.xml != null` → `this.stringToCells(img.xml.charAt(0)=='<' ? img.xml : Graph.decompress(img.xml))`
  and, on failure, a placeholder thumbnail whose title is the error message.

**Where custom libraries live on disk / in the browser.** This is the part worth copying exactly:

| Storage kind | Hash prefix | Class |
|---|---|---|
| Local library file (IndexedDB `files` store) | `F` + title | `LocalLibrary.prototype.getHash` |
| Storage library — scratchpad and other browser-stored libraries | `L` + `encodeURIComponent(title)` | `StorageLibrary.prototype.getHash` |
| Custom library loaded from a URL | `U` + `encodeURIComponent(title)` | `UrlLibrary.prototype.getHash` |
| Remote/Atlassian library | `R` + JSON of `[id, title, downloadUrl]` | `RemoteLibrary.prototype.getHash` |

The **list of open custom libraries** is a single array in browser settings:
`mxSettings.settings.customLibraries`, stored in `localStorage` under the key
`'.drawio-config'` (`Editor.settingsKey = '.drawio-config'`; `mxSettings.save()` does
`localStorage.setItem(mxSettings.key, JSON.stringify(mxSettings.settings))`). `addCustomLibrary(id)`
prepends `'L.scratchpad'` so the scratchpad always sits directly under Search, and appends everything
else. `removeCustomLibrary(id)` splices it out. `EditorUi.prototype.closeLibrary` removes it *unless* the
file is a `LocalLibrary`.

That gives a clean, copyable model for Diagram Studio: **two stores — a blob store keyed by library
title, and a small settings object holding an ordered array of library IDs.** Not a directory of files
per library.

### 4.4 The stencil XML language (what a custom shape is made of)

Documented in full at <https://www.drawio.com/docs/tutorials/custom-shapes/> and
<https://www.drawio.com/docs/manual/shapes/shape-complex-create-edit/>. The XSD is at
<https://jgraph.github.io/mxgraph/docs/stencils.xsd>. Summary of the contract:

```
<shape name="..." w="100" h="100" aspect="variable|fixed" strokewidth="inherit|N">
  <connections> <constraint x="0.5" y="0" perimeter="0|1" name="N"/> ... </connections>
  <background> one of <path>|<rect>|<roundrect>|<ellipse>, OR EMPTY </background>
  <foreground> <stroke/>|<fill/>|<fillstroke/> then geometry ... </foreground>
</shape>
```

Non-obvious rules stated in the docs, verbatim where they matter:

- "`aspect` - optional string with the value of either `"variable"`, the default, or `"fixed"`. *Fixed*
  always renders the shape with the aspect ratio defined by the ratio `w/h`. *Variable* causes the ratio
  to match that of the geometry of the current vertex."
- "The `<background>` element can only contain one `<path>`, `<rect>`, `<roundrect>` or `<ellipse>`
  element (or none). It can not contain any *fill*, *stroke*, *image*, *text* or *include-shape*."
- "Any *stroke*, *fill* or *fillstroke* of a background must be defined as the first stroke of the
  `<foreground>` element, and never in the `<background>` element."
- "The first element of geometry (the background) will use the shadow style if needed, but the rest will
  not."
- Coordinate system: "`0,0` is always the top left point. The bottom right is `w, h`."
- Styling follows an HTML5-canvas-like **state stack**: `<save/>` / `<restore/>`, and "The number of
  `<save/>` and `<restore/>` elements should match."
- Custom colours: `fillColorStyles` / `strokeColorStyles` in the cell style hold comma-separated style
  names (e.g. `fillColorStyles=ellipseFill,rectangleFill;`); the color picker exposes them and the
  stencil references them as `<fillcolor color="ellipseFill"/>`. `default` resolves to
  `shapeBackgroundColor` for `fillcolor` and `shapeForegroundColor` for everything else.
- Text can go in background or foreground, "but be aware that background text may be hidden by foreground
  elements, especially when those geometries are filled."

---

## 5. What RULES draw.io imposes so custom shapes don't break layout

This is the "không phá layout" question. The rules are mostly *opt-in style keys* plus *defaults that
keep a shape sane*, not validation that rejects a bad shape.

### 5.1 Aspect ratio

| Mechanism | Effect | Source |
|---|---|---|
| `<shape aspect="variable">` | Shape stretches to whatever box it is given. **This is the default.** | docs, custom-shapes |
| `<shape aspect="fixed">` | "always renders the shape with the aspect ratio defined by the ratio `w/h`" — resizing cannot distort it | docs |
| `aspect=fixed;` as a **cell style key** | Locks the cell's own ratio; used by draw.io itself for `Square` and `Circle` palette entries (`'whiteSpace=wrap;html=1;aspect=fixed;'`, `'ellipse;whiteSpace=wrap;html=1;shapeInside=1;aspect=fixed;'`) | `Sidebar.prototype.addGeneralPalette` |
| `imageAspect=0;` | Applied by the editor to every image-shape it creates from a library, alongside `verticalLabelPosition=bottom;verticalAlign=top;` | `EditorUi.prototype.addLibraryEntries` |

### 5.2 Fixed-size / no-stretch shapes

`fixedSize=1;` is applied by draw.io to built-ins whose geometry *must* keep proportions:
`Parallelogram`, `Hexagon`, `Step`, `Trapezoid`, `Data Storage` — all registered as
`'shape=…;whiteSpace=wrap;html=1;shapeInside=1;fixedSize=1;'`. A custom shape that copies one of these
should carry the same key.

### 5.3 Stroke width under resize vs scale

- `<shape strokewidth="inherit">` — "indicates that the *strokewidth* of the cell is only changed when you
  scale it, and not when you resize it."
- A numeric `strokewidth` "defines the multiplier that is applied to the width. The default is `"1"`."
- In the stencil body, `<strokewidth fixed="1"/>` "apply the value as-is, with no scaling."
- Every stencil shipped in `stencils/` uses `strokewidth="inherit"`.

### 5.4 Connection points — the layout contract

`<connections>` with `<constraint x y perimeter name>` is how a custom shape tells the connector router
where edges may attach. The shipped stencil files give every shape the full compass set:

```xml
<background>...<shape name="Annotation 1" h="98" w="50" aspect="variable" strokewidth="inherit">
<connections>
  <constraint x="0.5" y="0" perimeter="0" name="N"/>
  <constraint x="0.5" y="1" perimeter="0" name="S"/>
  <constraint x="0" y="0.5" perimeter="0" name="W"/>
  <constraint x="1" y="0.5" perimeter="0" name="E"/>
  <constraint x="0" y="0" perimeter="0" name="NW"/>
  <constraint x="0" y="1" perimeter="0" name="SW"/>
  <constraint x="1" y="0" perimeter="0" name="NE"/>
  <constraint x="1" y="1" perimeter="0" name="SE"/>
</connections>
```

Rules from the docs:
- `perimeter` — "required, either `1` or `0`. A value of `0` sets the connection point where specified by
  `x,y`. A value of `1` extrapolates the position of the connection point from the center of the shape,
  through `x,y`, to the point of intersection with the perimeter of the shape."
- `x,y` are **relative**: `(0,0)` top-left, `(0.5,0.5)` centre, `(1,0.5)` centre of right edge. Values
  outside `0..1` are allowed to place a point outside the shape.
- `name` is an optional unique port identifier.
- Cell-style override: `points=[[x,y],…]` on any shape "override the default connection points". Optional
  3rd–5th coordinates exist (`points=[[x0,y0,p0,dx0,dy0],…]`) but the docs call the third "only used for
  development purposes".
- A **visual editor** exists for this: right-click a shape → `Edit Connection Points`, add/move/delete
  points, and the docs explicitly suggest doing this before saving a shape into a custom library so
  "connectors attach to logical positions".

### 5.5 Grid snapping

- `mxGraph.prototype.gridSize = 10` and `mxGraph.prototype.gridEnabled = true` are mxGraph defaults
  (`jgraph/drawio@dev:src/main/webapp/mxgraph/src/view/mxGraph.js`).
- The default editor grid is documented as "10pts, and is a light grey"
  (<https://www.drawio.com/docs/manual/editor/panels/editor-grid-change/>), and the configuration key is
  `defaultGridSize` — "The default grid size for new diagrams. The default is `10`"
  (<https://www.drawio.com/docs/reference/configure-diagram-editor/#grid-page-and-zoom>).
- Snapping itself is `mxGraph.prototype.snap(value)`: `Math.round(value / this.gridSize) * this.gridSize`
  when `gridEnabled`.
- **`Graph.prototype.snapCellsToGrid(cells, gridSize)`** rounds x, y, **width and height** of every vertex
  and every edge waypoint to the grid — this is the "don't break layout" primitive: a shape whose natural
  size is off-grid gets forced onto the grid as a unit.
- Auto-layout post-processing deliberately snaps the **bounding box once and translates the cluster
  uniformly**, with an in-source comment explaining why per-cell snapping breaks alignment: "rounding
  159 → 160 and 144 → 140 independently shifts the centers 5px apart."
- `gridEnabled = false` is used for **offscreen thumbnail rendering** (`Graph.createOffscreenGraph`), so
  palette thumbs are pixel-accurate, not snapped.
- The Sketch theme disables the grid by default (`if (urlParams['grid'] == null) graph.defaultGridEnabled = false;`
  in `EditorUi.prototype.switchThemeConstants`), and `defaultGridEnabled` is configurable.

### 5.6 Other guard rails

- **`resizable=0; rotatable=0;`** — recommended in the library format doc for `<data>` image entries:
  `"style": "resizable=0;rotatable=0;"` "to prevent resizing and rotating the image". draw.io uses
  `rotatable=0;` on its own internal scaffolding cells (`edgeLabel;resizable=0;…`, list items, dividers).
- **`minSvgStrokeWidth` / `thumbAntiAlias`** — the sidebar's temporary render graph clamps stroke width
  (`this.graph.cellRenderer.minSvgStrokeWidth = this.minThumbStrokeWidth;`, default `1`, `1.3` in one
  theme branch) and can disable anti-aliasing, so a hairline custom shape does not vanish in a 38×38
  thumbnail.
- **`ignoredStyles`** — when computing a shape's search/identity key, `getKeyStyle` strips
  `['html','whiteSpace','aspect','points','verticalLabelPosition','labelPosition','outlineConnect']`
  plus all of `Graph.cellStyles`. Copying this list is a good way to decide which style keys are
  "cosmetic" vs "identity" for a Diagram Studio favourites entry.
- **Security**: stencil registry and tag list both use `Object.create(null)` against prototype pollution;
  the library file must have an `<mxlibrary>` root or the loader throws `notALibraryFile`
  (`notALibraryFile=Not a library file`).
- **Empty libraries never get stored**: `EditorUi.prototype.emptyLibraryXml = '<mxlibrary>[]</mxlibrary>'`,
  and the editor suppresses storing an empty scratchpad. ChangeLog: "Ignores invalid scratchpad data
  [jgraph/drawio-desktop#2341]" (29.6.2, 16-MAR-2026).

### 5.7 What draw.io does **NOT** enforce

Honest counterpoint, so the design does not over-promise:

- There is **no validation pass** over a custom library. A malformed `<xml>` entry does not fail the
  load — `addLibraryEntries` catches per entry and renders a thumbnail whose title is the error text.
- There is **no size constraint** beyond the `w`/`h` in the file; a badly-scaled `w`/`h` just produces a
  badly-scaled thumbnail.
- Nothing prevents a custom shape from having zero connection points, in which case connectors fall back
  to floating attachment on the perimeter.
- Nothing prevents an off-grid natural size; snapping is applied at placement/drag time, not at load time.

---

## Recommendation (this cluster only)

For Diagram Studio's palette redesign, take these five things from draw.io and leave the rest.

1. **Adopt the two-level model exactly: collapsible palette sections, one level deep, with category
   headers that are plain strings.** draw.io's categories are `General`, `Misc`, `Advanced`, `Basic`,
   `Arrows`, `Flowchart`, `Entity Relation`, `UML` — short, un-capitalised-beyond-first-word, no prefix
   decoration. A `Parent / Child` string (as in `Azure / Compute`) is the right answer for Diagram
   Studio's `architecture` preset, because it avoids building a tree component for one level of nesting.
   Persist only `collapsedLibraries: {id: bool}` and `libraryOrder: [id]` — two small objects — rather
   than a layout blob.

2. **Make every item carry a tag string, and index by tag, not by label.** draw.io's rule is one line and
   it works: `tags = tags || title.toLowerCase()`, then append the title to any supplied tags. For
   Diagram Studio's 19 shapes that means adding a synonym line per entry (the existing `hint` field is a
   good place). Implement the tiered scorer (exact 1.0 / word-boundary 0.8 / substring 0.6 / phonetic
   0.5) and **search across disabled groups too, rendering them dimmed** — that is draw.io's single best
   palette idea, because a user who collapsed a group still finds its shapes.

3. **Build the favourites store as a REFERENCE list, deliberately NOT a copy.** This is where Harvey's
   requirement diverges from draw.io, and the divergence should be documented in the code: draw.io's
   scratchpad stores *styled cell snapshots that only exist after being placed on the canvas*
   (`<mxlibrary>` `<xml>` entries, autosaved to IndexedDB `database`/`files`, hash `L.scratchpad`).
   A Diagram Studio favourite should instead store the palette identity — `{shape, colorKey, kind, size}`
   — so that a theme change recolours favourites exactly as it recolours the board, and a favourite can
   be added **from the palette itself** without a round-trip through the canvas. Add a star/pin control
   on each palette item; that control is the entire feature Harvey asked for and draw.io simply does not
   have.

4. **Copy draw.io's two-store persistence shape for user material:** a per-record blob store (draw.io:
   IndexedDB `database`, store `files`, keyPath `title`) plus a small ordered-ID array in settings
   (draw.io: `localStorage['.drawio-config'].customLibraries`, IDs prefixed `F`/`L`/`U`/`R` by origin).
   Diagram Studio already has the equivalent split — `<boards>/<id>.json` for blobs. A
   `<favourites>.json` for the set plus one file per custom shape is the same architecture, and it stays
   "on the local machine" as required.

5. **For the custom-element feature, constrain the input to the two formats that cannot break layout,
   and enforce the four keys that matter.** Accept (a) the palette item's own descriptor for favourites,
   and (b) an icon imported as SVG/PNG with **`aspect=fixed` plus an explicit `w`/`h`** — draw.io's own
   rule for `<data>` library entries is exactly `aspect` + `style` + `w` + `h`, with
   `resizable=0;rotatable=0;` available to make an asset inert. Enforce: a fixed aspect ratio on any
   imported image, a declared natural size, an explicit connection-point count, and grid-rounding of
   size at placement (draw.io's `snapCellsToGrid` rounds width/height as well as x/y). Do **not** copy
   draw.io's un-validated `aspect="variable"` default for user-supplied art — that is the one default
   that lets a custom shape wreck a layout.

Explicitly do **not** copy: the 66-entry More Shapes dialog with five nested groups (over-engineered for
a handful of presets — a simple flat checkbox list is enough), the Soundex phonetic tier (it is the
lowest-value/highest-complexity part of the scorer), or the remote icon service (a network dependency
that contradicts the local-first requirement and is disabled in the desktop build anyway).

---

## Sources

**Docs (drawio.com)**
- Shapes panel — https://www.drawio.com/docs/manual/editor/panels/shapes-panel/
- Work with shapes — https://www.drawio.com/docs/manual/shapes/
- Search the shape libraries — https://www.drawio.com/docs/manual/shapes/shape-search/
- Search omnibox — https://www.drawio.com/docs/manual/editor/panels/search-omnibox/
- Scratchpad — https://www.drawio.com/docs/manual/editor/panels/scratchpad/
- Custom shape libraries — https://www.drawio.com/docs/manual/advanced/custom-shape-libraries/
- Custom shape library file format — https://www.drawio.com/docs/reference/format-custom-shape-library/
- Create custom shapes (tutorial) — https://www.drawio.com/docs/tutorials/custom-shapes/
- Create and edit complex custom shapes — https://www.drawio.com/docs/manual/shapes/shape-complex-create-edit/
- Customise connection points — https://www.drawio.com/docs/manual/shapes/shape-connection-points-customise/
- Extra icon sets — https://www.drawio.com/docs/manual/shapes/extra-icon-sets/
- Public custom libraries — https://www.drawio.com/docs/manual/shapes/public-custom-libraries/
- Configure the draw.io editor — https://www.drawio.com/docs/reference/configure-diagram-editor/
- Supported URL parameters — https://www.drawio.com/doc/faq/supported-url-parameters
- Change the diagram editor grid — https://www.drawio.com/docs/manual/editor/panels/editor-grid-change/
- Getting started (editor layout) — https://www.drawio.com/docs/getting-started/
- Shape library shortcuts — https://www.drawio.com/docs/reference/shortcuts/shortcut-shape-library/
- Quick add shapes — https://www.drawio.com/docs/manual/shapes/quick-add-shapes/
- XSD for the stencil language — https://jgraph.github.io/mxgraph/docs/stencils.xsd

**Source (jgraph/drawio, branch `dev`, HEAD f3abfe0)**
- `src/main/webapp/js/grapheditor/Sidebar.js` — `Sidebar` ctor, `createMoreShapes`, `addSearchPalette`,
  `addGeneralPalette`, `addMiscPalette`, `addAdvancedPalette`, `createAdvancedShapes`, `addUmlPalette`,
  `addEntry`, `addEntryForTag`, `addPalette`, `addPaletteFunctions`, `createTitle`, `addFoldingHandler`,
  `createVertexTemplate`, `createVertexTemplateEntry`, `createVertexTemplateFromCells`,
  `createEdgeTemplateEntry`, `addImagePalette`, `addStencilPalette`, `getTagsForStencil`, `getKeyStyle`,
  `isEntryIgnored`, `matchPartialEntries`, `matchTermEntries`, `searchEntries`, `getEntrySearchWeight`,
  `splitCompoundToken`, `isTagMatchBoundary`, `thumbWidth`, `thumbHeight`, `searchClosedLibraries`,
  `maxSearchResultChips`, `libraryChipStopwords`, `libraryChipExcluded`
- `src/main/webapp/js/diagramly/Sidebar.js` — `libAliases`, `defaultEntries`, `configuration`,
  `updateEntries`, `showPalettes`, `showPalette`, `getConfigurationById`, `isEntryVisible`,
  `addCustomEntries`, `initPalettes`, `installPaletteDragReorder`, `setContentVisible` override,
  `setAllPalettesExpanded`, `isLibraryChipMatch`, `enableLibraryEntry`, `updateSearchIndex`,
  `searchEntries` override
- `src/main/webapp/js/diagramly/EditorUi.js` — `emptyLibraryXml`, `defaultCustomShapeStyle`,
  `isScratchpadEnabled`, `toggleScratchpad`, `createLibraryDataFromImages`, `closeLibrary`, `loadLibrary`,
  `libraryLoaded`, `addLibraryEntries`, `openDatabase`, `getDatabaseItem`, `switchThemeConstants`
- `src/main/webapp/js/diagramly/Dialogs.js` — `MoreShapesDialog`, `EditShapeDialog`
- `src/main/webapp/js/diagramly/Menus.js` — actions `'shapes'`, `'createShape'`, `'scratchpad'`,
  `'addToScratchpad'`
- `src/main/webapp/js/diagramly/Settings.js` — `getLibraries`, `setLibraries`, `addCustomLibrary`,
  `removeCustomLibrary`, `getCustomLibraries`, `getCollapsedLibraries`, `getLibraryOrder`, `getDefaults`,
  `save`
- `src/main/webapp/js/diagramly/StorageFile.js` — `getFileContent`, `listLocalStorageFiles`, `migrate`
- `src/main/webapp/js/diagramly/{Local,Storage,Url,Remote}Library.js` — `getHash`, `isAutosave`
- `src/main/webapp/js/diagramly/Editor.js` — `settingsKey`, `configurationKey`, `libraryFileTypes`
- `src/main/webapp/js/diagramly/App.js` — `loadLibraries`
- `src/main/webapp/js/grapheditor/Graph.js` — `snapCellsToGrid`, `mxStencilRegistry.loadStencilSet`,
  `loadStencil`, `parseStencilSet`, `getBasenameForStencil`, `libraries`,
  `mxCellRenderer.prototype.createShape` (`shape=stencil(...)`), `createOffscreenGraph`,
  `defaultGridEnabled`
- `src/main/webapp/mxgraph/src/shape/mxStencilRegistry.js` — `stencils` (null-proto map), `addStencil`,
  `getStencil`
- `src/main/webapp/mxgraph/src/shape/mxStencil.js` — `desc`, `allowEval`
- `src/main/webapp/mxgraph/src/view/mxGraph.js` — `gridSize = 10`, `gridEnabled = true`, `snap`,
  `isGridEnabledEvent`
- `src/main/webapp/resources/dia.txt` — English UI strings (quoted in §1.4, §2.1)
- `src/main/webapp/resources/dia_de.txt` — used only to confirm the resource keys are localised
- `src/main/webapp/stencils/flowchart.xml`, `src/main/webapp/stencils/basic.xml` — `<shapes name>` /
  `<shape name h w aspect strokewidth>` / `<connections>` shapes
- `src/main/webapp/js/diagramly/sidebar/Sidebar-BPMN.js` — `addBpmn2Palette`, `'BPMN 2.0 \ General'` etc.
- `src/main/webapp/js/diagramly/sidebar/CLAUDE.md` — sidebar architecture note (60+ `Sidebar-*.js`
  modules compiled into `sidebar.min.js`; palette framework lives in `grapheditor/Sidebar.js`)
- `ChangeLog` — dated release notes cited inline above
- GitHub tree listing — https://api.github.com/repos/jgraph/drawio/git/trees/dev?recursive=1

**Live observation**
- `https://app.diagrams.net/` opened 2026-09-16: visible `.geTitle` headers, the `More Shapes` dialog's
  five `.geMoreShapesSectionHeader` values and 66 `.geMoreShapesItem` labels, the
  `#geOmniSearch` placeholder `Type / to search`, and the default expanded/collapsed state of each
  palette, were all read from the live DOM.
