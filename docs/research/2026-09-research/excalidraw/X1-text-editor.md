# X1 — Excalidraw's IN-PLACE TEXT EDITOR on canvas

Research cluster: how Excalidraw implements WYSIWYG text editing on a canvas element — component, autosize,
start/end, disabled shortcuts while editing, what UI is visible while typing, caret/placeholder/empty handling,
and every exact number.

---

## 1. What I read

**Clone:** `https://github.com/excalidraw/excalidraw`, `git clone --depth 1 --filter=blob:none`
**Commit:** `c0ad61c6743aef7623e641cd1460d757cc6cacf3` (2026-09-16, "feat(editor): rightclick to pan canvas (#12110)")
**Package version:** `@excalidraw/excalidraw` **0.18.0** (`packages/excalidraw/package.json:3`)
**Disk:** `/dev/sda1` before clone `37G used / 60G avail (39%)`; clone size **92M**; after clone `37G used / 60G avail (39%)` — negligible, well under the GB stop threshold.

Files opened (all under `packages/`):

| File | Why |
|---|---|
| `excalidraw/wysiwyg/textWysiwyg.tsx` (1060 ln) | the entire in-place editor |
| `excalidraw/wysiwyg/textWysiwyg.test.tsx` (2098 ln) | behaviour assertions (escape, empty text, undo) |
| `excalidraw/components/App.tsx` (14176 ln) | `startTextEditing`, `handleTextWysiwyg`, `onKeyDown`, pointer handlers |
| `excalidraw/components/App.pan.ts` | pan-while-editing |
| `excalidraw/scene/Renderer.ts` | hiding the edited element from the canvas |
| `excalidraw/renderer/interactiveScene.ts` | `renderTextBox`, transform-handle suppression |
| `excalidraw/textAutoResizeHandle.ts` | the auto-resize grip |
| `excalidraw/components/Actions.tsx` + `Actions.scss` | full / compact / mobile styles panels |
| `excalidraw/components/shapeActionPredicates.ts` | which controls render, when |
| `excalidraw/actions/actionProperties.tsx` (2293 ln) | font family/size/align/opacity controls |
| `excalidraw/actions/manager.tsx`, `actionHistory.tsx`, `actionFinalize.tsx`, `actionExport.tsx`, `actionCanvas.tsx` | shortcut gating |
| `excalidraw/hooks/useTextEditorFocus.ts` | caret save/restore around panel interactions |
| `excalidraw/components/LayerUI.tsx`, `MobileMenu.tsx`, `Island.scss`, `FixedSideContainer.scss`, `HintViewer.tsx/.scss` | where the panel actually lives |
| `element/src/showSelectedShapeActions.ts`, `selection.ts`, `textElement.ts`, `textMeasurements.ts`, `textWrapping.ts`, `newElement.ts`, `transformHandles.ts`, `comparisons.ts`, `renderElement.ts` | measurement + geometry + visibility predicates |
| `common/src/{constants,utils,colors,editorInterface,font-metadata}.ts` | every constant |
| `excalidraw/css/{styles.scss,app.scss,theme.scss,variables.module.scss}` | real CSS values |

Docs page read (secondary): `https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api`
— it documents only the public API surface. **It says nothing about the text editor.** Marked secondary/insufficient below.

---

## 2. Findings

### 2.1 The WYSIWYG component: a bare `<textarea>` injected into the DOM

It is **not** `contentEditable`, and not a hidden input. It is a raw `<textarea>` created with
`document.createElement`, styled entirely via inline `Object.assign(editable.style, …)` — there is **no
`.excalidraw-wysiwyg` CSS rule anywhere in the repo** (grep for `excalidraw-wysiwyg` across all `.scss`/`.css`
returns only one hit, a *negative* selector).

`packages/excalidraw/wysiwyg/textWysiwyg.tsx:452-459`
```ts
const editable = ownerDocument.createElement("textarea");

editable.dir = "auto";
editable.tabIndex = 0;
editable.dataset.type = "wysiwyg";
// prevent line wrapping on Safari
editable.wrap = "off";
editable.classList.add("excalidraw-wysiwyg");
```

**Where it is mounted** — a dedicated empty container div that exists permanently in the app tree, *sibling to
the canvas*, not attached to the element:

`packages/excalidraw/components/App.tsx:2529`
```tsx
<div className="excalidraw-textEditorContainer" />
```
`packages/excalidraw/wysiwyg/textWysiwyg.tsx:1055-1057`
```ts
  excalidrawContainer
    ?.querySelector(".excalidraw-textEditorContainer")!
    .appendChild(editable);
```
The container div **has no CSS rule of its own** (grep returns zero scss/css hits). It is a plain static
positioning parent; the textarea inside it is `position: absolute` with viewport coords.

**What happens to the element's text while editing: the canvas text is HIDDEN.** The renderer drops the edited
text element out of the render list entirely, so the canvas no longer paints it and the textarea is the only
thing showing those glyphs:

`packages/excalidraw/scene/Renderer.ts:259-267`
```ts
      // we don't want to render text element that's being currently edited
      // (it's rendered on remote only)
      if (
        !editingTextElement ||
        editingTextElement.type !== "text" ||
        element.id !== editingTextElement.id
      ) {
        elementsMap.set(element.id, element);
      }
```

**The container does NOT stay put — the element itself grows, live, on every keystroke.** The textarea's
`width`/`height` are copied from the *scene element's* geometry each time `updateWysiwygStyle()` runs, and the
scene element is recomputed per input (see §2.2). There is **no auto-scroll** of the textarea:
`editable.scrollTop = 0` is forced after every restyle (`textWysiwyg.tsx:441`) and `overflow: hidden` +
`maxHeight` are set, so content that exceeds the viewport is clipped, not scrolled.

**Inline style block** — `packages/excalidraw/wysiwyg/textWysiwyg.tsx:461-487`:
```ts
  let whiteSpace = "pre";
  let wordBreak = "normal";

  if (isBoundToContainer(element) || !element.autoResize) {
    whiteSpace = "pre-wrap";
    wordBreak = "break-word";
  }
  Object.assign(editable.style, {
    position: "absolute",
    display: "inline-block",
    minHeight: "1em",
    backfaceVisibility: "hidden",
    margin: 0,
    padding: 0,
    border: 0,
    outline: 0,
    resize: "none",
    background: "transparent",
    overflow: "hidden",
    // must be specified because in dark mode canvas creates a stacking context
    zIndex: "var(--zIndex-wysiwyg)",
    wordBreak,
    // prevent line wrapping (`whitespace: nowrap` doesn't work on FF)
    whiteSpace,
    overflowWrap: "break-word",
    boxSizing: "content-box",
  });
  editable.value = element.originalText;
```
`--zIndex-wysiwyg: 3` (`packages/excalidraw/css/styles.scss:8`) — same layer as the SVG layer and canvas
buttons, one below `--zIndex-layerUI: 4`.

**The per-frame style refresh** — `textWysiwyg.tsx:385-427` (the position/size half of `updateWysiwygStyle`):
```ts
      const [viewportX, viewportY] = getViewportCoords(coordX, coordY);

      if (!container) {
        maxWidth = (appState.width - 8 - viewportX) / appState.zoom.value;
        width = Math.min(width, maxWidth);
      } else {
        width += 0.5;
      }

      // add 5% buffer otherwise it causes wysiwyg to jump
      height *= 1.05;

      const font = getFontString(updatedTextElement);
      const angle = getTextElementAngle(updatedTextElement, container);

      // Make sure text editor height doesn't go beyond viewport
      const editorMaxHeight =
        (appState.height - viewportY) / appState.zoom.value;
      Object.assign(editable.style, {
        font,
        // must be defined *after* font ¯\_(ツ)_/¯
        lineHeight: updatedTextElement.lineHeight,
        width: `${width}px`,
        height: `${height}px`,
        left: `${viewportX}px`,
        top: `${viewportY}px`,
        transform: getTransform(
          width, height, angle, appState, maxWidth, editorMaxHeight,
        ),
        textAlign,
        verticalAlign,
        color: applyDarkModeFilter(
          updatedTextElement.strokeColor,
          appState.theme === THEME.DARK,
        ),
        opacity: updatedTextElement.opacity / 100,
        maxHeight: `${editorMaxHeight}px`,
      });
```
`getTransform` (`textWysiwyg.tsx:80-99`) fuses zoom + rotation into one transform, keeping the box centred on
its scene anchor:
```ts
  return `translate(${translateX}px, ${translateY}px) scale(${zoom.value}) rotate(${degree}deg)`;
```
**`updateWysiwygStyle` is re-run from six places**: the scene update emitter (`textWysiwyg.tsx:1008-1016`), the
scroll emitter (`:1018-1020`), `ResizeObserver` on the canvas (`:1036-1040`), the theme change emitter
(`:1001-1005`), the wysiwyg's own keydown handlers after zoom/font changes (`:666,670,674`), and once at
construction (`:489`). It does `editable.focus()` on every scene update unless a `.properties-content` popup is
open (`:1008-1016`) — that is how the editor keeps focus while the user fiddles with the panel.

### 2.2 AUTOSIZE while typing — canvas `measureText`, never DOM measurement in the element path

**The measurer is a real `<canvas>` 2D context using `measureText().width` (advance width), on a detached
canvas created once:**

`packages/element/src/textMeasurements.ts:121-150`
```ts
class CanvasTextMetricsProvider implements TextMetricsProvider {
  private canvas: HTMLCanvasElement;

  constructor() {
    this.canvas = document.createElement("canvas");
  }

  /**
   * We need to use the advance width as that's the closest thing to the browser wrapping algo, hence using it for:
   * - text wrapping
   * - wysiwyg editor (+padding)
   */
  public getLineWidth(text: string, fontString: FontString): number {
    const context = this.canvas.getContext("2d")!;
    context.font = fontString;
    const metrics = context.measureText(text);
    const advanceWidth = metrics.width;
    …
    return advanceWidth;
  }
}
```
(`setCustomTextMetricsProvider` at `:106-115` exists because the headless server has no canvas.)

**The formulas** — `packages/element/src/textMeasurements.ts:160-177`:
```ts
export const getTextWidth = (text: string, font: FontString) => {
  const lines = splitIntoLines(text);
  let width = 0;
  lines.forEach((line) => {
    width = Math.max(width, getLineWidth(line, font));
  });
  return width;
};

export const getTextHeight = (
  text: string, fontSize: number, lineHeight: ExcalidrawTextElement["lineHeight"],
) => {
  const lineCount = splitIntoLines(text).length;
  return getLineHeightInPx(fontSize, lineHeight) * lineCount;
};
```
and `:91-96`
```ts
export const getLineHeightInPx = (
  fontSize: ExcalidrawTextElement["fontSize"],
  lineHeight: ExcalidrawTextElement["lineHeight"],
) => {
  return fontSize * lineHeight;
};
```
So:
- **width** = max over lines of `ctx.measureText(line).width` (advance width)
- **height** = `fontSize × unitlessLineHeight × lineCount`
- `measureText()` (`:12-27`) substitutes `" "` for empty lines so leading/trailing blank lines still count.

**The per-keystroke chain (exact function names):**

1. `editable.oninput` → normalises EOL/tabs, then `onChange(editable.value)`
   `packages/excalidraw/wysiwyg/textWysiwyg.tsx:648-659`
   ```ts
   editable.oninput = () => {
     const normalized = normalizeText(editable.value);
     if (editable.value !== normalized) {
       const selectionStart = editable.selectionStart;
       editable.value = normalized;
       // put the cursor at some position close to where it was before
       // normalization (otherwise it'll end up at the end of the text)
       editable.selectionStart = selectionStart;
       editable.selectionEnd = selectionStart;
     }
     onChange(editable.value);
   };
   ```
2. `onChange` is supplied by the App and is **batched into a React update** — `App.tsx:6473-6478`:
   ```ts
   onChange: withBatchedUpdates((nextOriginalText) => {
     updateElement(nextOriginalText, false);
     if (isNonDeletedElement(element)) {
       updateBoundElements(element, this.scene);
     }
   }),
   ```
3. `updateElement` writes the new text into the scene element and merges the new dimensions
   `App.tsx:6429-6441`:
   ```ts
   if (_element.id === latestTextElement.id && isTextElement(_element)) {
     return newElementWith(_element, {
       originalText: nextOriginalText,
       isDeleted: isDeleted ?? _element.isDeleted,
       ...(stickyLayout?.text ??
         // returns (wrapped) text and new dimensions
         refreshTextDimensions(
           _element,
           getContainerElement(_element, elementsMap),
           elementsMap,
           nextOriginalText,
         )),
     });
   }
   ```
4. `refreshTextDimensions` → `packages/element/src/newElement.ts:529-549`:
   ```ts
   export const refreshTextDimensions = (
     textElement, container, elementsMap, text = textElement.text,
   ) => {
     if (textElement.isDeleted) { return; }
     if (container || !textElement.autoResize) {
       text = wrapText(text, getFontString(textElement),
         container ? getBoundTextMaxWidth(container, textElement) : textElement.width);
     }
     const dimensions = getAdjustedDimensions(textElement, elementsMap, text);
     return { text, ...dimensions };
   };
   ```
5. `getAdjustedDimensions` → `newElement.ts:393-412` — the actual grow/shrink maths:
   ```ts
     let { width: nextWidth, height: nextHeight } = measureText(
       nextText, getFontString(element), element.lineHeight,
     );

     // wrapped text
     if (!element.autoResize) {
       nextWidth = element.width;
     }
   ```
   plus, at `:417-434`, the anchor-preserving x/y nudge so a centre/middle-aligned text grows symmetrically:
   ```ts
     if (textAlign === "center" && verticalAlign === VERTICAL_ALIGN.MIDDLE
         && !element.containerId && element.autoResize) {
       const prevMetrics = measureText(element.text, getFontString(element), element.lineHeight);
       const offsets = getTextElementPositionOffsets(element, {
         width: nextWidth - prevMetrics.width,
         height: nextHeight - prevMetrics.height,
       });
       x = element.x - offsets.x;
       y = element.y - offsets.y;
     }
   ```
6. The scene update triggers `updateWysiwygStyle()` again, which copies the *new* element width/height back
   onto the textarea (§2.1).

**So the DOM node is never measured.** `getBoundingClientRect` is used in exactly one place, and only to map a
**click position → caret index** — never for sizing (`textWysiwyg.tsx:112-202`): a `position: fixed; opacity: 0`
mirror `div` with `whiteSpace: "pre"` and the same `font`/`lineHeight` is appended to `document.body`, a `Range`
is collapsed at every caret boundary, and each `range.getBoundingClientRect().left` is compared to the click X:
```ts
  const mirror = ownerDocument.createElement("div");
  const textNode = ownerDocument.createTextNode(text);
  const range = ownerDocument.createRange();
  …
  mirror.style { position:"fixed"; top:0; left:0; margin:0; padding:0; border:0;
                 opacity:"0"; pointerEvents:"none"; whiteSpace:"pre"; font; lineHeight }
  …
      range.setStart(textNode, offset);
      range.setEnd(textNode, offset);
      const caretRect = range.getBoundingClientRect();
      …
  const leftEdge = Math.min(...positions);
  …
      const distance = Math.abs(positions[index] - leftEdge - targetX);
```
(The mirror is `mirror.remove()`d in a `finally`.)

**Wrap vs no-wrap behaviour** (`textWysiwyg.tsx:464-467`): a **container-bound** text or a text with
`autoResize: false` gets `white-space: pre-wrap; word-break: break-word`; a free autosizing text gets
`white-space: pre; word-break: normal` — i.e. **free text never soft-wraps, it just grows wider**, until it
hits the viewport clamp `(appState.width - 8 - viewportX) / zoom`.

**Min/max width:**
- min width for edge-resize (`resizeElements.ts:355-365`): `getMinTextElementWidth = measureText("").width + BOUND_TEXT_PADDING*2` = `0 + 10` = **10px** (`textMeasurements.ts:46-51`)
- min width for a *container* being sized around a bound label (`textMeasurements.ts:32-44`):
  `getMaxCharWidth(font) + BOUND_TEXT_PADDING*2` = `maxCharWidth + 10`
- drag-to-set-width switches to wrapping once the drag exceeds `TEXT_AUTOWRAP_THRESHOLD = 36` px
  (`dragElements.ts:291`, `common/src/constants.ts:20`)
- max width: the viewport clamp above; for bound text, `getBoundTextMaxWidth` (`textElement.ts:511-540`):
  ```ts
    if (isArrowElement(container)) {
      const minWidth = (boundTextElement?.fontSize ?? DEFAULT_FONT_SIZE) *
        ARROW_LABEL_FONT_SIZE_TO_MIN_WIDTH_RATIO;
      return Math.max(ARROW_LABEL_WIDTH_FRACTION * width, minWidth);
    }
    if (container.type === "ellipse") {
      return Math.round((width / 2) * Math.sqrt(2)) - BOUND_TEXT_PADDING * 2;
    }
    if (container.type === "diamond") {
      return Math.round(width / 2) - BOUND_TEXT_PADDING * 2;
    }
    return width - (isStickyNoteElement(container) ? STICKY_NOTE_PADDING : BOUND_TEXT_PADDING) * 2;
  ```

**Container autogrow/shrink while typing a bound label** (`textWysiwyg.tsx:347-373`) — the *container* is
mutated, not just the text:
```ts
          // autogrow container height if text exceeds
          if (!isArrowElement(container) && height > maxHeight) {
            const targetContainerHeight = computeContainerDimensionForBoundText(height, container.type);
            app.scene.mutateElement(container, { height: targetContainerHeight });
            updateBoundElements(container, app.scene);
            return;
          } else if (
            // autoshrink container height until original container height
            // is reached when text is removed
            !isArrowElement(container) &&
            container.height > originalContainerData.height &&
            height < maxHeight
          ) { … }
```
with `computeContainerDimensionForBoundText` (`textElement.ts:492-509`):
```ts
  if (containerType === "ellipse")  { return Math.round(((dimension + padding) / Math.sqrt(2)) * 2); }
  if (containerType === "arrow")    { return dimension + padding * 8; }
  if (containerType === "diamond")  { return 2 * (dimension + padding); }
  return dimension + padding;   // padding = BOUND_TEXT_PADDING * 2 = 10
```

**A deliberate "reset auto-resize" affordance** — when a text has `autoResize: false`, an editing *or* selected
text gets a small vertical grip drawn on the interactive canvas, and grabbing it restores `autoResize: true`
measured at the current text (`actionTextAutoResize.ts:51-69`):
```ts
    const metrics = measureText(target.originalText, getFontString(target), target.lineHeight);
    const anchor = getTextAnchorRatios(target);
    const resized = newElementWith(target, {
      autoResize: true,
      width: metrics.width,
      height: metrics.height,
      x: target.x + (target.width - metrics.width) * anchor.x,
      y: target.y + (target.height - metrics.height) * anchor.y,
      text: target.originalText,
    });
```
Grip geometry — `packages/excalidraw/textAutoResizeHandle.ts:13-18`:
```ts
const TEXT_AUTO_RESIZE_HANDLE_GAP = 12;
const TEXT_AUTO_RESIZE_HANDLE_LENGTH = 16;
const TEXT_AUTO_RESIZE_HANDLE_HITBOX_WIDTH = 10;
const TEXT_AUTO_RESIZE_HANDLE_HITBOX_HEIGHT = TEXT_AUTO_RESIZE_HANDLE_LENGTH + 2;   // 18
const MAX_HANDLE_HEIGHT_RATIO = 0.8;
```
Hidden entirely when `formFactor !== "desktop"` or when the handle would be taller than 80% of the box
(`:30-36`).

### 2.3 START / END — the exact handlers

**START.** Four entry points, all funnelling into `App.startTextEditing` (`App.tsx:6932`):

| Trigger | Site |
|---|---|
| Double-click on empty canvas / on an element (selection tool or `autoshape`) | `handleCanvasDoubleClick`, gated at `App.tsx:7230-7251`, creates via `startTextEditing` at `:7427` |
| Second click on an **already-selected single text** (or a container of one) — this is "click again to edit" | `App.tsx:12581-12605` |
| **Enter** with a single text (or valid text container) selected | `App.tsx:5901-5921` |
| Text tool click | `handleTextOnPointerDown`, `App.tsx:9849-9910` |

The double-click gate — `App.tsx:7230-7251`:
```ts
    if (
      !this.isInteractionEnabled() ||
      this.state.editingTextElement ||
      !this.shouldHandleBrowserCanvasDoubleClick(event.type)
    ) {
      return;
    }
    // case: double-clicking with arrow/line tool selected would both create
    // text and enter multi-element mode
    if (this.state.multiElement) {
      return;
    }
    // double click only creates/edits text in selection mode, or with the
    // autoshape tool …
    if (
      this.state.activeTool.type !== this.state.preferredSelectionTool.type &&
      this.state.activeTool.type !== "autoshape"
    ) {
      return;
    }
```
Double-click detection is hand-rolled, not the browser's: `isDoubleClick` compares pointer timestamps against
`TAP_TWICE_TIMEOUT = 300` ms (`App.tsx:1750-1763`, `constants.ts:344`), and `lastPointerUpIsDoubleClick`
(`App.tsx:752-753`) decides whether the caret is placed at the click point or the whole text is selected
(`App.tsx:12600-12602`).

The Enter path — `App.tsx:5901-5921`:
```ts
          } else if (
            isTextElement(selectedElement) ||
            isValidTextContainer(selectedElement)
          ) {
            let container;
            if (!isTextElement(selectedElement)) {
              container = selectedElement as ExcalidrawTextContainer;
            }
            const midPoint = getContainerCenter(selectedElement, this.scene.getNonDeletedElementsMap());
            const sceneX = midPoint.x;
            const sceneY = midPoint.y;
            this.startTextEditing({ sceneX, sceneY, container });
            event.preventDefault();
            return;
          }
```
`startTextEditing` sets `editingTextElement` in app state (`App.tsx:7141`) and then calls `handleTextWysiwyg`
(`App.tsx:7163-7169`), which constructs the textarea and does `editable.select()` on init for non-touch
(`App.tsx:6547`, `textWysiwyg.tsx:1026-1030`):
```ts
  if (autoSelect && !pendingInitialSelection) {
    // select on init (focusing is done separately inside the bindBlurEvent()
    // because we need it to happen *after* the blur event from `pointerdown`)
    editable.select();
  }
```

**END — the keydown handler, quoted in full** (`packages/excalidraw/wysiwyg/textWysiwyg.tsx:662-711`):
```ts
  editable.onkeydown = (event) => {
    if (!event.shiftKey && actionZoomIn.keyTest(event)) {
      event.preventDefault();
      app.actionManager.executeAction(actionZoomIn);
      updateWysiwygStyle();
    } else if (!event.shiftKey && actionZoomOut.keyTest(event)) {
      event.preventDefault();
      app.actionManager.executeAction(actionZoomOut);
      updateWysiwygStyle();
    } else if (!event.shiftKey && actionResetZoom.keyTest(event)) {
      event.preventDefault();
      app.actionManager.executeAction(actionResetZoom);
      updateWysiwygStyle();
    } else if (actionDecreaseFontSize.keyTest(event)) {
      app.actionManager.executeAction(actionDecreaseFontSize);
    } else if (actionIncreaseFontSize.keyTest(event)) {
      app.actionManager.executeAction(actionIncreaseFontSize);
    } else if (event.key === KEYS.ESCAPE) {
      event.preventDefault();
      submittedViaKeyboard = true;
      handleSubmit();
    } else if (actionSaveToActiveFile.keyTest(event)) {
      event.preventDefault();
      handleSubmit();
      app.actionManager.executeAction(actionSaveToActiveFile);
    } else if (event.key === KEYS.ENTER && event[KEYS.CTRL_OR_CMD]) {
      event.preventDefault();
      if (event.isComposing || event.keyCode === 229) {
        return;
      }
      submittedViaKeyboard = true;
      handleSubmit();
    } else if (
      event.key === KEYS.TAB ||
      (event[KEYS.CTRL_OR_CMD] &&
        (event.code === CODES.BRACKET_LEFT ||
          event.code === CODES.BRACKET_RIGHT))
    ) {
      event.preventDefault();
      if (event.isComposing) {
        return;
      } else if (event.shiftKey || event.code === CODES.BRACKET_LEFT) {
        outdent();
      } else {
        indent();
      }
      // We must send an input event to resize the element
      editable.dispatchEvent(new Event("input"));
    }
  };
```
Read the answer off this handler precisely:

- **Escape → commits, via keyboard.** `submittedViaKeyboard = true; handleSubmit();`. It is *not* a cancel —
  there is no text revert. (Tests: `textWysiwyg.test.tsx:300` "should reselect text after exiting wysiwyg with
  escape".)
- **Enter alone → does NOT commit**; it inserts a newline (plain textarea default, no branch matches).
- **Ctrl/Cmd+Enter → commits**, guarded against IME composition (`event.isComposing || event.keyCode === 229`).
- **Ctrl/Cmd+S → commits first, then saves the file.**
- **Ctrl/Cmd+Shift+< / >** (`actionDecreaseFontSize`/`actionIncreaseFontSize`, `actionProperties.tsx:1110-1141`)
  resize the font **live without leaving the editor**; the wysiwyg branch for these two does *not*
  `preventDefault()` (deliberately, so the browser doesn't see them as zoom).
- **Tab / Shift+Tab / Ctrl+[ / Ctrl+]** indent (4 spaces) / outdent and then **re-dispatch a synthetic `input`
  event** so the autosize runs — `TAB_SIZE = 4`, `TAB = " ".repeat(4)`, `RE_LEADING_TAB = new RegExp("^ {1,4}")`
  (`textWysiwyg.tsx:713-776`).
- **blur → commits.** `bindBlurEvent` installs `editable.onblur = handleSubmit` on a `setTimeout(0)`
  (`textWysiwyg.tsx:918-935`).

The commit itself — `textWysiwyg.tsx:818-872`:
```ts
  let submittedViaKeyboard = false;
  const handleSubmit = () => {
    // prevent double submit
    if (isDestroyed) {
      return;
    }

    isDestroyed = true;
    // cleanup must be run before onSubmit otherwise when app blurs the wysiwyg
    // it'd get stuck in an infinite loop of blur→onSubmit after we re-focus the
    // wysiwyg on update
    cleanup();
    const updateElement = app.scene.getElement(element.id) as ExcalidrawTextElement;
    if (!updateElement) {
      return;
    }
    const container = getContainerElement(updateElement, app.scene.getNonDeletedElementsMap());

    if (container) {
      if (editable.value.trim()) {
        const boundTextElementId = getBoundTextElementId(container);
        if (!boundTextElementId || boundTextElementId !== element.id) {
          app.scene.mutateElement(container, {
            boundElements: (container.boundElements || []).concat({
              type: "text",
              id: element.id,
            }),
          });
        } else if (isArrowElement(container)) {
          // updating an arrow label may change bounds, prevent stale cache:
          bumpVersion(container);
        }
      } else {
        app.scene.mutateElement(container, {
          boundElements: container.boundElements?.filter(
            (ele) => !isTextElement(ele as ExcalidrawTextElement | ExcalidrawLinearElement),
          ),
        });
      }

      redrawTextBoundingBox(updateElement, container, app.scene);
    }

    onSubmit({
      viaKeyboard: submittedViaKeyboard,
      nextOriginalText: editable.value,
    });
  };
```
`cleanup()` (`textWysiwyg.tsx:874-895`) nulls `onblur/oninput/onkeydown`, disconnects the `ResizeObserver`,
removes all window listeners (`resize`, capture-phase `wheel`, capture-phase `pointerdown`, `pointerup`, `blur`,
`beforeunload`), unbinds the scene/scroll emitters and finally **`editable.remove()`** — the textarea is deleted
from the DOM, not hidden.

Then the App side, `App.tsx:6479-6537`, decides **keyboard-commit keeps the element selected, pointer-commit
does not**:
```ts
      onSubmit: withBatchedUpdates(({ viaKeyboard, nextOriginalText }) => {
        this.textWysiwygSubmitHandler = null;

        const isDeleted = !nextOriginalText.trim();
        updateElement(nextOriginalText, isDeleted);

        // keyboard-submit keeps focus on the edited object. For bound text, keep
        // the container selected even if the text becomes empty and is deleted.
        // The autoshape tool stays active through the editing session and never
        // selects anything — don't fight the finalize action's selection reset.
        const elementIdToSelect =
          viaKeyboard &&
          !this.isToolLocked() &&
          this.state.activeTool.type !== "autoshape"
            ? element.containerId || (!isDeleted ? element.id : null)
            : null;
```
…and finally clears the editing flag inside `flushSync` (`App.tsx:6524-6529`):
```ts
        flushSync(() => {
          this.setState({
            newElement: null,
            editingTextElement: null,
          });
        });
```

**Hint text shown during editing** — `HintViewer.tsx:161-166` + `locales/en.json:386-387`:
```ts
  if (appState.editingTextElement) {
    return t("hints.text_editing", {
      shortcut_1: getTaggedShortcutKey("Escape"),
      shortcut_2: getTaggedShortcutKey(["CtrlOrCmd", "Enter"]),
    });
  }
```
→ **"Press Esc or Ctrl+Enter to finish editing"**, rendered under the toolbar (`Toolbar.tsx:255-260`), styled
by `HintViewer.scss` (`font-size: 0.75rem`, `kbd { border-radius: 4px; font-size: 10px }`). The pre-edit hint is
`"Double-click or press Enter to edit text"` (`en.json:386`).

### 2.4 WHILE EDITING — how global shortcuts are disabled

**There is no dedicated "text-editing mode" flag gating the keyboard, and no global capture-phase blocker.** The
disable mechanism is: **focus is inside a real `<textarea>`, and the app's key handler bails on writable
targets.** The textarea tags itself so the shared predicate recognises it.

`packages/excalidraw/wysiwyg/textWysiwyg.tsx:456`
```ts
  editable.dataset.type = "wysiwyg";
```
`packages/common/src/utils.ts:99-118`
```ts
export const isWritableElement = (
  target: Element | EventTarget | null,
): target is HTMLInputElement | HTMLTextAreaElement | HTMLBRElement | HTMLDivElement => {
  const targetWindow = getTargetWindow(target);
  return (
    !!targetWindow &&
    ((target instanceof targetWindow.HTMLElement &&
      target.dataset.type === "wysiwyg") ||
      target instanceof targetWindow.HTMLBRElement || // newline in wysiwyg
      target instanceof targetWindow.HTMLTextAreaElement ||
      (target instanceof targetWindow.HTMLInputElement && …) ||
      (target instanceof targetWindow.HTMLElement &&
        target.closest(".cm-editor") !== null))
  );
};
```
`packages/excalidraw/components/App.tsx:5654-5664` — the bail-out:
```ts
      // bail if
      if (
        // inside an input
        (isWritableElement(event.target) &&
          // unless pressing escape (finalize action)
          event.key !== KEYS.ESCAPE) ||
        // or unless using arrows (to move between buttons)
        (isArrowKey(event.key) && isInputLike(event.target))
      ) {
        return;
      }
```
Consequences, verified one by one:

| Global behaviour | State while editing | Evidence |
|---|---|---|
| Single-letter tool switching (R, E, D, T, 1–9 …) | **disabled** — `onKeyDown` returns at `:5663` before `findShapeByKey` (`:5730`) | `App.tsx:5654-5664, 5721-5735` |
| Action shortcuts / command palette (Ctrl+P) / Ctrl+V paste flag | **disabled** — all after the bail; note Ctrl+P and Ctrl+V handling at `:5620-5644` is *before* the bail, so those two fire, but `handleKeyDown` at `:5705` and the tool switching after never do | `App.tsx:5620-5644, 5705` |
| Undo / Redo (Ctrl+Z / Ctrl+Y) | **disabled** — `executeHistoryAction` requires `!appState.editingTextElement` | `actions/actionHistory.tsx:33-35` |
| Arrow-key element translation | **disabled** — unreachable past the bail (`isArrowKey` check plus the writeable bail) | `App.tsx:5812` |
| Element dragging (pointer) | **disabled** — the drag branch requires `!this.state.editingTextElement` | `App.tsx:10992-10998` |
| Creating a second text while one is open | **disabled** — `handleTextOnPointerDown` returns immediately | `App.tsx:9853-9858` |
| Double-click starting a second editor | **disabled** — `this.state.editingTextElement` gate | `App.tsx:7230-7236` |
| Selection (clicking another element) | **not possible**: the editor deselects on entry and a pointerdown on the canvas submits | `App.tsx:6549-6550`, `textWysiwyg.tsx:982-997` |
| Transform handles / resize | **hidden while editing** | `interactiveScene.ts:1997-2004` |
| Pan with middle-mouse / wheel | **still works**, and is special-cased so panning doesn't blur the editor | `textWysiwyg.tsx:951-959`, `App.pan.ts:114-125` |
| Zoom via Ctrl+±/0, font-size via Ctrl+Shift+<> | **explicitly re-enabled by the textarea's own handler** (§2.3) | `textWysiwyg.tsx:662-678` |

Two further "don't fight the editor" hooks:
- `packages/excalidraw/components/App.pan.ts:114-125`
  ```ts
      // due to event.preventDefault below, container wouldn't get focus automatically
      app.focusContainer();

      // preventing default while text editing messes with cursor/focus
      if (!app.state.editingTextElement) {
        // necessary to prevent browser from scrolling the page if excalidraw not full-page #4489
        // as such, the above is broken when panning canvas while in wysiwyg
        event.preventDefault();
      }
  ```
- Canvas-level `click`/`cut`/`copy` handlers refuse to run when the event target is writable
  (`App.tsx:4481, 4496`), so Ctrl+C/X in the editor does a native text copy.
- `textWysiwyg.tsx:1045` — `editable.onpointerdown = (event) => event.stopPropagation();` so pointer events
  inside the textarea never reach the canvas.

**Selection while editing:** `handleTextWysiwyg` ends with (`App.tsx:6549-6550`):
```ts
    // deselect all other elements when inserting text
    this.deselectElements();
```
`deselectElements` (`App.tsx:6557-6564`) clears `selectedElementIds`, `selectedGroupIds`, `editingGroupId`,
`activeEmbeddable`. **So while typing, nothing is selected — no selection border, no transform handles.** The
panel still tracks the edited element because the styles panel reads a *separate* app-state field:

`packages/element/src/selection.ts:215-231`
```ts
export const getTargetElements = (
  elements: ElementsMapOrArray,
  appState: Pick<AppState, "selectedElementIds" | "editingTextElement" | "newElement" | "activeTool">,
) =>
  appState.editingTextElement
    ? [appState.editingTextElement]
    : appState.newElement && appState.activeTool.type !== "autoshape"
    ? [appState.newElement]
    : getSelectedElements(elements, appState, { includeBoundTextElement: true });
```
and `actionProperties.tsx:240-247`:
```ts
  const editingTextElement = app.state.editingTextElement;
  …
  if (editingTextElement) {
    ret = getValue(editingTextElement);
  }
```
Also `App.tsx:4413-4424` is a failsafe that clears `editingTextElement` if the element got deleted underneath
the editor.

### 2.5 ⚠️ WHAT IS ACTUALLY RENDERED NEAR THE TEXT WHILE EDITING — critical finding

**There is NO floating control bar, NO handle, and NO on-canvas button attached to the text element while it is
being edited.** I looked for it specifically and can state this plainly:

- The textarea is appended to a permanently-empty sibling container `.excalidraw-textEditorContainer`
  (`App.tsx:2529`) which has **zero CSS rules in the entire repo**.
- The textarea's own style block (§2.1) contains **no child elements** — it is a single `<textarea>`, nothing
  rendered inside or on top of it.
- `ElementCanvasButtons` — the only on-canvas floating button component — renders **only** for a single selected
  `magicframe` or `iframe` (`App.tsx:2558-2630`). There is no text branch.
- Grep for a text-editor toolbar/label component: `FontPickerTrigger` / `CompactShapeActions` / `PropertiesPopover`
  are all **styles-panel** components living in `LayerUI`/`MobileMenu`, not attached to the element.

**What IS rendered, on the canvas, around the edited text:** a single **dashed rectangle** — no buttons — and
only when the text is *not* autosizing. `packages/excalidraw/renderer/interactiveScene.ts:1721-1733`:
```ts
  if (appState.editingTextElement) {
    const textElement = allElementsMap.get(appState.editingTextElement.id) as
      | ExcalidrawTextElement
      | undefined;
    if (textElement && !textElement.autoResize) {
      renderTextBox(textElement, context, appState, renderConfig.selectionColor);
    }
  }
```
`renderTextBox` (`:1568-1590`):
```ts
  const padding = getTextBoxPadding(appState.zoom.value);
  const width = text.width + padding * 2;
  const height = text.height + padding * 2;
  …
  context.lineWidth = 1 / appState.zoom.value;
  context.strokeStyle = selectionColor;
  context.globalAlpha = 0.5;
  context.setLineDash([6 / appState.zoom.value, 4 / appState.zoom.value]);
  context.strokeRect(shiftX, shiftY, width, height);
```
i.e. a 50%-alpha dashed 1px border, dash pattern `6/4` px divided by zoom, inset padding
`getTextBoxPadding(zoom) = DEFAULT_TRANSFORM_HANDLE_SPACING * 2 / zoom = 4 / zoom` scene-px
(`textAutoResizeHandle.ts:20-21`). For the *autosizing* (default) text case, **even this box is not drawn**.

**So where do "the buttons like Excalidraw" actually come from?** They are the app's ordinary **styles panel**,
which stays visible *because editing counts as a target*, and which is deliberately kept usable without stealing
the caret:

1. The panel renders during editing — `packages/element/src/showSelectedShapeActions.ts:11-22`:
   ```ts
   export const showSelectedShapeActions = (
     appState: UIAppState,
     elements: readonly NonDeletedExcalidrawElement[],
   ) =>
     Boolean(
       !appState.viewModeEnabled &&
         appState.openDialog?.name !== "elementLinkSelector" &&
         ((appState.activeTool.type !== "custom" &&
           (appState.editingTextElement ||
             (appState.activeTool.type !== "selection" && …
   ```
2. It is positioned **top-left of the canvas**, not next to the text — `LayerUI.tsx:301-330` puts it inside
   `<FixedSideContainer side="top">` → `.App-menu_top__left` → `.selected-shape-actions-container`
   (`styles.scss:388-446`; `--editor-container-padding: 1rem`, `theme.scss:51`).
3. Its **contents for text** — `Actions.tsx:187-195`:
   ```tsx
      {predicates.text && (
        <>
          <fieldset>{renderAction("changeFontFamily")}</fieldset>
          {renderAction("changeFontSize")}
          {predicates.textAlign && renderAction("changeTextAlign")}
        </>
      )}

      {predicates.verticalAlign && renderAction("changeVerticalAlign")}
   ```
4. **Clicking those controls does not end the edit**, and the caret is restored. Two cooperating mechanisms:
   - the textarea's capture-phase `pointerdown` watcher classifies the target and *temporarily disables* the
     blur-submit — `textWysiwyg.tsx:947-998` (and `bindBlurEvent` at `:905-923`):
     ```ts
     const isPropertiesTrigger =
       target instanceof ownerWindow.HTMLElement &&
       target.classList.contains("properties-trigger");
     const isPropertiesContent =
       (target instanceof ownerWindow.HTMLElement || target instanceof ownerWindow.SVGElement) &&
       !!(target as Element).closest(".properties-content");
     const inShapeActionsMenu =
       (target instanceof ownerWindow.HTMLElement || target instanceof ownerWindow.SVGElement) &&
       (!!(target as Element).closest(`.${CLASSES.SHAPE_ACTIONS_MENU}`) ||
         !!(target as Element).closest(".compact-shape-actions-island"));
     …
       // If we interacted within shape actions menu or its popovers/triggers,
       // keep submit disabled and don't steal focus back to textarea.
       if (inShapeActionsMenu || isPropertiesTrigger || isPropertiesContent) {
         return;
       }
       // Otherwise, re-enable submit on blur and refocus the editor.
       editable.onblur = handleSubmit;
       editable.focus();
     ```
     with `CLASSES.SHAPE_ACTIONS_MENU = "App-menu__left"` (`common/src/constants.ts:106`) and
     `PROPERTIES_CLASSES = clsx([CLASSES.SHAPE_ACTIONS_THEME_SCOPE, "properties-content"])`
     (`Actions.tsx:57-60`). `properties-trigger` is the class on the colour swatch / font-picker trigger
     buttons (`ColorPicker.tsx:304`, `FontPickerTrigger.tsx:36,42`, `Actions.tsx:267,352,449,534`).
   - caret save/restore is a purpose-built hook, `hooks/useTextEditorFocus.ts:10-45, 73-107`:
     ```ts
     const getTextEditor = (ownerDocument: Document): HTMLTextAreaElement | null => {
       return ownerDocument.querySelector(".excalidraw-wysiwyg") as HTMLTextAreaElement;
     };
     …
     export const restoreCaretPosition = (position: CaretPosition | null, ownerDocument = document) => {
       const ownerWindow = ownerDocument.defaultView ?? window;
       ownerWindow.setTimeout(() => {
         const textEditor = getTextEditor(ownerDocument);
         if (textEditor) {
           textEditor.focus();
           if (position) {
             textEditor.selectionStart = position.start;
             textEditor.selectionEnd = position.end;
           }
         }
       }, 0);
     };
     ```
     and every text action wires it in — e.g. `actionProperties.tsx:1628-1635`:
     ```ts
           onChange={(value) => {
             withCaretPositionPreservation(
               () => updateData(value),
               isCompact,
               !!appState.editingTextElement,
               data?.onPreventClose,
             );
           }}
     ```
5. On tablet / compact desktop UI the panel is a **vertical icon stack with popovers**, and the text controls
   live inside a `compactTextProperties` popover that itself preserves the caret — `Actions.tsx:410-492`:
   ```tsx
   const CombinedTextProperties = ({ appState, renderAction, setAppState, predicates, container }) => {
     const { saveCaretPosition, restoreCaretPosition } = useTextEditorFocus(container?.ownerDocument);
     const isOpen = appState.openPopup === "compactTextProperties";
     …
           <PropertiesPopover
             className={PROPERTIES_CLASSES}
             container={container}
             style={{ maxWidth: "13rem" }}
             // Improve focus handling for text editing scenarios
             preventAutoFocusOnTouch={!!appState.editingTextElement}
             onClose={() => {
               // Refocus text editor when popover closes with caret restoration
               if (appState.editingTextElement) {
                 restoreCaretPosition();
               }
             }}
           >
             <div className="selected-shape-actions">
               {predicates.text && renderAction("changeFontSize")}
               {predicates.textAlign && renderAction("changeTextAlign")}
               {predicates.verticalAlign && renderAction("changeVerticalAlign")}
             </div>
           </PropertiesPopover>
   ```
   (`PropertiesPopover` defaults to `side="right"` on desktop / `side="bottom"` on phone portrait, with
   `sideOffset={20}`, `alignOffset={-16}` — `PropertiesPopover.tsx:49-56`.)
6. On **phone**, the text controls are in the bottom action bar via `MobileShapeActions`
   (`MobileMenu.tsx:174`, `Actions.tsx:731`), gated by the same `showSelectedShapeActions`.

**Summary for the implementer:** Excalidraw's "buttons while typing" are **not** a floating element-attached
toolbar. They are the persistent styles panel (top-left island on desktop, compact icon island on tablet, bottom
bar on phone) whose *content* swaps to the text controls because `editingTextElement` is treated as a selection
target, combined with caret save/restore so using them doesn't end the edit. If the user's mental model is "a
small floating toolbar appears next to the text while I type", **that does not exist in Excalidraw** — what
appears is the normal panel staying usable.

### 2.6 Caret, placeholder, empty-element handling

**Caret:** native `<textarea>` caret. There is **no custom caret rendering and no `caret-color` declaration**
(grep for `caret`/`caretColor` across `packages/` returns only CodeMirror hits in `TTDDialog`). The caret colour
follows `color`, which `updateWysiwygStyle` sets to the element's stroke colour through
`applyDarkModeFilter(strokeColor, isDark)` (`textWysiwyg.tsx:421-424`; `common/src/colors.ts:86`). Direction is
`editable.dir = "auto"` (`:454`), and per-line direction is computed by `getLineDirection` via `isRTL`
(`:101-110`) for the click-to-caret mirror.

**Initial caret placement:** if the click was a single click (not a double click), the scene coords are handed to
the editor as `initialCaretSceneCoords` (`App.tsx:12600-12602`) and resolved by
`getCaretIndexFromInitialSceneCoords` (`textWysiwyg.tsx:491-555`): un-rotate the point into element-local space,
compute `lineIndex = floor(localY / lineHeightPx)`, subtract the horizontal alignment offset
(`center → (width − lineWidth)/2`, `right → width − lineWidth`), then use the hidden-mirror `Range` measurement
(§2.2) to pick the nearest boundary offset. If any step fails it returns the line start. On a **double-click**
the coords are `undefined`, so `pendingInitialSelection` stays `null` and the whole text is selected instead.

**Placeholder text: there is NONE.** Grep for `placeholder` in `textWysiwyg.tsx` returns zero matches; the
textarea has no `placeholder` attribute, no ghost text, no "Start typing…" label. An empty editing text shows
literally nothing but a blinking caret. (The only placeholders in the repo are unrelated UI inputs.)

**Empty element on commit → deleted.** Two layers:
1. `App.tsx:6482-6483`
   ```ts
        const isDeleted = !nextOriginalText.trim();
        updateElement(nextOriginalText, isDeleted);
   ```
   `trim()` means whitespace-only counts as empty. The element is marked `isDeleted` (soft delete, Excalidraw's
   normal model), and bindings are cleaned up at `:6514-6518`:
   ```ts
        if (isDeleted) {
          fixBindingsAfterDeletion(this.scene.getNonDeletedElements(), [element]);
        }
   ```
2. For a bound label, the container's `boundElements` entry is removed and the container is redrawn —
   `textWysiwyg.tsx:854-865` (quoted in §2.3).

Test evidence: `textWysiwyg.test.tsx:1405-1416` — `"should not allow bound text with only whitespaces"`:
```ts
      updateTextEditor(editor, "   ");
      Keyboard.exitTextEditor(editor);
      expect(rectangle.boundElements).toStrictEqual([]);
      expect(h.elements[1]).toEqual(expect.objectContaining({ isDeleted: true }));
```
and `:2087-2096` — `"removes a plain text in a single undo"` (create + type + commit collapses to one history
entry; the guard is `isEditingTextContent`, `App.tsx:6915-6930`).

**History capture on a fresh text:** the empty element created on the first click is deliberately *not* captured
so that undo removes the whole create-and-type, not just the typing — `App.tsx:6915-6930`:
```ts
  /**
   * Whether a text element's content is still being authored.
   *
   * Creating a text reverts the tool to selection during pointerdown, so the
   * pointerup that follows looks like an ordinary canvas click and would
   * capture the still-empty element as a history entry of its own. Undo would
   * then rewind only the typing, restoring an invisible, zero-content element
   * (and, for an endpoint label, leaving the arrow bound to it) rather than
   * removing it. The editor's own submit captures the finished text instead,
   * so the whole create-and-type lands in a single entry.
   */
  private isEditingTextContent() {
    return !!this.state.editingTextElement || isTextElement(this.state.newElement);
  }
```
on submit: `if (!isDeleted || isExistingElement) { this.store.scheduleCapture(); }` (`App.tsx:6520-6522`).

---

## 3. Exact numbers

**Fonts**
| Thing | Value | Source |
|---|---|---|
| Default font size | **20** | `common/src/constants.ts:216` (`DEFAULT_FONT_SIZE`) |
| Font size presets S/M/L/XL | **16 / 20 / 28 / 36** | `constants.ts:115-120` (`FONT_SIZES`) — labels `small`/`medium`/`large`/`veryLarge` |
| Min font size | 1 | `constants.ts:215` |
| Relative font step (Ctrl+Shift+< / >) | **0.1** (±10%, `Math.round`) | `actions/actionProperties.tsx:182, 1105, 1129` |
| Default font family | **`FONT_FAMILY.Excalifont` = id 5** | `constants.ts:138, 261` |
| Font family ids | Virgil 1, Helvetica 2, Cascadia 3, *(4 unused)*, Excalifont 5, Nunito 6, "Lilita One" 7, "Comic Shanns" 8, "Liberation Sans" 9, Assistant 10 | `constants.ts:133-144` |
| Fallback chain for Excalifont | **`Excalifont, Xiaolai, sans-serif, Segoe UI Emoji`** | `utils.ts:123-147` + `constants.ts:151-190` |
| Generic fallback for Cascadia / Comic Shanns | `monospace`; all others `sans-serif` | `constants.ts:162-173` |
| CJK hand-drawn fallback | `Xiaolai` (id 100) | `constants.ts:122, 157` |
| Windows emoji fallback | `Segoe UI Emoji` (id 1000) | `constants.ts:123, 159` |
| The font string actually applied to the textarea | `getFontString(el)` → `` `${fontSize}px ${fontFamilyString}` `` | `utils.ts:139-147` |
| **Default font family stack actually applied** | **`20px Excalifont, Xiaolai, sans-serif, Segoe UI Emoji`** | derived: `newElement.ts:351`, `utils.ts:139-147`, `constants.ts:181-186` |
| Font picker inline buttons | **3**, not 4: `FreedrawIcon`/`labels.handDrawn` (Excalifont), `FontFamilyNormalIcon`/`labels.normal` (Nunito), `FontFamilyCodeIcon`/`labels.code` (Comic Shanns); a 4th `TextIcon` control only **opens** the full list | `FontPicker/FontPicker.tsx:22-41`, `FontPicker/FontPickerTrigger.tsx:28-52` |
| UI font variable | `Assistant, system-ui, BlinkMacSystemFont, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif` | `css/styles.scss:41-42` |

**Line-height (unitless, per family)** — `common/src/font-metadata.ts`
| Family | lineHeight | ascender/descender (unitsPerEm) |
|---|---|---|
| Excalifont | **1.25** | 886 / −374 (1000) |
| Nunito | 1.25 | 1011 / −353 (1000) |
| Lilita One | **1.15** | 923 / −220 (1000) |
| Comic Shanns | 1.25 | 750 / −250 (1000) |
| Virgil | 1.25 | 886 / −374 (1000) |
| Helvetica | 1.15 | 1577 / −471 (2048) |
| Cascadia | **1.2** | 1900 / −480 (2048) |
| Liberation Sans | 1.15 | 1854 / −434 (2048) |
| Assistant | 1.25 | 1021 / −287 (2048) |
| Xiaolai (fallback) | 1.25 | 880 / −144 (1000) |
| Segoe UI Emoji (fallback) | 1.25 | 886 / −374 (1000) |
Excalidraw's own comment on the value: *"harcoded unitless line-height"* (`font-metadata.ts:20-23`).
**`line-height` on the textarea is set from `updatedTextElement.lineHeight` (unitless) and must come AFTER
`font` or it is ignored** (`textWysiwyg.tsx:405-406`).

**Text box / element**
| Thing | Value | Source |
|---|---|---|
| `BOUND_TEXT_PADDING` | **5** | `constants.ts:404` |
| `DEFAULT_TRANSFORM_HANDLE_SPACING` | **2** | `constants.ts:265` |
| Text box padding in the editor/handle | `2*2/zoom = 4/zoom` scene-px | `textAutoResizeHandle.ts:20-21` |
| Textarea height buffer while editing | **×1.05** | `textWysiwyg.tsx:394-395` |
| Bound-text textarea width fudge | **+0.5px** | `textWysiwyg.tsx:391` |
| Free-text max width | `(appState.width − 8 − viewportX) / zoom` | `textWysiwyg.tsx:388` |
| Textarea `maxHeight` | `(appState.height − viewportY) / zoom` | `textWysiwyg.tsx:401-402, 426` |
| Textarea `minHeight` | `1em` | `textWysiwyg.tsx:470` |
| Min text element width | `measureText("") + 10` = **10px** | `textMeasurements.ts:46-51` |
| Min bound-container width | `getMaxCharWidth(font) + 10` | `textMeasurements.ts:32-44` |
| Auto-wrap threshold on drag | **36px** | `constants.ts:20` |
| Sticky note padding / min / max font | **16** / 16 / 512 (fallback 28, step 2) | `constants.ts:217-221` |
| Arrow label max width | `max(0.7 × width, fontSize × 11)` | `textElement.ts:516-521`, `constants.ts:405-406` |
| Ellipse label max w/h | `round((w|h / 2) × √2) − 10` | `textElement.ts:526, 562` |
| Diamond label max w/h | `round(w|h / 2) − 10` | `textElement.ts:531, 567` |
| Rect label max w/h | `w − 10`, `h − 10` (sticky: `w − 32`) | `textElement.ts:533-539, 569` |
| Container autogrow, ellipse | `round(((h + 10) / √2) × 2)` | `textElement.ts:499-501` |
| Container autogrow, arrow | `h + 10 × 8` | `textElement.ts:502-504` |
| Container autogrow, diamond | `2 × (h + 10)` | `textElement.ts:505-507` |
| Container autogrow, default | `ceil(h) + 10` | `textElement.ts:496-508` |

**Auto-resize grip** (`textAutoResizeHandle.ts:13-18`): gap **12**, length **16**, hitbox **10×18**, max
handle/box height ratio **0.8**, drawn at `lineWidth 1.5/zoom`, `globalAlpha 0.5`, `lineCap round`. Desktop-only.

**Dashed edit box** (`interactiveScene.ts:1584-1588`): `lineWidth 1/zoom`, `globalAlpha 0.5`, dash
`[6/zoom, 4/zoom]`. **Only for `autoResize: false`.**

**Layering / radii / spacing**
| Token | Value | Source |
|---|---|---|
| `--zIndex-wysiwyg` | **3** | `css/styles.scss:8` |
| `--zIndex-canvas` / `interactiveCanvas` / `svgLayer` / `canvasButtons` / `layerUI` | 1 / 2 / 3 / 3 / 4 | `css/styles.scss:5-10` |
| `--zIndex-ui-styles-popup` | 100 | `css/styles.scss:19` |
| `--border-radius-lg` / `--border-radius-md` | **0.5rem / 0.375rem** | `css/theme.scss:149-150` |
| `--editor-container-padding` | **1rem** (0.75rem on phone) | `css/theme.scss:51, 169` |
| `--space-factor` | **0.25rem** | `css/theme.scss:80` |
| `--lg-button-size` / `--lg-icon-size` | **2.25rem / 1rem** (2.5rem / 1.25rem phone) | `css/theme.scss:49-50, 173-174` |
| Compact action button | `--mobile-action-button-size`, fallback **2rem** | `css/variables.module.scss:170-171, 249-250`, `Actions.scss:113-120` |
| Compact popover max width (text props) | **13rem** | `Actions.tsx:474` |
| Compact strip gap / padding | `gap 0.5rem`, `padding 0.5rem`, `max-height calc(100vh - 200px)` | `Actions.scss:95-101` |
| Compact island min width | **48px** | `styles.scss:441-446` |
| Hint text / `kbd` | `font-size 0.75rem` / `10px`, `border-radius 4px`, `padding 1px 3px` | `HintViewer.scss` |
| Full-panel fieldset label | `font-size 0.75rem`, `margin-bottom 0.25rem` | `styles.scss:163-170` |
| Full-panel column gap | `row-gap 0.75rem` | `styles.scss:158-161` |
| App menu grid | `1fr 2fr 1fr`, `grid-gap 1rem` (→ `1fr 1fr 1fr`, `3rem` ≥1536px) | `styles.scss:388-401` |
| Panel width (`--full` left menu) | `12.5rem`, `padding 0.75rem` | `styles.scss:494-499` |

**Interaction timings / thresholds**
| Thing | Value | Source |
|---|---|---|
| `TAP_TWICE_TIMEOUT` (double-click window) | **300 ms** | `constants.ts:344`, `App.tsx:1760` |
| `DOUBLE_TAP_POSITION_THRESHOLD` (touch) | **35 px** | `constants.ts:596` |
| `ZOOM_STEP` | **0.1** (zoom via Ctrl+±) | `constants.ts:349` |
| `ELEMENT_TRANSLATE_AMOUNT` | 1 px | `constants.ts:25` |
| `TEXT_AUTOWRAP_THRESHOLD` | **36 px** | `constants.ts:20` |
| `SCROLL_TIMEOUT` | 100 ms | `constants.ts:348` |
| `TAB_SIZE` | **4 spaces** | `textWysiwyg.tsx:713-714` |
| Caret-restore delay | `setTimeout(…, 0)` | `useTextEditorFocus.ts:35, 84` |
| Blur-submit deferral | `setTimeout` (1 macrotask) | `textWysiwyg.tsx:918` |
| Mobile-submit deferral | `requestAnimationFrame` | `textWysiwyg.tsx:994-996` |
| Undo grouping for create+type | one entry | `App.tsx:6915-6930`, tested `textWysiwyg.test.tsx:2087` |

**The full keyboard contract while editing** (from `textWysiwyg.tsx:662-711` + actions)
| Key | Effect |
|---|---|
| any printable char | insert (native) |
| **Enter** | **newline** (does not commit) |
| **Ctrl/Cmd+Enter** | commit (IME-guarded) |
| **Escape** | commit |
| **Ctrl/Cmd+S** | commit, then save file |
| **Tab / Shift+Tab** | indent / outdent 4 spaces, then re-dispatch `input` |
| **Ctrl/Cmd+[ / ]** | outdent / indent |
| **Ctrl/Cmd+Shift+`<` or `,`** | font size ÷ 1.1 (rounded) |
| **Ctrl/Cmd+Shift+`>` or `.`** | font size × 1.1 (rounded) |
| **Ctrl/Cmd+`+`/`-`/`0`** | zoom in / out / reset, then re-style |
| blur | commit |
| middle-mouse / right-button drag | pan canvas without committing |
| Ctrl+C / Ctrl+X / Ctrl+V | native text clipboard (cut/copy handlers bail on writable targets) |
| paste of Excalidraw elements | pastes only their text (`textWysiwyg.tsx:571-606`) |

**The panel content for a text element, in render order** (`Actions.tsx:167-222`)
`Stroke` → `Background` → `Fill` → `Stroke width` → `Stroke style` → `Sloppiness` → `Roundness` →
**text group: `Font family` fieldset → `Font size` → `Text align`** → `Vertical align` → `Opacity` →
`Layers` (sendToBack · sendBackward · bringForward · bringToFront — `Actions.tsx:65-79`) → `Align` →
`Actions` fieldset (duplicate · delete · group · ungroup · link · crop · line editor).
For **text** specifically the predicates (`shapeActionPredicates.ts:151-155`) give:
`text = activeTool === "text" || any selected is a text element`;
`textAlign = activeTool === "text" || suppportsHorizontalAlign(...)`;
`verticalAlign = shouldAllowVerticalAlign(...)`; and `showExtraActions = hasSelection && !isEditingTextOrNewElement`
(`:121`) — i.e. **duplicate/delete are hidden while editing text**, while colour/font/size/align remain.
Opacity slider is `min 0 max 100 step 10` (`actionProperties.tsx:985-993`).

---

## 4. What I could NOT verify

1. **Rendered DOM at runtime.** No browser and no ability to run the app (per the brief). Everything above is
   source-level. I could not screenshot the actual editing state to confirm there is no floating bar in a
   version where one might be feature-flagged — but there is **no feature flag** in the text-editing path
   (grep for `getFeatureFlag` in `textWysiwyg.tsx` and `startTextEditing`: only `COMPLEX_BINDINGS` for arrows),
   and `ElementCanvasButtons` has no text branch.
2. **The user's screenshot claim of "4 icon buttons" for font family.** The source has **3** inline default-font
   buttons plus a 4th icon that opens a list (`FontPicker.tsx:22-41`, `FontPickerTrigger.tsx:28-52`). Either the
   screenshot is of a build whose `DEFAULT_FONTS` differs from this commit, or one of the four icons the user saw
   is that trigger. **Which one is which is `[UNVERIFIED]`** — it needs one look at a live Excalidraw.
3. **`.excalidraw-wysiwyg` styling.** I confirmed there is **no CSS rule** for it, so all styling is the inline
   block at `textWysiwyg.tsx:468-487`. I could not verify what *hosting apps* (e.g. excalidraw.com's own
   `excalidraw-app/`) add on top — I did not audit `packages/excalidraw-app/` CSS for overrides of
   `.excalidraw-textEditorContainer` or the textarea. `[UNVERIFIED]` (low risk: the class is only ever matched
   in a `:not()` guard in `styles.scss:737`).
4. **Actual `measureText` advance widths.** I did not execute any font. The *formulas* are verified; the
   resulting pixel widths for any particular string are not, and would depend on the loaded Excalifont/Nunito
   webfonts (`fonts/*/…woff2`, registered via `fonts/Fonts.ts:224` + `Fonts/ExcalidrawFontFace.ts:24`).
5. **iOS/Android-specific behaviour.** `autoSelect: !this.editorInterface.isTouchScreen` (`App.tsx:6547`) and
   the mobile pointerdown-submit path (`textWysiwyg.tsx:986-997`) are source-verified but untested on device.
6. **The docs site.** `docs.excalidraw.com` documents the public API only; the pages I read contain **nothing**
   about the text editor. No documentation claim in this report rests on it.

---

## 5. Implications for a React Flow + DOM (non-canvas) implementation

### What transfers cleanly

1. **The `<textarea>` overlay is the whole trick, and it transfers 1:1.** A DOM-based editor (React Flow's node
   content is already DOM) can use a plain `<textarea>` as the editing widget. Everything that makes
   Excalidraw's feel "native" comes for free from the browser: selection, IME, RTL via `dir="auto"`, native
   caret, native undo *inside* the textarea, autofill-free paste. Don't build a `contentEditable` — Excalidraw
   deliberately didn't, and contentEditable brings IME/linting/paste-html pain.
2. **Tag the editor for the shortcut layer.** Excalidraw's mechanism is one attribute plus one predicate:
   `editable.dataset.type = "wysiwyg"` and `isWritableElement(target)` checked at the top of the global key
   handler, bailing on everything except Escape. In React this is a short-circuit at the top of your
   `useEffect(() => window.addEventListener("keydown", …))`: `if (isEditableTarget(e.target) && e.key !== "Escape") return;`.
   **Do not add a `mode === "text-editing"` flag to disable shortcuts** — Excalidraw doesn't, and doing so
   breaks the case where the editor is a host-rendered input.
3. **The keyboard contract is worth copying verbatim**, because it is what users already know: Enter = newline,
   Escape and Ctrl/Cmd+Enter = commit, **blur = commit**, Tab = indent, Ctrl+Shift+< / > = font size *without
   leaving the editor*. The subtle bit worth stealing: Escape and blur both **commit**, never revert; the only
   revert is undo. And IME composition must be guarded (`event.isComposing || event.keyCode === 229`).
4. **The styles panel doubles as the "controls while typing".** This is the single most important design
   finding for this project. Excalidraw does not build a floating toolbar; it (a) keeps the ordinary panel
   mounted, (b) treats `editingElement` as a selection *target* for the panel
   (`getTargetElements` / `getValue`), and (c) suppresses blur-submit + restores the caret around interactions
   with the panel. In React Flow you can copy this exactly: keep your properties panel mounted, make its
   "target" be `editingNodeId ?? selectedNodeId`, and on panel pointer-down call
   `e.preventDefault()`-equivalent (or a `temporarilyDisableSubmit()` like `textWysiwyg.tsx:938-944`) plus save
   and restore `textarea.selectionStart/selectionEnd`. The caret round-trip hook is ~40 lines
   (`useTextEditorFocus.ts`) and is the entire trick.
5. **Escape/blur-commit + deselect + "empty → delete"** is a coherent rule set worth copying: while editing,
   nothing is selected (so no resize handles fight the textarea), and committing restores selection **only for
   keyboard commits** (`viaKeyboard` at `textWysiwyg.tsx:868` / `App.tsx:6489-6494`) — pointer commits leave
   nothing selected. That is a deliberate, defensible UX decision and it reads well.
6. **The "hide the element while editing" rule.** `Renderer.ts:259-267` excludes the edited element from the
   canvas. The DOM analogue: while editing, hide (or better, replace) the node's static text rendering so the
   textarea is the only thing painting those glyphs — otherwise you get double-drawn text and mismatched
   metrics.
7. **Single-history-entry for create-and-type.** The comment at `App.tsx:6915-6930` describes a real bug class
   (undo rewinding the typing but leaving an invisible empty element) and the fix (don't capture the empty
   element; capture at submit). Any editor with a create-then-type flow needs this.

### What does NOT transfer

1. **Canvas `measureText` measurement.** Excalidraw measures with `ctx.measureText().width` on a detached
   canvas and paints with the same numbers, so the textarea and the canvas element are guaranteed to agree.
   In a DOM implementation you measure with the *same* engine that renders, so measurement is trivial — but you
   must pick one: `getBoundingClientRect()` on a hidden mirror, or `CanvasRenderingContext2D.measureText`. If
   you render nodes as DOM/SVG, prefer DOM measurement (a hidden mirror span) so wrap points match exactly.
   Excalidraw's canvas measurement is a consequence of its architecture, not a design goal.
2. **`transform: translate() scale() rotate()` on the editor.** Excalidraw positions an absolutely-positioned
   textarea in *viewport* coordinates and fakes zoom/rotation with a CSS transform, then divides several
   constants by `zoom` by hand (`1/zoom` line widths, `6/zoom, 4/zoom` dashes, `4/zoom` padding, `(width −
   viewportX)/zoom` clamps). In React Flow the canvas transform is already applied to your nodes, so the editor
   lives in the node's own coordinate space — **you inherit none of that zoom arithmetic, and you should not
   copy it.** Same for the `×1.05` height buffer, the `+0.5` width fudge and the `- 8` viewport margin: those
   are workarounds for rounding jitter between two independent render systems (canvas + DOM textarea), which
   you don't have.
3. **`ResizeObserver` on the canvas + `scrollTop = 0`.** Needed because the DOM overlay is decoupled from the
   canvas. A DOM node's editor is laid out by the same box model as its content — no observer needed.
4. **The autosize grip (`textAutoResizeHandle.ts`) and the dashed edit box (`renderTextBox`).** Both are canvas-
   drawn handles with hit-testing maths and `formFactor === "desktop"` gating. In DOM you would use ordinary
   absolutely-positioned handle elements with CSS. The *idea* (an explicit affordance to switch a fixed-width
   text back to autosize) is worth keeping; the 12/16/10/18/0.8 maths is not.
5. **`setCustomTextMetricsProvider`.** Exists purely because the server has no canvas. Irrelevant to a browser-
   only editor.
6. **The `applyDarkModeFilter` colour math on the textarea's `color`.** Excalidraw inverts/hue-rotates scene
   colours to match the canvas's dark-mode filter (`common/src/colors.ts:86`). A DOM implementation should use
   CSS variables / real theme colours instead.
7. **The `whiteSpace: "pre"` + "free text never wraps, it grows" behaviour.** That is a canvas-app convention.
   In a React Flow node you will almost certainly want `overflow-wrap: break-word` and a width, i.e. the
   `pre-wrap` branch (`textWysiwyg.tsx:464-467`), even for free text.

### Highest-value things to steal, in order

1. `<textarea>` overlay + `data-type`-style target tagging + one global-keydown bail (≈20 lines).
2. `editingElement` as the panel's selection target, so the panel stays live during editing
   (`getTargetElements` one-liner).
3. `temporarilyDisableSubmit()` + `saveCaretPosition`/`restoreCaretPosition` around panel interactions
   (≈60 lines) — this is what makes "click the font-size button while typing" feel right.
4. The keyboard contract table in §3, exactly.
5. `empty (after trim) → delete element`, and create-and-type as a single undo entry.
6. `Escape`/blur **commit** (never revert); `viaKeyboard` decides whether selection comes back.
