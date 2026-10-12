# Settings / Preferences survey — mature diagramming & whiteboard tools

Scope: what settings real tools expose, so we can decide what belongs in Diagram Studio's Settings
modal nav (Appearance / Canvas / Connections / Editor / Export / Keyboard / About + search).
Every row is grounded in official docs, the product's own settings UI (inspected live where possible),
or the product's own README/schema. Where verification failed, it is marked **UNVERIFIED** rather than guessed.

Methods note: Excalidraw's Preferences submenu, draw.io's *Configuration* and *Preferences* dialogs were
read directly from the running apps in a browser. Everything else is from official documentation pages.

---

## 1. Per-tool table

### Excalidraw — URL: https://excalidraw.com/ (menu → Preferences); component API: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/

| Category | Notable settings (verified in the live Preferences UI) |
| --- | --- |
| Appearance | **Theme** (light/dark/system toggle in main menu); **Canvas background** (colour picker in main menu); `theme` prop (`"light"`/`"dark"`) |
| Interaction / editor | **Select on** = Wrap \| Overlap; **Input** = Trackpad \| Mouse; **Tool lock** (`Q`); **Snap to objects** (`Alt+S`); **Arrow binding**; **Snap to midpoints** |
| View | **Toggle grid** (`Ctrl+'`, `gridModeEnabled` prop); **Zen mode** (`Alt+Z`, `zenModeEnabled`); **View mode** (`Alt+R`, `viewModeEnabled`) |
| Panels | **Canvas & Shape properties** (`Alt+/`) |
| Language | 30+ interface languages in menu (component prop `langCode`) |
| Data/persistence | Drawings auto-saved to browser storage; "Save to…" file export (menu); **library** items; `UIOptions.canvasActions` to show/hide export/load/save/clear actions in the component |
| Component-level (library props) | `detectScroll`, `handleKeyboardGlobally`, `autoFocus`, `validateEmbeddable` / `renderEmbeddable` (allowed embed hosts), `renderTopRightUI`, `renderCustomStats`, `isCollaborating`, custom `onPaste`/`onLibraryChange` |

### draw.io / diagrams.net — URL: https://www.drawio.com/docs/reference/configure-diagram-editor/ ; https://www.drawio.com/blog/configuration-dialog/

Read live from `app.diagrams.net` (Extras → Configuration; Extras → Preferences). The config dialog is itself
searchable ("Search for a string and press Enter"). Sections observed in the running Editor tab:

| Category | Notable settings (observed) |
| --- | --- |
| General | Settings Name (localStorage key), **Keyboard Shortcuts (JSON)** custom bindings, Language Resources, Default Languages, Override user settings, Compact UI, No Auto Focus, Show Splash on Start, Browser Translate |
| Canvas & Grid | **Default Grid Size**, Grid Steps, Default Grid Color (+ dark-mode variant), **Zoom Factor**, Default Edge Length, Page Width/Height, Page Background (+ dark), **Page Visible**, **Grid Enabled**, **Position Guides**, **Distance Guides**, **Size Guides**, **Zoom with Mouse Wheel** |
| Editing behaviour | Stop Editing on Enter, Paste at Mouse, **Fit Diagram on Load**, **Fit Diagram on Page**, Select Parent Layer, **Inline Toolbar**, Window Docking, Intersection Select, Swimlane Body Selection, Simple Labels, Optimize HTML Labels |
| Appearance | Dark Mode Background, **Adaptive Colors** (auto/simple/none), shadow colour/opacity/offset/blur, **CSS Dark Mode**, Light/Dark Colors, Enable Animations, Insert Animations |
| Sidebar & Panels | Thumbnail W/H, Sidebar Width, default/enabled libraries, **Expand Libraries**, custom template library |
| Fonts & Colors | Default/Custom Fonts (+ web-font URLs), Font CSS, preset/custom/default colour palettes, default & custom colour schemes, default text/vertex/edge styles, Mermaid config JSON, **custom CSS for the whole editor UI** |
| Connections | **Default Connectable**, **Connection Arrows**, **Copy on Connect**, Folding Enabled, Automatic Group Size |
| Editor chrome | Show Link Icons, Show Tooltip Icons, Show Note Icons, Show Connect Handle |
| Editor theme | **UI theme** choice: Classic / Atlas / Simple / Minimal / Sketch / Simple Viewer; Dark & light mode (Settings → Appearance) |
| Export & Security | Max Image Bytes/size, **Autosave Delay (ms)**, Default File Type, **Compress XML**, Include Diagram in Export, Enable Export URL, **Lockdown** (disable data transmission), **Restrict Export**, Native Clipboard, Embed SVG Fonts, Remove Image Metadata, Expand Patterns for Print |
| Collaboration & Advanced | Share Cursor Position, Show Remote Cursors, Global Variables JSON, OneDrive picker, self-hosted GitLab URL |
| AI | API keys (OpenAI/Gemini/Claude), AI Actions/Models JSON, **Enable AI** toggle |
| Preferences (separate dialog) | Language, dialog sizes/behaviour; the config dialog ships **Reset / Link (share config as URL) / Apply** |

### tldraw — URL: https://tldraw.dev/sdk-features/user-preferences ; https://tldraw.dev/sdk-features/options ; https://tldraw.dev/sdk-features/accessibility

tldraw splits config into **editor options** (set once at init, immutable) and **user preferences** (per-user,
persisted to localStorage, synced across tabs via BroadcastChannel).

| Category | Notable settings |
| --- | --- |
| Visual preferences | `colorScheme` (`light`/`dark`/`system`), `animationSpeed`, `enhancedA11yMode` |
| Interaction preferences | `isSnapMode` (snap to shapes/guides), `isWrapMode` ("select on wrap": brush selects only fully-enclosed shapes), `isDynamicSizeMode` (new shapes scale with zoom), `isPasteAtCursorMode`, `edgeScrollSpeed`, `areKeyboardShortcutsEnabled`, `inputMode` (`trackpad`/`mouse`), `isZoomDirectionInverted` |
| Identity | user `name`, cursor `color`, `locale` |
| Limits (init-time) | `maxShapesPerPage` (4000), `maxPages` (40), `maxFilesAtOnce` (100), `maxImageDimension`, `maxAssetSize`, accepted image/video MIME types |
| UI/features (init-time) | `createTextOnCanvasDoubleClick`, `enableToolbarKeyboardShortcuts`, `actionShortcutsLocation`, `tooltipDelayMs`, `laserDelayMs`, `adjacentShapeMargin` |
| Accessibility | Accessibility submenu under Preferences: **Reduce motion**, **Keyboard shortcuts** on/off, **Enhanced accessibility mode** (visible labels on UI elements); screen-reader announcements, reading order, alt text |
| Setup | `autoFocus`, `initialState` (default tool), `hideUi`, `forceMobile`, custom `tools`/`shapeUtils`/`override`s, `themes`/`initialTheme`, `licenseKey` (watermark) |
| Persistence | `persistenceKey` (IndexedDB local persistence), `snapshot`, `migrations` |

### React Flow (`@xyflow/react`) — URL: https://reactflow.dev/api-reference/react-flow

Library props, i.e. the knobs a flow editor is expected to surface as settings. Grouped as the docs group them.

| Category | Notable props (default) |
| --- | --- |
| Viewport | `defaultViewport`, `fitView`, `fitViewOptions`, **`minZoom` (0.5)**, **`maxZoom` (2)**, `translateExtent`, `nodeExtent`, `preventScrolling` (true) |
| Canvas | **`snapToGrid`**, `snapGrid`, `onlyRenderVisibleElements` (false — perf for large graphs), `nodeOrigin`, `colorMode` (`'light'` default) |
| Interaction | **`panOnDrag`** (true), **`selectionOnDrag`** (false), `selectionMode` (`'full'`/`'partial'`), **`panOnScroll`** (false), `panOnScrollSpeed` (0.5), `panOnScrollMode` (`'free'`), `zoomOnScroll` (true), `zoomOnPinch`, `zoomOnDoubleClick`, **`selectNodesOnDrag`**, `elevateNodesOnSelect`, `nodesDraggable`, `nodesConnectable`, `nodesFocusable`, `edgesFocusable`, `elementsSelectable`, `autoPanOnConnect`/`OnNodeDrag`/`OnSelection`, `autoPanSpeed` (15), `paneClickDistance`, `nodeClickDistance`, `nodeDragThreshold`, `connectionDragThreshold` |
| Edges / connections | **`connectOnClick`** (true), `connectionMode` (strict/loose), `edgesReconnectable`, `reconnectRadius` (10), `elevateEdgesOnSelect`, `defaultMarkerColor`, `defaultEdgeOptions` |
| Keyboard | `deleteKeyCode` (`'Backspace'`), **`selectionKeyCode`** (`'Shift'`), `multiSelectionKeyCode` (Meta/Ctrl), `zoomActivationKeyCode` (Meta/Ctrl), `panActivationKeyCode` (`'Space'`), **`disableKeyboardA11y`** (false); pass `null` to disable a shortcut |
| Accessibility / i18n | `ariaLabelConfig` (customisable labels, descriptions, minimap/control strings → localisation) |
| Styling escape hatches | `noPanClassName` (`"nopan"`), `noDragClassName`, `attributionPosition`, `proOptions` (hide attribution) |
| Debug | `debug` (logs fired events to console) |

### Mermaid (live editor + library config) — URL: https://mermaid.live/ ; https://mermaid.js.org/config/configuration.html ; https://mermaid.js.org/schemas/config.schema.json (schema mirror: https://mermaid.ai/open-source/config/schema-docs/config.html)

The live editor (`mermaid.live`) UI has exactly three tabs — **Code / Config / Actions** — plus
*docs* and a diagram-type gallery. Config is diagram-as-code, not a preferences panel.

| Category | Notable settings |
| --- | --- |
| Config level model | default config → **siteConfig** (set once via `initialize`) → **frontmatter** in the diagram (YAML, v10.5+; replaces deprecated directives) → render config |
| Theme / look | `theme`, `themeVariables`, `themeCSS`, **`look`** (e.g. hand-drawn), **`handDrawnSeed`**, `darkMode`, `fontFamily`, `altFontFamily` |
| Layout / rendering | `layout` (dagre/elk…), `elk` object, `htmlLabels`, `flowchart`/`sequence`/`gantt`/… per-diagram-type config blocks |
| Limits & safety | **`maxTextSize`**, **`maxEdges`**, `securityLevel`, `secure` list, `startOnLoad`, `logLevel` |
| Determinism / export | `deterministicIds`, `deterministicIDSeed`, `arrowMarkerAbsolute`, `legacyMathML`/`forceLegacyMathML` |
| Editor-level actions | Actions tab offers PNG/SVG export links via renderer (`mermaid.ink`), Kroki links, and share/edit links; `MERMAID_KROKI_RENDERER_URL`, etc. are build-time env vars (operator settings, not user settings) |

### Figma + FigJam — URL: https://help.figma.com/hc/en-us/sections/4403936364311-Change-your-preferences ; https://help.figma.com/hc/en-us/articles/360041065034-Adjust-your-zoom-and-view-options ; https://help.figma.com/hc/en-us/articles/360049549913

Figma's own "Change your preferences" section covers:

| Category | Notable settings |
| --- | --- |
| Appearance | **Theme** (Main menu → Preferences → Theme); **Interface scale** (desktop app: View → Interface Scale — Reset / Make Larger / Make Smaller) |
| Localisation / input | **Language preference**; **Select keyboard layout** |
| Display / colour | **Manage colour profiles in design files** (document colour profile, "preferred profile") |
| Platform behaviour | **Open links in the desktop app**; show/hide Figma in the macOS menu bar; browser downloads folder |
| Notifications | Notification preferences |
| View options (file-level, Zoom/view-options menu) | Zoom percentages, **Pixel preview** (Disabled/1x/2x), **Pixel grid** + **Snap to pixel grid**, **Layout guides** visibility, **Multiplayer cursors** show/hide, **Property labels** (beginner help labels), Prototype flow visibility |
| FigJam-specific | Board background colour, stickies that carry your name, connectors (elbow/straight), marker/highlighter/washi tape, sections/pages, "tidy up" alignment. **Not verified**: a dedicated FigJam preferences pane — FigJam shares the Figma main-menu Preferences; no separate FigJam-only setting list was findable in the help centre. |

### Miro — URL: https://help.miro.com/hc/en-us/articles/360017730553-Toolbars (board menu); https://help.miro.com/hc/en-us/articles/4408879513874-Profile-settings

Miro splits **board-level settings** from **account/profile settings**.

| Category | Notable settings |
| --- | --- |
| Board menu → View | **Grid** (background grid type: none / line grid / dot grid, **snap objects to grid**), **Collaborator cursors** toggle, **Comments on board** toggle, **Scroll bars** toggle, **Object dimensions** toggle, **Undo/Redo controls** on canvas toggle, full screen |
| Board menu → Preferences | **Mouse or trackpad interactivity**, **Align objects** toggle, **Follow all threads** toggle, link to Profile settings |
| Board menu → Accessibility | **Precise selection** toggle, **Reduce motion** toggle, **Accessibility checker** |
| Board menu → Board | Background colour, make a copy, export, move team/space, delete, present, version history, board details |
| Board menu → Language (unregistered users) | Language selector on the Board menu |
| Profile settings (account) | Name/photo/company/industry/role, cookies, email, **notification preferences** (email/mobile/Slack, summary digest timing), connections to other services, language, delete profile |
| Toolbar customisation | Pin/unpin and reorder creation-toolbar tools (saved **per profile**, not per board) |
| Navigation toolbar | Zoom, frames/layers list, minimap show/hide, full screen |

### Lucidchart — URL: https://help.lucid.co/hc/en-us/articles/44855483018900-Set-default-preferences-for-all-Lucidchart-documents

Account Settings → Document Settings → Lucidchart tab. Verified list of user-set defaults:

| Category | Notable settings |
| --- | --- |
| Canvas / document | **Default zoom**; **Grid lines** toggle; **Page tiling** toggle; **default page size and format**; **default page units (inches vs. cm)** |
| Connections / editing | **Default line binding**; **determine what happens after drawing lines** |
| Help / integration | **IconFinder search** enable/disable; **tips** enable/disable |
| Related account settings | Access & update account settings; preferred language on the account; "Make Lucid documents more accessible" |
| **UNVERIFIED** | An exhaustive in-editor Preferences pane list. help.lucid.co is Cloudflare-gated to automated fetching; the article above is the only preference inventory I could retrieve. |

### Whimsical — URLs: https://whimsical.com/learn/settings/dark-mode ; https://whimsical.com/learn/faqs/zoom-direction ; https://whimsical.com/learn/boards/grid ; https://whimsical.com/learn/faqs/language ; https://whimsical.com/learn/boards/performance

| Category | Notable settings |
| --- | --- |
| Appearance | **Settings → Preferences → Appearance**: **Interface colour mode = Light / Dark / System** (default System), also reachable via Command menu ("Interface color mode"). Applies to boards, docs, navigation, settings pages, desktop app. Per-user — does not affect teammates. |
| Navigation / input | **Invert zoom direction** ("works more like Sketch") |
| Canvas alignment | **Item snapping**, auto-alignment, **Snap to grid**, and a "backtick to ignore auto-alignment *and* the grid" override |
| Theme / colours | **Custom colour themes**, save as **custom theme**, **default colour theme** per workspace, restrict who can change the default theme |
| Language | Interface is **English-only**; spellcheck runs in many languages |
| Notifications | Account settings → notifications |
| Performance guidance | Documented limits rather than toggles (item count per board; cursors stop updating past ~100 concurrent collaborators) |
| Account settings hub | https://whimsical.com/learn/settings (Account settings) with Preferences and Dark mode subsections |

### Obsidian Excalidraw plugin — URL: https://github.com/zsviczian/obsidian-excalidraw-plugin (README, "Settings" section)

The plugin's README states settings are grouped into these sections (this is itself a useful grouping prior art):

| Group | Content per README |
| --- | --- |
| Basic settings | default folders etc. |
| Saving | compression, **autosave timer** (enable/disable autosave) |
| Filename | automatic filename generation |
| Display | **left-handed mode**, **theme**, **mouse wheel and pinch zoom settings**, **zoom-to-fit settings** |
| Links and transclusions | how links and embedded items behave on the canvas |
| Markdown-embed settings | behaviour of embedded markdown documents |
| Embed & Export | default width of embedded drawings; how image embeds render |
| Auto-export settings | **auto-export PNG and/or SVG on save**, incl. keep-in-sync |
| Compatibility features | for editing drawings outside Obsidian (LogSeq, VS Code, web) |
| Experimental | **custom fourth font**, custom file-explorer icon/tag, OCR settings |
| Script settings | per-installed-script settings (appear after first run of the script) |
| Palette | Colour palette customised via template `AppState.colorPalette` with `canvasBackground` / `elementBackground` / `elementStroke` (+ `topPicks`) |

---

## 2. Cross-tool frequency — what users of *any* diagram tool expect to find

Ranked by how many of the 11 surveyed tools expose it. Counts are from the tables above only.

| Rank | Setting / setting group | Tools exposing it | Count |
| --- | --- | --- | --- |
| 1 | **Theme / colour mode (light, dark, system)** | Excalidraw, draw.io, tldraw, Mermaid (`darkMode`/`theme`), Figma/FigJam, Miro (background colour + dark mode), Whimsical, Obsidian Excalidraw plugin, React Flow (`colorMode`) | 9 |
| 2 | **Grid: show/hide + snap-to-grid (+ grid size)** | Excalidraw, draw.io (size/steps/colour/enabled), tldraw (`isSnapMode`), React Flow (`snapToGrid`,`snapGrid`), Figma (`Pixel grid`, `Snap to pixel grid`), Miro (grid type + snap), Whimsical (snap to grid), Lucidchart (grid lines), Obsidian Excalidraw (grid via scripts) | 9 |
| 3 | **Zoom / viewport limits & behaviour** (min/max zoom, zoom speed/factor, zoom direction, fit-on-load, scroll-wheel zoom) | Excalidraw, draw.io, tldraw, React Flow, Mermaid (`maxTextSize`-adjacent; layout), Figma (zoom prefs), Miro, Whimsical (invert zoom), Lucidchart (default zoom), Obsidian Excalidraw | 10 |
| 4 | **Keyboard shortcuts / custom key bindings** (incl. enable-disable and rebinding) | draw.io (custom JSON shortcuts), tldraw (shortcuts toggle + a11y keys), React Flow (per-action key codes, `null` to disable), Excalidraw (tool-lock etc. shown with shortcuts), Figma (keyboard layout), Miro (mouse/trackpad interactivity) | 6 |
| 5 | **Export defaults & format** (export on save, default file type, SVG/PNG options) | draw.io, Obsidian Excalidraw (auto-export + keep-in-sync), Figma (pixel preview/pixel grid for export fidelity), Mermaid (PNG/SVG actions), Excalidraw ("Save to…"), Miro (export) | 6 |
| 6 | **Interface language + locale** | Excalidraw (30+), draw.io, tldraw (`locale`), Miro, Figma, Lucidchart (account language) | 6 |
| 7 | **Input device mode: mouse vs trackpad, pinch/wheel behaviour** | Excalidraw (**Input: Trackpad \| Mouse**), tldraw (`inputMode`, `edgeScrollSpeed`, invert zoom), Miro (**Mouse or trackpad interactivity**), draw.io (Zoom with Mouse Wheel), Whimsical (invert zoom), Figma (mouse/trackpad gesture docs) | 6 |
| 8 | **Accessibility: reduce motion, enhanced a11y mode, precise selection** | tldraw (3 toggles), Miro (**Precise selection**, **Reduce motion**), React Flow (`disableKeyboardA11y`, `ariaLabelConfig`), Figma (`Property labels` as a beginner-aid label toggle) | 4 |
| 9 | **Snapping & alignment aids beyond the grid** (position/distance/size guides, snap to objects/midpoints) | draw.io (Position/Distance/Size Guides), Excalidraw (Snap to objects, Snap to midpoints), Whimsical (item snapping + auto-alignment), Figma (layout guides), tldraw (`isSnapMode`) | 5 |
| 10 | **Default styles for new elements** (shape fill/stroke/font, default connector style) | draw.io (defaultVertexStyle/defaultEdgeStyle/colour schemes/fonts), Obsidian Excalidraw (template restores stroke properties), Whimsical ("save default object style", default colour theme), Mermaid (`themeVariables`/`fontFamily`), Excalidraw (palette) | 5 |
| 11 | **Autosave / persistence & file-handling** | draw.io (**Autosave Delay (ms)**, default file type), Obsidian Excalidraw (autosave timer on/off, compression), tldraw (`persistenceKey` IndexedDB, cross-tab sync), Excalidraw (browser storage + warning banner), Whimsical (offline mode FAQ, version history) | 5 |
| 12 | **Collaboration display controls** (cursors on/off, follow threads) | draw.io (Share/Show Remote Cursors), Miro (Collaborator cursors, Follow all threads), Figma (Multiplayer cursors), Whimsical (hide cursors) | 4 |
| 13 | **Panel / UI-chrome density & layout** (compact UI, sidebar width, panel positions, toolbar customisation) | draw.io (Compact UI, Sidebar Width, Window Docking, toolbar/inline toolbar), Miro (pin/reorder toolbar tools), Figma (Interface scale), tldraw (`actionShortcutsLocation`, `hideUi`) | 4 |
| 14 | **Performance / scale limits** | React Flow (`onlyRenderVisibleElements`), tldraw (`maxShapesPerPage`, `maxPages`), Mermaid (`maxTextSize`, `maxEdges`), Whimsical (documented item/concurrency behaviour) | 4 |
| 15 | **Content/embed safety: what external content may be loaded** | Excalidraw (`validateEmbeddable` allowed hosts), draw.io (Lockdown, Remove Image Metadata, Restrict Export), Mermaid (`securityLevel`, `secure`) | 3 |
| 16 | **Reset / share configuration** | draw.io (**Reset**, **Link** = share config URL, Override user settings), Excalidraw ("Reset the canvas"), Miro (restore from trash) | 3 |
| 17 | **AI features toggle + API keys** | draw.io (Enable AI, keys per provider, AI actions/models JSON), Mermaid/Whimsical (AI in the cloud products, not local settings) | 1–2 |

Notes on what is *rare*: per-diagram document settings distinct from app preferences (Lucidchart is the
clearest example), a *search box inside the settings dialog* (draw.io's Configuration dialog is the only
surveyed tool with one), and a user-editable raw JSON/CSS config surface (draw.io, Mermaid).

---

## 3. Proposed grouping / mapping into our nav

### 3.1 Direct fits for the seven planned groups

**Appearance** (today: the theme strip → move the picker here)
- Colour mode: **Light / Dark / System** (rank 1 — appears in 9/11 tools)
- Theme picker (our 6 themes)
- Canvas background colour (Excalidraw, Miro)
- UI density / compact mode + interface scale (draw.io Compact UI; Figma Interface Scale)
- Font family for labels (draw.io Custom/Default Fonts; Mermaid `fontFamily`)
- Custom colour palette / swatches (draw.io preset+custom palettes; Excalidraw `colorPalette`; Whimsical custom themes)
- Toggle visual extras: shadows, animations (draw.io: Enable Animations, Shadow opacity/blur; tldraw `animationSpeed`)

**Canvas**
- **Show grid** + **snap to grid** + **grid size** (rank 2)
- Snap to objects / snap to midpoint / alignment guides (draw.io Position, Distance, Size Guides; Excalidraw Snap to objects & Snap to midpoints; Whimsical item snapping)
- **minZoom / maxZoom** — React Flow defaults 0.5 / 2, expose as numbers or a preset (Tight / Default / Wide)
- `preventScrolling` ("scroll the page when the pointer is over the canvas") — React Flow, default true
- Zoom interaction: `zoomOnScroll`, `zoomOnPinch`, `zoomOnDoubleClick`, `zoomActivationKeyCode`, **zoom direction inverted** (Whimsical "invert zoom"; tldraw `isZoomDirectionInverted`)
- Fit-on-load / fit-to-view-on-open (draw.io Fit Diagram on Load; React Flow `fitView`)
- `nodeExtent` / `translateExtent` ("bounded canvas") if we support it
- Panels/overlays: minimap show/hide, background dots/lines/none (Miro grid type), scroll bars (Miro)

**Connections**
- Connect on click vs drag (`connectOnClick`, React Flow default true) — matches draw.io's "what happens after drawing lines" and Lucidchart's "default line binding"
- Default connector style: type (bezier/step/smoothstep/straight), stroke colour, width, arrow marker (`defaultMarkerColor`, `defaultEdgeOptions`)
- **Arrow binding / snap to midpoints** (Excalidraw)
- Reconnectable edges + reconnection radius (`edgesReconnectable`, `reconnectRadius` = 10)
- Connection arrows on hover, copy-on-connect, default connectable (draw.io)
- `connectionMode` strict vs loose (React Flow)
- Connection drag threshold (React Flow `connectionDragThreshold`)

**Editor** (general editing behaviour; the biggest group)
- **Mouse vs trackpad input mode** (Excalidraw, Miro, tldraw) — high-frequency, 6/11 tools
- Select-on-drag / selection key / selection mode full vs partial (React Flow `selectionOnDrag`, `selectionMode`; Excalidraw Select on = Wrap \| Overlap = tldraw `isWrapMode`)
- Multi-select key (React Flow `multiSelectionKeyCode`, default Ctrl/Cmd)
- Nodes draggable / connectable / selectable / focusable master switches (React Flow)
- Click-distance & drag-threshold tuning: `paneClickDistance`, `nodeClickDistance`, `nodeDragThreshold` (React Flow; draw.io's "Intersection Select", "Swimlane Body Selection" are the equivalents)
- Auto-pan on connect / node drag / selection + `autoPanSpeed` (React Flow)
- Paste behaviour: **paste at cursor vs original location** (tldraw `isPasteAtCursorMode`; draw.io Paste at Mouse)
- Stop editing on Enter / Shift+Enter newline (draw.io)
- New shapes scale with zoom (tldraw `isDynamicSizeMode`)
- Default styles for newly created elements (rank 10): default node fill/stroke/font, default connector (draw.io default vertex/edge styles; Whimsical save-default-object-style)
- Tool lock / one-time tools (Excalidraw Tool lock; Miro "all tools are one-time")
- Autosave interval + enable/disable autosave (draw.io Autosave Delay; Obsidian Excalidraw autosave) — could live here or in a new Data group
- Confirmation prompts / reset-canvas (Excalidraw "Reset the canvas")

**Export**
- Default export format (draw.io Default File Type: XML / PNG / SVG / HTML)
- Export scale / high-resolution multiplier (draw.io Max Image Size (px); Figma Pixel preview 1x/2x)
- Include/exclude the grid, background, and diagram metadata (draw.io Include Diagram in Export; Remove Image Metadata)
- `embedSvgFonts` (embed fonts as data URIs) — draw.io
- PNG background: transparent vs canvas colour (draw.io docs on dark-mode export)
- Copy-to-clipboard vs download-the-file behaviour (draw.io Native Clipboard / Use Internal Clipboard)

**Keyboard**
- Per-action key binding table with a **reset to defaults** (draw.io supports custom `{keyCode, control, shift, alt, action}` JSON; React Flow accepts one key/chord per action and `null` to disable)
- Master **enable/disable keyboard shortcuts** toggle (tldraw `areKeyboardShortcutsEnabled`)
- Individual toggles for: delete key, selection key, multi-select key, zoom activation key, pan activation key (React Flow `deleteKeyCode`, `selectionKeyCode`, `multiSelectionKeyCode`, `zoomActivationKeyCode`, `panActivationKeyCode`)
- Note Excalidraw's approach: shortcuts are *displayed inline in the Preferences submenu* next to each item — cheap discoverability win
- Keyboard layout variant for non-QWERTY users (Figma "Select keyboard layout")

**About**
- Version + build, licence/attribution (React Flow attribution is on by default and can be hidden via `proOptions` — decide our stance and state it here)
- Links: docs, source repo, changelog, report a bug
- **Reset all settings to defaults** (draw.io Reset; "Settings Name" key used by draw.io is a neat model: everything in one namespaced localStorage blob)
- **Import / export settings** — draw.io's "Link" button generates a URL that carries your configuration; strong pattern for a shared tool
- Data/privacy statement (draw.io Lockdown = "disable data transmission apart from storage"; Excalidraw warns "your drawings are saved in your browser's storage")
- Credits & thank-yous

Search box: draw.io's Configuration dialog is the only surveyed tool with in-dialog search. Keep it — it is a differentiator, and it makes a 7-group modal safe to grow.

### 3.2 Groups we are missing (with the evidence)

1. **Data & Storage** (strongest candidate for a NEW group)
   - Everything above that is about *where the diagram lives*, not how it looks: autosave interval on/off (draw.io, Obsidian Excalidraw), local persistence key / IndexedDB vs server (tldraw `persistenceKey` + cross-tab sync), default save file type (draw.io), "save to file" vs "browser storage" warning (Excalidraw literally warns users their work can be lost), import/export of the whole workspace, clear/reset local data, version history (Miro, Whimsical).
   - Why a separate group: it is the one setting class where a mistake loses user work, and users look for it under a Data/Storage heading, not under "Editor".

2. **Accessibility**
   - **Reduce motion** (tldraw, Miro), **enhanced accessibility mode / visible UI labels** (tldraw, Figma "Property labels"), **precise selection** (Miro), **keyboard navigation aids** (React Flow `disableKeyboardA11y` default false — we should keep it on), high-contrast / colour-blind-safe palettes, screen-reader descriptions for nodes (`ariaLabelConfig`).
   - Currently these have no natural home; bolting "reduce motion" into Appearance and "keyboard a11y" into Keyboard splits the concept. Miro and tldraw both give it its own submenu.

3. **Collaboration** (only if/when we add sharing; the brief says the tool is intended to be shared)
   - Show/hide collaborator cursors (draw.io, Miro, Figma, Whimsical), follow all threads / comments (Miro), presence display name + cursor colour (tldraw identity prefs), per-user vs per-board scope (Miro's toolbar customisation is explicitly per-profile, not per-board — worth copying).
   - Until multiplayer exists, this group should not appear; the *identity* half (display name, cursor colour, locale) is the part we could ship early if we ever add cursors.

4. **Performance**
   - Worth a group only if we expect large diagrams: React Flow's `onlyRenderVisibleElements` ("improve performance when you have a large number of nodes… also adds overhead"), tldraw's `maxShapesPerPage`/`maxPages`, Mermaid's `maxTextSize`/`maxEdges`.
   - Cheaper alternative: put these in **Advanced** under Editor, or hide them behind the About pane's "show advanced settings". Miro and Figma do not expose performance knobs to end users at all.

5. **Advanced / Developer** (optional, low priority for a personal tool)
   - draw.io exposes Lockdown, custom CSS, Global Variables JSON, custom keyboard-shortcut JSON, and share-config-as-URL. Mermaid exposes raw config. This is the escape hatch for power users and the place to put "share my settings as a link" if we build it.

### 3.3 Small but high-value items worth adding to existing groups

- **Language selector** (rank 6, 6/11 tools). Our nav has no home for it. Cheapest fix: a Language dropdown at the bottom of **Appearance** (Excalidraw puts Theme + Language side by side in the same menu; Miro puts it under Profile settings). If a real Accessibility/General group is added, it goes there.
- **Input device: Trackpad / Mouse** — put in **Editor** (or Canvas); 6/11 tools have it and it is a support-burden killer.
- **Snap-to-grid size + grid visibility** — the two together, in **Canvas**; both draw.io and Excalidraw group size/colour with the grid toggle.
- **Default styles for new elements** — **Editor**, mirroring draw.io's `defaultVertexStyle`/`defaultEdgeStyle` and Whimsical's "save default object style".
- **Reset to defaults** must exist somewhere visible — draw.io and Excalidraw both have a reset affordance; put it in **About** and make it per-pane where sensible.

---

## 4. Verification status

- **Read live from the running app**: Excalidraw (Preferences submenu), draw.io (Configuration Editor tab + Preferences dialog).
- **From official docs / schemas / READMEs**: tldraw, React Flow, Mermaid, Figma/FigJam, Miro, Lucidchart, Whimsical, Obsidian Excalidraw plugin.
- **Explicitly unverified**: (a) an exhaustive in-editor Lucidchart Preferences pane — only the account-level *Document Settings → Lucidchart* list could be retrieved; (b) a FigJam-only preferences pane — FigJam appears to share Figma's main-menu Preferences, and no FigJam-specific setting inventory is published; (c) Miro's board *Preferences* submenu item list beyond the four items named in the Toolbars article (mouse/trackpad, align objects, follow all threads, profile settings link) — help.miro.com is Cloudflare-gated to automated fetching.
