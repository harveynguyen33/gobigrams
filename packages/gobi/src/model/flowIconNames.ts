/* CORE-STEP4A-FIX (2026-11-05) — the flow-icon NAME vocabulary as plain data.
 *
 * WHY: the names used to be derived at runtime from the app's
 * `FLOW_ICON_PATHS` table (src/nodes/flowIcons.tsx), which holds JSX — a
 * React value. Importing it dragged the JSX runtime into the headless core
 * (the package bundle would need `react/jsx-runtime` installed by every
 * consumer). The core only ever reads the KEY LIST (GOBI_FLOW_ICONS), so the
 * list lives here and the app's table locks to it the other way round:
 * FLOW_ICON_TABLE is `satisfies Record<FlowIconName, ReactNode>`, so tsc
 * FAILS if the app table and this list ever drift in either direction.
 * Same discipline as iconNames.ts (the lucide vocabulary). */

export const FLOW_ICON_NAMES = [
  'mail',
  'package',
  'file',
  'zap',
  'settings',
  'database',
] as const;

export type FlowIconName = (typeof FLOW_ICON_NAMES)[number];
