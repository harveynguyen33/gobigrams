/* CodePane.tsx — UNISURF-S3+S4 (SPEC-UNIFIED-SURFACE §2/§4/§5/§9 steps 3-4,
 * 2026-11-08): the code pane, docked right-side sibling column of the canvas
 * inside .canvas-wrap. RAIL-CONTEXT (2026-11-09): it mounts ONLY while open —
 * there is NO rail by default (a board can mix architecture with one table, so
 * a fixed strip is dead width); App reveals it on a table selection or on the
 * manual { } code door. The width change carries NO transition (a transition
 * freezes in an unfocused tab and makes every measurement of the pane a lie —
 * spec §2).
 *
 * S4 — THE PANE IS EDITABLE, COMMIT ON INPUT (no debounce, spec §2): every
 * input event runs commitText (lazy compileGobi + applyGobiDoc — the same
 * dynamic-import shape as the S3 mirror, compiler off the boot chunk) and
 * hands the result to App through onCommit: valid → the merged board, ONE
 * undo entry per typing streak (App's useCodeCommit); invalid → the stale
 * report. The pane owns NO board state (spec §4).
 *
 * OWNER-OF-TYPING (spec §5): while the textarea has focus, a board change
 * must NOT rewrite its value — the mirror effect records the regenerated
 * text and returns without writing. On BLUR a clean pane re-syncs; a STALE
 * pane KEEPS its draft (the lock must outlive focus — clicking the locked
 * canvas is not consent to discard the fix in progress, C4b/C4e).
 *
 * STATE OWNERSHIP (spec §2/§4): the open mode (auto / manually open / manually
 * closed) lives in App under `diagram-studio:code-rail`; the stale report is
 * App's too (the canvas banner and lock read it) and arrives here as `stale`
 * for the error bar.
 *
 * UNISURF-S6 — THE SELECTION BRIDGE (spec §3/§5): `pending` is the lineOf
 * key of the row/node the canvas last focused; it becomes a `line N ↗` chip
 * + a scroll here, NEVER a focus steal — the caret range is applied the next
 * time the pane gains focus, inside setTimeout(0): Chrome rewrites the
 * selection DURING the focus event, so an inline setSelectionRange silently
 * lands the caret on line 1 (measured in the prototype; B2's follow-up probe
 * is the red proof). The other direction: every caret move maps back through
 * lineOf — a column line reports its row key, a header line reports null
 * (zero rows highlighted, by design), and stale reports null always.
 */
import {useCallback, useEffect, useRef, useState, type CSSProperties} from 'react';
import type {Node, Edge} from '@xyflow/react';
import {ChevronRight} from 'lucide-react';
import type {BoardDoc} from '../board/boards';
import {commitText, type CodeCommit, type StaleInfo} from '../gobi/commitText';
import {useRailWidth} from '../hooks/useRailWidth';
import CodeRailSplit from './CodeRailSplit';

export type CodePaneProps = {
  /* rail (closed) = the pane is NOT MOUNTED at all — no 44px strip is left on
   * a board that does not need it (RAIL-CONTEXT). */
  open: boolean;
  onToggle: () => void;
  /** the board's display name — the serialiser's `board "…"` header line. */
  name: string;
  nodes: Node[];
  edges: Edge[];
  /** App's stale report while the last commit failed (drives the error bar). */
  stale: StaleInfo | null;
  /** one call per input event: the merged board, or the stale report. */
  onCommit: (r: CodeCommit) => void;
  /** pane blur: the typing streak (one undo entry) ends here. */
  onTypingEnd: () => void;
  /** UNISURF-S6 — lineOf key of the canvas's last focused row/node. */
  pending: string | null;
  /** UNISURF-S6 — the caret moved: the highlighted row key, or null. */
  onCaret: (key: string | null) => void;
};

export function CodePane(p: CodePaneProps) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const rail = useRailWidth(); /* CODE-RAIL-WIDTH: the pane's width PREFERENCE + the separator's state */
  /** the newest regenerated text — written to the textarea when the pane is
   * NOT the typing owner, handed over on the blur that ends ownership. */
  const latest = useRef('');
  /** the serialiser's line map of the LAST VALID generation — the stale
   * report maps error lines to cards/rows through it (spec §4: never
   * re-derived from a stale parse). */
  const lineOf = useRef<Map<string, number>>(new Map());
  const [text, setText] = useState('');
  /* latest-commit-wins: a slow parse from an earlier keystroke must not
   * overwrite the verdict of the newest one. */
  const seq = useRef(0);
  const staleRef = useRef<StaleInfo | null>(null);
  staleRef.current = p.stale;
  /* the merge base: the board THIS render knows — a ref so a commit landing
   * between renders folds into the current board, not a stale closure. */
  const docRef = useRef({name: p.name, nodes: p.nodes, edges: p.edges});
  docRef.current = {name: p.name, nodes: p.nodes, edges: p.edges};

  /* The mirror: recompute whenever the board changes. `live` drops the write
   * if the board changed again mid-import; the focus guard is the
   * owner-of-typing rule itself — the harness (checks/unisurf-pane.mjs P5)
   * proves its absence red by dropping it in a copy.
   * UNISURF-S8 — the STALE guard: a board change while the pane is stale (the
   * author's draft failed to parse and the banner + lock outlive focus) must
   * not write the mirror over the draft, or the pane and the banner describe
   * two different texts. `latest`/`lineOf` are still recorded (the last valid
   * model is the only base a repair can map onto). */
  useEffect(() => {
    let live = true;
    void (async () => {
      const {boardDocToGobi} = await import('@techgoblin/gobi-core');
      const doc = {id: 'code-pane', name: p.name, nodes: p.nodes, edges: p.edges, updatedAt: 0} as unknown as BoardDoc;
      const out = boardDocToGobi(doc);
      if (!live) return;
      latest.current = out.text;
      lineOf.current = out.lineOf;
      if (staleRef.current) return; /* the draft is the owner until it parses */
      if (ta.current && document.activeElement === ta.current) return;
      setText(out.text);
    })();
    return () => { live = false; };
  }, [p.name, p.nodes, p.edges]);

  /* commit on input — no debounce (spec §2: a throttled tab defers a
   * setTimeout by seconds and the board then lies about the text). */
  const onInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.currentTarget.value;
    setText(v);
    const mine = ++seq.current;
    void commitText(v, lineOf.current, docRef.current as unknown as BoardDoc)
      .then(r => { if (mine === seq.current) p.onCommit(r); });
  }, [p.onCommit]);

  /* pane blur ends typing ownership: a clean pane catches up in the same
   * task (S3 P5c); a stale pane KEEPS its draft (S4, C4b/C4e). */
  const onPaneBlur = useCallback(() => {
    if (!staleRef.current) setText(latest.current);
    p.onTypingEnd();
  }, [p.onTypingEnd]);

  /* ---- UNISURF-S6: the bridge ---------------------------------------- */
  /* the pending line, from the LAST VALID generation's map (lineOf is never
   * re-derived from a stale parse — the mirror effect owns it). */
  const pendLine = p.pending != null ? lineOf.current.get(p.pending) ?? null : null;
  const lineH = (t: HTMLTextAreaElement) => parseFloat(getComputedStyle(t).lineHeight) || 20;
  const scrollLine = (t: HTMLTextAreaElement, n: number) => {
    t.scrollTop = Math.max(0, (n - 1) * lineH(t) - t.clientHeight / 2);
  };
  /* THE CARET-ON-FOCUS TRAP: applied one task AFTER focus (setTimeout 0) —
   * inline, Chrome's own focus rewrite wins and the caret sits on line 1. */
  const onFocusPane = () => {
    const t = ta.current;
    const n = pendLine;
    if (!t || n == null) return;
    setTimeout(() => {
      const ls = t.value.split('\n');
      let at = 0;
      for (let i = 0; i < Math.min(n - 1, ls.length); i++) at += ls[i].length + 1;
      t.setSelectionRange(at, at);
      scrollLine(t, n);
    }, 0);
  };
  /* the pane (open or opening) lands on the pending line without focusing */
  useEffect(() => {
    if (ta.current && pendLine != null) scrollLine(ta.current, pendLine);
  }, [pendLine, p.open]);
  /* code → canvas: the caret's line through lineOf. A header line maps to
   * the node only — reported as null (ZERO rows; the H3 asymmetry). While
   * stale the answer is always null: the draft's line numbers must never
   * highlight a row of the frozen board (B5). */
  const onCaretMove = () => {
    const t = ta.current;
    if (!t) return;
    if (staleRef.current) { p.onCaret(null); return; }
    const line = t.value.slice(0, t.selectionStart ?? 0).split('\n').length;
    let key: string | null = null;
    lineOf.current.forEach((v, k) => { if (v === line) key = k.includes(':') ? k : null; });
    p.onCaret(key);
  };

  if (!p.open) return null;
  const errs = p.stale?.errors ?? [];
  return (
    <div className="cp-pane open" style={{'--cp-w': `${rail.width}px`} as CSSProperties}>
      <CodeRailSplit rail={rail} />
      <div className="cp-head">
        <span>{'{ } code'}</span>
        {/* UNISURF-S6 — the bridge chip: the canvas's last focused row/node,
            one click focuses the pane ON that line (never before). */}
        {pendLine != null && (
          <button type="button" className="cp-chip" title="focus this line"
            onClick={() => ta.current?.focus()}>line {pendLine} ↗</button>
        )}
        <button type="button" className="cp-fold" aria-label="Collapse code pane" title="Cmd/Ctrl+/" onClick={p.onToggle}>
          <ChevronRight size={14} />
        </button>
      </div>
      <textarea
        ref={ta}
        className="cp-code"
        spellCheck={false}
        aria-label="Board as gobi source"
        value={text}
        onChange={onInput}
        onBlur={onPaneBlur}
        onFocus={onFocusPane}
        onSelect={onCaretMove}
        onClick={onCaretMove}
        onKeyUp={onCaretMove}
      />
      {/* the closed-world error list: EVERY error (compileGobi collected them
          all in one pass — no second validator), capped at 6 + …and K more
          (spec §4.4). Rendered only while stale; a commit clears it. */}
      {errs.length > 0 && (
        <div className="cp-errors" role="alert" aria-label="Gobi errors">
          {errs.slice(0, 6).map((e, i) => (
            <div key={i} className="err">{e.line}:{e.col} — {e.message}</div>
          ))}
          {errs.length > 6 && <div className="err more">…and {errs.length - 6} more</div>}
        </div>
      )}
    </div>
  );
}

/** The canvas's OWN stale notice (spec §4.3: "the canvas carries its own
 *  banner, not only a pane badge") — rendered by App over the canvas: the
 *  last valid model, how many errors block it, the first error's line:col,
 *  and that the canvas is locked until the code parses. */
export function StaleBanner({stale}: {stale: StaleInfo | null}) {
  if (!stale) return null;
  const n = stale.errors.length;
  return (
    <div className="stale-banner" role="status">
      <span className="stale-t">showing the last valid board · {n} error{n === 1 ? '' : 's'} in the code block the canvas</span>
      <span className="stale-first">line {stale.first.line} col {stale.first.col} — {stale.first.message}</span>
      <span className="stale-lock">read-only until the code parses</span>
    </div>
  );
}
