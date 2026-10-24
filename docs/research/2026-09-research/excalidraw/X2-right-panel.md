# X2 — Excalidraw's properties panel: sections, order, control types, conditional logic

**Cluster:** right-hand properties panel. **Deliverable status:** grounded in source, all claims cited.

---

## 1. What I read

**Repository:** `https://github.com/excalidraw/excalidraw`
**Pinned commit:** `c0ad61c6743aef7623e641cd1460d757cc6cacf3` — `2026-09-16 19:50:39 +0200` — *feat(editor): rightclick to pan canvas (#12110)*
**Clone:** `git clone --depth 1 --filter=blob:none` → `/tmp/excalidraw` (92 MB)

`df -h /` before the clone: 96 G total, 37 G used, **60 G available (39 %)**, unchanged after. Well under the GB-scale stop condition.

### Files opened (all under `/tmp/excalidraw/packages/`)

| Path | Why |
|---|---|
| `excalidraw/components/Actions.tsx` (945 lines) | The panel itself: `SelectedShapeActions`, `CompactShapeActions`, `MobileShapeActions`, `LayersFieldset`, `AlignFieldset` |
| `excalidraw/components/shapeActionPredicates.ts` (191) | **Every visibility condition in one object** |
| `excalidraw/components/LayerUI.tsx` (758) | Where the panel is mounted and where it is gated |
| `element/src/showSelectedShapeActions.ts` (22) | Top-level "show the panel at all" predicate |
| `excalidraw/actions/actionProperties.tsx` (2293) | Every `PanelComponent` — the actual controls |
| `excalidraw/actions/actionZindex.tsx` (156) | Layers buttons |
| `excalidraw/actions/actionAlign.tsx`, `actionDistribute.tsx` | Align/distribute predicates |
| `excalidraw/actions/actionGroup.tsx`, `actionDuplicateSelection.tsx`, `actionDeleteSelected.tsx`, `actionLink.tsx`, `actionCropEditor.tsx`, `actionLinearEditor.tsx` | Actions fieldset buttons |
| `excalidraw/components/RadioSelection.tsx`, `RadioButton.tsx`, `IconButton.tsx`, `IconPicker.tsx`, `Range.tsx` | Control primitives |
| `excalidraw/components/FontPicker/{FontPicker,FontPickerList,FontPickerTrigger,FontPicker.scss}` | Font control |
| `excalidraw/components/ColorPicker/{ColorPicker.tsx,TopPicks.tsx,ColorPicker.scss}` | Stroke/background swatch rows |
| `excalidraw/css/{styles.scss,theme.scss,variables.module.scss,app.scss}` | Exact CSS values |
| `excalidraw/components/{ToolIcon.scss,Actions.scss,FontPicker/FontPicker.scss,Range.scss,IconPicker.scss,Island.scss,FixedSideContainer.scss,LayerUI.scss}` | Control geometry |
| `common/src/constants.ts`, `common/src/font-metadata.ts`, `common/src/utils.ts`, `common/src/editorInterface.ts`, `common/src/colors.ts` | Fonts, sizes, modes |
| `element/src/comparisons.ts`, `element/src/textElement.ts`, `element/src/selection.ts`, `element/src/showSelectedShapeActions.ts` | Per-type capability predicates |
| `excalidraw/fonts/Fonts.ts`, `fonts/*/index.ts` | Font registry |
| `excalidraw/locales/en.json` | Every label string |

**Docs pages read:** `https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/ui-options` (only relevant snippet: `UIOptions.canvasActions` can hide an individual panel action; `renderAction` consults it — `actions/manager.tsx:183–190`). Everything else in this report is source, not docs.

---

## 2. Findings

### 2.0 ⚠️ Two corrections to the brief before anything else

**(a) There is no right-hand properties panel in Excalidraw.** The properties panel is mounted in the **top-left**, in the same grid cell as the hamburger menu:

```
components/LayerUI.tsx:301-330
  const renderFixedSideContainer = () => {
    const shouldRenderSelectedShapeActions =
      defaultUIEnabled && showSelectedShapeActions(appState, elements);
    ...
      <FixedSideContainer side="top">
        <div className="App-menu App-menu_top">
          <Stack.Col gap={spacing.menuTopGap} className={clsx("App-menu_top__left")}>
            {renderCanvasActions()}
            ...
              <div className={clsx("selected-shape-actions-container", {...})}>
                {shouldRenderSelectedShapeActions && renderSelectedShapeActions()}
```

with `css/styles.scss:405-421`:

```scss
  .App-menu_top > .App-menu_top__left {
    grid-column: 1;
    justify-self: start;
```

`css/styles.scss:388-403` — `.App-menu_top { grid-template-columns: 1fr 2fr 1fr }`. Column 3 (`layer-ui__wrapper__top-right`) holds the **library sidebar trigger** and collaborators — that is the only right-side surface (`LayerUI.tsx:400-436`). If Diagram Studio puts the properties panel on the right, that is a deliberate divergence from Excalidraw, not a copy of it. Worth flagging to Harvey.

**(b) The user's screenshot is a TEXT element selection, and the order in it is exactly right.** It is not a generic "all shapes" panel. Section order for a **standalone text element**, derived from `Actions.tsx:168-222` + `shapeActionPredicates.ts`:

| Predicate | Value for a bare `text` element | Consequence |
|---|---|---|
| `strokeColor` | `hasStrokeColor("text")` → **true** (`comparisons.ts:27`) | **Stroke** shown |
| `backgroundColor` | `hasBackground("text")` → **false** (`comparisons.ts:3-14` has no `text`) | Background hidden |
| `fill` | needs `hasFillStyle` → false | Fill hidden |
| `strokeWidth` | `hasStrokeWidth("text")` → false (`comparisons.ts:31-40`) | hidden |
| `strokeStyle` | false | hidden |
| `sloppiness` | `hasRoughness("text")` → false | hidden |
| `roundness` | `canChangeRoundness("text")` → false | Edges hidden |
| `arrowType` | false | hidden |
| `text` | `targetElements.some(isTextElement)` → **true** | **Font family + Font size** shown |
| `textAlign` | `suppportsHorizontalAlign` → **true** (`textElement.ts:475 isTextElement(element)`) | **Text align** shown |
| `verticalAlign` | `shouldAllowVerticalAlign` → false (`textElement.ts:446-459`, requires `isBoundToContainer`) | vertical align hidden |
| `opacity` | `activeToolType !== "autoshape"` → true | **Opacity** shown |
| `layers` | true | **Layers** shown |
| `align` | needs >1 grouped selection → false | Align hidden |
| `showExtraActions` | `hasSelection && !isEditingTextOrNewElement` → true | **Actions** shown |

Result: **Stroke · Font family · Font size · Text align · Opacity · Layers · Actions.** Identical to the screenshot. The screenshot is a text element; I am confident of this because every omission is explained by the text-element capability table and nothing else.

**Also a correction:** Font size's 4 buttons are **Small / Medium / Large / Very large** — the 4th is `labels.veryLarge`, *not* "XL" / "Extra large" (`actionProperties.tsx:1043-1049`, `locales/en.json: labels.veryLarge = "Very large"`). And Font family has **3 real options + 1 popover trigger**, not 4 font options (see §5).

---

### 2.1 Every section in DOM order (full/desktop layout)

Source of truth: **`components/Actions.tsx:167-223`**.

```tsx
  return (
    <div className="selected-shape-actions">
      <div>{predicates.strokeColor && renderAction("changeStrokeColor")}</div>          // 169
      {predicates.backgroundColor && (<div>{renderAction("changeBackgroundColor")}</div>)} // 170-172
      {predicates.fill && renderAction("changeFillStyle")}                              // 173
      {predicates.strokeWidth && renderAction("changeStrokeWidth")}                     // 175
      {predicates.strokeStyle && <>{renderAction("changeStrokeStyle")}</>}              // 177
      {predicates.freedrawMode && renderAction("changeFreedrawMode")}                   // 179
      {predicates.sloppiness && <>{renderAction("changeSloppiness")}</>}                // 181
      {predicates.roundness && <>{renderAction("changeRoundness")}</>}                  // 183
      {predicates.arrowType && <>{renderAction("changeArrowType")}</>}                  // 185
      {predicates.text && (
        <>
          <fieldset>{renderAction("changeFontFamily")}</fieldset>                        // 189
          {renderAction("changeFontSize")}                                              // 190
          {predicates.textAlign && renderAction("changeTextAlign")}                      // 191
        </>
      )}
      {predicates.verticalAlign && renderAction("changeVerticalAlign")}                  // 195
      {predicates.arrowheads && <>{renderAction("changeArrowhead")}</>}                  // 196
      {predicates.opacity && renderAction("changeOpacity")}                              // 198
      {predicates.layers && <LayersFieldset renderAction={renderAction} />}              // 200
      {predicates.align && (<AlignFieldset ... showDistribute={predicates.distribute} />)} // 202-207
      {predicates.showExtraActions && (<fieldset><legend>{t("labels.actions")}</legend>  // 208-221
          {renderAction("duplicateSelection")}{renderAction("deleteSelectedElements")}
          {renderAction("group")}{renderAction("ungroup")}
          {predicates.link && renderAction("hyperlink")}
          {predicates.cropEditor && renderAction("cropEditor")}
          {predicates.lineEditor && renderAction("toggleLinearEditor")}
      </fieldset>)}
    </div>
  );
```

Mounted at **`LayerUI.tsx:277-296`** as `<Island className={CLASSES.SHAPE_ACTIONS_MENU} padding={2} style={{maxHeight: `${appState.height - 166}px`}} data-viewport-ui="side" data-viewport-ui-name="stylesPanel">`, inside `<Section heading="selectedShapeActions" className="selected-shape-actions zen-mode-transition">` (`LayerUI.tsx:249-256`). `CLASSES.SHAPE_ACTIONS_MENU = "App-menu__left"` (`common/src/constants.ts:106`).

The whole panel is gated by **`element/src/showSelectedShapeActions.ts:7-22`**:

```ts
export const showSelectedShapeActions = (appState, elements) =>
  Boolean(
    !appState.viewModeEnabled &&
      appState.openDialog?.name !== "elementLinkSelector" &&
      ((appState.activeTool.type !== "custom" &&
        (appState.editingTextElement ||
          (appState.activeTool.type !== "selection" &&
            appState.activeTool.type !== "lasso" &&
            appState.activeTool.type !== "eraser" &&
            appState.activeTool.type !== "hand" &&
            appState.activeTool.type !== "laser"))) ||
        getSelectedElements(elements, appState).length),
  );
```

i.e. **the panel only exists when a drawing tool is active or something is selected** — with `selection`/`eraser`/`hand`/`lasso`/`laser` and nothing selected, the entire panel is gone.

#### Full table of sections, and where each one's component lives

| # | `path:line` in `Actions.tsx` | Section label (`legend`/`h3`) | Component that renders it | Wrapper element |
|---|---|---|---|---|
| 1 | 169 | `labels.stroke` = **"Stroke"** (or **"Text color"** for sticky notes) | `actionChangeStrokeColor` `actionProperties.tsx:358-435` | `<div>` (+ `<h3>` in full mode, `:412`) |
| 2 | 170-172 | `labels.background` = **"Background"** | `actionChangeBackgroundColor` `:437-551` | `<div>` (+ `<h3>`, `:524`) |
| 3 | 173 | `labels.fill` = **"Fill"** | `actionChangeFillStyle` `:606-689` | `<fieldset><legend>` `:636-637` |
| 4 | 175 | `labels.strokeWidth` = **"Stroke width"** | `actionChangeStrokeWidth` `:708-764` | `<fieldset><legend>` `:726-727` |
| 5 | 177 | `labels.strokeStyle` = **"Stroke style"** | `actionChangeStrokeStyle` `:901-954` | `<fieldset><legend>` `:919-920` |
| 6 | 179 | `labels.pressure` = **"Pressure"** | `actionChangeFreedrawMode` `:820-899` | `<fieldset><legend>` `:875-876` |
| 7 | 181 | `labels.sloppiness` = **"Sloppiness"** | `actionChangeSloppiness` `:766-818` | `<fieldset><legend>` `:783-784` |
| 8 | 183 | `labels.edges` = **"Edges"** | `actionChangeRoundness` `:1743-1823` | `<fieldset><legend>` `:1785-1786` |
| 9 | 185 | `labels.arrowtypes` = **"Arrow type"** | `actionChangeArrowType` `:2052-2291` | `<fieldset><legend>` `:2244-2245` |
| 10 | 189 | `labels.fontFamily` = **"Font family"** | `actionChangeFontFamily` PanelComponent `:1358-1540` → `FontPicker` | `<fieldset>` (legend emitted *inside* the action, `:1437-1439`) |
| 11 | 190 | `labels.fontSize` = **"Font size"** | `actionChangeFontSize` `:999-1093` | `<fieldset><legend>` `:1020-1021` |
| 12 | 191 | `labels.textAlign` = **"Text align"** | `actionChangeTextAlign` `:1542-1641` | `<fieldset><legend>` `:1581-1582` |
| 13 | 195 | *(no legend)* | `actionChangeVerticalAlign` `:1643-1741` | bare `<fieldset>` `:1680-1681` |
| 14 | 196 | `labels.arrowheads` = **"Arrowheads"** | `actionChangeArrowhead` `:1939-2031` | `<fieldset><legend>` `:1990-1991` |
| 15 | 198 | `labels.opacity` = **"Opacity"** | `actionChangeOpacity` `:956-997` | `<Range label=…>` → `<label class="control-label">` |
| 16 | 200 | `labels.layers` = **"Layers"** | `LayersFieldset` `Actions.tsx:65-79` | `<fieldset><legend>` `:70-71` |
| 17 | 202-207 | `labels.align` = **"Align"** | `AlignFieldset` `Actions.tsx:85-130` | `<fieldset><legend>` `:95-96` |
| 18 | 208-221 | `labels.actions` = **"Actions"** | inline in `Actions.tsx` | `<fieldset><legend>` `:209-210` |

`LayersFieldset` (`Actions.tsx:65-79`) renders, in order: `sendToBack`, `sendBackward`, `bringForward`, `bringToFront`. `AlignFieldset` (`:85-130`) renders one `<div className="buttonList">` in two wrap-rows split by `<div style={{flexBasis:"100%", height:0}} />`: row 1 = alignLeft, alignHorizontallyCentered, alignRight (+distributeHorizontally if `showDistribute`); row 2 = alignTop, alignVerticallyCentered, alignBottom (+distributeVertically). RTL swaps row 1 (`:98-110`).

**Special case — the bucket-fill tool** short-circuits the whole panel (`Actions.tsx:157-165`):

```tsx
  if (appState.activeTool.type === "bucketfill") {
    return (
      <div className="selected-shape-actions">
        <div>{renderAction("changeBucketFillBackgroundColor")}</div>
        {renderAction("changeFillStyle")}
        {renderAction("changeOpacity")}
      </div>
    );
  }
```

Three sections only: Background (transparent excluded, `actionProperties.tsx:579-589`), Fill, Opacity. No stroke at all.

#### Other layouts (the panel is not one layout — it is three)

`deriveStylesPanelMode` (`common/src/editorInterface.ts:152-164`): `phone → "mobile"`, `tablet → "compact"`, else `editorInterface.desktopUIMode` (`"compact" | "full"`, persisted under `localStorage["excalidraw.desktopUIMode"]`, `:16`).

- **`full`** → `SelectedShapeActions` — the flat column above.
- **`compact`** (tablet, or desktop opted into compact) → `CompactShapeActions` (`Actions.tsx:612-724`), an icon rail of popovers: Stroke colour · Background colour · *(freedraw)* · `CombinedShapeProperties` popover (Fill, Stroke width, freedraw mode, Stroke style, Sloppiness, Edges, Opacity — `:290-306`) · `CombinedArrowProperties` popover (arrowheads + arrow type — `:402`, rendered only `if (!predicates.arrowType) return null`, `:331-333`) · line editor · font family trigger · `CombinedTextProperties` popover (**Font size, Text align, vertical align** — `:484-488`; note font *family* is a standalone trigger, not in this popover) · duplicate · delete · `CombinedExtraActions` popover (Layers, Align, group, ungroup, link, crop — `:560-582`).
- **`mobile`** → `MobileShapeActions` (`Actions.tsx:731-882`), a horizontal bottom bar. Measured overflow decides whether duplicate/delete are promoted out of the popover (`:754-769`): `MIN_ACTIONS = 9`, `GAP = 6`, `WIDTH = 32`, `MIN_WIDTH = 9*32 + 8*6`. `showDuplicateOutside = ACTIONS_WIDTH >= MIN_WIDTH + 2*(32+6)`, `showDeleteOutside = ACTIONS_WIDTH >= MIN_WIDTH + 38`.

Also: `renderAction` returns `null` for any action whose name is in `UIOptions.canvasActions` and falsy (`actions/manager.tsx:183-191`), so a host app can delete a section by name.

---

### 2.2 Which sections are conditional — and on exactly what

All conditions live in **one function**, `getShapeActionPredicates` (`components/shapeActionPredicates.ts:88-189`). This is the key architectural fact: *all three layouts consume the same predicates; layout is pure.* From the file's own doc comment (`:81-87`):

> Single source of truth for "which shape-action controls are relevant right now". Each flag answers whether a given control should be shown, given the active tool and the current selection. All three styles-panel layouts (full / compact / mobile) and the compact popovers consume these flags so that visibility logic lives in one place and layout stays pure.

The two inputs are `targetElements` and `activeToolType`:

```ts
// shapeActionPredicates.ts:94, 98-102
const activeToolType = appState.activeTool.type;
const forToolOrSelection = (predicate: (type: ElementOrToolType) => boolean) =>
  predicate(activeToolType) || targetElements.some((element) => predicate(element.type));
```

And `targetElements` = **`element/src/selection.ts:215-231`**:

```ts
export const getTargetElements = (elements, appState) =>
  appState.editingTextElement
    ? [appState.editingTextElement]
    : appState.newElement && appState.activeTool.type !== "autoshape"
    ? [appState.newElement]
    : getSelectedElements(elements, appState, { includeBoundTextElement: true });
```

**Three modes of "what the panel describes":** (a) the text element being edited, (b) the element currently being drawn, (c) the selection *including bound label text elements*.

`singleSelected` / `hasSelection` / `isEditingTextOrNewElement` (`:104-115`):

```ts
const singleSelected = targetElements.length === 1;
const isSingleElementBoundContainer =
  targetElements.length === 2 &&
  (hasBoundTextElement(targetElements[0]) || hasBoundTextElement(targetElements[1]));
const isEditingTextOrNewElement = Boolean(appState.editingTextElement || appState.newElement);
const hasSelection = targetElements.length > 0;
```

Full predicate object, verbatim (`:117-188`):

```ts
  return {
    hasSelection,
    showExtraActions: hasSelection && !isEditingTextOrNewElement,

    strokeColor: canChangeStrokeColor(appState, targetElements),
    backgroundColor: canChangeBackgroundColor(appState, targetElements, elementsMap),
    fill:
      activeToolType === "bucketfill" ||
      (hasFillStyle(activeToolType) && !isTransparent(appState.currentItemBackgroundColor)) ||
      targetElements.some(
        (element) => hasFillStyle(element.type) && !isTransparent(element.backgroundColor),
      ),

    strokeWidth: forToolOrSelection(hasStrokeWidth),
    freedrawMode: forToolOrSelection(hasFreedrawMode),
    strokeStyle: forToolOrSelection(hasStrokeStyle),
    sloppiness: forToolOrSelection(hasRoughness),
    roundness: forToolOrSelection(canChangeRoundness),
    arrowType: forToolOrSelection(toolIsArrow),
    arrowheads: forToolOrSelection(canHaveArrowheads),

    text: activeToolType === "text" || targetElements.some(isTextElement),
    textAlign:
      activeToolType === "text" || suppportsHorizontalAlign(targetElements, elementsMap),
    verticalAlign: shouldAllowVerticalAlign(targetElements, elementsMap),

    opacity: activeToolType !== "autoshape" || hasSelection,

    layers:
      (activeToolType !== "freedraw" &&
        activeToolType !== "autoshape" &&
        !targetElements.some((element) => element.type === "freedraw")) ||
      getSelectedElements(elementsMap, appState).some(
        (element) => element.type === "freedraw",
      ),
    align: !isSingleElementBoundContainer && alignActionsPredicate(appState, app),
    distribute: targetElements.length > 2,

    link: singleSelected || isSingleElementBoundContainer,
    linkSingleOnly: singleSelected,
    cropEditor: !appState.croppingElementId && singleSelected && isImageElement(targetElements[0]),
    lineEditor:
      !appState.selectedLinearElement?.isEditing &&
      singleSelected &&
      isLinearElement(targetElements[0]) &&
      !isElbowArrow(targetElements[0]),
  };
```

The per-type capability predicates these call are all in **`element/src/comparisons.ts`** (quoted in full in §2.3).

#### The FONT section specifically — question 2's core ask

```ts
// shapeActionPredicates.ts:151-155
    text: activeToolType === "text" || targetElements.some(isTextElement),
    textAlign:
      activeToolType === "text" || suppportsHorizontalAlign(targetElements, elementsMap),
    verticalAlign: shouldAllowVerticalAlign(targetElements, elementsMap),
```

- **Font family + Font size are shown ⟺ `appState.activeTool.type === "text"` OR the target list contains an element with `type === "text"`** (`isTextElement`, `element/src/typeChecks.ts:67-71`). Because `getTargetElements` passes `includeBoundTextElement: true` (`selection.ts:229-231`), a **shape with a bound label also has its text element in `targetElements` → the font controls appear for a labelled rectangle/ellipse/diamond/arrow**. A bare shape with no label has no text element → **hidden**.
- **Hidden while dragging out a new shape** (`appState.newElement`, `activeTool.type !== "autoshape"`, `selection.ts:227-228`): `targetElements === [newElement]`, not a text element → hidden, unless the text tool is the active tool.
- **Hidden when nothing is selected and the active tool is `selection`/`lasso`/`eraser`/`hand`/`laser`** — because the whole panel is unmounted (`showSelectedShapeActions.ts:14-20`).
- **Text align** has its own, narrower condition. `suppportsHorizontalAlign` (`element/src/textElement.ts:462-477`):

```ts
export const suppportsHorizontalAlign = (selectedElements, elementsMap) =>
  selectedElements.some((element) => {
    if (isBoundToContainer(element)) {
      const container = getContainerElement(element, elementsMap);
      if (isArrowElement(container)) {
        return false;      // ← an arrow's label cannot be h-aligned
      }
      return true;
    }
    return isTextElement(element);
  });
```

So: **an arrow's bound label shows Font family + Font size but NOT Text align.** (Verified from the same shape of rule in `shouldAllowVerticalAlign`, `textElement.ts:446-460` → **an arrow's label also loses vertical align**; a rectangle/ellipse/diamond's label keeps both.)
- **`activeToolType === "text"` forces `textAlign: true`** even with no selection, matching `text: true`.
- `verticalAlign` never has `activeToolType === "text"` in its condition — it is purely selection-driven and requires `isBoundToContainer` (`textElement.ts:451`).

#### Element-type matrix (derived from `comparisons.ts` + the predicates above)

`✓` = shown when that type alone is selected (no bound label). Read the `comparisons.ts` block below to check any cell.

| Section | rect | ellipse | diamond | arrow | line | text | freedraw | image | frame | stickynote | embeddable |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Stroke | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | ✓ | ✓ |
| Background | ✓ | ✓ | ✓ | – | ✓ | – | ✓ | – | – | ✓ | ✓ |
| Fill | ✓ | ✓ | ✓ | – | ✓ | – | ✓ | – | – | – | ✓ |
| Stroke width | ✓ | ✓ | ✓ | ✓ | ✓ | – | ✓ | – | – | – | ✓ |
| Stroke style | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | – | – | – | ✓ |
| Pressure | – | – | – | – | – | – | ✓ | – | – | – | – |
| Sloppiness | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | – | – | ✓ | ✓ |
| Edges (roundness) | ✓ | – | ✓ | – | ✓ | – | – | ✓ | – | ✓ | ✓ |
| Arrow type | – | – | – | ✓ | – | – | – | – | – | – | – |
| Font family / size | (label only) | (label only) | (label only) | (label only) | – | ✓ | – | – | – | (label) | – |
| Text align | (label only) | (label only) | (label only) | – | – | ✓ | – | – | – | (label) | – |
| Vertical align | (label only) | (label only) | (label only) | – | – | – | – | – | – | (label) | – |
| Arrowheads | – | – | – | ✓ | – | – | – | – | – | – | – |
| Opacity | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Layers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | conditional | ✓ | ✓ | ✓ | ✓ |
| Align | needs >1 | | | | | | | | never | | |
| Actions | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Caveats on that table, from code:
- **Arrow + Edges:** `canChangeRoundness` (`comparisons.ts:57-64`) omits `arrow` — an arrow gets **Arrow type** (sharp / curved / elbow) instead of Edges. That is the swap (see §7).
- **Layers for freedraw** is the one non-obvious expression (`shapeActionPredicates.ts:162-168`): hidden while the freedraw tool is active with no real selection, but *shown* if a freedraw element is actually selected (the second disjunct).
- **Align is hidden for frames** (`actionAlign.tsx:39-53` — `!selectedElements.some((el) => isFrameLikeElement(el))`) and when `isSingleElementBoundContainer`.
- **The `-` cells are type-level.** `forToolOrSelection` means a section can also be visible because the *tool* supports it — e.g. with the rectangle tool active and nothing selected, Stroke/Background/Fill/Stroke width/Stroke style/Sloppiness/Edges/Opacity/Layers all show (`showSelectedShapeActions.ts:14-20` keeps the panel mounted for a non-selection tool).

#### Other conditional rules worth naming

- **Opacity is the only section with an `autoshape` rule**: `activeToolType !== "autoshape" || hasSelection` (`:157`) — during draw-shape recognition with nothing selected, Opacity disappears.
- **Actions (`showExtraActions`) disappears while typing text or drawing an element**: `hasSelection && !isEditingTextOrNewElement` (`:121`). During in-place text editing, `getTargetElements` returns `[editingTextElement]`, so `hasSelection` is true but `isEditingTextOrNewElement` is too → **the Actions row (duplicate/delete/group/link) is hidden while you are editing text**, while Layers/Stroke/Font stay.

---

### 2.3 Control type + exact styling of every control

#### Shared container & label metrics (`css/styles.scss:158-215`)

```scss
  .selected-shape-actions {
    display: flex;
    flex-direction: column;
    row-gap: 0.75rem;                       // 12px between sections

    h3, legend, .control-label {
      margin: 0;
      margin-bottom: 0.25rem;               // 4px
      font-size: 0.75rem;                   // 12px
      color: var(--text-primary-color);
      font-weight: 400;
      display: block;
    }

    .buttonList {
      flex-wrap: wrap;
      display: flex;
      column-gap: 0.5rem;                   // 8px
      row-gap: 0.5rem;                      // 8px

      label { font-size: 0.75rem; }         // 12px
      input[type="radio"], input[type="button"] {
        opacity: 0; position: absolute; pointer-events: none;
      }
      .iconRow { margin-top: 8px; }
    }

    fieldset { margin: 0; padding: 0; border: none; }
  }
```

Plus `css/styles.scss:856-860`: `.App-menu__left .buttonList { padding: 0.25rem 0; }` (4px vertical).

Island chrome (`components/Island.scss`): `background-color: var(--island-bg-color)`, `box-shadow: var(--shadow-island)`, `border-radius: var(--border-radius-lg)`, `padding: calc(var(--padding) * var(--space-factor))` — the panel passes `padding={2}`, so **8px**.

Panel size cap, `LayerUI.tsx:281-285`: `maxHeight: ${appState.height - 166}px` (viewport height minus ~166px for the hamburger + footer).

Theme scope: the panel gets `shape-actions-theme-scope` when in a popover (`Actions.tsx:57-60`), which only redefines button chrome (`Actions.scss:200-208`):

```scss
.shape-actions-theme-scope { --button-border: transparent; --button-bg: var(--color-surface-mid); }
:root.theme--dark .shape-actions-theme-scope {
  --button-hover-bg: #363541;
  --button-bg: var(--color-surface-high);
}
```

#### Control 1 — Stroke / Background: **swatch strip + single active swatch**. Not a segmented control.

Structure is a CSS grid (`ColorPicker.scss:66-81`):

```scss
  .color-picker-container {
    display: grid;
    grid-template-columns: 1fr 20px 1.625rem;
    padding: 0.25rem 0px;
    align-items: center;
  }
```

- **Top picks strip** (`TopPicks.tsx:88-161`): one `<button class="color-picker__button">` per colour. Stroke defaults `DEFAULT_ELEMENT_STROKE_PICKS` = **black, red[4], green[4], blue[4], yellow[4]** (`common/src/colors.ts:239-245`); background defaults include `transparent` first (`:248-254`). In `full` mode the strip is drag-and-droppable to re-pin colours (`ColorPicker.tsx:366`, `topPicksDnD`), with a right-click "reset" menu (`TopPicks.tsx:170-192`).
- **Swatch geometry** (`ColorPicker.scss:89-212`):

```scss
  .color-picker__button {
    --radius: 4px;
    --size: 1.375rem;          // 22px
    width: var(--size); height: var(--size);
    border: 0; border-radius: var(--radius);
    background-color: var(--swatch-color);
    &.active-color { border-radius: calc(var(--radius) + 1px); width: 1.625rem; height: 1.625rem; } // 26px
    &--large      { --radius: 6px; width: 1.875rem; height: 1.875rem; }                            // 30px
    &.compact-sizing { width: var(--mobile-action-button-size); height: var(--mobile-action-button-size); }
    &.has-outline { box-shadow: 0 0 0 1px var(--color-outline); }
    &.is-transparent { background-image: url("data:image/png;base64,…"); }  // checkerboard
  }
```

`--color-outline: var(--color-gray-20)` light / `var(--color-gray-80)` dark (`:5-8`).
- **Popup grid** (`:301-312`): `.color-picker-content--default { padding: 0.5rem; display: grid; grid-template-columns: repeat(5, 1.875rem); grid-gap: 0.25rem; border-radius: 4px; }` — 5 columns × 30px, 4px gaps, over the 13-colour `COLOR_PALETTE` ramp (`common/src/colors.ts:193-212`, open-color indexes 50/200/400/600/800).
- The **hex input** sits at `grid-column: 1 / span 5` (`:330-332`), with a `#` prefix chip and a rounded-rect input (`:334-357`, `:411-443`).
- Full-mode header: `<h3 aria-hidden="true">{label}</h3>` inside the PanelComponent, where `label` is **"Text color"** for a sticky-note target and **"Stroke"** otherwise (`actionProperties.tsx:406-412`).

#### Control 2–5, 7, 8, 9 — **segmented button rows** (2–4 `<button>`s), class `buttonList`

All of them use the same primitive, `RadioSelection` with `type="button"` for Fill/Stroke width/Sloppiness/Edges/Arrow type/Stroke style (`RadioSelection.tsx:31-40` → `RadioButton.tsx:20-33`), or `type="radio"` (a `<label><input type=radio hidden>`) for Font size/Text align/Vertical align (`RadioSelection.tsx:41-56`). Both render as square icon buttons; the radio input is made invisible + non-interactive by `styles.scss:198-203`, so the visual result is identical.

Sizing, `ToolIcon.scss` + `variables.module.scss:107-192`:

```scss
@mixin outlineButtonStyles {
  display: flex; justify-content: center; align-items: center;
  padding: 0.625rem;
  width: var(--button-width, var(--default-button-size));
  height: var(--button-height, var(--default-button-size));
  box-sizing: border-box;
  border-width: 1px; border-style: solid;
  border-color: var(--button-border, var(--default-border-color));
  border-radius: var(--border-radius-lg);
  background-color: var(--button-bg, var(--island-bg-color));
  svg { width: var(--button-width, var(--lg-icon-size)); height: var(--button-height, var(--lg-icon-size)); }
  &.active, &.ToolIcon--checked {
    background-color: var(--button-selected-bg, var(--color-surface-primary-container));
    border-color:     var(--button-selected-border, var(--color-surface-primary-container));
    svg { color: var(--button-color, var(--color-on-primary-container)); }
  }
}
@mixin outlineButtonIconStyles {
  @include outlineButtonStyles;
  & { padding: 0; }
  svg { width: var(--default-icon-size); height: var(--default-icon-size); }
}
```

with `styles.scss:244-259`:

```scss
  .buttonList {
    .ToolIcon__icon { all: unset !important; display: flex !important; }
    button { background-color: transparent; }
    label, button, .zIndexButton { @include outlineButtonIconStyles; }
  }
```

**Exact numbers:**

| Token | Value | Source |
|---|---|---|
| `--default-button-size` | `2rem` = **32px** (`2.25rem`/36px at `min-device-width: 1921px`) | `theme.scss:47`, `:175` |
| `--default-icon-size` | `1rem` = **16px** (`1.25rem` ≥1921px) | `theme.scss:48`, `:176` |
| `--lg-button-size` | `2.25rem` = **36px** | `theme.scss:49` |
| `--lg-icon-size` | `1rem` = **16px** | `theme.scss:50` |
| `--mobile-action-button-size` | `2rem` = **32px** | `theme.scss:52` |
| `--border-radius-lg` | `0.5rem` = **8px** | `theme.scss:150` |
| `--border-radius-md` | `0.375rem` = **6px** | `theme.scss:149` |
| `--space-factor` | `0.25rem` = **4px** | `theme.scss:80` |
| `--default-border-color` | `var(--color-surface-high)` `#f1f0ff` light / `#2e2d39` dark | `theme.scss:45`, `:152`, `:268` |
| `--island-bg-color` | `#ffffff` light / `#232329` dark | `theme.scss:25`, `:205` |
| `--color-surface-primary-container` (selected) | `#e0dfff` light / `#403e6a` dark | `theme.scss:159`, `:275` |
| `--color-on-primary-container` | `#030064` light / `#e0dfff` dark | `theme.scss:158`, `:274` |
| `--shadow-island` | `0 0 1px rgba(0,0,0,.17), 0 0 3px rgba(0,0,0,.08), 0 7px 14px rgba(0,0,0,.05)` | `theme.scss:37-38` |

Selected/active state is therefore a **filled pill: `#e0dfff` bg, radius 8px, icon `#030064`** (light theme). Hover = `var(--button-hover-bg)` = `var(--color-surface-high)`; press = `var(--button-active-border)` = `var(--color-brand-active)`.

Option sets and their labels:

| Control | Options (`value` → label) | Source |
|---|---|---|
| Fill | `hachure`→"Hachure" (or "Zigzag" w/ Alt-click), `cross-hatch`→"Cross-hatch", `solid`→"Solid" | `actionProperties.tsx:641-663` |
| Stroke width | `thin`→**"Thin"** (1px), `medium`→"Medium" (2px), `bold`→**"Bold"** (4px) | `:729-750`, `common/src/constants.ts:457-470` |
| Stroke style | `solid`→"Solid", `dashed`→"Dashed", `dotted`→"Dotted" | `:924-940` |
| Sloppiness | `0`→"Architect", `1`→"Artist", `2`→"Cartoonist" | `:788-804` |
| Edges | `sharp`→"Sharp", `round`→"Round" + `togglePolygon` button | `:1790-1818` |
| Arrow type | `sharp`→"Sharp arrow", `round`→**"Curved arrow"**, `elbow`→"Elbow arrow" | `:2249-2268` |
| Pressure (freedraw) | `constant`→"Constant", `variable`→"Variable" (2 buttons; in compact it is 1 cycling button) | `:878-894`, `:857-872` |

Note **Stroke width's 3 buttons are Thin/Medium/Bold**, not "S/M/L" — and **Stroke style is a 3-button segmented row, not a dropdown**. That fully answers question 6's "dash" and "stroke width" sub-questions: yes, they exist, and they are the *same* control for arrows and shapes.

#### Control 6 — Font size: **4-button segmented row** (S/M/L/XL)

`actionProperties.tsx:1023-1050`, `RadioSelection group="font-size"`:

| Position | Label | Value | testId |
|---|---|---|---|
| 1 | **Small** | `FONT_SIZES.sm` = **16** | `fontSize-small` |
| 2 | **Medium** | `FONT_SIZES.md` = **20** | `fontSize-medium` |
| 3 | **Large** | `FONT_SIZES.lg` = **28** | `fontSize-large` |
| 4 | **Very large** | `FONT_SIZES.xl` = **36** | `fontSize-veryLarge` |

`FONT_SIZES` = `{ sm: 16, md: 20, lg: 28, xl: 36 }` (`common/src/constants.ts:115-120`). `DEFAULT_FONT_SIZE = 20` (`:216`). The read side prefers a bound label's size if the selection is a container (`:1056-1067`), and there are also Ctrl+Shift+. / Ctrl+Shift+, steps of ±10 % (`FONT_SIZE_RELATIVE_INCREASE_STEP = 0.1`, `:182`).

#### Control 11 — Text align: **3-button segmented row**

`actionProperties.tsx:1584-1605`: `left`→"Left", `center`→"Center", `right`→"Right" (testIds `align-left`, `align-horizontal-center`, `align-right`).
**Vertical align** is a second 3-button row (`:1682-1703`): `top`→"Align top", `middle`→"Center vertically", `bottom`→"Align bottom" — and it renders **without a legend** (`:1680` opens a bare `<fieldset>`).

#### Control 12 — Opacity: **a range slider**, 0–100 step 10

`actionChangeOpacity` PanelComponent `actionProperties.tsx:975-996`:

```tsx
    return (
      <Range
        label={t("labels.opacity")}
        value={opacity ?? appState.currentItemOpacity}
        hasCommonValue={opacity !== null}
        onChange={updateData}
        min={0}
        max={100}
        step={10}
        testId="opacity"
      />
    );
```

`Range` (`components/Range.tsx`) renders `<label class="control-label">{label}<div class="range-wrapper"><input type="range" class="range-input">…`. Geometry (`Range.scss`):

```scss
  --slider-thumb-size: 16px;
  .range-wrapper { position: relative; padding-top: 10px; padding-bottom: 25px; }
  .range-input  { width: 100%; height: 4px; -webkit-appearance: none;
                  background: var(--color-slider-track); border-radius: 2px; outline: none; }
  .range-input::-webkit-slider-thumb, ::-moz-range-thumb {
    width: var(--slider-thumb-size); height: var(--slider-thumb-size);
    background: var(--color-slider-thumb); border-radius: 50%; border: none; cursor: pointer; }
  .value-bubble { position: absolute; bottom: 0; transform: translateX(-50%); font-size: 12px; }
  .zero-label   { position: absolute; bottom: 0; left: 4px; font-size: 12px; }
```

with `--color-slider-track: hsl(240, 100%, 90%)` light / `hsl(244, 23%, 39%)` dark (`theme.scss:57`, `:226`) and `--color-slider-thumb: var(--color-gray-80)` = `#3d3d3d` (`theme.scss:58`).

Two behaviours worth copying: the **filled-track gradient** is painted imperatively (`Range.tsx:46`):

```ts
rangeElement.style.background = `linear-gradient(to right, var(--color-slider-track) 0%, var(--color-slider-track) ${progress}%, var(--button-bg) ${progress}%, var(--button-bg) 100%)`;
```

and the numeric bubble is **hidden at zero** — `{value !== min ? value : null}` (`Range.tsx:73`) — with a `0` at the left edge in 12px. `hasCommonValue === false` (mixed selection) repaints the whole track in `--button-bg` so it reads as "no single value" (`Range.tsx:55-59`).

**Note the `step={10}`.** Opacity is a coarse 11-notch slider, not continuous.

#### Control 16 — Layers: **4 z-order icon buttons**

`Actions.tsx:65-79`. Each is a bare `<button class="zIndexButton">` (`actionZindex.tsx:42-49`, etc.), which is styled by `@include outlineButtonIconStyles` via `styles.scss:256` → **same 32×32 / 8px-radius / 16px-icon geometry as every other button row**, single row, 8px gaps.

Titles include the shortcut (`actionZindex.tsx:46`): `` `${t("labels.sendBackward")} — ${getShortcutKey("CtrlOrCmd+[")}` `` →

| Order | Action name | Label | Shortcut | What it does |
|---|---|---|---|---|
| 1 | `sendToBack` | "Send to back" | `Ctrl/Cmd+Shift+[` (mac: `Ctrl/Cmd+Alt+[`) | `moveAllLeft(elements, appState)` — whole selection below everything |
| 2 | `sendBackward` | "Send backward" | `Ctrl/Cmd+[` | `moveOneLeft` — one slot down |
| 3 | `bringForward` | "Bring forward" | `Ctrl/Cmd+]` | `moveOneRight` |
| 4 | `bringToFront` | "Bring to front" | `Ctrl/Cmd+Shift+]` (mac: `Ctrl/Cmd+Alt+]`) | `moveAllRight` |

All four are always enabled when rendered — **no disabled state**; visibility is entirely `predicates.layers`. (`keyPriority: 40` on sendBackward/bringForward, `actionZindex.tsx:36`, `:66`.)

#### Control 18 — Actions: **icon buttons, two of them disableable, three conditionally mounted**

`Actions.tsx:211-219`, in order: `duplicateSelection`, `deleteSelectedElements`, `group`, `ungroup`, `hyperlink` (if `predicates.link`), `cropEditor` (if), `toggleLinearEditor` (if).

| Button | Type | Disabled / hidden condition | Source |
|---|---|---|---|
| Duplicate | `IconButton type="button"`, icon `DuplicateIcon`, title `"Duplicate — Ctrl/Cmd+D"` | **`disabled` when nothing selected**: `disabled={!isSomeElementSelected(getNonDeletedElements(elements), appState)}` | `actionDuplicateSelection.tsx:112-134` |
| Delete | `IconButton`, `TrashIcon`, title `"Delete"` | same `disabled` expression | `actionDeleteSelected.tsx:308-328` |
| Group | `IconButton`, `visible={isSomeElementSelected(...)}` | **`hidden={!enableActionGroup(appState, app)}`** → `hidden` attr **and** `display: none !important` | `actionGroup.tsx:204-214`; `ToolIcon.scss:125-127` |
| Ungroup | `IconButton` | `hidden={getSelectedGroupIds(appState).length === 0}` | `actionGroup.tsx:312-322` |
| Link | `IconButton type="toggle"`, `checked = selected.length===1 && !!selected[0].link` | `predicates.link` = `singleSelected \|\| isSingleElementBoundContainer`; title switches to "Link & embed" for embeddables | `actionLink.tsx:45-64`; `shapeActionPredicates.ts:177` |
| Crop | `IconButton` | `predicates.cropEditor` = `!croppingElementId && singleSelected && isImageElement(target[0])` | `actionCropEditor.tsx:46-58` |
| Edit line/arrow | `IconButton`, label "Edit arrow" for arrows, "Edit line" for lines | `predicates.lineEditor` = not already editing && single && `isLinearElement` && **`!isElbowArrow`** | `actionLinearEditor.tsx:80-103` |

`enableActionGroup` = more than one element **group** selected, i.e. group button is disabled/hidden for a single element (`actionGroup.tsx:73-90`). `hidden` on `IconButton` adds `ToolIcon_type_button--hide { display: none !important }` (`IconButton.tsx:118-120`, `ToolIcon.scss:121-127`).

**Align's buttons are also `hidden`-driven, not disabled**: every one of them carries `hidden={!alignActionsPredicate(appState, app)}` (`actionAlign.tsx:100`, `:134`, `:168`, `:202`, `:234`, `:264`), and `alignActionsPredicate` (`:39-53`) requires ≥2 selected groups and no frame. Distribute requires ≥3 (`actionDistribute.tsx:35-46`).

#### Control 14 — Arrowheads: **two `IconPicker` popovers** in one `iconSelectList buttonList` row

`actionProperties.tsx:1989-2028`. Two triggers (start / end), each opening a `Picker` popup (`IconPicker.tsx`):
- `PICKER_COLUMNS = 4` (`IconPicker.tsx:17`) → `.picker-content { display: grid; grid-template-columns: repeat(4, auto); grid-gap: 0.5rem; border-radius: 4px; }`, `.picker { padding: 0.5rem; background: var(--popup-bg-color); box-shadow: var(--shadow-island-stronger); border-radius: 4px; }`, and the icons are **`36px × 18px`** (`IconPicker.scss:9-58`).
- **Visible section (4):** None (`q`), Arrow (`w`), Triangle (`e`), Triangle (outline) (`r`).
- **Hidden behind "more":** Circle (`a`), Circle (outline) (`s`), Diamond (`d`), Diamond (outline) (`f`), Bar (`z`) — plus a second section **"Cardinality"**: Cardinality (one)/(many)/(one or many)/(exactly one)/(zero or one)/(zero or many), keys `x`,`c`,`v`, and none for the last three (`actionProperties.tsx:1825-1937`).
- Keybindings work as *hotkeys inside the open popup*, not globally (`IconPicker.tsx:98-118`), plus Tab and arrow navigation.
- The picker is **RTL-flipped**: `getArrowheadOptions(!isRTL)` for start, `(!!isRTL)` for end (`:1980-1987`).

#### Popover wrapper (compact/mobile/colour/font popovers)

`components/PropertiesPopover.tsx`:

```tsx
        <Popover.Content … side={isMobilePortrait ? "bottom" : "right"}
          align={isMobilePortrait ? "center" : "start"}
          alignOffset={-16} sideOffset={20}
          collisionBoundary={container ?? undefined}
          style={{ zIndex: "var(--zIndex-ui-styles-popup)" }}>
          <Island padding={3} style={style}>{children}</Island>
          <Popover.Arrow width={20} height={10}
            style={{ fill: "var(--popup-bg-color)",
                     filter: "drop-shadow(rgba(0, 0, 0, 0.05) 0px 3px 2px)" }} />
```

Island `padding={3}` ⇒ **12px** inner padding. Callers pass `style={{ maxWidth: "13rem" }}` (colour pickers, shape/arrow/text/colour popovers), `12rem` (extra actions, `Actions.tsx:553-557`), `15rem` (font list, `FontPickerList.tsx:374`). `--zIndex-ui-styles-popup: 100` (`styles.scss:19`).

Compact rail metrics (`Actions.scss:95-179`): `.compact-shape-actions { display:flex; flex-direction:column; gap:0.5rem; max-height: calc(100vh - 200px); overflow-y:auto; padding:0.5rem; }`, `.compact-action-item { min-height: 2.5rem; --default-button-size: 2rem; display:flex; justify-content:center; align-items:center; }`, `.compact-action-button { width/height: var(--mobile-action-button-size); border-radius: var(--border-radius-lg); transition: all 0.2s ease; background: var(--mobile-action-button-bg); svg { 1rem × 1rem } }`, `.compact-shape-actions-island { width: fit-content; }`. `--mobile-action-button-bg: rgba(255,255,255,0.35)` light / `var(--island-bg-color)` dark (`theme.scss:12`, `:193`).

---

### 3. The Font family control in detail

**The inline row is: 3 font options + 1 "open the full list" trigger.** `FontPicker.tsx:23-42` + `:94-104` + `:105-110`:

```tsx
export const DEFAULT_FONTS = [
  { value: FONT_FAMILY.Excalifont,     icon: FreedrawIcon,         text: t("labels.handDrawn"), testId: "font-family-hand-drawn" },
  { value: FONT_FAMILY.Nunito,         icon: FontFamilyNormalIcon, text: t("labels.normal"),    testId: "font-family-normal" },
  { value: FONT_FAMILY["Comic Shanns"],icon: FontFamilyCodeIcon,   text: t("labels.code"),      testId: "font-family-code" },
];

  return (
    <div role="dialog" aria-modal="true" className={clsx("FontPicker__container", { "FontPicker__container--compact": compactMode })}>
      {!compactMode && (<div className="buttonList">
          <RadioSelection<FontFamilyValues | false> type="button" options={defaultFonts} value={selectedFontFamily} onClick={onSelectCallback} />
        </div>)}
      {!compactMode && <ButtonSeparator />}
      <Popover.Root open={isOpened} onOpenChange={onPopupChange}>
        <FontPickerTrigger … />
```

- **Option 1 — "Hand-drawn"** (`labels.handDrawn`), `FONT_FAMILY.Excalifont = 5`, icon `FreedrawIcon` (a squiggle).
- **Option 2 — "Normal"** (`labels.normal`), `FONT_FAMILY.Nunito = 6`, icon `FontFamilyNormalIcon` (an "A").
- **Option 3 — "Code"** (`labels.code`), `FONT_FAMILY["Comic Shanns"] = 8`, icon `FontFamilyCodeIcon` (`< >` with a slash).
- **Option 4** is **not a font**: `FontPickerTrigger` (`FontPickerTrigger.tsx:34-57`) renders `IconButton type="toggle" icon={TextIcon} title={t("labels.showFonts")} = "Show font picker"`, `className="standalone properties-trigger"`, `data-openpopup="fontFamily"`, `border: "none"`. Clicking it opens the searchable font list. **The brief's "4 icon buttons: hand-drawn / serif / code / normal-ish" is wrong on two counts:** there are 3 font options (there is no serif option), and the 4th control is a popover trigger.

`role="dialog" aria-modal="true"` on the row, and the row is a **3-column grid** (`FontPicker.scss`):

```scss
  .FontPicker__container {
    display: grid;
    grid-template-columns: calc(1rem + 3 * var(--default-button-size)) 1rem 1fr; // ~ 2 gaps + 4 buttons
    align-items: center;
  }
```

The middle `1rem` column is the `ButtonSeparator` — a 1px vertical rule: `<div style={{ width: 1, height: "1rem", backgroundColor: "var(--default-border-color)", margin: "0 auto" }} />` (`ButtonSeparator.tsx`).

**The full list** (`FontPicker/FontPickerList.tsx`). Registered families (`fonts/Fonts.ts:396-411`, `init()` calls):

| `FONT_FAMILY` name | id | metadata flags | CSS family string produced |
|---|---|---|---|
| `Cascadia` | 3 | `deprecated`, `local:false` | `Cascadia, monospace, Segoe UI Emoji` |
| `Comic Shanns` | 8 | — | `Comic Shanns, monospace, Segoe UI Emoji` |
| `Excalifont` | 5 | — | `Excalifont, Xiaolai, sans-serif, Segoe UI Emoji` |
| `Helvetica` | 2 | `deprecated`, `local: true` | `Helvetica, sans-serif, Segoe UI Emoji` |
| `Liberation Sans` | 9 | **`private: true`** (server export only) | `Liberation Sans, sans-serif, Segoe UI Emoji` |
| `Lilita One` | 7 | — | `Lilita One, sans-serif, Segoe UI Emoji` |
| `Nunito` | 6 | — | `Nunito, sans-serif, Segoe UI Emoji` |
| `Virgil` | 1 | `deprecated` | `Virgil, sans-serif, Segoe UI Emoji` |
| *(fallback)* `Xiaolai` | 100 | `fallback: true` | CJK hand-drawn fallback |
| *(fallback)* `Segoe UI Emoji` | 1000 | `fallback: true`, `local` | Windows emoji fallback |

ids: `FONT_FAMILY = { Virgil:1, Helvetica:2, Cascadia:3, Excalifont:5, Nunito:6, "Lilita One":7, "Comic Shanns":8, "Liberation Sans":9, Assistant:10 }` (`common/src/constants.ts:133-144`), `FONT_FAMILY_FALLBACKS = { Xiaolai:100, sans-serif:998, monospace:999, "Segoe UI Emoji":1000 }` (`:151-160`). **id 4 is deliberately unused** — comment at `:137`: *"leave 4 unused as it was historically used for Assistant (which we don't use anymore) or custom font (Obsidian)"*.

The **exact label→stack mapping** comes from `getFontFamilyString` (`common/src/utils.ts:123-136`) + `getFontFamilyFallbacks` (`constants.ts:175-190`):

```ts
export const getFontFamilyString = ({ fontFamily }) => {
  for (const [fontFamilyString, id] of Object.entries(FONT_FAMILY)) {
    if (id === fontFamily) {
      return `${fontFamilyString}${getFontFamilyFallbacks(id).map((x) => `, ${x}`).join("")}`;
    }
  }
  return WINDOWS_EMOJI_FALLBACK_FONT;
};
```

with

```ts
export const getFontFamilyFallbacks = (fontFamily: number) => {
  const genericFallbackFont = getGenericFontFamilyFallback(fontFamily);
  switch (fontFamily) {
    case FONT_FAMILY.Excalifont:
      return [CJK_HAND_DRAWN_FALLBACK_FONT, genericFallbackFont, WINDOWS_EMOJI_FALLBACK_FONT];
    default:
      return [genericFallbackFont, WINDOWS_EMOJI_FALLBACK_FONT];
  }
};
// getGenericFontFamilyFallback: Cascadia + Comic Shanns → "monospace"; everything else → "sans-serif"
// CJK_HAND_DRAWN_FALLBACK_FONT = "Xiaolai"; WINDOWS_EMOJI_FALLBACK_FONT = "Segoe UI Emoji"
```

**How many options the list actually shows** (`FontPickerList.tsx:117-178`):

```tsx
    const allFonts = …Array.from(Fonts.registered.entries())
          .filter(([_, { metadata }]) => !metadata.private && !metadata.fallback)
          .map(…).sort(alpha);

    const sceneFonts = … allFonts.filter((font) => sceneFamilies.has(font.value));
    const availableFonts = …
        allFonts.filter((font) =>
            !sceneFamilies.has(font.value) &&
            (showDeprecatedFonts || !font.deprecated));
```

- `!private && !fallback` removes `Liberation Sans`, `Xiaolai`, `Segoe UI Emoji` → **7 candidates: Cascadia, Comic Shanns, Excalifont, Helvetica, Lilita One, Nunito, Virgil.**
- Deprecated ones (`Virgil`, `Helvetica`, `Cascadia`) are **hidden from the "Available fonts" group unless `props.showDeprecatedFonts` is true** (`types.ts:1012`), but **always shown for fonts already used in the open scene** (the `sceneFonts` branch does not filter deprecated, with the comment *"always show all the fonts in the scene, even those that were deprecated"*).
- ⇒ **Default, empty-scene list = 4 usable fonts: Excalifont, Lilita One, Nunito, Comic Shanns** (+ any deprecated font the scene already uses, badged **"old"**, red, `locales/en.json fontList.badge.old`, `FontPickerList.tsx:130-138`).

The list is grouped into two `DropdownMenuGroup`s with headings `"In this scene"` / `"Available fonts"` (`:344-368`, `fontList.sceneFonts` / `fontList.availableFonts`). Each row gets a live `textStyle={{ fontFamily: getFontFamilyString({ fontFamily: font.value }) }}` so the option name is rendered **in its own font** (`:334-339`). Above it in `full` mode: a `QuickSearch` input, placeholder **"Quick search"** (`:394-400`), debounced 20 ms. Empty state: **"No fonts found"** (`fontList.empty`). Popup width **`15rem`**, class `properties-content`, `preventAutoFocusOnTouch={!!appState.editingTextElement}` (`:370-392`).

Two behaviours specific to text editing (relevant to the in-place editor cluster):
- `wrappedOnSelect` saves and restores `selectionStart/selectionEnd` of `.excalidraw-wysiwyg` around the font change (`FontPickerList.tsx:210-243`).
- Closing the picker refocuses `.excalidraw-wysiwyg` (`:375-389`).
- `actionChangeFontFamily`'s panel wraps its handlers in `withCaretPositionPreservation(...)` (`actionProperties.tsx:1446`, `:1079` for font size, `:1628` for align).
- Hover **previews** the font: `onHover` writes `currentHoveredFontFamily` + a `cachedElements` snapshot and `onLeave` does `resetAll: true` to roll the scene back (`actionProperties.tsx:1460-1473`, `:1168-1195`). There is a perf guard: hover preview is skipped for **>200 text elements or >5000 combined characters** (`:1217-1236`).

---

### 4. Layers and Actions — exactly what each button does

Covered in the tables in §2.3 (Control 16 / Control 18). Condensed:

**Layers** — 4 buttons, **never disabled**, no confirmation, all `captureUpdate: CaptureUpdateAction.IMMEDIATELY`:
1. **Send to back** → `moveAllLeft(elements, appState)` (`element/src/zindex.ts:654`), shortcut `Ctrl/Cmd+Shift+[` (`Ctrl/Cmd+Alt+[` on macOS).
2. **Send backward** → `moveOneLeft(elements, appState, app.scene)` (`:638`), `Ctrl/Cmd+[`.
3. **Bring forward** → `moveOneRight` (`:646`), `Ctrl/Cmd+]`.
4. **Bring to front** → `moveAllRight` (`:666`), `Ctrl/Cmd+Shift+]` / `Cmd+Alt+]`.

The z-order functions are frame-aware (`shiftElementsAccountingForFrames`, `:658-663`).

**Actions** — visibility (`predicates.showExtraActions = hasSelection && !isEditingTextOrNewElement`) and per-button:
- **Duplicate** (`Ctrl/Cmd+D`) and **Delete** (`Backspace`/`Delete`) are **rendered but `disabled` when `!isSomeElementSelected(getNonDeletedElements(elements), appState)`** — which in practice only happens in edit/draw states. Their icon buttons also get a mobile-only background override `MOBILE_ACTION_BUTTON_BG` when the mobile overflow popover is closed (`actionDuplicateSelection.tsx:127-131`).
- **Group** is `hidden={!enableActionGroup(appState, app)}` — hidden unless ≥2 element-groups are selected (`actionGroup.tsx:73-90`); it also passes `visible={isSomeElementSelected(...)}`.
- **Ungroup** is `hidden={getSelectedGroupIds(appState).length === 0}`.
- **Link** is `type="toggle"`, `checked` when the sole selected element has a link; title is `"Link - Ctrl/Cmd+K"` or `"Link & embed - Ctrl/Cmd+K"` for embeddables; `aria-label` is the context-menu verb — **"Add link" / "Edit link" / "Edit embeddable link"** (`actionLink.tsx:55-61`, `hyperlink/Hyperlink.tsx:371-382`).
- **Crop image** only for a single selected `image` element and not already cropping.
- **Edit line / Edit arrow** only for a single selected `line`/`arrow` that is not an elbow arrow and not already in point-editing mode. It *toggles* point editing (`actionLinearEditor.tsx:55-79`) — but because the predicate requires `!selectedLinearElement?.isEditing`, **the button disappears once you are editing points** (`shapeActionPredicates.ts:183-187`).

---

### 5. Line / edge properties, and how an ARROW differs from a SHAPE

**Yes — there are dedicated line/edge controls.** They are not in a "Line" section; they are the same stroke sections reused, plus one arrow-only swap.

Shared by both shapes and linear elements:
- **Stroke width** — `hasStrokeWidth` includes `arrow` and `line` (`comparisons.ts:31-40`): Thin 1 / Medium 2 / Bold 4. For freedraw the same keys map through `FREEDRAW_STROKE_WIDTH` (`constants.ts:486-493` — freedraw values are halved for schema 2.0).
- **Stroke style (dash)** — `hasStrokeStyle` includes `arrow` and `line` (`:42-50`): Solid / Dashed / Dotted.
- **Stroke colour**, **Sloppiness** (`hasRoughness` includes both), **Opacity**, **Layers**.
- **Edges (sharp/round)** — `canChangeRoundness` (`:57-64`) includes `line` and `diamond` but **not `arrow`**. For a line, "Round" is the smooth/rounded-corner rendering of its points.

**Arrow-only:**
- **Arrowheads** — `canHaveArrowheads = (type) => type === "arrow"` (`comparisons.ts:68`). **A plain `line` therefore gets no Arrowheads section in this build**, even though `ExcalidrawLinearElement` carries `startArrowhead`/`endArrowhead` (the picker itself is also gated by `isLinearElement(element) && canHaveArrowheads(element.type)`, `actionProperties.tsx:2001`).
- **Arrow type** — `toolIsArrow = (type) => type === "arrow"` (`:66`): **Sharp arrow / Curved arrow / Elbow arrow** (`actionChangeArrowType`, `:2242-2291`). Choosing a type rewrites geometry: `roundness: value === "round" ? { type: ROUNDNESS.PROPORTIONAL_RADIUS } : null`, `elbowed: value === "elbow"` and re-points via `updateElbowArrowPoints` / rebinds via `bindBindingElement` (`:2072-2213`).
- **Edit line/arrow points** button, `line` too — but **hidden for elbow arrows** (`shapeActionPredicates.ts:183-187`).

**The swap, stated plainly.** For a selected **arrow**, the Edges section is absent and the Arrow type section is present. For a selected **rectangle/ellipse/diamond/line**, Arrow type is absent; the Edges section (sharp/round) is present for rectangle/diamond/line, and absent for ellipse. That is the "which sections swap in/out" answer:

```
arrow selected  →  Stroke · Background(–) · Stroke width · Stroke style · Sloppiness · Arrow type · [font fam/size if labelled] · Arrowheads · Opacity · Layers · Actions
rectangle       →  Stroke · Background · Fill · Stroke width · Stroke style · Sloppiness · Edges · [font fam/size/align if labelled] · Opacity · Layers · [Align if >1] · Actions
line            →  Stroke · Background · Fill · Stroke width · Stroke style · Sloppiness · Edges · Opacity · Layers · Actions · (Edit line)
```

(Arrow gets no Background/Fill because `hasBackground` omits `arrow`, `comparisons.ts:3-14`.) Note also `actionChangeRoundness`'s perform **refuses to change an elbow arrow** (`:1750-1752: if (isElbowArrow(el)) return el;`).

---

## 6. Exact numbers (consolidated)

| Quantity | Value | Source |
|---|---|---|
| Panel section gap | `0.75rem` = 12px | `styles.scss:161` |
| Label / legend size | `0.75rem` = 12px, weight 400, `margin-bottom: 0.25rem` | `styles.scss:165-172` |
| Button row gaps | column `0.5rem` + row `0.5rem` = 8px | `styles.scss:191-192` |
| Button size | `2rem` = 32px | `theme.scss:47` |
| Button icon | `1rem` = 16px | `theme.scss:48` |
| Button radius | `--border-radius-lg` = `0.5rem` = 8px | `theme.scss:150` |
| Button border | 1px solid `--default-border-color` = `#f1f0ff` / `#2e2d39` | `variables.module.scss:115-117`, `theme.scss:45` |
| Selected button bg | `#e0dfff` (light) / `#403e6a` (dark) | `theme.scss:159`, `:275` |
| Selected button fg | `#030064` (light) / `#e0dfff` (dark) | `theme.scss:158`, `:274` |
| Panel island padding | `padding={2}` → 2 × 4px = **8px** | `LayerUI.tsx:280`, `Island.scss:7` |
| Popover island padding | `padding={3}` → **12px** | `PropertiesPopover.tsx:87` |
| Panel max height | `appState.height - 166` px | `LayerUI.tsx:284` |
| Popover width ceilings | 13rem / 12rem / 15rem | `Actions.tsx:287,554`, `FontPickerList.tsx:374` |
| Popover side/offsets | `side:"right"`, `sideOffset:20`, `alignOffset:-16`, arrow 20×10 | `PropertiesPopover.tsx:52-55`, `:90-92` |
| z-index popup | `--zIndex-ui-styles-popup: 100` | `styles.scss:19` |
| Colour swatch | 22 × 22px, radius 4px; active 26×26; large 30×30 radius 6px | `ColorPicker.scss:90-202` |
| Colour popup grid | `repeat(5, 1.875rem)`, gap `0.25rem`, padding `0.5rem` | `ColorPicker.scss:301-306` |
| Slider thumb | 16px circle, `#3d3d3d` | `Range.scss:4`, `theme.scss:58` |
| Slider track | 4px tall, radius 2px, `hsl(240,100%,90%)` | `Range.scss:12-19`, `theme.scss:57` |
| Slider wrapper padding | top 10px, bottom 25px | `Range.scss:8-9` |
| Slider bubble / zero label | 12px | `Range.scss:45`, `:53` |
| Opacity range | min 0, max 100, **step 10** | `actionProperties.tsx:990-992` |
| Font sizes | sm **16**, md **20**, lg **28**, xl **36**; default 20 | `constants.ts:115-120`, `:216` |
| Font-size relative step | 10 % (`0.1`) | `actionProperties.tsx:182` |
| Stroke widths | thin 1, medium 2, bold 4 (extraBold 8 unused) | `constants.ts:463-470` |
| Font picker row grid | `calc(1rem + 3*var(--default-button-size)) 1rem 1fr` = `112px 16px 1fr` at 32px buttons | `FontPicker.scss:6` |
| Arrowhead picker | 4 columns, gap `0.5rem`, icons 36×18, padding `0.5rem` | `IconPicker.scss:9-58` |
| Compact rail | gap+padding `0.5rem`, `max-height: calc(100vh - 200px)`, min item height `2.5rem` | `Actions.scss:95-109` |
| Mobile bar | `GAP=6`, `WIDTH=32`, `MIN_ACTIONS=9` | `Actions.tsx:760-763` |
| Zen-mode slide | `translate(±999px, 0)`, `transition: transform 0.5s ease-in-out` | `LayerUI.scss:44-61` |
| Compact button transition | `all 0.2s ease` | `Actions.scss:123` |

---

## 7. What I could NOT verify

- **The rendered screenshot itself.** I have no browser in this session; I matched the brief's list against the predicate evaluation for a text element, which reproduces it exactly. I did not pixel-inspect the app. The match is strong enough that I treat it as confirmed, but it is inference from code, not observation.
- **Whether the current `master` HEAD differs from the pinned commit on these paths.** The clone is `--depth 1`, so there is no history: `git log --oneline -30 -- components/Actions.tsx components/shapeActionPredicates.ts` returns a single commit (`c0ad61c`). I can only attest to this commit.
- **`docs.excalidraw.com` prose on the panel.** The only page I fetched that exists at the guessed path is the `UIOptions` reference; `.../introduction/get-started` 404s. The source-level fact that `UIOptions.canvasActions` can remove individual panel actions comes from `actions/manager.tsx:183-191`, not from docs. I did not search the docs site exhaustively.
- **`Assistant` / `Liberation Sans` / emoji fonts** are registered in `FONT_METADATA` (`common/src/font-metadata.ts`) but `Assistant` is never passed to `Fonts.init()` (`fonts/Fonts.ts:396-411`), so it does not appear in the picker. I did not chase whether a host app can register it.
- **Whether `line` elements can ever show Arrowheads in this build.** `canHaveArrowheads` is literally `type === "arrow"` at this commit. I did not check git history to see whether that is a recent narrowing; if Harvey's design wants arrowheads on plain edges, note that upstream Excalidraw's panel currently will not offer them for `line`.
- **Exact `--shadow-island-stronger` rendering** — I quoted the variable (`theme.scss:39-40`) but did not render it.
- **Per-cell truth of the §2.2 matrix for `autoshape`, `iframe`, `frame`, `magicframe`, `embeddable`, `stickynote`** rests on reading `comparisons.ts` and `canChangeStrokeColor`/`canChangeBackgroundColor` literally; I did not run the app to confirm each cell. The `stickynote` cells in particular route through a separate colour-target system (`actions/colorTargets.ts`) that normalizes colours, so "Background shown" for a note is true but the picker excludes `transparent` (`colorTargets.ts:74-76`).
- **The clone I read was not created by me.** `/tmp/excalidraw` and `/tmp/x3` were both written at ~09:59–10:00, before this task started at ~10:12, and are 92 MB each. Since concurrent sibling agents in this cluster may be reading the same working copies, **I did not delete them** — deleting a shared clone could break a sibling's citation work. `df -h /` shows 60 GB free, 39 % used, so the brief's GB-scale stop condition is not approached.

---

## 8. Implications for a React Flow + DOM (non-canvas) implementation

**What transfers directly:**

1. **The predicate object is the real deliverable.** `getShapeActionPredicates` is the single best idea in this file: one pure function `(appState, targetElements, elementsMap) → {boolean per control}`, consumed by three different layouts. Copy this shape. In Diagram Studio it becomes `getNodeActionPredicates(appState, selectedNodes, nodesMap)` returning flags like `{ stroke, fill, text, fontSize, textAlign, opacity, layers, align, actions }`, and each layout (side panel / compact popover / mobile sheet) reads the flags and renders nothing itself. It also gives you a testable seam: unit-test predicate → expected section set per node type, which is far cheaper than UI snapshots.
2. **Two-level visibility.** Excalidraw has (a) *is the panel mounted at all* (`showSelectedShapeActions` — hidden for selection/eraser/hand/lasso with nothing selected) and (b) *which sections inside it*. Keep both levels; conflating them makes "nothing selected" and "selected, but this control is irrelevant" produce the same empty UI. For a right-hand panel you probably want it to collapse to zero width (like Excalidraw's unmount) rather than render an empty card.
3. **`targetElements` abstraction.** `editingTextElement → [that element]`, `newElement → [newElement]`, else *selection including bound labels*. This is how the panel follows the in-place text editor without a special case in the layout. Diagram Studio needs the equivalent: the panel should describe "the thing I am currently editing" when a text editor is open, even though selection may be cleared — this is exactly the behaviour Harvey asked for.
4. **`forToolOrSelection(predicate)`** — a control shows if the active *tool* supports it OR a selected element does. This is what makes the panel a pre-configuration surface ("set stroke width before drawing") as well as an inspector. Cheap to add, high value.
5. **The control vocabulary.** Swatch strip + active swatch grid; 3–4 button segmented rows with `aria-pressed`/radio semantics; a 0–100 step-10 slider with the bubble hidden at 0; a 4-button z-order row with shortcut-bearing tooltips; a two-part arrowhead picker with a "more" section. All of these are plain DOM and copy over verbatim — the geometry below is CSS, not canvas.
6. **Font stacks, not font choices.** The value in the font control is the *mapping*: `label → CSS font-family string with explicit generic fallback + emoji fallback` (`getFontFamilyString`). Copy that: define `{ Excalifont: "Excalifont, Xiaolai, sans-serif, Segoe UI Emoji", … }` once and use it for the canvas node, the in-place textarea, and the picker preview row so the three never drift.
7. **Hover preview with rollback.** Snapshot the affected elements on hover, mutate live, restore on leave (`cachedElements` + `resetAll`). In DOM terms you'd keep a `React` state snapshot of the node's style props and restore it — simpler than Excalidraw's mutable-element cache, same UX. Include the perf guard (>200 elements / >5000 chars → skip preview) if scenes get large.
8. **Caret preservation.** Every text-affecting control in Excalidraw wraps its `updateData` in `withCaretPositionPreservation(...)` and re-focuses `.excalidraw-wysiwyg`. In React Flow, a controlled `<textarea>` overlay will *lose* the caret on any state update that re-renders it. This is the single highest-risk transplant: you must either keep the editing buffer uncontrolled and apply style changes without touching `value`, or save/restore `selectionStart/selectionEnd` around every commit, exactly as `FontPickerList.wrappedOnSelect` does (`FontPickerList.tsx:210-243`).
9. **`disabled` vs `hidden` semantics.** Excalidraw uses `disabled` for duplicate/delete (the action exists, the state makes it a no-op) and `hidden` for group/ungroup/align/distribute/crop/line-editor (the control is not applicable). That distinction is legible and worth keeping.

**What does NOT transfer:**

1. **"Right-hand panel" has no Excalidraw precedent.** Excalidraw's is top-left; the right edge is the library sidebar. Do not cite Excalidraw as justification for the placement — cite it only for the *contents and ordering*. Be explicit with Harvey about this, since he asked for Excalidraw-like.
2. **Canvas-rendered controls.** `ColorPicker`'s canvas-background variant, the `IconPicker`'s SVG-preview arrowheads (`arrowheadPreviewIconProps`, 40×20 inline SVG), and every `createIcon` glyph are inline SVG — those port fine. But the *rendering* of the element itself is canvas, so any "live preview of this dash pattern" must be re-implemented as SVG/CSS in the DOM.
3. **The `mutateElement` cache-invalidation layer.** `ShapeCache.delete(element)`, `charWidth.clearCache(getFontString(element))`, `redrawTextBoundingBox(...)`, `updateBoundElements(...)`, `Fonts.onLoaded(fontFaces)` — this entire apparatus exists because text metrics are measured against the canvas and cached (`fonts/Fonts.ts:110-140`, `actionProperties.tsx:1317-1353`). React Flow + DOM does not have it: layout is the browser's job. Do not port `redrawTextBoundingBox`; do port the *intent* (re-measure after a font change) by letting the browser reflow, and be careful that node dimensions (which React Flow stores in `node.width/height`) then need an explicit re-measure pass or `node.measured` will go stale.
4. **Binding/elbow-arrow machinery.** `updateElbowArrowPoints`, `calculateFixedPointForElbowArrowBinding`, `bindBindingElement`, `LinearElementEditor.getPointAtIndexGlobalCoordinates` (`actionProperties.tsx:2062-2213`) assume Excalidraw's own arrow model. `@xyflow/react` has its own edge routing (straight/step/smoothstep/bezier) and its own handle-based connection model. Map Excalidraw's **Sharp / Curved / Elbow** onto React Flow's **straight / bezier / step** edge *types* and let React Flow own the geometry. Do not port the point-math.
5. **`Ctrl/Cmd+[` / `]` z-order shortcuts and `Ctrl+D`** — those are Excalidraw's bindings; React Flow has none of these, so wire your own. The z-order model also differs: React Flow orders by array index in `nodes`, Excalidraw by `fractionalIndex`. `moveOneLeft`/`moveAllLeft` (`element/src/zindex.ts:638-668`) are index-splice helpers with frame awareness; you need a simpler `reorderNode(nodes, id, delta | 'front' | 'back')`.
6. **Three-layout system.** `full`/`compact`/`mobile` with `deriveStylesPanelMode` and a persisted `excalidraw.desktopUIMode` is more than Harvey asked for. Take `full` (the column with legends) as the reference and only steal the *predicate* layer; if you later need responsive behaviour, the predicates already make it cheap.
7. **Sticky-note colour domain.** `ColorTargetKind = "regular" | "sticky" | "mixed"` with its own default keys and `transparent` exclusion (`actions/colorTargets.ts:29-76`) is Excalidraw-specific. Ignore unless Diagram Studio grows notes.
8. **`UIOptions.canvasActions` action-removal-by-name.** Excalidraw's `renderAction(name)` can return `null` per host config; React Flow has no equivalent registry, so a similar feature needs an explicit "which sections does this editor allow" prop on your panel component.

**Concrete recommendation for the two features being built now:**

- Build `getNodeActionPredicates(...)` as a pure, unit-tested module **first**, with the §2.2 conditions transcribed (text section ⟺ `activeTool === 'text' || targets.some(isText)`; text-align additionally requires the bound container not be an edge; opacity hidden during shape recognition; actions hidden while editing text). That single file answers "which sections for which shape" and is what Harvey means by "sắp xếp cho phù hợp với mọi loại shapes".
- Copy the section order from `Actions.tsx:168-222` verbatim, including the `Stroke → font → opacity → layers → actions` tail, since that tail is what the user's screenshot already validates for a text node.
- Keep `--border-radius-lg: 0.5rem`, 32px buttons, 16px icons, 8px gaps, 12px labels, 12px section gap. Those six numbers are most of the "feels like Excalidraw" for the panel.
