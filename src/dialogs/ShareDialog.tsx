/* ShareDialog.tsx — SHARE-DOOR (2026-11-03): the share-by-link surface, lifted
 * out of ExportModal's Export tab. Share is a different VERB from Import and
 * Export (both move a FILE; Share produces a LINK — the product's growth
 * loop), so it has its own toolbar entrance and its own dialog. ONE copy of
 * the build/copy logic: it lives HERE and nowhere else (ExportModal no longer
 * mentions share). Every door law travels with it: the codec arrives by
 * DYNAMIC import (never a static src/share), a built link ticks the export
 * task, and nothing touches a server. */
import {useEffect, useRef, useState, type RefObject} from 'react';
import {type Edge, type Node} from '@xyflow/react';
import {Check, Copy, X} from 'lucide-react';
import {trackExport} from '../app/analytics';

/* GOBI-S1 — the share codec arrives by DYNAMIC import, same law as the .gobi
 * compiler (pinned by round-gobi-door A3/A4 + round-gobi-share S5a): no
 * static import of src/share in this dialog. */
type ShareUrl = {payload: string; url: string; length: number; base: string};

/* EMBED-DOOR (2026-11-07) — the ONE embed-code builder: pure and exported so
 * the harness EXECUTES it (round-toolbar-share d5/d6 + round-embed-fit f1),
 * like shareSignature. It consumes the SAME payload the link was built from
 * plus the SAME base constant the share URL uses (SHARE_BASE_URL, captured at
 * build time from the codec's dynamic import) — never a second encoder, never
 * a retyped host. ONE line: an inline HTML comment that says what the frame
 * does (EMBED-FIT: the diagram scales to fit; raise the attributes for a
 * bigger rendering — the hint must travel WITH the paste, not live only in
 * our dialog) directly followed by the iframe. One line ON PURPOSE: the
 * field is an <input>, and input.value SANITIZES LINE BREAKS AWAY (measured:
 * assigning 'a\nb' reads back 'ab') — a two-line builder output would drift
 * from the field, breaking this dialog's shown-==-copied invariant, and
 * '--><iframe' is valid HTML so the comment needs no separator. The literal
 * border colour is the SNIPPET's own content (it must render on someone
 * else's page, with none of our tokens) — not dialog styling. */
export const EMBED_FRAME = {w: 800, h: 450} as const;
export const embedSnippet = (base: string, payload: string): string =>
  `<!-- Gobigrams embed: the diagram scales to fit the ${EMBED_FRAME.w}x${EMBED_FRAME.h} frame. Raise the width and height attributes for a bigger rendering. -->`
  + `<iframe src="${base}embed#b=${payload}" width="${EMBED_FRAME.w}" height="${EMBED_FRAME.h}" frameborder="0" loading="lazy" style="border:1px solid #2a2a2e;border-radius:8px"></iframe>`;

/* SHARE-STALE-LINK (2026-11-04) — a built link describes ONE board revision.
 * This dialog stays mounted in App (only its BODY unmounts on close), so the
 * built URL used to survive close -> reopen while the board changed under it:
 * delete a node, reopen Share, and the dead link was still there — the reader
 * got the OLD diagram and neither end could see the mistake. The link is now
 * bound to a SIGNATURE of the exact input buildShareUrl consumes (name +
 * nodes + edges — the doc minus its build-time `updatedAt` stamp); on
 * mismatch the derived link is null and the collapsed build row returns
 * exactly as if nothing had been built. CLEAR, never migrate or auto-rebuild
 * (a rebuild per keystroke would rewrite the clipboard behind the user's
 * back). Transient RF fields (selected/dragging/measured) are dropped:
 * selecting a node is not an edit, and size lives in style/width/height.
 * data keys starting with __ are dropped too — app bookkeeping written at
 * insert and cleared by the settle pass (data.__dropAt); counting it killed
 * a link built inside the settle window one second later (measured: add
 * node -> Build immediately -> the link dies when __dropAt clears).
 * Pure and exported so the harness EXECUTES it (round-toolbar-share K). */
const scrubData = (d: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
  if (!d) return d;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(d)) if (!k.startsWith('__')) out[k] = d[k];
  return out;
};

export const shareSignature = (nodes: readonly Node[], edges: readonly Edge[], boardName?: string): string =>
  JSON.stringify({
    name: boardName ?? 'Shared diagram',
    nodes: nodes.map(({selected: _sel, dragging: _drag, measured: _m, ...n}) =>
      ({...n, data: scrubData(n.data)})),
    edges: edges.map(({selected: _s, ...e}) => ({...e, data: scrubData(e.data)})),
  });

type Props = {
  open: boolean;
  onClose: () => void;
  /** MODAL-DOORS (2026-11-03) — the toolbar trigger that opened this dialog;
   * focus returns to it on close (the BoardDialog/Settings contract). */
  returnFocusTo?: RefObject<HTMLElement | null>;
  /** the WHOLE board rides the link — the share view is a read-only
   *  whole-board render, so there is no scope choice to make here (the Export
   *  tab's scope control is a FILE concern). */
  nodes: Node[];
  edges: Edge[];
  boardName?: string;
  onExported: () => void;  // ONBOARD-P7 — a built link COUNTS as "Export your diagram"
};

export default function ShareDialog({open, onClose, returnFocusTo, nodes, edges, boardName, onExported}: Props) {
  /* GOBI-S1 — the Share door's state: the built link (shown + copied) and a
   * copy confirmation. `null` = not built yet (the row starts collapsed to a
   * single button so the long URL does not own the dialog on open).
   * SHARE-STALE-LINK — the URL is stored BESIDE the signature of the input
   * that produced it; the SHOWN link is derived below, never stored state. */
  const [built, setBuilt] = useState<{url: ShareUrl; sig: string} | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  /* SHARE-COPY-BUTTON (2026-11-04) — the transient state of the Copy button
   * beside the field: 'ok' = copied (shows "Copied" ~1.5s), 'manual' = every
   * automatic path failed and the dialog says so. The FIELD stays the one
   * source of truth for the string; the ref is how the handler reads it. */
  const [copyBtn, setCopyBtn] = useState<'ok' | 'manual' | 'idle'>('idle');
  /* EMBED-DOOR (2026-11-07) — the embed row's own transient state, the same
   * three-value contract as copyBtn; separate so copying one never repaints
   * the other button. */
  const [embedBtn, setEmbedBtn] = useState<'ok' | 'manual' | 'idle'>('idle');
  const urlRef = useRef<HTMLInputElement>(null);
  const embedRef = useRef<HTMLInputElement>(null);
  const copyTimer = useRef<number | null>(null);
  const embedTimer = useRef<number | null>(null);
  const goRef = useRef<HTMLButtonElement>(null);
  /* MODAL-DOORS — the document listener reads the ref, never its own deps, so
   * it is bound once per open and cannot be churned mid-event by a re-render
   * (the failure mode the old window-bubble listener had, measured at HEAD:
   * a trusted Escape reached window and the dialog stayed open). */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      closeRef.current();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);
  /* the build button is this dialog's "first tab": focus lands there on open,
   * exactly like the Export modal focuses its active tab. */
  useEffect(() => {
    if (open) window.setTimeout(() => goRef.current?.focus(), 30);
  }, [open]);
  /* MODAL-DOORS — this component stays mounted while closed, so the focus
   * return fires on the open -> false EDGE (BoardDialog restores on unmount;
   * that form cannot apply here). */
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) returnFocusTo?.current?.focus();
    wasOpen.current = open;
  }, [open, returnFocusTo]);
  /* the Copied revert timers must never fire after the dialog is gone. */
  useEffect(() => () => {
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    if (embedTimer.current !== null) window.clearTimeout(embedTimer.current);
  }, []);

  /* SHARE-STALE-LINK — the shown link is a DERIVED value: the stored URL
   * renders only while the live signature still equals the one it was built
   * from. Any board change (delete/add/drag/rename) mismatches -> null ->
   * the collapsed build row, exactly as if nothing had been built; an
   * unchanged board keeps it (the copy-again path the Copy button exists
   * for). Computed only while OPEN: a drag re-renders every frame and the
   * modal blocks editing, so the comparison is owed on open, not per frame. */
  const liveSig = open ? shareSignature(nodes, edges, boardName) : '';
  const shareUrl = built && built.sig === liveSig ? built.url : null;
  /* EMBED-DOOR — the snippet is a DERIVED value off the same gated link: it
   * appears, dies and revives with it (SHARE-STALE-LINK's contract), and is
   * built by the ONE exported builder — never inline JSX string surgery. */
  const snippet = shareUrl ? embedSnippet(shareUrl.base, shareUrl.payload) : null;

  if (!open) return null;

  /* GOBI-S1 — the Share door: the CURRENT board → one URL whose fragment
   * carries the whole doc (never a server). Copy on build; show the link and
   * its length; warn past the big-board threshold where some chat tools
   * truncate pasted URLs. Codec + URL helper arrive by import().
   * ONBOARD-P7 DECISION — a built link COUNTS as "Export your diagram": P6's
   * funnel already reads it as export {format:share}; the tick + this line move together (p7.1c). */
  const doShare = async () => {
    const {buildShareUrl, SHARE_BASE_URL} = await import('../share');
    const doc = {
      id: 'shared', name: boardName ?? 'Shared diagram',
      nodes, edges, updatedAt: Date.now(),
    };
    const res = await buildShareUrl(doc);
    const url = {payload: res.payload, url: res.url, length: res.url.length, base: SHARE_BASE_URL};
    /* SHARE-STALE-LINK — the URL and the signature of the exact input that
     * produced it land in ONE write, so they can never disagree. */
    setBuilt({ url, sig: shareSignature(nodes, edges, boardName) });
    trackExport('share'); onExported();   // ONBOARD-P6 funnel · ONBOARD-P7 checklist tick
    setShareCopied(false); setCopyBtn('idle'); setEmbedBtn('idle');
    /* SHARE-COPY-BUTTON — the build-time copy is KEPT (a courtesy) but goes
     * through the SAME degrade ladder, so even its failure is stated, never
     * the old empty catch. The select needs the input rendered: one tick. */
    if (await writeClipboard(url.url)) setShareCopied(true);
    else { setCopyBtn('manual'); window.setTimeout(() => urlRef.current?.select(), 0); }
  };

  /* SHARE-COPY-BUTTON (2026-11-04) — ONE copy ladder, shared by the
   * copy-on-BUILD courtesy, the Copy button and the embed-code button (never
   * three copies of this logic, and never in a shared util: it lives HERE):
   *   1. navigator.clipboard (unavailable or rejected ->)
   *   2. select() + document.execCommand('copy') (false or throws ->)
   *   3. the caller states the manual way out.
   * EMBED-DOOR: the legacy select() step must target the field that holds the
   * string being copied, so the element is a parameter — the default stays
   * the link field (the c5b build-time call shape is pinned by harness). */
  const writeClipboard = async (text: string, el: HTMLInputElement | null = urlRef.current): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
    } catch { /* fall through to the legacy path */ }
    if (el) {
      try { el.select(); if (document.execCommand('copy')) return true; } catch { /* manual path */ }
    }
    return false;
  };

  /* the button copies the FIELD's value verbatim — the shown string IS the
   * copied string, so the two can never drift (a rebuilt URL would be a
   * second source of truth). */
  const doCopy = async () => {
    const text = urlRef.current?.value ?? '';
    if (!text) return;
    if (await writeClipboard(text)) {
      setCopyBtn('ok');
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => { copyTimer.current = null; setCopyBtn('idle'); }, 1500);
    } else {
      urlRef.current?.select();
      setCopyBtn('manual');
    }
  };

  /* EMBED-DOOR — the embed twin: same ladder, same feedback contract, its
   * own field + timer so the two buttons never repaint each other. It does
   * NOT touch the share-link state (the built URL is untouched by copying). */
  const doCopyEmbed = async () => {
    const text = embedRef.current?.value ?? '';
    if (!text) return;
    if (await writeClipboard(text, embedRef.current)) {
      setEmbedBtn('ok');
      if (embedTimer.current !== null) window.clearTimeout(embedTimer.current);
      embedTimer.current = window.setTimeout(() => { embedTimer.current = null; setEmbedBtn('idle'); }, 1500);
    } else {
      embedRef.current?.select();
      setEmbedBtn('manual');
    }
  };

  return (
    <div className="sp-overlay em-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="em-modal shr-modal" role="dialog" aria-label="Share this board">
        <button type="button" className="em-close" aria-label="Close" onClick={onClose}><X size={14} /></button>
        <div className="em-title">Share this board</div>
        <div className="em-note">The whole board rides the link itself — no account, nothing stored on a server. Anyone who opens it sees a read-only copy.</div>
        <button ref={goRef} className="em-go" onClick={() => void doShare()} disabled={!nodes.length}>
          Build share link
        </button>
        {/* EMPTY-SHARE-REASON (2026-11-03) — a disabled primary button with no
         * stated reason reads as a bug, not a precondition. One sentence, next
         * to the button, naming the next step; it disappears the moment the
         * board has content because it is gated on the LIVE nodes prop. The
         * button STAYS disabled — the precondition is real. data-shr-empty is
         * the probe handle (round-toolbar-share e-family): assert on the
         * attribute, never on the wording. No in-dialog insert action: none
         * exists today and the card forbids inventing one. */}
        {!nodes.length && (
          <div className="em-note" data-shr-empty="">Nothing to share yet — add a node from the palette first.</div>
        )}
        {shareUrl && (
          <>
            <div className="em-share-row">
              <input ref={urlRef} className="em-share-url" readOnly value={shareUrl.url}
                onFocus={e => e.currentTarget.select()} aria-label="Share link" />
              <button type="button" className={'em-copy' + (copyBtn === 'ok' ? ' ok' : '')}
                aria-label="Copy share link" onClick={() => void doCopy()}>
                {copyBtn === 'ok' ? <Check size={13} /> : <Copy size={13} />}
                <span>{copyBtn === 'ok' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="em-note">
              {/* data-shr-copy is the probe handle; aria-live announces the
               * copy outcome to a screen reader (the text CHANGES on every
               * copy, which is what makes the live region actually speak). */}
              <span data-shr-copy="" aria-live="polite">{
                copyBtn === 'manual'
                  ? 'Copy blocked by the browser — the link is selected; press ⌘C / Ctrl+C. '
                  : copyBtn === 'ok' || shareCopied
                    ? 'Copied to clipboard — '
                    : ''
              }</span>
              {shareUrl.length.toLocaleString()} characters.
            </div>
            {shareUrl.length > 8000 && (
              <div className="em-note" role="alert">This board is big — export JSON instead.</div>
            )}
            {/* EMBED-DOOR (2026-11-07) — the iframe twin of the link, its own
             * row in the same vocabulary (data-shr-embed is the probe
             * handle). Below the 8000 threshold only: past it most sites
             * truncate a URL that long, so the row is REPLACED by an honest
             * refusal — never a snippet that looks fine and renders nothing. */}
            {shareUrl.length <= 8000 && snippet && (
              <>
                <div className="em-share-row" data-shr-embed="">
                  <input ref={embedRef} className="em-share-url" readOnly value={snippet}
                    onFocus={e => e.currentTarget.select()} aria-label="Embed code" />
                  <button type="button" className={'em-copy' + (embedBtn === 'ok' ? ' ok' : '')}
                    aria-label="Copy embed code" onClick={() => void doCopyEmbed()}>
                    {embedBtn === 'ok' ? <Check size={13} /> : <Copy size={13} />}
                    <span>{embedBtn === 'ok' ? 'Copied' : 'Copy embed code'}</span>
                  </button>
                </div>
                <div className="em-note">
                  <span data-shr-embed-copy="" aria-live="polite">{
                    embedBtn === 'manual'
                      ? 'Copy blocked by the browser — the code is selected; press ⌘C / Ctrl+C. '
                      : ''
                  }</span>
                  Paste into any page's HTML — the diagram renders read-only, nothing is stored.
                </div>
                {/* EMBED-FIT (2026-11-07) — the note that matches what the
                 * frame now DOES: fit-to-frame. Never promise a size the
                 * reader will not get, and never leave a tall board's author
                 * wondering why the frame cuts it (the card's defect: a fixed
                 * height with no hint it is wrong). data-shr-embed-fit is the
                 * probe handle (round-embed-fit f2): assert the attribute,
                 * never the wording. */}
                <div className="em-note" data-shr-embed-fit="">
                  The diagram scales to fit the {EMBED_FRAME.w}×{EMBED_FRAME.h} frame — raise the width and height attributes for a bigger rendering.
                </div>
              </>
            )}
            {shareUrl.length > 8000 && (
              <div className="em-note" role="alert" data-shr-embed-big="">
                Too big to embed — most sites cut a URL this long. Use the share link, or export JSON.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
