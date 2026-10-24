/**
 * ROUND BH, ITEM 1 (public launch, 2026-10-24) — THE FEEDBACK DIALOG.
 *
 * Harvey asked for an in-app feedback form that creates a GitHub issue
 * directly, "no repo visit". A public static app cannot ship the API token
 * that would need (every client byte is public), and the task forbids
 * inventing a proxy — so this is the HONEST version of the ask: a real form
 * (type / title / details / optional email) that builds the repo's own
 * new-issue URL with everything prefilled and opens it in a new tab. The user
 * reviews the filled GitHub form and presses Submit. Zero typing; zero
 * secrets. See src/feedbackDialog.ts for the URL contract (no `labels` param,
 * template per kind).
 *
 * THE PATTERN IS BOARDDIALOG'S, NOT A NEW ONE: scrim + card via `.sp-overlay`
 * + `.sp-card` (`.fb-card` only narrows), the FOCUSABLE selector and the
 * returnFocusTo contract IMPORTED from Settings.tsx (one definition of
 * "focusable" in the app), Escape in a CAPTURE listener that stops
 * propagation, the Tab trap wrapping first↔last, autofocus after paint, focus
 * restore on unmount, and tokens-only CSS (no hex literal in this file's
 * rules).
 *
 * WHY IT LIVES INSIDE SETTINGS' TREE: it is opened from the About pane, so it
 * paints above the Settings modal (`.fb-overlay` z-index 80 > 70) and Settings'
 * own key handler returns early while it is open — Escape closes ONLY the
 * dialog, exactly as App's handler defers to the board dialog.
 */
import {useEffect, useRef, useState} from 'react';
import {FOCUSABLE} from './Settings';
import {buildFeedbackIssueUrl, FEEDBACK_ISSUES_URL, type FeedbackKind} from './feedbackIssueUrl';

type Props = {
  onCancel: () => void;
  /** Focus restore, Settings.tsx's contract: on close, `.current?.focus()`. */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
};

const KINDS: {key: FeedbackKind; label: string; hint: string}[] = [
  {key: 'bug', label: 'Bug', hint: 'something broke or behaved oddly'},
  {key: 'feature', label: 'Feature', hint: 'a shape, tool or improvement'},
];

export default function FeedbackDialog({onCancel, returnFocusTo}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');

  const canSubmit = title.trim().length > 0;

  // Keep the latest handler for the document listener without re-binding it.
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  /* Escape (capture + stopPropagation, exactly as BoardDialog does it) and the
     Tab focus trap. Capture is what stops Settings' own handler from ALSO
     acting on the same key (Settings returns early while we are open — two
     independent guards, one outcome). */
  useEffect(() => {
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancelRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const card = cardRef.current;
      if (!card) return;
      const els = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null || el === document.activeElement);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = active ? card.contains(active) : false;
      if (e.shiftKey) {
        if (!inside || active === first) { e.preventDefault(); last.focus(); }
      } else if (!inside || active === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onDocKey, true);
    return () => document.removeEventListener('keydown', onDocKey, true);
  }, []);

  /* Autofocus after paint (Settings/BoardDialog's setTimeout pattern): the
     title is the one field the submit gates on. */
  useEffect(() => {
    const t = window.setTimeout(() => { titleRef.current?.focus(); }, 10);
    return () => window.clearTimeout(t);
  }, []);

  // Focus restore: hand the caret back to the About entry that opened us.
  useEffect(() => () => { returnFocusTo?.current?.focus(); }, [returnFocusTo]);

  const submit = () => {
    if (!canSubmit) return;
    /* The ONLY network act in the flow: open the prefilled form. window.open
       with noopener,noreferrer — the same no-new-handle guarantees as the
       app's existing target=_blank + rel anchors. The dialog stays open under
       the new tab so the user's typed text is not lost if they come back. */
    window.open(
      buildFeedbackIssueUrl(kind, title, details, email),
      '_blank', 'noopener,noreferrer',
    );
  };

  return (
    <div
      className="sp-overlay fb-overlay"
      data-feedback-dialog={kind}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        ref={cardRef}
        className="sp-card fb-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fb-title-h"
        tabIndex={-1}
      >
        <div className="bd-head">
          <div>
            <h2 className="bd-title" id="fb-title-h">Send feedback</h2>
            <p className="bd-sub">It becomes a prefilled issue — you review it on GitHub.</p>
          </div>
        </div>

        <div className="fb-body">
          <fieldset className="fb-kinds">
            <legend className="fb-label">type</legend>
            {KINDS.map(k => (
              <label key={k.key} className="fb-kind">
                <input
                  type="radio"
                  name="fb-kind"
                  value={k.key}
                  checked={kind === k.key}
                  onChange={() => setKind(k.key)}
                />
                <span className="fb-kind-text">
                  <span className="fb-kind-name">{k.label}</span>
                  <span className="fb-kind-hint">{k.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="fb-label" htmlFor="fb-title">title</label>
          <input
            id="fb-title"
            ref={titleRef}
            className="sp-input"
            type="text"
            value={title}
            placeholder="A short sentence: what happened, or what you want"
            autoComplete="off"
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          />

          <label className="fb-label fb-label-gap" htmlFor="fb-details">details</label>
          <textarea
            id="fb-details"
            className="fb-details"
            rows={5}
            value={details}
            placeholder="What did you do, what went wrong — or what should the app do?"
            onChange={e => setDetails(e.target.value)}
          />

          <label className="fb-label fb-label-gap" htmlFor="fb-email">email (optional)</label>
          <input
            id="fb-email"
            className="sp-input"
            type="email"
            value={email}
            placeholder="Only if you want a reply"
            autoComplete="off"
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div className="fb-actions">
          <button type="button" className="bd-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="bd-btn primary" data-fb-submit disabled={!canSubmit} onClick={submit}>
            Open GitHub issue
          </button>
        </div>
        {/* The honest caption — what actually happens next — plus a plain
            fallback for people without a GitHub account. */}
        <p className="fb-note">
          Opening GitHub — you'll just press Submit.
          No account?{' '}
          <a href={FEEDBACK_ISSUES_URL} target="_blank" rel="noopener noreferrer">
            email-free bug tracker
          </a>
        </p>
      </div>
    </div>
  );
}
