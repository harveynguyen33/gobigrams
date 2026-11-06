/**
 * FIRST-VISIT rework (2026-11-01) — the load fit vs the Getting-started panel.
 *
 * The panel (`.gsc` in styles.css) owns the bottom-left corner of the canvas
 * while it is on screen: left 16px, width 236px. A load that frames content
 * for the FULL canvas parks its leftmost node behind the panel — measured on
 * sys-pipeline at 1516x392: the EXTERNAL card was 96.9% covered. The applyBoard
 * fit therefore reserves that strip as LEFT padding (RF v12 `fitView` takes
 * per-side paddings); the other three sides keep the uniform 0.25 every other
 * load uses, and with the panel gone the fit is the plain centred one.
 *
 * TWO boot-timing facts shaped the call sites (both measured, reload at
 * 1516x392 onto a 4-node board, checklist incomplete):
 *  - presence must come from Checklist's OWN storage readers
 *    (`readChecklistDismissed` / `readChecklistDone`), never a DOM query — the
 *    fit's 30ms timeout can fire before the panel's first commit, and the fit
 *    silently reverts to the plain centred one;
 *  - the ReactFlow `fitView` PROP must carry the SAME padding (`fitOpts` in
 *    App.tsx) — RF's first-content fit lands AFTER applyBoard's 30ms fit and
 *    used to overwrite it with the plain one.
 *
 * 268 = 16 (panel left) + 236 (panel width) + 16 clearance.
 */
export const GSC_FIT_LEFT_PX = 268;

/** Structured like RF's own `Padding`: the object form carries per-side values,
 *  `left` as the `'${number}px'` string RF parses per side. */
export type FitPadding = number | {top: number; right: number; bottom: number; left: `${number}px`};

/** The padding object for one fit: asymmetric (panel-aware) or the round's
 *  uniform default. Pure so a harness can execute it directly. */
export function fitPaddingFor(panelOnScreen: boolean): FitPadding {
  return panelOnScreen
    ? {top: 0.25, right: 0.25, bottom: 0.25, left: `${GSC_FIT_LEFT_PX}px`}
    : 0.25;
}
