# X3 — What panel a selection gets, per element type, and TEXT specifics

Reference implementation: **Excalidraw** (`github.com/excalidraw/excalidraw`, monorepo, TypeScript).
Pinned commit: **`c0ad61c6743aef7623e641cd1460d757cc6cacf3`** (master, 2026-09-16 19:50:39 +0200).

Clone: `git clone --depth 1 --filter=blob:none` → **58 MB incl. 35 MB `.git`**. Disk before: 37G used / 60G avail. After: 37G used / 60G avail (no measurable change). Clone deleted at end of this task.

---

## 1. What I read

| Path | Why |
|---|---|
| `packages/excalidraw/components/Actions.tsx` (945 lines) | The three panel layouts (`SelectedShapeActions`, `CompactShapeActions`, `MobileShapeActions`) + shared fieldsets |
| `packages/excalidraw/components/shapeActionPredicates.ts` (191 lines) | **The single dispatch point** — `getShapeActionPredicates()` |
| `packages/element/src/comparisons.ts` (68 lines) | The per-element-type truth table (`hasStrokeWidth`, `hasBackground`, …) |
| `packages/element/src/showSelectedShapeActions.ts` (22 lines) | Whether the panel renders at all |
| `packages/excalidraw/components/LayerUI.tsx` | Panel mount point, `renderSelectedShapeActions`, main menu |
| `packages/element/src/selection.ts` | `getTargetElements`, `getSelectedElements` |
| `packages/element/src/textElement.ts` | `suppportsHorizontalAlign`, `shouldAllowVerticalAlign` |
| `packages/element/src/groups.ts` | `getSelectedElementsByGroup` (multi-select + align) |
| `packages/excalidraw/actions/actionProperties.tsx` | Every `PanelComponent` (font, size, align, opacity, stroke…) |
| `packages/excalidraw/actions/manager.tsx` | `renderAction` — how an action becomes a control |
| `packages/excalidraw/actions/colorTargets.ts` | `resolveColorTarget` (sticky-note special case) |
| `packages/excalidraw/actions/actionAlign.tsx`, `actionGroup.tsx`, `actionLink.tsx` | predicate logic for Align / Group / Link |
| `packages/common/src/constants.ts` | `FONT_SIZES`, `FONT_FAMILY`, `DEFAULT_FONT_SIZE`, `DEFAULT_ELEMENT_PROPS` |
| `packages/excalidraw/css/styles.scss`, `components/Actions.scss`, `components/LayerUI.scss`, `css/theme.scss`, `components/FixedSideContainer.scss` | real pixel values |
| `packages/excalidraw/locales/en.json` | exact user-facing labels |
| Docs (`docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/ui-options`) | **only** used for the `UIOptions.canvasActions.*` gate (secondary source, flagged below) |

---

## 2. Findings

### 2.1 The single dispatch point

It is **not** `Actions.tsx` itself — `Actions.tsx` is the *renderer*. The decision of *what* to render is one pure function:

**`packages/excalidraw/components/shapeActionPredicates.ts:88` → `getShapeActionPredicates()`**

Its docstring states the contract verbatim (`shapeActionPredicates.ts:81-87`):

```
/**
 * Single source of truth for "which shape-action controls are relevant right
 * now". Each flag answers whether a given control should be shown, given the
 * active tool and the current selection. All three styles-panel layouts
 * (full / compact / mobile) and the compact popovers consume these flags so
 * that visibility logic lives in one place and layout stays pure.
 */
```

It returns **18 boolean flags** (`shapeActionPredicates.ts:117-188`). The complete enumeration, with the exact expression:

| Flag | Line | Expression |
|---|---|---|
| `hasSelection` | 119 | `targetElements.length > 0` |
| `showExtraActions` | 121 | `hasSelection && !isEditingTextOrNewElement` |
| `strokeColor` | 124 | `canChangeStrokeColor(appState, targetElements)` (41-62) |
| `backgroundColor` | 125 | `canChangeBackgroundColor(...)` (64-79) |
| `fill` | 130-139 | bucketfill tool **OR** (tool `hasFillStyle` AND `!isTransparent(currentItemBackgroundColor)`) **OR** any target elem `hasFillStyle && !isTransparent(elem.backgroundColor)` |
| `strokeWidth` | 142 | `forToolOrSelection(hasStrokeWidth)` |
| `freedrawMode` | 143 | `forToolOrSelection(hasFreedrawMode)` |
| `strokeStyle` | 144 | `forToolOrSelection(hasStrokeStyle)` |
| `sloppiness` | 145 | `forToolOrSelection(hasRoughness)` |
| `roundness` | 146 | `forToolOrSelection(canChangeRoundness)` |
| `arrowType` | 147 | `forToolOrSelection(toolIsArrow)` |
| `arrowheads` | 148 | `forToolOrSelection(canHaveArrowheads)` |
| `text` | 151 | `activeToolType === "text" \|\| targetElements.some(isTextElement)` |
| `textAlign` | 152-154 | `activeToolType === "text" \|\| suppportsHorizontalAlign(targetElements, elementsMap)` |
| `verticalAlign` | 155 | `shouldAllowVerticalAlign(targetElements, elementsMap)` |
| `opacity` | 157 | `activeToolType !== "autoshape" \|\| hasSelection` |
| `layers` | 162-168 | `(tool !== freedraw && tool !== autoshape && no freedraw selected) \|\| some selected element is freedraw` |
| `align` | 169-170 | `!isSingleElementBoundContainer && alignActionsPredicate(appState, app)` |
| `distribute` | 171 | `targetElements.length > 2` |
| `link` | 177 | `singleSelected \|\| isSingleElementBoundContainer` |
| `linkSingleOnly` | 178 | `singleSelected` |
| `cropEditor` | 179-182 | `!croppingElementId && singleSelected && isImageElement(targetElements[0])` |
| `lineEditor` | 183-187 | `!selectedLinearElement?.isEditing && singleSelected && isLinearElement(t0) && !isElbowArrow(t0)` |

Two helpers shape everything (`shapeActionPredicates.ts:98-102, 104-110`):

```ts
const forToolOrSelection = (predicate) =>
  predicate(activeToolType) || targetElements.some((element) => predicate(element.type));

const singleSelected = targetElements.length === 1;
// a container + its bound text read as a single logical element (2 selected)
const isSingleElementBoundContainer =
  targetElements.length === 2 &&
  (hasBoundTextElement(targetElements[0]) || hasBoundTextElement(targetElements[1]));
```

`forToolOrSelection` is why **the active tool pre-configures the panel**: picking the rectangle tool shows the rectangle's controls *before anything is drawn*.

**The "branch structure" the renderer consumes** — `SelectedShapeActions`, `Actions.tsx:157-224`. This is the full, ordered case list (verified line by line):

```
157  if (appState.activeTool.type === "bucketfill") {     ← Case 0: early return, 3 controls only
159      changeBucketFillBackgroundColor
161      changeFillStyle
162      changeOpacity
     }
167  return (
168    <div className="selected-shape-actions">
169      strokeColor      → changeStrokeColor
170-172  backgroundColor  → changeBackgroundColor
173      fill             → changeFillStyle
175      strokeWidth      → changeStrokeWidth
177      strokeStyle      → changeStrokeStyle
179      freedrawMode     → changeFreedrawMode
181      sloppiness       → changeSloppiness
183      roundness        → changeRoundness
185      arrowType        → changeArrowType
187-193  text             → {changeFontFamily wrapped in <fieldset>}, changeFontSize, textAlign && changeTextAlign
195      verticalAlign    → changeVerticalAlign
196      arrowheads       → changeArrowhead
198      opacity          → changeOpacity
200      layers           → <LayersFieldset/>  = sendToBack, sendBackward, bringForward, bringToFront
202-207  align            → <AlignFieldset showDistribute={predicates.distribute}/>
208-221  showExtraActions → <fieldset legend="Actions"> duplicateSelection, deleteSelectedElements,
                            group, ungroup, link && hyperlink, cropEditor && cropEditor,
                            lineEditor && toggleLinearEditor
```

**That is 17 render-branches, in that fixed order.** Note `arrowheads` (196) sits *after* the text block and *before* opacity — the source order is the visual order.

Three sibling renderers re-consume the same flags:

- `CompactShapeActions` — `Actions.tsx:612-724`. Column of popover triggers: stroke / background / freedraw-mode / `CombinedShapeProperties` / `CombinedArrowProperties` / lineEditor / font-family + `CombinedTextProperties` / duplicate / delete / `CombinedExtraActions`.
- `MobileShapeActions` — `Actions.tsx:731-882`. Horizontal `Island`, plus undo/redo always, and duplicate/delete promoted out of the popover by width measurement (`Actions.tsx:754-769`):
  ```ts
  const MIN_ACTIONS = 9; const GAP = 6; const WIDTH = 32;
  const MIN_WIDTH = MIN_ACTIONS * WIDTH + (MIN_ACTIONS - 1) * GAP;   // = 336
  const ADDITIONAL_WIDTH = WIDTH + GAP;                              // = 38
  const showDeleteOutside = ACTIONS_WIDTH >= MIN_WIDTH + ADDITIONAL_WIDTH;
  const showDuplicateOutside = ACTIONS_WIDTH >= MIN_WIDTH + 2 * ADDITIONAL_WIDTH;
  ```
- The compact popovers: `CombinedShapeProperties` (226-312), `CombinedArrowProperties` (314-408), `CombinedTextProperties` (410-494), `CombinedExtraActions` (496-588), each `maxWidth: "13rem"` except extras `"12rem"`.

`renderAction(name)` (`actions/manager.tsx:182-235`) resolves a name → the action's `PanelComponent`, and returns `null` if the action has no `PanelComponent` or is disabled in `UIOptions.canvasActions`.

### 2.2 The per-element-type truth table

`packages/element/src/comparisons.ts` is the entire type table (all 68 lines quoted in substance):

```ts
hasBackground   = rectangle, stickynote, iframe, embeddable, ellipse, diamond, line, freedraw, autoshape, bucketfill   (3-14)
hasFillStyle    = hasBackground(type) && type !== "stickynote"                                                        (16-17)
hasStrokeColor  = rectangle, stickynote, ellipse, diamond, freedraw, arrow, line, text, embeddable, autoshape        (19-29)
hasStrokeWidth  = rectangle, iframe, embeddable, ellipse, diamond, freedraw, arrow, line, autoshape                   (31-40)
hasStrokeStyle  = rectangle, iframe, embeddable, ellipse, diamond, arrow, line, autoshape                             (42-50)
hasRoughness    = hasStrokeStyle(type) || type === "stickynote"                                                       (52-53)
hasFreedrawMode = type === "freedraw"                                                                                 (55)
canChangeRoundness = rectangle, iframe, embeddable, line, diamond, stickynote, image                                   (57-64)
toolIsArrow / canHaveArrowheads = type === "arrow"                                                                    (66, 68)
```

Plus the two text-specific ones in `packages/element/src/textElement.ts`:

```ts
446  shouldAllowVerticalAlign(selectedElements, elementsMap)   // true iff some selected elem
                                                              // isBoundToContainer AND its container is NOT an arrow
462  suppportsHorizontalAlign(selectedElements, elementsMap)   // same, OR isTextElement(element)
```

…and the `strokeColor` override in `shapeActionPredicates.ts:41-62`, which is **stricter than `hasStrokeColor`** for a uniform selection:

```ts
commonSelectedType = uniform type of all targets, else null
return (hasStrokeColor(activeTool.type) && commonSelectedType !== "image"
        && commonSelectedType !== "frame" && commonSelectedType !== "magicframe")
       || targetElements.some(el => hasStrokeColor(el.type));
```

and the sticky-note-aware background rule (`shapeActionPredicates.ts:64-79`, via `getColorTargetElement`, `stickyNote.ts:95-108`): a note's bound label has no fill, but a background pick on the label colors the *note*, so the picker stays.

**Resulting matrix.** `Y` = the control renders for a single element of that type on desktop "full" layout, tool = `selection`, with the default `currentItemBackgroundColor = transparent`. Verified programmatically by evaluating the predicates above. `fill` is **`-` almost everywhere by default** because `DEFAULT_ELEMENT_PROPS.backgroundColor = COLOR_PALETTE.transparent` (`packages/common/src/constants.ts:507-508`) and the `fill` predicate requires non-transparent.

| element | Stroke | Background | Fill | StrokeWidth | StrokeStyle | FreedrawMode | Sloppiness | Roundness | ArrowType | Arrowheads | FontFamily+Size+Align | VerticalAlign | Opacity | Layers | Align/Extra |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| rectangle | Y | Y | – | Y | Y | – | Y | Y | – | – | – | Y | Y | Y | Y (Align needs ≥2) |
| ellipse | Y | Y | – | Y | Y | – | Y | – | – | – | – | Y | Y | Y | Y |
| diamond | Y | Y | – | Y | Y | – | Y | Y | – | – | – | Y | Y | Y | Y |
| arrow | Y | – | – | Y | Y | – | Y | – | **Y** | **Y** | – | – | Y | Y | Y |
| line | Y | Y | – | Y | Y | – | Y | Y | – | – | – | Y | Y | Y | Y |
| freedraw | Y | Y | – | Y | – | **Y** | – | – | – | – | – | – | Y | **–** | Y |
| **text** | **Y** | **–** | – | **–** | – | – | – | – | – | – | **Y** | **–** | Y | Y | Y |
| image | – | – | – | – | – | – | – | **Y** | – | – | – | Y¹ | Y | Y | Y + **Crop** |
| frame | – | – | – | – | – | – | – | – | – | – | – | Y¹ | Y | Y | Y |
| magicframe | – | – | – | – | – | – | – | – | – | – | – | Y¹ | Y | Y | Y |
| iframe | – | Y | – | Y | Y | – | Y | Y | – | – | – | Y¹ | Y | Y | Y |
| embeddable | Y | Y | – | Y | Y | – | Y | Y | – | – | – | Y¹ | Y | Y | Y + Link |
| stickynote | Y² | Y | – | – | – | – | Y | Y | – | – | – | Y¹ | Y | Y | Y |
| autoshape (tool) | Y | – | – | Y | Y | – | Y | – | – | – | – | – | – | – | – |
| bucketfill (tool) | – | – | – | – | – | – | – | – | – | – | – | – | – | – | – |
| group / multi | see §2.4 | | | | | | | | | | | | | | |
| nothing selected | panel does not exist at all — see §2.5 | | | | | | | | | | | | | | |

¹ `verticalAlign` only shows when the element **has a bound text label** (`shouldAllowVerticalAlign` requires `isBoundToContainer`). A frame with no label, an image with no label → no VerticalAlign. An arrow container explicitly returns `false`.
² For a sticky note the label reads `labels.textColor` ("Text color"), not `labels.stroke` — `actionProperties.tsx:406-408`:
```ts
const label = target.kind === "sticky" ? t("labels.textColor") : t("labels.stroke");
```

Notes that contradict the screenshot the user supplied, and are worth knowing:

- **`fill` is not a per-shape section that always shows.** It is hidden unless the current background is non-transparent (`shapeActionPredicates.ts:130-139`). On a fresh canvas it only appears for the bucket-fill tool.
- **`Layers`, `Actions`, `Align` are `fieldset` (bold small legend); Stroke and Background are `<h3>` headings, not fieldsets** — `actionProperties.tsx:412` and `525`:
  ```ts
  {stylesPanelMode === "full" && <h3 aria-hidden="true">{label}</h3>}
  ```
  So on compact/mobile the words "Stroke"/"Background" are *omitted entirely*.
- **FontFamily is wrapped in its own `<fieldset>` in `SelectedShapeActions` (`Actions.tsx:189`) but the `PanelComponent` emits only a bare `<legend>`** (`actionProperties.tsx:1436-1438`). The `fieldset` is supplied by the caller, not the action.

### 2.3 TEXT element: complete section list and order

Selection: a single `type: "text"` element, `selection` tool, desktop full layout. Flags from the table: `strokeColor ✓, backgroundColor ✗, fill ✗, strokeWidth ✗, strokeStyle ✗, freedrawMode ✗, sloppiness ✗, roundness ✗, arrowType ✗, arrowheads ✗, text ✓, textAlign ✓, verticalAlign ✗ (not bound to a container), opacity ✓, layers ✓, align ✓ (needs ≥2 → ✗ alone), showExtraActions ✓`.

Rendered order, exactly as `Actions.tsx:168-221` emits it:

| # | Section (label) | Control | Component / testId | Source |
|---|---|---|---|---|
| 1 | **Stroke** `<h3>` | color swatch grid + custom picker | `actionChangeStrokeColor` / `ColorPicker` | `actionProperties.tsx:403-419` |
| 2 | *(no label)* | color | — | `changeBackgroundColor` **absent** for text |
| 3 | *(no label)* | — | — | `changeFillStyle` **absent** for text |
| 4-9 | — | — | — | strokeWidth / strokeStyle / freedrawMode / sloppiness / roundness / arrowType **all absent** |
| 10 | **Font family** `<legend>` | 4 icon buttons + "Show font picker" trigger | `FontPicker`, `FontPickerTrigger` | `actionProperties.tsx:1436-1443`, `FontPicker/FontPicker.tsx:23-44` |
| 11 | **Font size** `<legend>` | 4 radio buttons S/M/L/XL | `RadioSelection group="font-size"` | `actionProperties.tsx:1018-1071` |
| 12 | **Text align** `<legend>` | 3 radio buttons left/center/right | `RadioSelection group="text-align"` | `actionProperties.tsx:1578-1630` |
| 13 | *(no legend)* | — | — | `changeVerticalAlign` **absent** (text not bound to a container) |
| 14 | *(no label)* | — | — | `changeArrowhead` absent |
| 15 | **Opacity** `<label class="control-label">` | range slider | `Range`, testId `"opacity"` | `actionProperties.tsx:957-990` |
| 16 | **Layers** `<legend>` | 4 buttons | `LayersFieldset` | `Actions.tsx:65-79` |
| 17 | **Align** `<legend>` | 6 buttons + 2 distribute | `AlignFieldset` | `Actions.tsx:85-130` — **requires ≥2 selected**, so absent for one text element |
| 18 | **Actions** `<legend>` | duplicate, delete, group, ungroup, link | `Actions.tsx:208-221` | `link` is `true` for a single selection (`shapeActionPredicates.ts:177`) |

**So a lone text element gets 6 labelled sections: Stroke · Font family · Font size · Text align · Opacity · Layers · Actions = 7** (Align drops out because it needs 2+).

**The answer to "Font section"?** There is **no section called "Text" or "Shape"** in the styles panel. I checked the locale file: `labels` contains no `text` key that names a panel section (only `toolBar.text -> "Text"` and `element.text -> "Text"`, which are the *toolbar tool* and the *element name in the stats/context menu*), and no `labels.shape`. The "Text" vs "Shape" distinction the user is thinking of exists only in **`stats.fullTitle` = "Canvas & Shape properties"** and **`stats.elementProperties` = "Shape properties"** (`locales/en.json`) — the in-app stats dialog, not the styles panel. Excalidraw's font/size/align controls are **three sibling fieldsets inserted mid-panel**, not one "Text" box.

**Why text gets Horizontal align but not Vertical align:** `suppportsHorizontalAlign` returns true for any bare `isTextElement` (`textElement.ts:471`), while `shouldAllowVerticalAlign` returns true only for `isBoundToContainer` whose container is not an arrow (`textElement.ts:450-457`). Vertical align is a *container* concern — where the label sits inside a rectangle — not a standalone-text concern.

**Text-specific controls — exact contents:**

*Font family* (`FontPicker/FontPicker.tsx:23-44`) — 3 icon buttons plus a picker trigger:

| value | `FONT_FAMILY` | icon | `testId` | label |
|---|---|---|---|---|
| `5` | `Excalifont` | `FreedrawIcon` | `font-family-hand-drawn` | `labels.handDrawn` = "Hand-drawn" |
| `6` | `Nunito` | `FontFamilyNormalIcon` | `font-family-normal` | `labels.normal` = "Normal" |
| `8` | `"Comic Shanns"` | `FontFamilyCodeIcon` | `font-family-code` | `labels.code` = "Code" |

⚠️ **The screenshot's 4th font button (the serif one) does not exist in this commit.** `DEFAULT_FONTS` has exactly 3. The full `FONT_FAMILY` enum (`common/src/constants.ts:133-143`) is `Virgil:1, Helvetica:2, Cascadia:3, Excalifont:5, Nunito:6, "Lilita One":7, "Comic Shanns":8, "Liberation Sans":9, Assistant:10`, and the additional families are reachable through the popover list (`FontPickerList`), not as top-level icon buttons. `4` is explicitly retired: *"leave 4 unused as it was historically used for Assistant (or custom font, Obsidian)"* (`constants.ts:136`).

*Font size* — `FONT_SIZES` (`constants.ts:115-120`): **`sm: 16, md: 20, lg: 28, xl: 36`**. `DEFAULT_FONT_SIZE = 20` (`constants.ts:216`). Keyboard nudges use `FONT_SIZE_RELATIVE_INCREASE_STEP = 0.1` (`actionProperties.tsx:182`) on `Ctrl/Cmd+Shift+<` and `Ctrl/Cmd+Shift+>` (`actionProperties.tsx:1099-1140`).

*Text align* — 3 options, `RadioSelection group="text-align"`: `left` (`testId: align-left`), `center` (`align-horizontal-center`), `right` (`align-right`) (`actionProperties.tsx:1584-1606`). `DEFAULT_TEXT_ALIGN = "left"` (`constants.ts:262`).

**Font size changes trigger a real re-layout, not just a CSS change** (`actionProperties.tsx:294-356`): each text element goes through `getBaseFontSizeUpdate → redrawTextBoundingBox → offsetElementAfterFontResize`, then `updateBoundElements` for arrow labels. `offsetElementAfterFontResize` (`actionProperties.tsx:271-292`) re-anchors x based on `textAlign`:

```ts
x: prevElement.textAlign === "left" ? prevElement.x
   : prevElement.x + (prevElement.width - nextElement.width) / (prevElement.textAlign === "center" ? 2 : 1),
y: prevElement.y + (prevElement.height - nextElement.height) / 2,
```

### 2.4 MULTI-SELECTION

There is **no "two elements selected" branch**. Multi-select is handled purely by the *aggregation* inside the predicates. What survives is the **union**: every flag that is `true` for the tool *or for any one selected element* stays on.

`shapeActionPredicates.ts:98-102`:
```ts
const forToolOrSelection = (predicate) =>
  predicate(activeToolType) || targetElements.some((element) => predicate(element.type));
```
and the same `targetElements.some(...)` pattern in `canChangeStrokeColor:60`, `canChangeBackgroundColor:73`, `fill:136`, `text:151`.

**Survivors on a mixed multi-selection (e.g. rectangle + text + arrow):**
- every property section whose predicate any member satisfies → Stroke, Background, Fill(if any non-transparent bg), StrokeWidth, StrokeStyle, Sloppiness, Roundness, ArrowType, Arrowheads, Font family, Font size, Text align, Opacity, Layers
- **Align** — now *appears* (it needs ≥2): `alignActionsPredicate` (`actionAlign.tsx:39-50`) returns `getSelectedElementsByGroup(...).length > 1 && !any(isFrameLikeElement)`.
- **Distribute** — appears when `targetElements.length > 2` (`shapeActionPredicates.ts:171`), rendered inside `AlignFieldset`.
- **Actions** fieldset — `showExtraActions` is `hasSelection && !isEditingTextOrNewElement` (`:121`), so it is on.
- **Group** becomes enabled — `enableActionGroup` requires ≥2 root elements (`actionGroup.tsx:102-109`), and the `PanelComponent` uses `hidden`/`visible` on the IconButton, not removal (`actionGroup.tsx:204-214`).

**Dropped on multi-select:**
- **Link** — reduced from "single selection" semantics. Full panel keeps it for a container+its-bound-text pair (`link`), but the compact/mobile layouts use `linkSingleOnly` (`shapeActionPredicates.ts:174-178`, comment: *"the full panel treats a bound container as linkable; the compact / mobile layouts only link a truly single selection"*). Note the underlying action is stricter than the flag: `actionLink.tsx:41-44` `predicate: selectedElements.length === 1`.
- **Crop editor** — `singleSelected && isImageElement(t0)` (`:179-182`). Any multi-selection kills it.
- **Linear (line) editor** — `singleSelected && isLinearElement(t0) && !isElbowArrow(t0)` (`:183-187`). Killed by multi-select.
- **VerticalAlign / TextAlign as *actions*** — the perform still applies but the *control* shows no single value: `getFormValue` (`actionProperties.tsx:229-270`) returns the value only when all filtered targets **share** it, via `reduceToCommonValue`; otherwise the action's own `defaultValue(hasSelection)` — and every one of these passes `hasSelection ? null : currentItemX`. A `null` value means the radio group renders **unselected** and the opacity slider sets `hasCommonValue: false` (`actionProperties.tsx:988`), which greys the slider track.
- **Align is suppressed for a bound container + its text** — `!isSingleElementBoundContainer` (`:169-170`), because that pair is one logical element and aligning it against itself is meaningless.

Also structural: the container+label pair (`isSingleElementBoundContainer`) is *deliberately* treated as **one** element for `align` and `link` while still counting as **2** for `singleSelected` — that asymmetry is explicit in the source.

**Groups:** `getSelectedElementsByGroup` (`groups.ts:417-469`) buckets elements into `groupIds`-derived buckets so `align` counts *logical* units, not raw elements. A single selected group is re-indexed one level inward (`keyIndex = indexOf(selectedGroupId) - 1`) so aligning inside an already-selected group operates on its members.

**Bound text**: `getTargetElements` (`selection.ts:215-231`) resolves to `appState.editingTextElement` if editing, else `appState.newElement` (unless the tool is `autoshape` — the draw-shape recognition preview is deliberately excluded), else `getSelectedElements(elements, appState, { includeBoundTextElement: true })`. That last flag (`selection.ts:184-193`) auto-adds a container's bound text whenever the container is selected — so **selecting one rectangle with a label actually yields `targetElements.length === 2`.**

### 2.5 NOTHING SELECTED

**The panel is not empty — it usually does not exist.**

`packages/element/src/showSelectedShapeActions.ts` (all 22 lines):

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

Consumed at `LayerUI.tsx:302-303`:
```ts
const shouldRenderSelectedShapeActions =
  defaultUIEnabled && showSelectedShapeActions(appState, elements);
```
…and `LayerUI.tsx:327-328` renders the whole `<Section heading="selectedShapeActions">` only when that is true.

So: **`selection` / `lasso` / `eraser` / `hand` / `laser` tool with an empty selection ⇒ the section is not mounted at all.** The `CompactShapeActions` path has a parallel guard via `predicates.hasSelection` inside `CombinedShapeProperties` (`Actions.tsx:239-250`), which additionally returns `null` when the tool is one of `selection/eraser/hand/laser/lasso`.

**Document-level settings live elsewhere — outside the right panel entirely.** There is no "canvas" section in the styles panel. Confirmed by the menu wiring at `LayerUI.tsx:111-136`:

```tsx
<MainMenu.DefaultItems.LoadScene />
<MainMenu.DefaultItems.SaveToActiveFile />
{UIOptions.canvasActions.export && <MainMenu.DefaultItems.Export />}
<MainMenu.DefaultItems.SaveAsImage />
<MainMenu.DefaultItems.SearchMenu />
<MainMenu.DefaultItems.Help />
<MainMenu.DefaultItems.ClearCanvas />
<MainMenu.Separator />
<MainMenu.Group title="Excalidraw links"><MainMenu.DefaultItems.Socials /></MainMenu.Group>
<MainMenu.Separator />
<MainMenu.DefaultItems.ToggleTheme allowSystemTheme={false} />
<MainMenu.DefaultItems.ChangeCanvasBackground />
```

- **Background** → `MainMenu.DefaultItems.ChangeCanvasBackground` (`main-menu/DefaultItems.tsx:323-353`), which renders `actionChangeViewBackgroundColor` (`actionCanvas.tsx:48-75`, `label: "labels.canvasBackground"`, `type="canvasBackground"`). It is **not** in `selected-shape-actions`; the styles panel's Background picker uses `type="elementBackground"`.
- **Grid** → `PreferencesToggleGridModeItem` inside the **Preferences submenu** (`DefaultItems.tsx:566-583`), an `actionToggleGridMode` toggle. Same place as snap mode, zen mode, view mode, tool lock, arrow binding, midpoint snapping (`DefaultItems.tsx:642-676`).
- **Everything else** (load/save/export/clear/theme/search/help) also lives in the hamburger main menu.
- The other right-side surface is the **Library/Search sidebar** (`DefaultSidebar`), toggled by `DefaultSidebar.Trigger` (`LayerUI.tsx:481-499`) — a *separate* dockable panel, containing the library and canvas search, **not** canvas properties.
- There is an extra escape hatch: clicking empty canvas with the **canvas context menu** (`App.tsx:13884-13914`) offers `actionToggleGridMode, actionToggleObjectsSnapMode, actionToggleArrowBinding, actionToggleMidpointSnapping, actionToggleZenMode, actionToggleViewMode, actionToggleStats`.

---

## 3. Exact numbers

**Panel container / position** (it is **top-left, not right-hand**):
- `LayerUI.tsx:251-256` — `<Section heading="selectedShapeActions" className="selected-shape-actions zen-mode-transition">`
- `LayerUI.tsx:278-288` — `<Island className={CLASSES.SHAPE_ACTIONS_MENU} padding={2} maxHeight={appState.height - 166} data-viewport-ui="side" data-viewport-ui-name="stylesPanel">`
- `CLASSES.SHAPE_ACTIONS_MENU = "App-menu__left"` (`common/src/constants.ts:106`)
- `styles.scss:494-500` — `.App-menu__left { overflow-y: auto; padding: 0.75rem; width: 12.5rem; box-sizing: border-box; position: absolute; }` → **width 12.5rem = 200px, padding 12px**
- `LayerUI.tsx:313-329` — it is mounted inside `<FixedSideContainer side="top">` → `.App-menu_top` with `grid-template-columns: 1fr 2fr 1fr` (`styles.scss:388-403`) in the **left** column, `@media (min-width: 1536px)` → `1fr 1fr 1fr` with `grid-gap: 3rem`. `FixedSideContainer_side_top` is `position: absolute; left/top/right/bottom: var(--editor-container-padding)` (`FixedSideContainer.scss:15-19`).
- Container: `.selected-shape-actions-container { width: fit-content; }`, `&--compact { min-width: 48px; }` (`styles.scss:441-447`)
- Compact island: `.selected-shape-actions-container--compact` min-width 48px; pen-mode nudge `margin-left: calc((48px - var(--lg-button-size)) / 2)` (`LayerUI.scss:130-132`)

**Panel internals** (`styles.scss:158-215`):
- `.selected-shape-actions { display: flex; flex-direction: column; row-gap: 0.75rem; }` → **12px vertical gap between sections**
- section label (`h3, legend, .control-label`): `font-size: 0.75rem` (12px), `margin-bottom: 0.25rem` (4px), `font-weight: 400`, `color: var(--text-primary-color)`
- `.buttonList { flex-wrap: wrap; display: flex; column-gap: 0.5rem; row-gap: 0.5rem; }` → 8px gaps; `label { font-size: 0.75rem; }`
- `.buttonList input[type="radio"], input[type="button"] { opacity: 0; position: absolute; pointer-events: none; }` — **the radios are visually hidden; the icon is the control**
- `fieldset { margin: 0; padding: 0; border: none; }`
- Mobile `.App-mobile-menu .selected-shape-actions { padding: 8px 8px 0 8px; }` (`styles.scss:368-370`)

**Compact layout** (`components/Actions.scss:96-141`):
- `.compact-shape-actions { display:flex; flex-direction:column; gap:0.5rem; max-height: calc(100vh - 200px); overflow-y:auto; padding:0.5rem; }`
- `.compact-action-item { min-height: 2.5rem; --default-button-size: 2rem; }`
- `.compact-action-button { border-radius: var(--border-radius-lg); transition: all 0.2s ease; }`, `svg { width:1rem; height:1rem; }`

**Design tokens** (`css/theme.scss`):
- `--default-button-size: 2rem` (32px), `--lg-button-size: 2.25rem` (36px), `--default-icon-size: 1rem`, `--lg-icon-size: 1rem`, `--mobile-action-button-size: 2rem`, `--editor-container-padding: 1rem`, `--border-radius-lg: 0.5rem` (8px), `--space-factor`
- mobile: `--editor-container-padding: 0.75rem`; ≥1921px: `--lg-button-size: 2.5rem`, `--lg-icon-size: 1.25rem`, `--default-button-size: 2.25rem`, `--default-icon-size: 1.25rem`

**Controls:**
- Opacity `Range`: `min: 0, max: 100, step: 10, testId: "opacity"`; default `step = 10`, `minLabel = min`; `value-bubble` is hidden when `value === min` (`Range.tsx:36-73`)
- Font sizes `sm:16 md:20 lg:28 xl:36`, `DEFAULT_FONT_SIZE = 20`, `MIN_FONT_SIZE = 1`, `STICKY_NOTE_MIN_FONT_SIZE = 16`, `STICKY_NOTE_MAX_FONT_SIZE = 512` (`constants.ts:115-120, 214-218`)
- Font-size keyboard step `0.1` relative
- Mobile width math: `WIDTH = 32`, `GAP = 6`, `MIN_ACTIONS = 9` → `MIN_WIDTH = 336`, `ADDITIONAL_WIDTH = 38`
- Popovers: `maxWidth: "13rem"` (208px) for shape/arrow/text, `"12rem"` (192px) for extras
- Panel `maxHeight: appState.height - 166` px
- Stroke width options: `thin / medium / bold` (testIds `strokeWidth-thin|medium|bold`)
- Default element props: `strokeColor: COLOR_PALETTE.black`, `backgroundColor: COLOR_PALETTE.transparent`, `fillStyle: "solid"` (`constants.ts:506-509`)

**testIds an implementer can target:** `font-family-hand-drawn`, `font-family-normal`, `font-family-code`, `font-family-show-fonts`, `fontSize-small`, `fontSize-medium`, `fontSize-large`, `fontSize-veryLarge`, `align-left`, `align-horizontal-center`, `align-right`, `align-top`, `align-middle`, `align-bottom`, `opacity`, `edges` group, `arrowhead_*`, `sharp-arrow`, `round-arrow`, `elbow-arrow`, `canvas-background-label`.

**Labels (`locales/en.json`):** `labels.stroke` "Stroke" · `labels.background` "Background" · `labels.fill` "Fill" · `labels.strokeWidth` "Stroke width" · `labels.strokeStyle` "Stroke style" · `labels.sloppiness` "Sloppiness" · `labels.edges` "Edges" · `labels.arrowheads` "Arrowheads" · `labels.arrowtypes` "Arrow type" · `labels.fontFamily` "Font family" · `labels.fontSize` "Font size" · `labels.textAlign` "Text align" · `labels.opacity` "Opacity" · `labels.layers` "Layers" · `labels.align` "Align" · `labels.actions` "Actions" · `labels.textColor` "Text color" · `labels.canvasBackground` "Canvas background" · `labels.duplicateSelection` "Duplicate" · `labels.group` "Group selection" · `labels.ungroup` "Ungroup selection" · `headings.selectedShapeActions` "Selected shape actions".

---

## 4. What I could NOT verify

1. **No browser, no running app** (per brief). Every number above is read from CSS/TSX, not measured in a rendered DOM. Pixel results of the flex/grid layout are inferred from the declarations, not observed.
2. **The screenshot's 4th "serif" font button.** I found exactly 3 default font buttons in this commit. Either the screenshot is from an older release (pre-`Excalifont`/`Nunito` rename, when `Virgil` was the hand-drawn face and a serif icon existed), or the 4th icon is the `FontPickerTrigger` (`TextIcon`, "Show font picker") which *looks* like a 4th family button but opens a popover. I cannot tell which from source alone. **The 3-button set is what the pinned commit ships.**
3. **`labels.verticalAlign` does not exist as a locale key** — `actionChangeVerticalAlign`'s panel emits `<fieldset><div className="buttonList">` with **no `<legend>`** (`actionProperties.tsx:1679-1683`). So the Vertical-align row renders **unlabelled**. Confirmed by reading, but whether that is intentional or an oversight is not stated anywhere in the tree.
4. **No `Labels.shape` / `Labels.text` panel section** exists in the styles panel. The user's "Text vs Shape" framing is not present in this codebase. `stats.fullTitle` "Canvas & Shape properties" is the closest string, and it belongs to the stats dialog. I could not find any other place these words are used as section headings.
5. **`--space-factor`, `--button-width`, `--button-height`, `--mobile-action-button-size` final resolved values**: `--default-button-size` etc. are defined in `theme.scss` but `--space-factor` I did not locate a definition for in the files I opened. `[UNVERIFIED]` for that one token.
6. **Exact rendered section order under RTL.** `AlignFieldset` (`Actions.tsx:92-110`) explicitly mirrors button order for RTL — I verified the code branch but did not confirm layout direction effects beyond it.
7. **Which `EditorInterface.desktopUIMode` value a given screen gets.** `deriveStylesPanelMode` (`common/src/editorInterface.ts:152-164`) maps `phone → "mobile"`, `tablet → "compact"`, else `editorInterface.desktopUIMode` — but I did not trace how `desktopUIMode` itself is computed, so **the exact condition under which desktop shows "compact" vs "full" is `[UNVERIFIED]`**.
8. **Docs pages**: only the `UIOptions` page was fetched; `docs.excalidraw.com/docs/introduction/get-started` is a **404**. Doc coverage of the styles panel is thin — the panel's shape is only knowable from source. Everything above is primary-source (code) except the `UIOptions.canvasActions.*` gate on `renderAction`.

---

## 5. Implications for React Flow + DOM (non-canvas)

**What transfers directly:**

- **The architecture is the best thing to copy, and it is not canvas-specific.** One pure `getShapeActionPredicates(appState, targetElements, elementsMap)` function returning a **flat record of booleans**, consumed by every layout. For Diagram Studio this maps 1:1 onto a `usePropertiesPanel(node)` hook returning the same shaped object; your panel JSX then becomes a list of `predicates.x && <Control/>` guards. Port `shapeActionPredicates.ts` almost verbatim — it is 191 lines and has zero React in it (only `app` for `alignActionsPredicate`).
- **`forToolOrSelection` = "configure the tool before you draw."** In React Flow, the analogue is: when no node is selected but a node-type tool/palette entry is armed, show that node type's defaults. This is exactly the "panel must suit every shape type" ask. The rule is one line: `predicate(activeTool) || targets.some(t => predicate(t.type))`.
- **The per-type truth table should be a plain data module, not conditionals in JSX.** `comparisons.ts` (68 lines) is the whole thing. Copy the shape: `hasStrokeWidth(type)`, `hasBackground(type)`, … as pure functions over a string union, then a single `getPredicates`. Do not scatter `node.type === 'text' &&` through components.
- **Union semantics for multi-select, with a "common value" reduction.** `getFormValue` (`actionProperties.tsx:229-270`) + `reduceToCommonValue` is the right pattern: show the shared value, otherwise show the control in an indeterminate state. React Flow gives you the selection array; this logic is framework-agnostic.
- **The container + bound-text asymmetry.** `isSingleElementBoundContainer` treats a node+label pair as one element for Align/Link but as two for `singleSelected`. This is a real, subtle UX rule worth reproducing if Diagram Studio nodes will have editable labels: *aligning a container against its own label is meaningless.*
- **Ordering by "render order = semantic order"** — the panel is a flat ordered list of `flags && render(name)` branches. Reproduce that as an explicit ordered array of `{ flag, Component }` entries rather than nested conditionals; it makes "reorganise the panel per shape" a data edit.

**What does NOT transfer / has no DOM equivalent:**

- **`Layers` (z-order).** Excalidraw's z-order is a `FractionalIndex` on a flat scene array with `sendToBack/sendBackward/bringForward/bringToFront` operating on that array. React Flow instead has `nodes` order + `zIndex` + `parentId` nesting. The *four buttons* transfer as UI; the *semantics* do not — `bringToFront` in React Flow interacts with parent/child nesting and the `elevateNodesOnSelect` behaviour, which Excalidraw has no concept of. Implement the buttons against your own ordering model and do not pretend the semantics match.
- **`Arrowheads` / `ArrowType` (sharp/round/elbow).** Excalidraw's arrows are point-lists inside one element. React Flow edges are `source`/`target` handles with an entirely different geometry model (`type: 'default' | 'straight' | 'step' | 'smoothstep' | 'bezier'`, `markerEnd`/`markerStart`, `pathOptions`). The panel *shape* (an arrow-type radio group + a start/end arrowhead picker) transfers; the values and the rendering pipeline do not. `lineEditor`/`togglePolygon` (editing individual arrow points) has **no React Flow equivalent at all** — there is no per-edge point editor in the public API.
- **`freedraw` / `sloppiness` (roughness) / `strokeStyle: dashed|dotted`.** Excalidraw renders via `roughjs` on a canvas. In a DOM/SVG implementation, `sloppiness` has no analogue (SVG has no hand-drawn filter equivalent without shipping roughjs), and `strokeStyle` maps to `stroke-dasharray` which exists but with different visual semantics than roughjs's rendering. `freedraw` as a *node type* is a poor fit for React Flow at all.
- **Auto-resize / text measurement.** Excalidraw's text is `autoResize`-flagged with `redrawTextBoundingBox` doing synchronous canvas `measureText` (and `document.fonts.check` / `.load` before it, `actionProperties.tsx:1324-1345`). In a DOM node you get measurement for free from the layout engine — **do not port the measurement code**, port only the *behaviour*: re-anchor on `textAlign` when size changes (`offsetElementAfterFontResize`, `actionProperties.tsx:271-292` is 20 lines and is pure geometry, worth copying as a rule even with DOM measurement).
- **The panel is top-left in Excalidraw, not right-hand.** `FixedSideContainer side="top"` + `.App-menu__left` `position: absolute` (`LayerUI.tsx:313`, `styles.scss:494-500`). The user wants a right-hand panel. So: **take the section list, order, control types and the predicate architecture; do not take the placement.** The right-hand host in Excalidraw is the *Library/Search sidebar* (`DefaultSidebar`), a genuinely different surface — do not conflate the two.
- **Three layouts (full/compact/mobile) driven by `EditorInterface.formFactor`.** `deriveStylesPanelMode` (`common/src/editorInterface.ts:152-164`) returns `mobile` for phone, `compact` for tablet, `desktopUIMode` otherwise. If Diagram Studio is desktop-first, implement the **full layout only** and skip the popover/measurement machinery (`CombinedShapeProperties`, `CombinedArrowProperties`, `CombinedTextProperties`, `MobileShapeActions`) entirely — it is ~350 lines of `Actions.tsx` that buys you nothing on desktop.
- **`<h3 aria-hidden="true">` for Stroke/Background vs `<fieldset><legend>` for everything else** is a genuine inconsistency in the source. Do not copy it — pick one pattern (a labelled fieldset for every section) so your sections are uniformly styleable and accessible.

**Concrete size estimate for a port:** the entire decision layer is `shapeActionPredicates.ts` (191 lines) + `comparisons.ts` (68 lines) + `textElement.ts:446-472` (27 lines) + `actionAlign.tsx:39-50` (12 lines) ≈ **~300 lines of pure logic** that you can adapt near-verbatim. The rendering layer is `Actions.tsx:157-224` (68 lines, the one function to copy) plus the individual `PanelComponent`s you care about (font family, font size, text align, opacity, stroke, background).
