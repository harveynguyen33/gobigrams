/* SETTINGS-CODE-PANE (t_5356c171) — Settings → Code. Harvey, 2026-11-15:
 * "canvas đang có quá nhiều options — nên chia ra, ví dụ liên quan code nên
 * có một cái riêng." The Code pane holds exactly the controls that concern
 * the code rail / .gobi text. ONE control moved here: `After a code edit`
 * (CodeLayoutRow — self-contained, it owns its own persistence, nothing is
 * threaded through App). `Auto-layout direction` STAYS in Canvas on purpose:
 * the toolbar's Arrange button is its other consumer (useCanvasTools), so its
 * home is the surface the user meets it on most. Nothing was invented to pad
 * the pane — a short pane is honest. (feature-map home: src/settings/CodePane.tsx)
 */
import {CodeLayoutRow} from './CodeLayoutRow';

export function CodePane() {
  return (
    <>
      <h2 className="settings-h" id="settings-title">Code</h2>
      <p className="settings-sub">How a code-rail commit lands on the board.</p>
      <div className="settings-rows">
        <CodeLayoutRow />
      </div>
    </>
  );
}
