/* src/canvas/inspectorOptions.tsx — the inspector's pure option tables.
 * APP-SPLIT t_502be2a0 (S2): the 15 declarations below moved VERBATIM from
 * src/app/App.tsx — same bytes, same values; only their home changed. They are
 * module-scope constants reading no component state, so the move cannot change
 * render output. FLOW_GLYPH_SCALE moved WITH FLOW_ICON_OPTS — it is read by
 * that one table and nothing else.
 * The extension is .tsx, not the plan's .ts: FLOW_ICON_OPTS and FONT_OPTS
 * carry JSX art and .ts cannot parse JSX (camelCase non-component .tsx is what
 * checks/naming-convention.mjs expects here).
 */
import {cloneElement, type ReactElement} from 'react';
import {MarkerType} from '@xyflow/react';
import {ArtArrow, ArtFlow, ArtWidth, type PickerOption} from '../ui/InspectorPickers';
import {FLOW_ICON_PATHS} from '../nodes/flowIcons';
import {TEXT_SIZE_OPTS, TEXT_WEIGHT_OPTS, TEXT_FONT_OPTS, TEXT_FONT_FAMILY, TEXT_VALIGN_OPTS} from '../layout/textStyle';
import type {SectionId} from './inspector';

  export const MARKER_OPTS: PickerOption[] = [
    {v: 'none', label: 'none', art: <ArtArrow kind="none" />},
    {v: MarkerType.ArrowClosed, label: 'closed arrow', art: <ArtArrow kind="closed" />},
    {v: MarkerType.Arrow, label: 'open arrow', art: <ArtArrow kind="open" />},
  ];

  export const MARKER_OPTS_START: PickerOption[] = MARKER_OPTS.map(o => ({
    ...o, art: cloneElement(o.art as ReactElement<{kind: 'none' | 'closed' | 'open'; flip?: boolean}>, {flip: true}),
  }));

  export const WIDTH_OPTS: PickerOption[] = [1, 1.5, 1.8, 2, 3].map(w => ({
    v: String(w), label: String(w), art: <ArtWidth w={w} />,
  }));

export const CUST_DROP_HINT = 'Drop an SVG here, or click to choose a file';

  export const MARKER_ICON_OPTS_START = MARKER_OPTS_START;

  export const FLOW_OPTS: PickerOption[] = ([
    ['none', 'None'], ['dots', 'Dots'], ['dash', 'Dash'], ['pulse', 'Pulse'], ['icon', 'Icon'],
  ] as const).map(([v, label]) => ({v, label, art: <ArtFlow kind={v} />}));

      export const FLOW_GLYPH_SCALE = 22 / 20;

   export const FLOW_ICON_OPTS: PickerOption[] = (([
     ['mail', 'Letter'], ['package', 'Package'], ['file', 'File'],
     ['zap', 'Zap'], ['settings', 'Gear'], ['database', 'DB'],
   ] as const)).map(([v, label]) => ({
     v, label,
     art: (
       /* `insp-glyph` is the class `G` itself renders, so both rows' figures are
          carried by the same box — not a second frame that happens to look alike. */
       <svg className="insp-glyph" viewBox="0 0 26 18" width={26} height={18}
         fill="none" stroke="currentColor" strokeWidth={2 / FLOW_GLYPH_SCALE}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
         <g transform={`translate(13 9) scale(${FLOW_GLYPH_SCALE}) translate(-12 -12)`}>
           {FLOW_ICON_PATHS[v]}
         </g>
       </svg>
     ),
   }));

  export const SIZE_OPTS: PickerOption[] = TEXT_SIZE_OPTS.map(o => ({v: o.v, label: o.label, art: null}));

  export const WEIGHT_OPTS: PickerOption[] = TEXT_WEIGHT_OPTS.map(o => ({v: o.v, label: o.label, art: null}));

  export const FONT_OPTS: PickerOption[] = TEXT_FONT_OPTS.map(o => ({
    v: o.v, label: o.label,
    /* ROUND Z, ITEM 1 — THE BUTTON'S TOOLTIP IS THE FULL FAMILY NAME. The label
       is short because the full one does not fit a 3-column cell (measured: at
       10px `JetBrains Mono` is 84.0px and `Be Vietnam Pro` 75.2px, against a
       65px content box), so the short name is what prints and the real family
       name is what hovering says. */
    title: o.title,
    /* ROUND X, ITEM 3 — THE PREVIEW IS THE BUTTON'S OWN CONTENT. Each option
       prints its own family NAME in its own family. That is the one thing a
       native `<select>` cannot do, and it is why this control survives the
       change from a popover to a segmented row: the label and the sample are
       the SAME span, so the row prints each name exactly ONCE — there is no
       second cell to suppress and therefore nothing to hide. */
    art: (
      <span className="insp-font-btn" style={{fontFamily: TEXT_FONT_FAMILY[o.v]}}>
        {o.label}
      </span>
    ),
  }));

  export const VALIGN_OPTS: PickerOption[] = TEXT_VALIGN_OPTS.map(o => ({v: o.v, label: o.label, art: null}));

  export const CROW_FOOT: {v: string; label: string}[] = [
    {v: 'none', label: 'none'},
    {v: 'one', label: 'one (bar)'},
    {v: 'zeroOrOne', label: 'zero or one (ring + bar)'},
    {v: 'many', label: 'many (crow\u2019s foot)'},
    {v: 'zeroOrMany', label: 'zero or many (ring + foot)'},
    {v: MarkerType.ArrowClosed, label: 'arrow'},
  ];

  export const SECTION_TITLES: Record<SectionId, string> = {
    content: 'Content',
    definition: 'Additional Description',
    text: 'Text',
    style: 'Style',
    table: 'Table',
    columns: 'Columns',
    showMode: 'Show mode',
    label: 'Label',
    line: 'Line',
    markers: 'Markers',
    cardinality: "Cardinality (crow\u2019s foot)",
    flow: 'Flow animation',
  };
