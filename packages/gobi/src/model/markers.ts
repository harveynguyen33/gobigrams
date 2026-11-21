/* CORE-STEP1 (task t_f808b5fb) — the edge-marker vocabulary as PLAIN DATA.
 *
 * WHY: the .gobi compiler imports the app's palette factories (makeEdge, the
 * presets), and those factories stamped arrowheads with @xyflow/react's
 * `MarkerType` ENUM — a runtime import that dragged @xyflow/react (+ react +
 * react-dom + d3, ~500 KB minified) into every headless consumer of the
 * language. The marker vocabulary is two strings.
 *
 * PROVENANCE: the values are VERBATIM from @xyflow/system 0.0.84's MarkerType
 * enum (MIT; see src/gobi/paths.ts for the licence text) — `arrow` and
 * `arrowclosed` are stored in board JSON as marker `type` strings, so they must
 * never change. The app keeps @xyflow/react for the canvas; only the factory
 * graph reads this copy.
 *
 * The decouple harness (round-gobi-core-decouple P4) asserts src/presets/**
 * holds no runtime @xyflow/react import, and the corpus proves every board JSON
 * byte stayed identical. */
export const MarkerType = {
  Arrow: 'arrow',
  ArrowClosed: 'arrowclosed',
} as const;
export type MarkerType = (typeof MarkerType)[keyof typeof MarkerType];
