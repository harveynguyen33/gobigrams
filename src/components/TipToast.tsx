/* TipToast.tsx — ONBOARD-P5 (2026-11-01): the one-line tip.

   ONE line of text plus a close, painted over the canvas's TOP-CENTRE (below the
   toolbar, above the bottom band where the notice toast, the zoom pill and the
   getting-started checklist already live). It is a live region, not a dialog:
   `role="status"` + `aria-live="polite"` announce it without stealing focus, and
   there is no scrim — the canvas stays fully usable while it is up.

   The element takes pointer events ONLY on itself (the CSS says so explicitly):
   a full-bleed wrapper would swallow clicks on the canvas for as long as the tip
   is alive, which is the one thing a teaching surface must never do.

   Attention is honest: it closes itself after AUTO_HIDE_MS if the user ignores
   it, and the × is the same act as waiting — both write the forever key through
   App's `dismissTip`. A tip the user never noticed is not re-shown later; the
   claim already happened when it appeared (src/tips.ts), which is what keeps
   "shown once" true. */

import {useEffect} from 'react';
import {X} from 'lucide-react';

/** ~12s: long enough to read one sentence while working, short enough that the
 *  canvas clears itself if the user ignores it. */
const AUTO_HIDE_MS = 12000;

export default function TipToast({line, onDismiss}: {
  /** The sentence to show — already gated and claimed by `takeTip`. */
  line: string;
  /** Closes it AND writes the same forever key as the ×. */
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, AUTO_HIDE_MS);
    return () => window.clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="tip-toast" role="status" aria-live="polite" data-tip-toast>
      <span className="tip-toast-line">{line}</span>
      <button
        type="button"
        className="tip-toast-x"
        aria-label="Dismiss tip"
        onClick={onDismiss}
      >
        <X size={13} />
      </button>
    </div>
  );
}
