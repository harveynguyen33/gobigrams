/**
 * HISTORY-V3 (t_37f23a89) — the version-history dialog, LEDGER design
 * (the variant Harvey picked from the sketch). One row per stored
 * generation, NEWEST FIRST: relative time (absolute on `title`) · size ·
 * badge · hover actions; a restore bar pinned to the dialog bottom.
 *
 * MACHINERY IS REUSED, NOT REINVENTED (the brief's rule): the search
 * palette's `.sp-overlay`/`.sp-card` narrowed by the board dialog's
 * `.bd-*` head/button vocabulary, the `FOCUSABLE` selector and
 * `returnFocusTo` contract from Settings/BoardDialog, the capture-phase
 * Escape + Tab trap exactly as BoardDialog.tsx does it, and the
 * HISTORY-PREVIEW thumbnail: the bar renders the version's own LAYOUT
 * (src/ui/historyThumb.ts — a rect per node at its stored position,
 * straight centre-to-centre lines, capped at 400 each), a MAP rather
 * than a shape census — a version whose nodes share one shape still reads at a glance.
 *
 * THE RESTORE LAW lives in the seam (`restoreHistoryVersion`): the exact
 * old bytes go back through the app's normal save path with the
 * `pre-restore` reason, then THIS dialog hands the returned doc to
 * `onRestored` — App's `applyBoard`, the one board-adoption write that
 * also resets the undo/redo stacks. This file never builds a synthetic
 * doc, never writes history, never re-implements adoption.
 *
 * BADGES are derived client-side (`src/ui/historyBadges.ts`) — the
 * retention planner is deliberately NOT imported; only the CAP NUMBERS
 * come from the one policy home (historyPolicy.ts), so the header's
 * `of 28 versions` and its explainer cannot drift from what retention
 * actually keeps.
 *
 * HISTORY-STABLE (t_7bba117f, 2026-11-20) — owner device test #2: the
 * selection must not reflow the dialog (fixed-height .hd-prev box + a
 * stamp-keyed doc cache, never blanking the preview), the bar is ONE
 * line, the size column lands on one x on every row (the act sits in a
 * constant absolute gutter), the cap is EXPLAINED (of N versions + one
 * muted line interpolated from historyPolicy), and the version-NAMING
 * feature is REMOVED (owner: "tôi nghĩ k cần đặt tên"). The STORAGE seam
 * keeps its pin slot unchanged — pinHistoryLabel's '' is still what the
 * Keep button writes — only the UI stops reading the NAME; the badge
 * KIND survives, the badge name does not.
 *
 * LOCAL MODE (HISTORY-V4, t_1b538662): the dialog is live in BOTH storage
 * modes — the local IndexedDB `versions` store answers the same listing,
 * the same pin cap, and the same restore law through the seam, so
 * every seam call here works unchanged whichever backend the boot probe
 * picked. The dialog renders rows, never re-derives them.
 */
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Pin, PinOff, X} from 'lucide-react';
import {FOCUSABLE} from '../ui/Settings';
import {fmtDate, relTime} from '../ui/relTime';
import {deriveBadges} from '../ui/historyBadges';
import {HISTORY_DAILY_KEEP, HISTORY_PIN_KEEP, HISTORY_RING_KEEP} from '../board/historyPolicy';
/* Named imports, NOT the namespace: A15b (unisurf-lock-seam) closes the
   `* as boards` namespace to the four persistence owners because it carries
   createBoard/deleteBoard. The history functions are READ/history surface —
   importing them by name is exactly what the lock-seam design wants (A15
   only forbids name-importing the WRITE exports, which this file never
   touches: the restore's PUT rides inside restoreHistoryVersion). */
import {getHistoryVersion, listHistory, pinHistoryLabel, restoreHistoryVersion, unpinHistoryLabel} from '../board/boards';
import type {BoardDoc, HistoryRow} from '../board/boards';
import {thumbGeometry} from '../ui/historyThumb';

type Props = {
  /** The board whose history this is (id + name — the anchor for every call). */
  board: {id: string; name: string};
  onClose: () => void;
  /** The restore adoption: App's applyBoard (adoption + undo/redo stack reset). */
  onRestored: (doc: BoardDoc) => void;
  /** Focus restore, Settings.tsx's contract: on close, `.current?.focus()`. */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
};

/** When 4 kept versions exist every other row's Keep is disabled — the cap
 *  must be VISIBLE, not a surprise 409. The number rides the title so a
 *  keyboard user reads the same explanation a hover user does. The words
 *  match the header explainer (D4, 2026-11-20): kept, and the oldest
 *  unkept one goes first. */
const CAP_TITLE = `Keep cap reached (${HISTORY_PIN_KEEP}) — stop keeping another version first.`;

/** The shared loading copy (the header count and the list's empty state both
 *  hold it — one literal, not two riding the bundle). */
const LOADING_TXT = 'Reading the saved versions…';

const msg = (e: unknown) => e instanceof Error ? e.message : String(e);

export default function HistoryDialog({board, onClose, onRestored, returnFocusTo}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [selDoc, setSelDoc] = useState<BoardDoc | null>(null);
  const [selErr, setSelErr] = useState('');
  const [busy, setBusy] = useState<'restore' | 'op' | null>(null);
  const [barErr, setBarErr] = useState('');

  /* Ref mirrors so the document-level capture listener always reads the
     CURRENT state without re-subscribing (BoardDialog's cancelRef pattern). */
  const cancelRef = useRef(onClose); cancelRef.current = onClose;
  const selRef = useRef<string | null>(null);
  const opRef = useRef(false);

  /* HISTORY-STABLE D1(b): version docs cached by stamp — re-selecting an
     already-shown version paints synchronously from this map: no refetch,
     no "Reading…" flash for something the dialog has already displayed. */
  const docCache = useRef(new Map<string, BoardDoc>());

  /* The badge column, one badge per row, derived from the rows alone. The
     kept-count reads the BADGE KIND, not the row's storage slot — the UI no
     longer reads the seam's name field anywhere (D5, 2026-11-20). */
  const badges = useMemo(() => deriveBadges(rows ?? []), [rows]);
  const pins = useMemo(() => (rows ?? []).filter((r, i) => badges[i]?.kind === 'pinned').length, [rows, badges]);
  const thumb = useMemo(() => (selDoc ? thumbGeometry(selDoc) : null), [selDoc]);

  const refresh = useCallback(async () => {
    try { setRows(await listHistory(board.id)); }
    catch (e) { setLoadErr(msg(e)); }
  }, [board.id]);

  /* Load once per board. `alive` keeps a slow listing from setting state on
     a dialog that already closed. */
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const rs = await listHistory(board.id); if (alive) setRows(rs); }
      catch (e) { if (alive) setLoadErr(msg(e)); }
    })();
    return () => { alive = false; };
  }, [board.id]);

  /* Escape (capture + stopPropagation, exactly as BoardDialog does it) and
     the Tab focus trap. Capture is what stops App's global handler from
     ALSO acting on the key; App carries its own guard. (HISTORY-STABLE D5:
     the label-edit cancel exit is gone with the feature — Escape now only
     closes the dialog.) */
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

  /* Focus the card once painted (BoardDialog's setTimeout pattern — no
     field owns autofocus here, the LIST is the dialog's subject). */
  useEffect(() => {
    const t = window.setTimeout(() => { cardRef.current?.focus(); }, 10);
    return () => window.clearTimeout(t);
  }, []);

  // Focus restore: hand the caret back to the control that opened us.
  useEffect(() => () => { returnFocusTo?.current?.focus(); }, [returnFocusTo]);

  /** Select = preview: fetch the generation (or replay it from the doc cache)
   *  and show its counts in the bar. A second click on the same row is a
   *  no-op; a slower earlier fetch must not overwrite a newer selection (the
   *  stamp is re-checked on resolve). */
  const select = useCallback(async (stamp: string) => {
    if (opRef.current || selRef.current === stamp) return;
    selRef.current = stamp;
    /* HISTORY-STABLE D1(c): selDoc is never blanked here — the previous
       preview stays on screen until the newly-picked doc arrives (or fails,
       into selErr). The old code nulled it, which is what made the bar
       flash and the card jump on every pick. */
    setSel(stamp); setSelErr(''); setBarErr('');
    const hit = docCache.current.get(stamp);
    if (hit) { setSelDoc(hit); return; }
    try {
      const doc = await getHistoryVersion(board.id, stamp);
      docCache.current.set(stamp, doc);
      if (selRef.current === stamp) setSelDoc(doc);
    } catch (e) {
      if (selRef.current === stamp) setSelErr(msg(e));
    }
  }, [board.id]);

  /** THE RESTORE. The seam owns the law (GET version → PUT through the
   *  normal save path with the pre-restore reason); App's applyBoard owns
   *  adoption + the undo/redo stack reset. Close on success so the user
   *  sees the restored canvas, not a stale ledger. */
  const restore = useCallback(async () => {
    if (opRef.current || !sel) return;
    opRef.current = true; setBusy('restore'); setBarErr('');
    try {
      const doc = await restoreHistoryVersion(board.id, sel);
      onRestored(doc);
      cancelRef.current();
    } catch (e) {
      setBarErr(msg(e)); setBusy(null); opRef.current = false;
    }
  }, [board.id, sel, onRestored]);

  const runOp = useCallback(async (fn: () => Promise<unknown>) => {
    if (opRef.current) return;
    opRef.current = true; setBusy('op'); setBarErr('');
    try { await fn(); } catch (e) { setBarErr(msg(e)); }
    setBusy(null); opRef.current = false;
    await refresh();
  }, [refresh]);

  const capTotal = HISTORY_RING_KEEP + HISTORY_DAILY_KEEP + HISTORY_PIN_KEEP;

  return (
    <div className="sp-overlay bd-overlay" data-history-dialog>
      <div className="sp-card bd-card hd-card" ref={cardRef} role="dialog" aria-modal="true"
        aria-labelledby="hd-title" tabIndex={-1}>
        <div className="bd-head">
          <div className="hd-head-txt">
            <h2 className="bd-title" id="hd-title">History — {board.name}</h2>
            <p className="bd-sub">
              {rows == null ? LOADING_TXT : `${rows.length} of ${capTotal} versions`}
            </p>
            {/* HISTORY-STABLE D4: the cap says what it MEANS now — one muted
                line, its three numbers interpolated from the ONE policy home
                (historyPolicy.ts), never a second copy. */}
            <p className="hd-exp">Keeps the {HISTORY_RING_KEEP} newest, {HISTORY_DAILY_KEEP} daily and {HISTORY_PIN_KEEP} kept — the oldest unkept one goes first.</p>
          </div>
          <button type="button" className="bd-x" aria-label="Close" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="hd-list">
          {loadErr && <p className="hd-empty hd-err" role="alert">{loadErr}</p>}
          {!loadErr && rows == null && <p className="hd-empty">{LOADING_TXT}</p>}
          {!loadErr && rows != null && rows.length === 0 &&
            <p className="hd-empty">No versions yet — they appear as this board is saved.</p>}
          {!loadErr && rows != null && rows.map((r, i) => {
            const badge = badges[i];
            const pinned = badge.kind === 'pinned';
            const atCap = pins >= HISTORY_PIN_KEEP;
            return (
              <div key={r.stamp} className={`hd-row${sel === r.stamp ? ' sel' : ''}`}>
                <button type="button" className="hd-row-main" title={fmtDate(r.at)}
                  aria-current={sel === r.stamp ? 'true' : undefined}
                  onClick={() => void select(r.stamp)}>
                  <span className="hd-time">{relTime(r.at)}</span>
                  {/* HISTORY-STABLE D4/D5: the chip says kept — the name is
                      gone with the naming feature, so there is no title to
                      hover for either. */}
                  <span className={`hd-badge hd-badge-${badge.kind}`}>
                    {badge.kind === 'pinned' ? 'kept' : badge.kind}
                  </span>
                  <span className="hd-size">{(r.bytes / 1024).toFixed(1)} KB</span>
                </button>
                <span className="hd-act">
                  {pinned ? (
                    <button type="button" className="hd-icon-btn" title="Stop keeping" disabled={busy === 'restore'}
                      onClick={() => void runOp(() => unpinHistoryLabel(board.id, r.stamp))}><PinOff size={13} /></button>
                  ) : (
                    <button type="button" className="hd-icon-btn" title={atCap ? CAP_TITLE : 'Keep this version (never auto-dropped)'}
                      disabled={atCap || busy === 'restore'}
                      onClick={() => void runOp(() => pinHistoryLabel(board.id, r.stamp, ''))}><Pin size={13} /></button>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* HISTORY-STABLE D1(a): the preview box is PERMANENTLY rendered with a
            fixed height — its contents swap in place (the version's own layout
            thumbnail when one is selected, the empty-state sentence when not),
            so a selection can never grow the card, re-bucket the list above, or
            re-centre the dialog. The old bar mounted the thumb on selection,
            which is exactly the "giật flicker" the owner reported. */}
        <div className="hd-prev">
          {selDoc && thumb ? (
            <svg className="hd-thumb" width={96} height={54} role="img" aria-hidden="true" aria-label="Version layout preview"
              style={{flexShrink: 0}} viewBox={`0 0 ${thumb.vw} ${thumb.vh}`}>
              {thumb.rects.map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />)}
              {thumb.lines.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />)}
            </svg>
          ) : (
            <span className="hd-prev-empty">
              {selDoc ? 'Nothing to preview in this version'
                : selErr || (sel ? 'Reading…' : 'Pick a version to see its layout')}
            </span>
          )}
        </div>
        <div className="hd-bar">
          {/* HISTORY-STABLE D2: the bar is ONE line — the note never wraps
              (nowrap + ellipsis, min-width 0), Restore never shrinks, and the
              thumbnail lives in .hd-prev above, not in here. The note reads the
              previewed doc's own updatedAt, so it stays paired with the thumb
              even while a slower fetch for a newer pick is still in flight. */}
          <span className="hd-note">
            Viewing: <b>{selDoc ? relTime(selDoc.updatedAt) : '—'}</b>
            {selDoc && <span className="hd-count"> · {selDoc.nodes.length} {selDoc.nodes.length === 1 ? 'node' : 'nodes'} · {selDoc.edges.length} {selDoc.edges.length === 1 ? 'link' : 'links'}</span>}
          </span>
          {barErr && <span className="hd-err-txt" role="alert">{barErr}</span>}
          <button type="button" className="bd-btn primary hd-restore"
            disabled={!selDoc || busy === 'restore'}
            onClick={() => void restore()}>Restore</button>
        </div>
      </div>
    </div>
  );
}
