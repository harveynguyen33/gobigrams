import {memo, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Handle, Position, useStore} from '@xyflow/react';
import {relHandleId, extraTargetHandleId} from './TableNode';
import type {TableColumn} from '../../packages/gobi/src/model/nodeData';

/* ---------------------------------------------------------------------------
   UNISURF-S5 (SPEC-UNIFIED-SURFACE §3/§9 step 5) — the editable column list of
   the `table` node, split out of TableNode so that file stays in budget.

   THE ONE RULE THIS FILE EXISTS FOR (owner-of-typing, row level — the
   prototype's `touch()`/`paintRow` split): the name input is UNCONTROLLED
   (`defaultValue`, keyed by `col.id`) and no code path here ever writes
   `.value` on an input that has focus. Typing mutates the row in place
   through `__onColumns`; React keeps the DOM node (same key) and the caret.
   Structural gestures (add / delete / notnull / FK) push exactly ONE
   history entry; a typing session pushes once, on its FIRST keystroke —
   `pushed` is a ref reset on blur, so a focus session is one entry.
   TYPE-CELL (t_67f95be7) — the type is the SAME kind of field: an
   uncontrolled <input> beside the name (the owner asked to TYPE the type
   instead of clicking to cycle it), one entry per session, Enter/blur
   commits, Esc restores the value the session opened on without pushing.
--------------------------------------------------------------------------- */

/* Name→type inference, ported from the prototype (§6: blue-until-pinned). The
 * 9th rule is the Grist lossless default: unknown stays text, never guessed
 * numeric. Inference proposes the TYPE only — the fk FLAG itself is the
 * picker's/drag's job (S7), so the prototype's "fk" rule proposes int. */
const INFER: [RegExp, string][] = [
  [/(^|_)(id)$/i, 'int'],
  [/(^|_)(qty|quantity|count|lines?|days?|seq|sequence)$/i, 'int'],
  [/(price|amount|total|balance|debit|credit|cost|tax|subtotal)/i, 'money'],
  [/(_at|datetime|timestamp)/i, 'datetime'],
  [/(date|due|start|end|from|to)$/i, 'date'],
  [/(is_|has_|active|enabled|posted|void)/i, 'bool'],
  [/(state|status)/i, 'enum'],
  [/(code|ref|name|email|phone|note|desc|label|address|city|country)/i, 'varchar'],
];
const inferType = (name: string) => {
  for (const [re, t] of INFER) if (re.test(name)) return t;
  return 'text';
};
const uid = () => `c${Math.random().toString(36).slice(2, 8)}`;

/* FLAG-SLOTS (t_d13987ba) — THE slot order, and the table's own slot list.
 * The gutter is not a per-row run of chips any more: every constraint TYPE the
 * table uses gets a FIXED slot in this order, so the same mark sits on the same
 * x on every row (the reported defect: `NN` slid left under `UQ` on the next
 * row). The slot list is derived from the FULL column array — the same data the
 * core width reads (`tableMetrics.flags`) — so the painted gutter and the
 * reserved track can never disagree. The NN toggle counts as used for any
 * non-pk column: it is the control that SETS the flag. */
const FLAG_ORDER = ['pk', 'fk', 'uq', 'nn'] as const;
type FlagKind = (typeof FLAG_ORDER)[number];
const flagSlots = (cols: TableColumn[]): FlagKind[] => {
  const on: Record<FlagKind, boolean> = {pk: false, fk: false, uq: false, nn: false};
  for (const c of cols) {
    if (c.pk) on.pk = true;
    if (c.fk) on.fk = true;
    if (c.unique) on.uq = true;
    if (!c.pk) on.nn = true;
  }
  return FLAG_ORDER.filter((k) => on[k]);
};

type Seam = ((id: string, columns: TableColumn[], push?: boolean) => void) | undefined;

type Props = {
  nodeId: string;
  /** the FULL column array (edits always write the full array, by col id). */
  columns: TableColumn[];
  /** the subset visible under the board's show-mode (what renders). */
  shown: TableColumn[];
  lock?: boolean;
  staleCols?: string[];
  /** UNISURF-S6 — the caret's row key ("nodeId:colId"), render-only. */
  hl?: string;
  seam: Seam;
  onPickColumn?: (id: string, col: TableColumn) => void;
  /** UNISURF-S7 — the ONE FK writer (drag + picker share it). */
  onFk?: (id: string, colId: string, targetId: string) => void;
};

const List = memo(({nodeId, columns, shown, lock, staleCols, hl, seam, onPickColumn, onFk}: Props) => {
  /* extra target handles: one per incoming FK already attached to a column */
  const edges = useStore(s => s.edges);
  const incoming = new Map<string, number>();
  edges.forEach(e => {
    if (e.target !== nodeId || !e.targetHandle) return;
    incoming.set(e.targetHandle, (incoming.get(e.targetHandle) ?? 0) + 1);
  });

  const refs = useRef<(HTMLInputElement | null)[]>([]);
  /* TYPE-CELL — the type field's DOM nodes and the value its focus session
   * opened on (Esc's restore target; `Esc` never pushes history). */
  const typeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const typeWas = useRef<Record<string, string>>({});
  /* ONE history push per focus session: set by the session's first keystroke,
   * cleared on blur (structural gestures always push — they pass push:true). */
  const pushed = useRef(false);
  /* rows the author typed into THIS session that started empty (inference is
   * proposed for them until the author claims it — claimed ids move across). */
  const proposed = useRef<Set<string>>(new Set());
  const claimFocus = useRef<string | null>(null);
  const [fkPick, setFkPick] = useState<string | null>(null);

  /* after a structural add, focus lands in the NEW row's input */
  useEffect(() => {
    if (claimFocus.current === null) return;
    const i = shown.findIndex(c => c.id === claimFocus.current);
    claimFocus.current = null;
    if (i >= 0) refs.current[i]?.focus();
  }, [shown]);

  /* TWO VIEWS, ONE VALUE (UNISURF-S8) — the name input is UNCONTROLLED, so a
   * CODE-PANE rename never reached a row the author had typed into (the DOM
   * kept the old text and the next keystroke wrote it back). Re-sync every
   * input that is NOT the active element: a focused input owns the caret. */
  useEffect(() => {
    shown.forEach((c, i) => {
      const el = refs.current[i];
      if (el && el !== document.activeElement && el.value !== c.name) el.value = c.name;
    });
  }, [shown]);

  /* The SAME rule for the type field: an inference (typing a fresh name) or a
   * code-pane edit changes `col.type` while the type input is not focused, so
   * the uncontrolled input must repaint — and must NOT repaint the one the
   * author is typing into (that input owns its caret). */
  useEffect(() => {
    shown.forEach((c, i) => {
      const el = typeRefs.current[i];
      if (el && el !== document.activeElement && el.value !== c.type) el.value = c.type;
    });
  }, [shown]);

  const write = (next: TableColumn[], push: boolean) => seam?.(nodeId, next, push || undefined);
  const byId = (id: string) => columns.findIndex(c => c.id === id);

  const typeIn = (si: number, v: string) => {
    const col = shown[si];
    if (!col || col.name === v) return;
    /* inference eligibility is STICKY: the row was empty when this typing
       session opened on it (or was inferred earlier in the session) — the
       per-keystroke `col.name` is already non-empty after the first char. */
    const wasEmpty = col.name === '' || proposed.current.has(col.id);
    if (wasEmpty) proposed.current.add(col.id);
    const next = columns.map(c =>
      c.id === col.id ? {...c, name: v, ...(wasEmpty ? {type: inferType(v)} : {})} : c);
    write(next, !pushed.current);
    pushed.current = true;
  };

  const keydown = (si: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const col = shown[si];
    if (!col) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const fresh: TableColumn = {id: uid(), name: '', type: 'text'};
      const next = [...columns];
      next.splice(byId(col.id) + 1, 0, fresh);
      claimFocus.current = fresh.id;
      write(next, true);
    } else if (e.key === 'Backspace' && e.currentTarget.value === '') {
      e.preventDefault();
      if (columns.length <= 1) return;
      const next = columns.filter(c => c.id !== col.id);
      const prev = shown[si - 1] ?? shown[si + 1];
      claimFocus.current = prev?.id ?? null;
      write(next, true);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const to = si + (e.key === 'ArrowDown' ? 1 : -1);
      if (to >= 0 && to < shown.length) refs.current[to]?.focus();
    }
  };

  /* TYPE-CELL — the type is FREE TEXT, not a cycle. Every keystroke writes in
   * place (the name field's discipline); the session's FIRST keystroke is its
   * one history entry, and an authored type IS the claim that drops the
   * inference accent. Any single line survives the grammar: adapterText emits
   * a bare word when the value is an ident and a QUOTED token otherwise, and
   * the parser's column branch accepts both — `numeric(12,2)` round-trips
   * (checks/unisurf-tablerow V5 measures this, and the UA strips the only
   * literal the grammar folds: a line break, V5e). */
  const typeText = (si: number, v: string) => {
    const col = shown[si];
    if (!col) return;
    proposed.current.delete(col.id);
    if (col.type === v) return;
    write(columns.map(c => (c.id === col.id ? {...c, type: v} : c)), !pushed.current);
    pushed.current = true;
  };

  const typeKey = (si: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const col = shown[si];
    if (!col) return;
    if (e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      e.currentTarget.blur();          /* commit — the entry was pushed on the first keystroke */
    } else if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      const was = typeWas.current[col.id] ?? col.type;
      e.currentTarget.value = was;
      /* restoring the session's own opening value adds NO history entry */
      if (col.type !== was) write(columns.map(c => (c.id === col.id ? {...c, type: was} : c)), false);
      e.currentTarget.blur();
    }
  };

  /* the → picker: the .sp-* dialog vocabulary reused verbatim (no second
   * picker, no window.prompt). UNISURF-S7: the pick lands on the SAME FK
   * writer as a column-handle drag (__onFk) — one code path, one shape. */
  const tables = useStore(s => s.nodes)
    .filter(n => n.type === 'table' && n.id !== nodeId)
    .map(n => ({id: n.id, name: (n.data as {name?: string} | undefined)?.name ?? n.id}));
  const [filter, setFilter] = useState('');
  const pickCol = columns.find(c => c.id === fkPick) ?? null;
  /* FLAG-SLOTS — the table's own slot list, computed from the FULL columns (the
     same array the core width reads), never from the visible subset. */
  const SLOTS = flagSlots(columns);

  return (
    <>
      {shown.map((col, si) => {
        const n = incoming.get(relHandleId('left', col.id)) ?? 0;
        const inf = proposed.current.has(col.id);
        /* BOARD-STYLE — the flag SET as data: the harness (and any other reader)
           compares anatomy across styles, where the marks are PAINTED
           differently (plain / chips / bracketed) but mean the same thing. */
        const flags = [col.pk && 'pk', col.fk && 'fk', col.unique && 'uq',
          !col.pk && col.notNull && 'nn'].filter(Boolean).join(' ');
        return (
          <div
            key={col.id}
            className={`tnode-col${col.fk ? ' is-fk' : ''}${staleCols?.includes(col.id) ? ' stale-row' : ''}${hl === nodeId + ':' + col.id ? ' hl' : ''}`}
            data-flags={flags}
            onClick={e => { e.stopPropagation(); onPickColumn?.(nodeId, col); }}
          >
            <Handle type="target" position={Position.Left} id={relHandleId('left', col.id)} className="tnode-h" />
            {Array.from({length: Math.max(0, n - 1)}).map((_, i) => (
              <Handle
                key={i}
                type="target"
                position={Position.Left}
                id={extraTargetHandleId(i, col.id)}
                className="tnode-h"
                style={{top: `${((i + 1) / (n + 1)) * 100}%`}}
              />
            ))}
            {/* BOARD-STYLE — the constraint gutter. ONE anatomy, three paints:
                the marks are TEXT (PK FK UQ NN) in every style; the style only
                decides chrome (plain / bordered chip / bracketed lowercase).
                The SEMANTIC colours are CSS (pk accent, fk teal, uq dim, nn
                faint) and never --nc: a table painted orange still shows its
                orange PK mark (B5).
                FLAG-SLOTS (t_d13987ba) — the gutter is a FIXED SLOT per
                constraint TYPE the table uses, in PK · FK · UQ · NN order. A
                row without a type paints an EMPTY slot (`.ghost`: never
                clickable, never bordered) instead of pulling the next chip
                left, so `NN` sits on the same x on every row of the table. */}
            <span className="tnode-flags">
              {SLOTS.map((k) => {
                const on = k === 'pk' ? !!col.pk : k === 'fk' ? !!col.fk : k === 'uq' ? !!col.unique : !col.pk;
                return k === 'nn' ? (
                  <button
                    key="nn"
                    type="button"
                    className={`tnode-nn flag flag-nn trow-b nodrag${on ? '' : ' ghost'}${on && col.notNull ? ' on' : ''}`}
                    disabled={!!lock || !on}
                    aria-hidden={on ? undefined : true}
                    aria-pressed={on ? col.notNull : undefined}
                    data-flag={on ? 'nn' : undefined}
                    {...(on ? {title: col.notNull ? 'NOT NULL — click to make nullable' : 'nullable — click to make NOT NULL'} : {'data-ghost': 'nn'})}
                    onClick={() => write(columns.map(c => (c.id === col.id ? {...c, notNull: !c.notNull} : c)), true)}
                  >NN</button>
                ) : (
                  <span
                    key={k}
                    className={`${k === 'uq' ? 'tnode-u ' : ''}flag flag-${k}${on ? '' : ' ghost'}`}
                    {...(on ? {'data-flag': k} : {'data-ghost': k, 'aria-hidden': true})}
                  >{k.toUpperCase()}</span>
                );
              })}
            </span>
            <input
              className="tnode-cname trow-in nm nodrag"
              defaultValue={col.name}
              spellCheck={false}
              disabled={!!lock}
              aria-label={`column name ${col.name || 'new'}`}
              ref={el => { refs.current[si] = el; }}
              onInput={e => typeIn(si, e.currentTarget.value)}
              onFocus={() => onPickColumn?.(nodeId, col)} /* S6: row focus bridges to its line */
              onBlur={() => { pushed.current = false; }}
              onKeyDown={e => keydown(si, e)}
            />
            <input
              className={`tnode-ctype trow-in trow-chip ty nodrag${inf ? ' inf' : ''}`}
              defaultValue={col.type}
              spellCheck={false}
              disabled={!!lock}
              aria-label={`column type ${col.type || 'new'}`}
              title="type — free text (one line; letters, digits, punctuation)"
              ref={el => { typeRefs.current[si] = el; }}
              onFocus={e => { typeWas.current[col.id] = e.currentTarget.value; }}
              onInput={e => typeText(si, e.currentTarget.value)}
              onBlur={() => { pushed.current = false; }}
              onKeyDown={e => typeKey(si, e)}
            />
            <button
              type="button"
              className="trow-fk trow-b door nodrag"
              disabled={!!lock}
              aria-pressed={col.fk}
              title="point at another table"
              onClick={() => { setFkPick(col.id); setFilter(''); }}
            >→</button>
            <Handle type="source" position={Position.Right} id={relHandleId('right', col.id)} className="tnode-h" />
          </div>
        );
      })}
      {pickCol && createPortal(
        <div
          className="sp-overlay trow-pick"
          onMouseDown={e => { if (e.target === e.currentTarget) setFkPick(null); }}
          onKeyDown={e => { if (e.key === 'Escape') setFkPick(null); }}
        >
          <div className="sp-card">
            <input
              className="sp-input"
              autoFocus
              value={filter}
              spellCheck={false}
              placeholder={`point ${pickCol.name || 'the column'} at…`}
              aria-label="filter tables"
              onChange={e => setFilter(e.currentTarget.value)}
            />
            <div className="sp-list">
              {tables.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()) || t.id.toLowerCase().includes(filter.toLowerCase())).map(t => (
                <button
                  key={t.id}
                  type="button"
                  className="sp-item"
                  onClick={() => {
                    onFk?.(nodeId, pickCol.id, t.id);
                    setFkPick(null);
                  }}
                >{t.name}</button>
              ))}
              {tables.length === 0 && <div className="sp-empty">no other tables on this board</div>}
            </div>
            <div className="sp-foot">Esc closes · same edge as dragging the column handle</div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
});

export default List;
