/* ShareBanner.tsx — ROUND GOBI-S1: the read-only share view's chrome. A
 * fragment-owned board renders with this banner above the canvas: the board
 * name, the ONE exit ("Copy to my boards"), and a way out to the visitor's
 * own boards ("Go to my boards"). A failed decode renders the ERROR CARD
 * variant — a plain message plus "Open Gobigrams", never a blank canvas.
 * Tokens only; fixed-portal-free (it sits in normal flow above the canvas
 * column, so it cannot be clipped by `.panel` and needs no portal).
 * (feature-map home: src/components/ShareBanner.tsx) */
import {Copy, ExternalLink} from 'lucide-react';

type Props = {
  mode: 'viewing' | 'error';
  boardName: string;
  reason?: string;
  onEditCopy: () => void;
  onOpenApp: () => void;
};

export function ShareBanner({mode, boardName, reason, onEditCopy, onOpenApp}: Props) {
  if (mode === 'error') {
    return (
      <div className="ds-share-banner ds-share-error" role="alert">
        <span className="ds-share-title">This share link is broken or incomplete.</span>
        <span className="ds-share-sub">The address was cut off — ask for a new link. ({reason ?? 'corrupt'})</span>
        <span className="ds-share-actions">
          <button type="button" className="ds-share-btn" onClick={onOpenApp}>
            <ExternalLink size={13} /> Open Gobigrams
          </button>
        </span>
      </div>
    );
  }
  return (
    <div className="ds-share-banner">
      <span className="ds-share-title">{boardName}</span>
      <span className="ds-share-sub">Read-only share — this board belongs to someone else.</span>
      <span className="ds-share-actions">
        <button type="button" className="ds-share-btn" onClick={onEditCopy}>
          <Copy size={13} /> Copy to my boards
        </button>
        <a className="ds-share-btn secondary" href="/">
          <ExternalLink size={13} /> Go to my boards
        </a>
      </span>
    </div>
  );
}
