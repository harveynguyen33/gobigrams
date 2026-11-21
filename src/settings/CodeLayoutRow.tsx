/* CODE-LAYOUT-MODE (t_760dec3c) — the Settings → Canvas row. Self-contained on
 * purpose: this component owns the preference's UI state, and the commit lane
 * (src/gobi/commitText.ts) reads the stored value fresh per commit — one
 * source of truth, nothing threaded through App. */
import {useState} from 'react';
import {Row, Segmented} from './Controls';
import {CODE_LAYOUT_OPTS, loadCodeLayoutMode, saveCodeLayoutMode, type CodeLayoutMode} from '../canvas/codeLayoutMode';

export function CodeLayoutRow() {
  const [mode, setMode] = useState<CodeLayoutMode>(() => loadCodeLayoutMode());
  return (
    <Row label="After a code edit"
         hint="where a commit puts new nodes: keep the compiled spot, park them beside the board, or re-arrange everything">
      <Segmented
        label="After a code edit"
        options={CODE_LAYOUT_OPTS.map(o => o.v)}
        value={mode}
        onPick={v => { setMode(v); saveCodeLayoutMode(v); }}
        labelOf={v => CODE_LAYOUT_OPTS.find(o => o.v === v)?.label ?? String(v)}
      />
    </Row>
  );
}
