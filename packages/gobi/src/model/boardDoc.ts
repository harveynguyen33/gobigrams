/* CORE-STEP4A-FIX (2026-11-05) — the BoardDoc TYPE, extracted from the app's
 * src/boards.ts so the package's adapter (toBoardDoc) can declare its return
 * without importing the app's storage layer (serverBoards/localStore — server
 * code that must never reach the tarball). boards.ts re-exports this type
 * unchanged; every existing `import {type BoardDoc} from './boards'` works. */

import type {PresetId} from './presets/index';
import type {ThemeName} from './theme';
import type {FlowEdge, FlowNode} from './flowTypes';

export type BoardDoc = {
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  updatedAt: number;
  /** L2 — the board's diagram type. Absent on old boards → 'architecture'. */
  preset?: PresetId;
  /** PACKAGE-M fix — boards no longer store a theme. A preset may suggest one
   *  (and the user's global preference still wins); this field is LEGACY/IGNORED
   *  and kept only so old board files on disk still parse. */
  /** @deprecated (PACKAGE-M fix) — boards no longer store a theme; the preset suggests it and the
   *  user's global preference wins. Kept only so old files still parse. */
  theme?: ThemeName;
  /** L2 — the on-canvas legend/key toggle this used to control was removed on
   *  2026-09-17 (harvey: not wanted). The KEY IS PERSISTED DATA: nothing renders
   *  it, but `saveBoard` writes the value back unchanged, so a board that carries
   *  it round-trips instead of losing a key this type still declares. */
  legend?: boolean;
};
