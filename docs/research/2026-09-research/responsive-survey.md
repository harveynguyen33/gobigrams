# Responsive layout & panel-collapse survey — mature diagram/whiteboard tools

Scope: what shipped tools actually do on **phone**, **tablet**, and for **desktop panel collapse**, plus touch-interaction deltas, breakpoints, and platform pitfalls. Every claim below is tied to a source. Where a tool's behaviour could **not** be verified, it says so explicitly.

Research date: 2026-09-15. Sources are official docs/help centres, the libraries' own source and docs, and vendor engineering posts.

---

## 1. Per-tool table

| Tool | Phone behaviour | Tablet behaviour | Desktop panel-collapse | Source URL |
|---|---|---|---|---|
| **Excalidraw** (core + app) | `formFactor: "phone"` when `width <= 599px`, **or** `height < 500px && width < 1000px` (landscape-phone rule). Switches to a dedicated **mobile toolbar** component (`MobileToolbar.tsx`, `.excalidraw--mobile-toolbar`) and styles panel mode `"mobile"`. | `formFactor: "tablet"` when `min(w,h) >= 600 && max(w,h) <= 1180` ("ipad air" is the comment in source). Styles panel mode becomes **`"compact"`**, not the desktop preference. | Three styles-panel modes: `"compact" \| "full" \| "mobile"`. Sidebar docks only when `editorWidth > dockedSidebarBreakpoint` (default `MQ_RIGHT_SIDEBAR_MIN_WIDTH = 1229`); a "dock" button is then shown. `desktopUIMode` is **persisted** in `localStorage` under key `excalidraw.desktopUIMode` (values `"compact"`/`"full"`), with try/catch for Safari private mode. | https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/editorInterface.ts · https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx · https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/ui-options |
| **Excalidraw — acknowledged gaps** | Excalidraw maintainers opened a **"Touch Device Support" meta-issue** stating the tool "functions on touch devices [but] is currently primarily optimized for desktop use and lacks many features that tablet users expect". Listed gaps: no native multitouch, limited stylus/palm-rejection support, **"lacks standard tablet features like single-finger pan in drawing mode"**, no gesture framework (undo/redo, tool switching), inconsistent behaviour across iOS/Android/Windows tablets. | Same issue is labelled both `mobile` and `tablet`. | — (desktop is the optimised path) | https://github.com/excalidraw/excalidraw/issues/9705 |
| **tldraw** | Breakpoint array `PORTRAIT_BREAKPOINTS = [0, 389, 436, 476, 580, 640, 840, 1023]` with named tiers `MOBILE_XXS(389) → MOBILE_XS(436) → MOBILE_SM(476) → MOBILE(580) → TABLET_SM(640) → TABLET(840) → DESKTOP(1023)`. Layout is chosen **from the editor container's width, not the window**. `forceMobile` prop pins the mobile layout regardless of size. | Same breakpoint ladder; `TABLET`/`TABLET_SM` tiers. Docs: "On desktop, the style panel appears in the top-right zone; **on mobile it moves into a popover opened from the toolbar**." Toolbar lives in the bottom zone. | **`hideUi` prop** hides the entire default UI (toolbar, menus, panels) while keeping the editor, tools and keyboard shortcuts working; you then supply your own controls via `useEditor()`. Individual slots can be hidden by passing `null` (e.g. `PageMenu: null`, `NavigationPanel: null`) or replaced. | https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/ui/constants.ts · https://tldraw.dev/sdk-features/ui-components · https://tldraw.dev/examples/hide-ui · https://tldraw.dev/examples/force-mobile |
| **tldraw — touch tuning (documented defaults)** | Explicit touch-vs-mouse thresholds: `dragDistanceSquared` 16 (4px) mouse vs **`coarseDragDistanceSquared` 36 (6px) touch**; `uiDragDistanceSquared` 16 vs **`uiCoarseDragDistanceSquared` 625 (25px) touch UI drag**; `handleRadius` 12 vs **`coarseHandleRadius` 20**; `hitTestMargin` 3 vs **`coarseHitTestMargin` 4**; `longPressDurationMs` 500. Docs say the larger touch thresholds "prevent accidental drags on mobile devices". | Same option set. | Keyboard shortcuts survive `hideUi` (docs explicitly note `d` = draw, `r` = rectangle still work with UI hidden). | https://tldraw.dev/sdk-features/options |
| **Figma (design)** | Two distinct levels: **Minimize UI** collapses left + right sidebars (narrow icon rails); **Hide UI** "conceal[s] the navigation bar, left and right sidebars, and the toolbar". Minimize = `⌘⇧\` (Mac) / `Ctrl+Shift+\`; Hide = `⌘\` / `Ctrl+\`. With nothing selected, the right sidebar stays minimized; **selecting an object re-expands the right sidebar, deselecting re-minimizes it**. | Mobile/iPad app is view/comment/prototype only: "**It's not possible to edit Figma Design files or Figma Slides decks using the mobile app**" (iOS 16+/Android 8+). | Figma documents no *remembered* collapsed state; the minimize/hide state is a session toggle. Sidebar state is not described as persisted in any help article found. | https://help.figma.com/hc/en-us/articles/41414918021271-Hide-or-minimize-the-UI · https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app |
| **FigJam (iPad)** | FigJam for iPad app **retired 2026-01-08**; FigJam now lives inside the Figma app. Top toolbar holds pages; the **`+` button is in the bottom toolbar**. Pan = drag with **one or two fingers**; "use **two fingers to move around the canvas while drawing**"; pinch = zoom. "Tap the **toggle sidebar** button to open the left sidebar." Pages **cannot** be created/renamed/deleted on iPad. | Explicit iPad section with the above; no separate tablet breakpoint is documented — the iPad app is the tablet story. | No documented panel-collapse affordance beyond the sidebar toggle button. | https://help.figma.com/hc/en-us/articles/4502073572247-FigJam-for-iPad |
| **Miro (phone app)** | App toolbar documented as a list including "Creation toolbar (limited tools and features)". Gestures: **swipe to pan**, long-tap-and-drag to multi-select, pinch to zoom, double-tap to zoom in, double-tap + swipe to zoom. Boards open **view-only by default** — you must select an object and tap **Edit**. Unsupported on mobile: templates, board export, presentation mode, video chat, voting, starred boards. Requirements: iOS 16+/Android 7+. Docs explicitly recommend the **tablet** app (not phone) for templates and other team tools. | — | — | https://help.miro.com/hc/en-us/articles/360017572834-Mobile-app |
| **Miro (tablet app)** | — | Gestures: "**Single or two finger scroll** to move canvas", single tap select, press-and-move to drag, **long tap and drag to multi-select**, pinch to zoom. Pen/Stylus auto-recognised as pen, toggleable via *Only draw with Stylus*. **Documented minimum screen resolution: 768×1024 px.** | Fullscreen toggle exists ("Entering full screen" under the View submenu); toolbar tool order is user-customisable. No documented persistent collapse state. | https://help.miro.com/hc/en-us/articles/360017731633-Tablet-app · https://help.miro.com/hc/en-us/articles/360017730553-Toolbars |
| **draw.io / diagrams.net** | **No app in the iOS/Android stores** — docs instruct adding the web app to the home screen. On small touch screens draw.io recommends the **Sketch editor theme**, "ideal for diagramming on the smaller touch screens of mobile devices", which has "simple toolbar, **minimised panels**" and **floating panels you can drag and minimise**. | "The default more complex editor themes … are still easy to use on larger tablets and notebooks with touch screens." Touch shortcuts: **double-tap blank canvas → shape selector**, **double-tap a shape/connector → on-screen keyboard for label**, tap a direction arrow to add+auto-connect a shape, pinch/spread to zoom. Zoom controls sit "in the toolbar at the bottom right of the screen". | Three explicit affordances: **Fullscreen** (closes left+right panels and hides filename/share), **Format** button (toggle the right format panel), **Collapse/Expand** (hide filename + app icon). Panels also toggled from *View > Fullscreen* and the *View* toolbar menu. Floating dialogs have their own Minimise/Close. **No documented persistence of the collapsed state.** | https://www.drawio.com/docs/tutorials/touch-screen-diagrams/ · https://www.drawio.com/docs/manual/editor/increase-drawing-canvas/ · https://www.drawio.com/docs/manual/editor/toolbars/ · https://www.drawio.com/docs/manual/editor/mobile-diagram-app/ |
| **Lucidchart / Lucidspark** | Native iOS + Android apps exist for *viewing and light editing*; the **Android help article explicitly splits phone vs tablet feature sets** — phone gets "Primary Toolbar (selection, text, sticky notes, shapes, lines, frames, freehand, notes)" and zoom, while containers/templates/timer/voting/minimap are called out as tablet-only. "To access templates and other team tools, please use the Android app on a **tablet** or in a web browser." | Documented as a distinct experience from the phone app with a superset of tools. No px breakpoints published. | No documented panel-collapse affordance or persisted state in the help centre. | https://help.lucid.co/hc/en-us/articles/15154010721300-Use-Lucidspark-on-an-Android-device · https://help.lucid.co/hc/en-us/articles/16287878424852-Use-Lucidchart-on-the-iOS-mobile-app |
| **Whimsical** | **No dedicated mobile app.** Official FAQ: "No dedicated mobile app yet, but Whimsical works in mobile browsers — view files, add comments, and switch between workspaces on the go." i.e. phone = **read + comment**, not editing. | Not documented anywhere in the help centre — **could not verify** any tablet-specific layout or breakpoints. | Not documented — **could not verify**. | https://whimsical.com/learn/faqs/mobile (page description/front matter, verified via the page's own metadata) |
| **Obsidian Excalidraw plugin** | The plugin README lists "**Mobile Support**" as a shipped feature (linking a demo video), and ships an `ea-scripts/Archive/Toggle Fullscreen on Mobile.md` script — implying mobile is treated as a constrained viewport needing a fullscreen/reclaim-space mode. **No breakpoints or drawer behaviour are documented in the repo.** | Not documented — **could not verify** a distinct tablet layout. | Not documented beyond the mobile-fullscreen script. | https://github.com/zsviczian/obsidian-excalidraw-plugin (README) |
| **React Flow (`@xyflow/react` v12)** — the library itself | `zoomOnPinch` (default `true`) — "Controls if the viewport should zoom by pinching on a touch screen." `panOnDrag` is `boolean \| number[]`, and the docs warn: "**Mouse button arrays do not disable touch panning; set this prop to `false` to disable all drag panning.**" `connectOnClick` (default `true`) enables **tap-handle-then-tap-handle** connection — the documented touch path. | `nodeDragThreshold` (default 1) and `connectionDragThreshold` (default 1) exist to suppress accidental drags/connections on click; both would need raising for fingers. | `<Panel position="…">` supports `top-left/top-center/top-right/bottom-left/bottom-center/bottom-right/center-left/center-right` — the mechanism for a top-center floating toolbar **and** a bottom-center mobile bar. | https://reactflow.dev/api-reference/react-flow · https://reactflow.dev/examples/interaction/touch-device · https://reactflow.dev/api-reference/components/panel |
| **React Flow — built-in CSS guarantees** | `.xy-flow__pane { touch-action: none; }` ships in the base stylesheet — i.e. React Flow already suppresses native browser pan/zoom gestures on the pane, which is what makes canvas panning possible on touch. | Same. | `.xy-flow__panel` already has `position:absolute; z-index:5; margin:15px` and the `top/bottom/left/right/center` classes. | https://github.com/xyflow/xyflow/blob/main/packages/system/src/styles/init.css |

---

## 2. Touch interaction changes vs desktop (consolidated)

**Pan/zoom model on touch**
- **Miro (phone):** swipe to pan, pinch to zoom, double-tap to zoom in, double-tap + swipe to zoom — https://help.miro.com/hc/en-us/articles/360017572834-Mobile-app
- **Miro (tablet):** "Single **or** two finger scroll to move canvas"; long tap + drag = multi-select — https://help.miro.com/hc/en-us/articles/360017731633-Tablet-app
- **Figma/FigJam on iPad:** "you can pan and move around your board by dragging with **one or two fingers**. Use **two fingers to move around the canvas while drawing**" — https://help.figma.com/hc/en-us/articles/4502073572247-FigJam-for-iPad
- **draw.io on touch:** pinch/spread to zoom; zoom buttons are placed "in the toolbar at the bottom right of the screen" — https://www.drawio.com/docs/tutorials/touch-screen-diagrams/
- **React Flow:** pinch zoom via `zoomOnPinch`; note that a `panOnDrag` **array** does not restrict touch — only `false` disables it — https://reactflow.dev/api-reference/react-flow
- **Excalidraw** gates wheel/hand/space-pan logic separately from touch and explicitly comments that multi-touch on iOS/iPadOS needs special handling because `GestureEvent` gives a zoom factor "but not the center", so zoom happens in the `touchmove` handler instead — https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx

**Long-press replaces right-click**
- Excalidraw implements a dedicated `maybeOpenContextMenuAfterPointerDownOnTouchDevices` path that only fires for `event.pointerType === "touch"` and opens the canvas context menu after `TOUCH_CTX_MENU_TIMEOUT = 500` ms; the timer is invalidated if a **second** pointer goes down (so pinching never opens a menu) — https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx and https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/constants.ts
- tldraw exposes `longPressDurationMs` (default **500 ms**) as a first-class option — https://tldraw.dev/sdk-features/options
- Miro phone: "Long tap and drag to select multiple objects", "Long tap on the object to move it" — https://help.miro.com/hc/en-us/articles/360017572834-Mobile-app

**Double-tap becomes the discovery gesture** (no hover, no right-click)
- draw.io: **double-tap blank canvas** opens the shape selector; **double-tap a shape** opens the on-screen keyboard for its label — https://www.drawio.com/docs/tutorials/touch-screen-diagrams/
- Miro phone: double-tap the object to add text; double-tap the board to zoom in — https://help.miro.com/hc/en-us/articles/360017572834-Mobile-app
- Figma mobile: **long-press** a location to add a comment — https://help.figma.com/hc/en-us/articles/1500007537281-Guide-to-the-Figma-mobile-app

**Bigger hit targets**
- React Flow's official touch example enlarges handles from the default 6px to **20×20px** with an animated bounce on the click-connecting handle — https://github.com/xyflow/xyflow/blob/main/examples/react/src/examples/TouchDevice/touch-device.css
- tldraw doubles handle radius on coarse pointers (`handleRadius` 12 → **`coarseHandleRadius` 20**) — https://tldraw.dev/sdk-features/options
- Excalidraw's mobile toolbar forces `min-width/min-height: 2rem` on tool icons and `2.25rem` on the icon inside, and a `2rem` mobile action-button size via the `--mobile-action-button-size` CSS variable — https://github.com/excalidraw/excalidraw/blob/main/packages/excalidraw/components/MobileToolbar.scss and .../css/variables.module.scss
- Web platform guidance: "A minimum recommended touch target size is around **48 device independent pixels**… Touch targets should also be spaced about **8 pixels** apart" — https://web.dev/articles/accessible-tap-targets
- W3C WCAG 2.2 SC 2.5.8 **Target Size (Minimum), Level AA**: "The size of the target for pointer inputs is at least **24 by 24 CSS pixels**", with exceptions for spacing/equivalent control/inline/UA-controlled/essential — https://github.com/w3c/wcag/blob/main/guidelines/sc/22/target-size-minimum.html

**Accidental-drag suppression is a documented concern, not a nicety**
- tldraw: "The larger touch thresholds **prevent accidental drags on mobile devices**" (`coarseDragDistanceSquared` 36 ≈ 6px vs 16 ≈ 4px for mouse) — https://tldraw.dev/sdk-features/options
- React Flow: `nodeDragThreshold` "is 1 by default, so that clicks don't trigger drag events"; `connectionDragThreshold` "is useful to prevent accidental connections when clicking on a handle" — https://reactflow.dev/api-reference/react-flow

**Touch is detected at runtime, not only by media query**
- Excalidraw sets `isTouchScreen: true` lazily on the first `pointerdown` whose `pointerType` is `"pen"` or `"touch"`, and separately toggles `penMode` on first pen contact — https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx
- CSS-side, the platform signals are `@media (pointer: coarse)` (primary pointing device "includes a pointing device of limited accuracy, such as a finger on a touchscreen") and `@media (hover: none)` — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/pointer and https://developer.mozilla.org/en-US/docs/Web/CSS/@media/hover
- Excalidraw's own UA sniffing combines `navigator.userAgentData.mobile` with `matchMedia("(hover: none)") && matchMedia("(pointer: coarse)")` to distinguish a touch tablet from a Chromebook/desktop — https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/editorInterface.ts

**View-only defaults on touch**
- Miro phone: "When you open a board in the mobile app, it will be in **view-only mode by default**. This allows you to easily pan around the board without moving objects." — https://help.miro.com/hc/en-us/articles/360017572834-Mobile-app
- Whimsical phone: view files + comment only — https://whimsical.com/learn/faqs/mobile

---

## 3. Breakpoints other tools use (px)

| Tool | Value | Meaning | Source |
|---|---|---|---|
| Excalidraw | **599** | `MQ_MAX_MOBILE` — at/below this width, formFactor = `phone` | https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/editorInterface.ts |
| Excalidraw | **1000 × 500** | `isMobileBreakpoint` also returns true when `height < 500 && width < 1000` — i.e. **landscape phone** is classed as phone | same |
| Excalidraw | **600 – 1180** | `MQ_MIN_TABLET = MQ_MAX_MOBILE + 1` (600), `MQ_MAX_TABLET = 1180` (commented "ipad air"); tablet = `min(w,h) >= 600 && max(w,h) <= 1180` | same |
| Excalidraw | **1229** | `MQ_RIGHT_SIDEBAR_MIN_WIDTH` — the docked right sidebar appears only when editor width exceeds this; override via `UIOptions.dockedSidebarBreakpoint` | same + https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/ui-options |
| Excalidraw | **1440** | `MQ_MIN_WIDTH_DESKTOP` — declared, with a comment that it is **not** used for form-factor detection | same |
| tldraw | **[0, 389, 436, 476, 580, 640, 840, 1023]** | `PORTRAIT_BREAKPOINTS`, indexed by named tiers `MOBILE_XXS=389 … MOBILE=580, TABLET_SM=640, TABLET=840, DESKTOP=1023` | https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/ui/constants.ts |
| Miro (tablet app) | **768 × 1024** | Documented *minimum screen resolution* for the tablet app (not a CSS breakpoint, but the vendor's stated floor) | https://help.miro.com/hc/en-us/articles/360017731633-Tablet-app |
| Legacy Excalidraw (v0.17-era constants, for lineage) | **640 / 730 / 1000 / 1229** | `MQ_SM_MAX_WIDTH = 640`, `MQ_MAX_WIDTH_PORTRAIT = 730`, `MQ_MAX_WIDTH_LANDSCAPE = 1000`, `MQ_RIGHT_SIDEBAR_MIN_WIDTH = 1229` | https://github.com/michaeljohnn/excalidraw-cn/blob/master/src/constants.ts (mirror of the older Excalidraw constants file; cited as lineage, not as current upstream) |
| Figma / FigJam / draw.io / Lucid / Whimsical | — | **No px breakpoints are published** in their help centres. State explicitly: not documented. | — |

Note: there is **no single industry-standard set**. Two independent, actively-maintained sources converge on roughly **phone ≤ ~600px**, **tablet ≈ 600–1180px**, and **desktop sidebars viable only above ~1229px**, with a landscape phone rule keyed off height.

---

## 4. Panel-collapse affordances in use

| Affordance type | Who uses it | Source |
|---|---|---|
| **Keyboard shortcut** (two levels: minimize vs hide) | Figma: Minimize = `⌘⇧\` / `Ctrl+Shift+\`; Hide entire UI = `⌘\` / `Ctrl+\` | https://help.figma.com/hc/en-us/articles/41414918021271-Hide-or-minimize-the-UI |
| **Toolbar toggle button** | draw.io: *Fullscreen* (closes both side panels), *Format* (toggles the right format panel), *Collapse/Expand* (hides filename + icon) | https://www.drawio.com/docs/manual/editor/toolbars/ · https://www.drawio.com/docs/manual/editor/increase-drawing-canvas/ |
| **Menu item duplicating the toolbar toggle** | draw.io: *View > Fullscreen* toggles the same state; panels also toggled from the *View* toolbar menu | https://www.drawio.com/docs/manual/editor/increase-drawing-canvas/ |
| **Dock button that appears only at sufficient width** | Excalidraw: when the container is wider than `dockedSidebarBreakpoint`, the sidebar becomes "dockable" and a **dock button is shown**; docking pushes the canvas left to make room | https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/ui-options |
| **Whole-UI hide prop (build your own chrome)** | tldraw `hideUi`; also per-slot `null` hiding | https://tldraw.dev/examples/hide-ui · https://tldraw.dev/sdk-features/ui-components |
| **Selection-driven auto-expand/auto-collapse** | Figma: with the UI minimized, selecting an object expands **only the right sidebar**; deselecting minimizes it again. Note: this is the *same* behaviour Diagram Studio already has for its right inspector. | https://help.figma.com/hc/en-us/articles/41414918021271-Hide-or-minimize-the-UI |
| **Sidebar toggle button (touch)** | FigJam iPad: "tap the **toggle sidebar** button to open the left sidebar" | https://help.figma.com/hc/en-us/articles/4502073572247-FigJam-for-iPad |
| **Draggable + minimisable floating panels** | draw.io: floating dialogs can be dragged anywhere; each has Minimise and Close buttons | https://www.drawio.com/docs/manual/editor/increase-drawing-canvas/ |
| **Full-screen "focus mode" per object** | Miro: any Format (Doc/Table/Timeline/Diagram/Slides) can be opened in focus mode, exited via a "Go to canvas" button; can be set as board default view | https://help.miro.com/hc/en-us/articles/26711034117138-Formats-Focus-modes |

**Is the collapsed state remembered?**
- **Yes — one verified case:** Excalidraw persists `desktopUIMode` (`"compact"`/`"full"`) to `localStorage` under `excalidraw.desktopUIMode`, read on every `refreshEditorInterface()` and written on `setDesktopUIMode()`, wrapped in try/catch for storage failures — https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/editorInterface.ts
- **Figma, draw.io, Miro, tldraw, Lucid, Whimsical:** no published documentation of persisting the collapsed/minimized state. Report this as **not documented**, not as "they don't".

---

## 5. Pitfalls & platform gotchas

**React Flow / `@xyflow/react` on touch**
1. **`panOnDrag` arrays silently don't restrict touch.** Docs: "Mouse button arrays do not disable touch panning; set this prop to `false` to disable all drag panning." Implication: you cannot express "left-drag box-select, but fingers pan" purely through the mouse-button array — https://reactflow.dev/api-reference/react-flow
2. **The Pane's pointer handling special-cases touch.** In `Pane/index.tsx`, `onPointerDownCapture` returns early (`// Mouse button arrays only restrict mouse input. Let touch panning handle this gesture unless the user explicitly activated selection with the selection key.`) when `event.pointerType === 'touch' && panOnDrag !== false && !selectionKeyPressed` — so a Figma-style "drag on empty canvas = box-select" **will not** happen for fingers unless you change `panOnDrag`/`selectionOnDrag` or gate on the selection key — https://github.com/xyflow/xyflow/blob/main/packages/react/src/container/Pane/index.tsx
3. **`touch-action: none` is already applied** to `.xy-flow__pane` in the shipped stylesheet. If you wrap the flow in your own scroll container, the **ancestor's** `touch-action` participates in the intersection, so an over-eager `touch-action` on a parent can break canvas panning — https://github.com/xyflow/xyflow/blob/main/packages/system/src/styles/init.css · https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
4. **The wheel handler is deliberately non-passive.** React Flow registers `d3Selection.on('wheel.zoom', wheelHandler, { passive: false })` so it can `preventDefault` and stop the page scrolling — the cost is a thread-blocking listener; and `preventScrolling` (default `true`) is the documented knob for "allow the user to scroll the page even when their pointer is over the flow" — https://github.com/xyflow/xyflow/blob/main/packages/system/src/xypanzoom/XYPanZoom.ts · https://reactflow.dev/api-reference/react-flow
5. **Pinch must be explicitly defended.** In `xypanzoom/filter.ts`, when `zoomOnPinch` is off, React Flow calls `event.preventDefault()` for `touchstart` with `event.touches.length > 1` ("if you manage to start with 2 touches, we prevent native zoom"), and it disables pinch-zoom **while a connection is in progress**. If `zoomOnPinch` is on, note the filter treats `zoomOnPinch && event.ctrlKey` as the pinch signal — https://github.com/xyflow/xyflow/blob/main/packages/system/src/xypanzoom/filter.ts
6. **Double-tap zoom bypasses the filter.** Source comment: "We cannot add `zoomOnDoubleClick` to the filter above because **double tapping on touch screens circumvents the filter and dblclick.zoom is fired on the selection directly**." If double-tap means something else in your app (e.g. add-node), turn `zoomOnDoubleClick` off — https://github.com/xyflow/xyflow/blob/main/packages/system/src/xypanzoom/XYPanZoom.ts
7. **Elements that eat gestures need an escape hatch.** `noPanClassName` (`"nopan"` by default) is the documented way to stop a drag on an element from panning the viewport — https://reactflow.dev/api-reference/react-flow
8. **Handle hit area is 6px by default**; the official touch example bumps it to 20px. Connection on touch is tap-handle → tap-handle via `connectOnClick` (default `true`) — https://github.com/xyflow/xyflow/blob/main/packages/system/src/styles/style.css · https://reactflow.dev/examples/interaction/touch-device

**Pointer events vs mouse events**
- Pointer events exist precisely to unify mouse/pen/touch, and expose `pointerType` so you can branch; a browser that starts handling a touch gesture itself will fire **`pointercancel`** to the app, which is the standard reason a canvas drag "randomly" stops — https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events · https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
- Real-world consequence (tldraw engineering post): once an **Apple Pencil** is touching an iPad screen, "the OS stops sending finger events to the browser entirely, no matter how many settings I tried to tweak" — i.e. multi-touch+stylus combinations are unreliable on iOS — https://tldraw.dev/blog/a-touchy-subject
- Same post: "The second press can conflict with pinching. But that's okay so long as we wait for you to start drawing before the second touch occurs." Excalidraw solves the sibling problem by discarding or finalising a freedraw element when a second finger lands mid-stroke — https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx

**Passive listeners / scrolling intervention**
- Chrome made touch listeners **passive by default** where that matches intent, "in rare cases this change can result in unintended scrolling. This is usually easily addressed by applying a `touch-action: none` style to the element where scrolling shouldn't occur." — https://developer.chrome.com/blog/scrolling-intervention
- `touch-action` values intersect up the ancestor chain, so applying it at the wrong level is a common cause of "my canvas scrolls the page instead" — https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
- Excalidraw's `styles.scss` shows the full state matrix: `canvas { touch-action: none }` normally; `pan-x pan-y` when the editor is non-interactive ("let the page handle scrolling over the editor, but not the browser zoom gestures (pinch, double-tap)"); `auto` when browser zoom is allowed; back to `none` when navigation or a tool is permitted — https://github.com/excalidraw/excalidraw/blob/main/packages/excalidraw/css/styles.scss

**iOS Safari specifics**
- `100vh` is the **large** viewport, so it can exceed the visible area while browser chrome is expanded. Use `dvh` for the current visible size, or `svh`/`lvh` explicitly: "`vh` is equivalent to `lvh`… If so, this could obscure content on a full-page display while the browser interface is expanded." — https://developer.mozilla.org/en-US/docs/Web/CSS/length
- Edge-to-edge layouts need `viewport-fit=cover` **plus** safe-area padding: the WebKit post documents `env(safe-area-inset-left/right/top/bottom)` and states that after switching to `viewport-fit=cover`, "some of the page's content is obscured by the device's sensor housing, and the bottom navigation bar is very hard to use" — which is exactly the failure mode for a **bottom toolbar / bottom sheet**. `env()` has a fallback form (`env(safe-area-inset-bottom, 0px)`) and has been Baseline-wide since January 2020 — https://webkit.org/blog/7929/designing-websites-for-iphone-x/ · https://developer.mozilla.org/en-US/docs/Web/CSS/env
- `viewport-fit` is a `viewport` meta extension; `width=device-width` is what makes the CSS pixel viewport equal the device width — https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag
- Browser-zoom gesture conflicts: Excalidraw keeps `GESTURE_START/GESTURE_CHANGE/GESTURE_END` handlers **explicitly documented as "fires only on Safari"**, calls `preventDefault()`, and refuses to apply the gesture's own scale on touch screens because the gesture event "only has zoom factor but not the center" — https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/App.tsx

**Accessibility notes**
- WCAG 2.2 SC 2.5.8 (AA) — 24×24 CSS px minimum target with spacing/equivalence exceptions — https://github.com/w3c/wcag/blob/main/guidelines/sc/22/target-size-minimum.html
- Practical web.dev guidance — ~48 device-independent px targets, ~8px spacing, achievable via padding on a smaller icon — https://web.dev/articles/accessible-tap-targets
- Figma targets **WCAG 2.2 AA** and ships keyboard navigation primitives: `F6`/`Ctrl+F6` to move between top-level UI areas, `Tab` within sections, `⌘K`/`Ctrl+K` actions menu, plus **adjustable UI scale** (`⌥⇧⌘0 / = / -` and the Windows equivalents) specifically so users can "Resize the toolbar, side panels, and menus". Mobile apps support VoiceOver (iOS) and TalkBack (Android). — https://help.figma.com/hc/en-us/articles/35063862380311-Accessibility-at-Figma
- Miro: "Single key shortcuts can be disabled to help with the use of assistive technologies"; it also exposes a **Reduce motion** and **Precise selection** toggle under Accessibility. — https://help.miro.com/hc/en-us/articles/360017731033-Shortcuts-and-hotkeys · https://help.miro.com/hc/en-us/articles/360017730553-Toolbars
- tldraw's UI layer includes "accessibility announcements" providers and docs state that hiding the UI keeps **keyboard shortcuts and clipboard handling working** — https://tldraw.dev/sdk-features/ui-components · https://tldraw.dev/examples/hide-ui
- React Flow exposes `ariaLabelConfig` to localise/override ARIA labels and descriptions for controls, minimap, etc. — https://reactflow.dev/api-reference/react-flow

---

## 6. Recommended approach for Diagram Studio (3-column React Flow tool)

### 6.1 Breakpoints to adopt

Mirror Excalidraw's scheme — it is the only surveyed tool with a fully published, currently-shipping rule set, and it happens to be the closest architectural analogue (infinite canvas, left tool palette, right property panel, desktop-first).

| Tier | Rule | Layout |
|---|---|---|
| `phone` | `width <= 599` **or** (`height < 500` **and** `width < 1000`) | Single-column canvas. **Bottom** toolbar, top-**center** slim bar for undo/redo + menu. Left palette and right inspector become **off-canvas drawers / bottom sheets**. |
| `tablet` (portrait) | `min(w,h) >= 600 && max(w,h) <= 1180` and `w <= h` | Canvas + drawers, but the **right inspector may stay docked** at ~248px in landscape; in portrait, drawers. |
| `tablet` (landscape) / small laptop | width `> 1180` | Keep the 3-column grid; both panels **collapsible**; inspector still auto-hides with no selection. |
| `desktop` | width `> 1229` | 3-column grid, both panels collapsible **and** dockable; collapsed state persisted. |

Rationale for 1229 rather than 1280: Excalidraw's `MQ_RIGHT_SIDEBAR_MIN_WIDTH` is 1229 and it is a shipped, tested value for "is there room for a right sidebar beside an infinite canvas". The current 1279.98px breakpoint is close enough that moving to 1229 is a small, defensible change — but if you prefer not to move it, keep 1279.98 as the "3-column" threshold and use 599/1180 for the rest. **Do not invent a fifth number without reason.**

Also copy the landscape-phone rule (`height < 500 && width < 1000`): a 932×430 iPhone in landscape is *not* a tablet, and a naive width-only test will wrongly keep side panels visible.

### 6.2 Phone: where things go

- **Toolbar at the bottom, not top-center.** Both surveyed touch-native canvases put creation tools at the bottom: tldraw's bottom zone houses "navigation controls, the main toolbar with drawing tools" and moves the style panel into a popover opened **from the toolbar**; draw.io puts zoom tools "in the toolbar at the bottom right of the screen"; FigJam iPad puts `+` in the **bottom** toolbar. The existing top-center floating toolbar should move to bottom-center (or split: history/menu top, tools bottom) on phone.
  - tldraw: https://tldraw.dev/sdk-features/ui-components
  - draw.io: https://www.drawio.com/docs/tutorials/touch-screen-diagrams/
  - FigJam iPad: https://help.figma.com/hc/en-us/articles/4502073572247-FigJam-for-iPad
- **Use `<Panel position="bottom-center">`** — it is a first-class React Flow affordance and already carries the correct absolute positioning and z-index — https://reactflow.dev/api-reference/components/panel
- **Bottom sheets for the palette and inspector.** Precedent: tldraw moves the style panel into a popover from the toolbar on mobile; Excalidraw swaps in a dedicated `MobileToolbar` and a `"mobile"` styles-panel mode. Sheet height should leave the canvas visible (a peek/partial sheet, expandable) — https://tldraw.dev/sdk-features/ui-components · https://github.com/excalidraw/excalidraw/blob/master/packages/common/src/editorInterface.ts
- **Respect safe-area insets.** Any bottom-anchored bar needs `padding-bottom: env(safe-area-inset-bottom, 0px)` and the page needs `viewport-fit=cover`, otherwise the bottom toolbar is "very hard to use" per WebKit's own write-up — https://webkit.org/blog/7929/designing-websites-for-iphone-x/
- **Use `dvh`, not `vh`, for full-height layout** — https://developer.mozilla.org/en-US/docs/Web/CSS/length
- **Minimum practical viewport:** no tool publishes a hard floor for phones. Miro's phone app requires iOS 16+/Android 7+ with no px floor; its **tablet** app documents **768×1024 minimum**. Excalidraw's phone tier starts at ≤599px. Practical target: **design at 360 CSS px width** and treat anything under ~320px as unsupported. State this as a judgement call, not a sourced number.

### 6.3 Mandatory touch changes

These are the ones with documented evidence that skipping them breaks real behaviour:

1. **Long-press (≈500 ms) opens the context menu** instead of right-click, and must be **cancelled by a second pointer** so pinching never opens a menu. 500 ms matches both Excalidraw's `TOUCH_CTX_MENU_TIMEOUT = 500` and tldraw's `longPressDurationMs = 500`.
2. **Two-finger pan/zoom while a tool could be drawing**, and single-finger pan on empty canvas. Miro tablet: "Single or two finger scroll to move canvas". FigJam iPad: "Use two fingers to move around the canvas while drawing."
3. **Raise drag/connection thresholds for coarse pointers.** tldraw's defaults are 4px → 6px for shape drag and 4px → 25px for UI drag on touch; React Flow's `nodeDragThreshold` and `connectionDragThreshold` default to 1px and should be raised (start ~4–8px) on touch. Suppressing accidental drags is explicitly why these knobs exist.
4. **Tap-handle → tap-handle connection**, via React Flow's `connectOnClick` (already default `true`) — keep it on and make it discoverable; the official touch example adds a bounce animation on the active handle.
5. **Enlarge handles and all interactive hit targets.** 6px → 20px handles per React Flow's own touch example; nothing below 24×24 CSS px (WCAG 2.2 AA), aiming for 44–48px for primary controls per web.dev.
6. **Kill hover-only affordances.** Tooltips and hover-reveal controls must become either always-visible or tap-triggered. Gate them behind `@media (hover: hover)` rather than removing them entirely.
7. **Decide `zoomOnDoubleClick` explicitly.** React Flow's own source warns that double-tap **bypasses the gesture filter** and fires `dblclick.zoom` directly on the selection. If double-tap-in-canvas means "add node" or "fit", turn it off.
8. **Consider a view-only first touch.** Miro opens mobile boards in view-only mode so a pan doesn't move objects. This is a strong pattern for a shared tool where a new user's first gesture should not mutate the diagram.

### 6.4 Desktop panel collapse

- **Affordance:** a chevron/toggle button on the panel edge **plus** a keyboard shortcut, matching the two most-established precedents (draw.io's *Fullscreen*/*Format* toggle buttons; Figma's `⌘⇧\` minimize / `⌘\` hide). Do **not** use double-click-on-divider as the only affordance — no surveyed tool documents that, and it conflicts with resizable-panel double-click-to-reset conventions. A drag-to-resize divider can still exist alongside, but the collapse must be a discrete button + shortcut.
- **Two levels, like Figma:** (a) collapse one panel, (b) "hide all UI" to reclaim the whole window. Level (b) is cheap to add given a floating toolbar is already re-showable.
- **Persist the collapsed state.** This is the single highest-value, lowest-cost item with direct precedent: Excalidraw stores `desktopUIMode` in `localStorage` and re-reads it on every interface refresh, wrapped in try/catch. Persist *per-panel* collapsed booleans under one namespaced key.
- **Keep the existing selection-driven inspector auto-hide.** Figma's minimised-UI behaviour is identical ("Once all objects are deselected, the right sidebar minimizes again") — so Diagram Studio is already aligned with the mature pattern; just make sure that when a panel is *manually* collapsed, selecting a node does **not** silently re-expand it (Figma's auto-expand applies to *minimize*, which is a distinct state from a user-collapsed panel — worth deciding explicitly and documenting in the UI).
- Add a `dockedSidebarBreakpoint`-style escape hatch (an overridable constant) so embedders/narrow-panel hosts can force the compact layout — Excalidraw exposes exactly this as `UIOptions.dockedSidebarBreakpoint`, and tldraw exposes `forceMobile` for the same reason.

### 6.5 Build order

1. **Centralise a single `useEditorInterface()` hook** returning `{ formFactor, isTouchScreen, isLandscape, canFitSidebar }`, driven by `ResizeObserver` on the editor container (Excalidraw measures `container.getBoundingClientRect()`, **not** the window — critical for a shareable, embeddable tool).
2. **Desktop panel collapse + persistence** (cheap, no touch risk, immediately useful, and the only feature with a clean persistence precedent).
3. **Touch hardening on the existing layout** — long-press context menu, coarse drag thresholds, bigger handles, `connectOnClick`, `zoomOnDoubleClick` decision. This works at *all* sizes and can be verified on a desktop touch device / DevTools emulation.
4. **Tablet tier** — drawers in portrait, docked inspector in landscape.
5. **Phone tier** — bottom toolbar + bottom sheets + safe-area + `dvh`. Requires the most new UI, so it goes last.

Rationale for this order: items 2–3 are independent of the drawer/bottom-sheet UI work and are testable on a desktop browser with device emulation, so they de-risk the largest chunk (item 5). Excalidraw's own touch meta-issue shows that "desktop-first, touch bolted on" is the failure mode that produces a backlog of tablet defects — https://github.com/excalidraw/excalidraw/issues/9705

### 6.6 Explicitly unverified / open questions

- Whether Figma, draw.io, Miro, tldraw, Lucid or Whimsical **persist** their collapsed-UI state is not documented anywhere found. Only Excalidraw is confirmed.
- No tool publishes CSS px breakpoints except Excalidraw and tldraw. Any "tablet starts at 768px" advice is from Miro's **minimum resolution** requirement for a native app, not a web media query.
- Whimsical's tablet layout and desktop panel behaviour are undocumented; its phone behaviour is read-only. Do not treat Whimsical as a design reference for editing UX.
- The Obsidian Excalidraw plugin's mobile support exists (README lists it, and it ships a "Toggle Fullscreen on Mobile" script) but no breakpoints, drawer behaviour, or mobile layout are documented in the repo.
- tldraw's exact toolbar position is inferred from the documented UI zone diagram (bottom zone houses "navigation controls, the main toolbar with drawing tools") plus the statement that the style panel moves into a toolbar-opened popover on mobile — the docs do not say "bottom-left" in so many words.
