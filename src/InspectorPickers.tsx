/* ROUND BN-4 — the former 845-line InspectorPickers.tsx, now a re-export
   shell. The slices live in ./pickers/ (verbatim moves along the file's own
   section banners); every import of './InspectorPickers' — including the
   esbuild bundle entries in the harnesses — is unchanged. */
export {popoverPlacement, placementStyle} from './pickers/popover';
export {G, ArtWidth, ArtDash, ArtFlow, ArtCurve, ArtArrow, ArtCardinality} from './pickers/Art';
export {IconPickerRow, ShapesPicker, ToggleRow, type PickerOption} from './pickers/Rows';
export {Stepper, SPEED_MIN, SPEED_MAX, sliderSeconds, storableSeconds, FlowSpeed} from './pickers/StepperFlow';
export {Section, CardReadout} from './pickers/Section';
export {SHAPES} from './shapes';
export {COLOR_VAR} from './colors';
