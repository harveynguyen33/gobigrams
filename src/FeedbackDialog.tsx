/* feature-map home: src/FeedbackDialog.tsx */
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
/* ROUND BI — the screenshot helper's brain (clipboard + data URL → Blob). Pure,
   injectable, harness-executable; see src/boardClipboard.ts for why there is no
   upload and why the ClipboardItem is built synchronously. */
import {clipboardUsable, copyPngToClipboard} from './boardClipboard';

type Props = {
  onCancel: () => void;
  /** Focus restore, Settings.tsx's contract: on close, `.current?.focus()`. */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
  /** ROUND BI — the CURRENT board as a PNG data URL, produced by the app's
   *  existing export path (App's `buildPng`: SVG emitter → rasterise). App
   *  passes null on an empty board, so this doubles as the "is there anything
   *  to attach" gate and the helper row renders nothing at all. */
  boardPng?: (() => Promise<string>) | null;
};

const KINDS: {key: FeedbackKind; label: string; hint: string}[] = [
  {key: 'bug', label: 'Bug', hint: 'something broke or behaved oddly'},
  {key: 'feature', label: 'Feature', hint: 'a shape, tool or improvement'},
];

export default function FeedbackDialog({onCancel, returnFocusTo, boardPng}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  /* ROUND BI — the screenshot helper's three states. 'idle' is the button,
     'copied' swaps the label and adds the hairline note, 'failed' shows the
     manual-screenshot line. Never a spinner, never a blocker. */
  const [shot, setShot] = useState<'idle' | 'copied' | 'failed'>('idle');

  const canSubmit = title.trim().length > 0;
  /* The row exists only when there IS something to copy (App passes null for an
     empty board) AND the browser can take an image. Plain-http LAN origins
     expose neither clipboard API, so they simply never see the row. */
  const clipboardReady = clipboardUsable();

  /* Copy the board as a PNG. Fire-and-forget by design: the caller (a click, or
     Send) must not wait on the rasterise or on a permission answer. */
  const copyShot = () => {
    if (!boardPng) return;
    void copyPngToClipboard({buildDataUrl: boardPng}).then(r => {
      setShot(r.ok ? 'copied' : 'failed');
    });
  };

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
    /* ROUND BI — the screenshot rides along: copy the board as a PNG FIRST,
       still inside this click's gesture (Safari only accepts a ClipboardItem
       created synchronously during it), and do not wait for it. A refused
       clipboard costs the user a manual screenshot, never the Send. */
    void copyShot();
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
            <p className="bd-sub">The goblin reads every note — thank you, he'll be on it right away.</p>
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
            placeholder="One line: what happened?"
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

        {/* ROUND BI — the screenshot helper, above the actions. The app copies
            the board as a PNG; the user pastes it into the GitHub body, where
            GitHub's own uploader hosts it. Nothing is uploaded from here, and
            the row only exists when there is a board to copy AND the clipboard
            can take an image — no dead button on an empty board or a plain-http
            origin. */}
        {boardPng && (
          <div className="fb-shot" data-fb-shot={shot} data-fb-clipboard={clipboardReady ? 'yes' : 'no'}>
            {clipboardReady ? (
              <button
                type="button"
                className="bd-btn fb-shot-btn"
                data-fb-copy
                onClick={copyShot}
              >
                {shot === 'copied'
                  ? 'Copied — paste it in the GitHub body (Ctrl+V / ⌘V)'
                  : 'Copy board as PNG'}
              </button>
            ) : (
              /* The Clipboard API only exists in a secure context, so a plain-http
                 host (a LAN dev server) can never copy. Say WHY instead of hiding
                 the whole affordance: a hidden control reads as "this app cannot
                 take a screenshot at all". Nothing here is a dead button. */
              <span className="fb-shot-note" data-fb-clipboard-blocked="1">
                Copying needs HTTPS — on this address take a screenshot instead.
              </span>
            )}
            {shot === 'copied' && (
              <span className="fb-shot-note">GitHub uploads pasted images for you.</span>
            )}
            {shot === 'failed' && (
              <span className="fb-shot-err">
                Couldn't copy — take a screenshot manually and paste it in the GitHub body.
              </span>
            )}
          </div>
        )}
        {/* Media that cannot travel on the clipboard (video, animated GIF, extra
            screenshots) goes straight into the issue body by drag-and-drop —
            GitHub hosts it there. Stated once, outside the board-dependent row so
            it is true even on an empty board. */}
        <p className="fb-note">
          Images or video? Drag the file into the GitHub issue body — GitHub hosts it for you.
        </p>

        <div className="fb-actions">
          <button type="button" className="bd-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="bd-btn primary" data-fb-submit disabled={!canSubmit} onClick={submit}>
            Send feedback
          </button>
        </div>
        {/* Honest, but in the product's voice: Send opens GitHub with the note
            already written, so the only step left there is Submit. The plain
            link covers people who would rather not go through the form. */}
        <p className="fb-note">
          Send opens GitHub with your note written — press Submit there.{' '}
          <a href={FEEDBACK_ISSUES_URL} target="_blank" rel="noopener noreferrer">
            Or browse the issue tracker
          </a>
        </p>
      </div>
    </div>
  );
}
