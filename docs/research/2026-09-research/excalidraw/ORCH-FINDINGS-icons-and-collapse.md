# ORCHESTRATOR FINDINGS — the icon-picker question, answered from source

Pinned source: `github.com/excalidraw/excalidraw` @ **`c0ad61c6743aef7623e641cd1460d757cc6cacf3`** (2026-09-16).
Read by the orchestrator directly (clone + grep), because two research children finished BEFORE the user's
follow-up question landed. These findings are MEASURED, not inferred.

## Q1 — does Excalidraw use text dropdowns in the properties panel?

**No. There is not a single `<select>` in the panel layer.**

```
grep -c "<select" packages/excalidraw/actions/actionProperties.tsx   ->  0
```
Every control is an icon button. (`Actions.tsx:609`-era markup uses `<button>` × 6 in the compact block alone,
and `IconButton` elsewhere.)

**So Harvey's ask — "instead of a text dropdown, show it as an image to pick easily" — is literally what
Excalidraw already does. We are behind, not ahead.**

## Q2 — how does an icon picker actually work there? (the pattern to copy)

**Trigger + popup.** `FontFamily` case, exactly:

| piece | file:line | what it is |
|---|---|---|
| resting control | `components/FontPicker/FontPickerTrigger.tsx:37` | ONE `IconButton type="toggle" icon={TextIcon}`, class `properties-trigger` |
| open state | `FontPickerTrigger.tsx:48-52` | flips `appState.openPopup` between `'fontFamily'` and `null` |
| the popup | `components/FontPicker/FontPicker.tsx:105` | radix-ui `Popover.Root open={isOpened}` — not a native select, not a menu |
| each option | `components/FontPicker/FontPickerList.tsx:308` | a `<button>` carrying `icon` + `text` + optional `badge`, i.e. **visual + labelled** |
| selected state | `FontPickerList.tsx:312` | `getDropdownMenuItemClassName("", isSelected, isHovered)` |
| keyboard | `components/FontPicker/keyboardNavHandlers.ts` | its own handlers, tab-between-search-and-selection |

**The shape of the answer for Diagram Studio:** collapse the row to ONE icon button; on press, open a
popover whose items each show a preview (glyph/font/spacing) AND a label. Not `appearance:none` selects.

## Q3 — is there a collapse / accordion mechanism?

**No accordion. No `<details>`. No disclosure widget.**

```
ls packages/excalidraw/components/ | grep -iE "accordion|collapse|disclosur"   ->  (empty)
grep -rniE "collapse|accordion|<details|disclosure" components/Actions.tsx     ->  only a COMMENT (line 609)
```

So do NOT invent an accordion and attribute it to Excalidraw. **But there is a better precedent for exactly
what Harvey asked** — *"cái nào ít khi đổi thì có thể theo dạng collapse"*:

**`CompactShapeActions`** — `packages/excalidraw/components/Actions.tsx:608-612`, verbatim comment:
> *"Compact styles panel — the collapsed, popover-driven layout used on tablets and on desktop when the UI is
> in "compact" mode."*

Same action set, TWO densities: full rows, or **folded into popovers**. That is the mechanism to reuse — it is
frequency-driven (the often-used controls stay out, the rest go behind a trigger) and it is the same code path
as the tablet tier, which this project also has to serve.

## Q4 — does the panel reorder sections by frequency?

**No.** The order is FIXED; entries are filtered by predicates, never sorted:

```
examples: predicates.strokeColor && ( ... ), predicates.opacity && ( ... )   (Actions.tsx, compact block)
```
Order is whatever the source lists. **So "sắp xếp theo thứ tự ưu tiên hay dùng" is OUR design decision**, to be
justified from what each element type actually shows (that is what X3's per-type table is for) — it is not
something to copy from Excalidraw, because Excalidraw never made that decision.

## Consequence for the spec

1. Any text `<select>` in our inspector is a regression against the reference. Enumerate them and convert the
   ones that have a visual vocabulary (font, size, align, stroke width, line style, arrowheads, curvature).
2. The conversion pattern is `trigger + popover` with icon+label items, not a native dropdown.
3. "Rarely changed" ⇒ behind a popover trigger (the `CompactShapeActions` precedent), NOT behind a home-made
   accordion.
4. Ordering is ours to choose; state the reasoning per section, and group by element type (X3's table).
