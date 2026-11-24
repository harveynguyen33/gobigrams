/* src/canvas/inspectorSections.tsx — the inspector's Text and edge-label
 * section bodies as factories. APP-SPLIT t_502be2a0 (S3): the JSX below moved
 * VERBATIM from src/app/App.tsx — same bytes, called at the same place in the
 * render; the ctx values each body read travel through destructured args,
 * exactly the census read sets. ALIGN_OPTS passes through ctx (the one option
 * table that stayed in App.tsx — plan L107): its module identity is stable,
 * nothing is rebuilt per render. The .tsx extension (not the plan's .ts) is
 * forced by JSX; the ctx types stay module-private.
 */
import {ToggleRow, type PickerOption} from '../ui/InspectorPickers';
import {swatchRow} from '../components/swatchRow';
import {FONT_OPTS, SIZE_OPTS, VALIGN_OPTS, WEIGHT_OPTS} from './inspectorOptions';
import type {readTextStyle, TextAlign, TextFont, TextStyle, TextSize, TextVAlign, TextWeight} from '../layout/textStyle';

type Shown = ReturnType<typeof readTextStyle>;
type StyleWrite = (patch: Partial<TextStyle>) => void;
type TsBodyCtx = {tsShown: Shown; writeTextStyle: StyleWrite; ALIGN_OPTS: PickerOption[]};
type EdgeLabelCtx = {edgeLabelShown: Shown; writeEdgeLabelStyle: StyleWrite};

export const buildTsBody = ({tsShown, writeTextStyle, ALIGN_OPTS}: TsBodyCtx) => (
    <>
      <div className="field">
        <label>size</label>
        {/* ROUND X, ITEM 1 — BACK TO THE BARE SEGMENTED ROW. ROUND W put a
            custom-size number input beside these four buttons, and that flex
            row squeezed the 4-column grid into a 31×121px COLUMN (Harvey:
            "UI lệch, quá xấu"). The input is GONE; the steps are the control
            again, full panel width, one row.

            THE RULE STAYS (Harvey: "rule giữ khi cần"). `scale` on `TextStyle`,
            `TEXT_SCALE_MIN/MAX`, `clampTextScale` and the `scale` read in
            `textStyleVars` are all still in `src/textStyle.ts`, so a board that
            already carries a custom multiplier still RENDERS it. What changed is
            only how the panel REPORTS one: `readTextStyle` now derives `size`
            from what actually paints (`stepForScale`), so a stored 1.7 lights NO
            step here rather than claiming M while the node paints 1.7. */}
        <ToggleRow
          /* `null` is "matches no step" — a custom multiplier. `?? ''` matches no
             option either, so nothing is marked and the node keeps painting its
             stored scale. */
          value={tsShown.size ?? ''}
          onChange={v => writeTextStyle({size: v as TextSize})}
          options={SIZE_OPTS}
          title="Text size"
        />
      </div>
      <div className="field">
        <label>weight</label>
        <ToggleRow
          value={tsShown.weight}
          onChange={v => writeTextStyle({weight: v as TextWeight})}
          options={WEIGHT_OPTS}
          title="Text weight"
        />
      </div>
      {/* ROUND W, ITEM 2 — THE FAMILY, FOR THE WHOLE NODE. Harvey's own choice:
          "cả node trước" — the one choice sets title + kicker + sub + metric +
          the label node's text. That FLATTENS the mix this section's header used
          to call out ("one node already mixes `--mono` and `--sans`, so a single
          family control would be a lie") and it is a decision, not an accident:
          the picker is worth having only if it actually changes what you read.
          The lie that note warned about is gone because the control now DOES set
          every one of those rows — see the EIGHT `var(--ts-font, …)` consumers
          in `src/styles.css`, one per row that owns node text. */}
      <div className="field">
        <label>font</label>
        {/* ROUND Z, ITEM 1 — SIX FAMILIES, TWO ROWS OF THREE, REAL NAMES.
            Harvey: "Font name hơi kì, nên theo tên Font" + "nếu 6 nút thì 3 3
            cho đẹp". The buttons print short labels because the full family
            names do not fit a 3-column cell (measured: `JetBrains Mono` 84.0px
            and `Be Vietnam Pro` 75.2px at 10px, against a 65px content box),
            and each carries its real name as the tooltip. `grid3` is the
            two-row modifier; the geometry is measured in the `.insp-seg.grid3`
            block in `src/styles.css`.

            THE HINT THAT USED TO SIT UNDER THIS CONTROL IS STILL GONE — with
            six self-previewing buttons the control states its own scope, and
            the whole Text section carries zero hints. */}
        <ToggleRow
          value={tsShown.font}
          onChange={v => writeTextStyle({font: v as TextFont})}
          options={FONT_OPTS}
          title="Text font for the whole node"
          grid3
        />
      </div>
      <div className="field">
        <label>text color</label>
        {/* ROUND AQ2 — the custom literal cell, same as the edge stroke row: the
            literal is stored on `textStyle.customColor` with `colorKey` cleared
            (the merge enforces the exclusion); a key pick clears the literal. The
            custom cell takes the ring when a literal is set (no hue lights). */}
        {swatchRow(tsShown.colorKey, k => writeTextStyle({colorKey: k, customColor: undefined}),
          {value: tsShown.customColor, onPick: hex => writeTextStyle({customColor: hex, colorKey: undefined})},
        )}
      </div>
      <div className="field">
        <label>align</label>
        {/* ROUND Z, ITEM 2 — TWO ROWS IN ONE FIELD: the horizontal row Harvey
            already had (Left / Center / Right, storing `align`), and the new
            vertical one (Top / Middle / Bottom, storing `vAlign`). Both are the
            same segmented control, both write through the same lazy-write
            helper, and the vertical one is ALWAYS PRESENT for a text target —
            the research flagged hiding it (Excalidraw force-sets `middle` when
            text binds, Figma has no control at all) as the anti-pattern to
            avoid. No hint: the whole Text section carries zero hints. */}
        <ToggleRow
          value={tsShown.align}
          onChange={v => writeTextStyle({align: v as TextAlign})}
          options={ALIGN_OPTS}
          title="Text align"
        />
        <ToggleRow
          value={tsShown.vAlign}
          onChange={v => writeTextStyle({vAlign: v as TextVAlign})}
          options={VALIGN_OPTS}
          title="Text vertical align"
        />
      </div>
    </>
);

export const buildEdgeLabelTextBody = ({edgeLabelShown, writeEdgeLabelStyle}: EdgeLabelCtx) => (
    <>
      <div className="field">
        <label>size</label>
        <ToggleRow
          value={edgeLabelShown.size ?? ''}
          onChange={v => writeEdgeLabelStyle({size: v as TextSize})}
          options={SIZE_OPTS}
          title="Edge label text size"
        />
      </div>
      <div className="field">
        <label>weight</label>
        <ToggleRow
          value={edgeLabelShown.weight}
          onChange={v => writeEdgeLabelStyle({weight: v as TextWeight})}
          options={WEIGHT_OPTS}
          title="Edge label text weight"
        />
      </div>
      <div className="field">
        <label>font</label>
        <ToggleRow
          value={edgeLabelShown.font}
          onChange={v => writeEdgeLabelStyle({font: v as TextFont})}
          options={FONT_OPTS}
          title="Edge label text font"
          grid3
        />
      </div>
    </>
);
