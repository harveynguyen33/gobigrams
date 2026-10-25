/* useBoardsMenu.ts — ROUND BN-2: the boards menu cluster moved out of App()
 *  verbatim (the ITEM 6b board dialog state, the ROUND 3/6 create-from-
 *  template owner + gallery handover, the ITEM B portal'd popover clamp,
 *  switchPreset, openBoard, rename/duplicate/delete, onBoardDialog and the
 *  outside-click closer). Behaviour-neutral: bodies are byte-identical; only
 *  this wrapper, its parameter list and the return tuple are new. boardsOpen,
 *  boardList, curBoard, presetId and their setters stay in App (shared with
 *  the persistence hook and the JSX popover) and pass down positionally —
 *  no context. boardsBtnRef and boardsMenuBtnRef come back out because the
 *  JSX (still in App) attaches them.  (feature-map home: src/src/useBoardsMenu.ts)
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import type * as React from 'react';
import type {Node, Edge} from '@xyflow/react';
import * as boards from './boards';
import type {BoardDoc, BoardMeta} from './boards';
import {getPreset} from './presets';
import type {PresetId} from './presets';
import type {BoardDialogResult} from './BoardDialog';
import type {ShowMode} from './TableNode';

/* Positional parameters, not an opts object (AGENTS.md perf ratchet). */
export function useBoardsMenu(
  nodesRef: React.MutableRefObject<Node[]>,
  edgesRef: React.MutableRefObject<Edge[]>,
  boardList: BoardMeta[],
  setBoardList: React.Dispatch<React.SetStateAction<BoardMeta[]>>,
  boardsOpen: boolean,
  setBoardsOpen: (v: boolean | ((o: boolean) => boolean)) => void,
  curBoard: BoardDoc | null,
  setCurBoard: React.Dispatch<React.SetStateAction<BoardDoc | null>>,
  presetId: PresetId,
  setPresetId: (id: PresetId) => void,
  setShowMode: (m: ShowMode) => void,
  setNoCycles: (v: boolean) => void,
  setOneIn: (v: boolean) => void,
  suggestTheme: (t?: string) => void,
  flushSave: () => void | Promise<void>,
  saveTimer: React.MutableRefObject<number | undefined>,
  applyBoard: (doc: BoardDoc) => void,
  flash: (msg: string) => void,
  tickTask: (id: 'node' | 'edge' | 'label' | 'move' | 'export' | 'board') => void,
) {

  /** ITEM 6b — the board dialog. `null` = closed. The MODE is the state: a
   *  `create` / `rename` / `delete` request each just sets it, and all the async
   *  work happens in `onBoardDialog`, so the dialog itself never touches the
   *  boards API. */
  const [boardDlg, setBoardDlg] = useState<BoardDialogResult['kind'] | null>(null);

  /** PACKAGE-TEMPLATES §2.5 Pass 2 — the Templates gallery. `false` = closed.
   *
   *  TWO SEPARATE PIECES OF STATE, ON PURPOSE, and they can be TRUE AT THE SAME
   *  TIME: the "Browse all templates…" row lives INSIDE the board dialog, so
   *  opening the gallery from there leaves that dialog mounted underneath (the
   *  gallery's scrim is above it — see `.tg-overlay`'s z-index). The alternative —
   *  one enum, `'create' | 'rename' | 'delete' | 'gallery'` — would UNMOUNT the
   *  dialog and lose the half-typed board name, which is exactly the work the user
   *  was doing when they went browsing. `boardDlg` answers "is a board dialog
   *  open, and in which mode"; `tgOpen` answers "is the gallery open". */
  const [tgOpen, setTgOpen] = useState(false);
  /** ROUND 4, ITEM 1 — `boardPick` and its `setBoardPick` are GONE, with the
   *  dialog's `initialPick` prop they existed to feed. ROUND 3 had already
   *  removed their only non-null writer (the gallery creates the board itself),
   *  leaving four `setBoardPick(null)` resets guarding a value nothing could
   *  set; ROUND 4 removed the last reader (the dialog's row-matching), so the
   *  state was carrying nothing at all. Deleting it is the honest end of that
   *  history — no behaviour changed: every write was already a reset to `null`. */
  /** The dialog's close path for all three of its modes. Focus restore is left
   *  to `BoardDialog`'s own unmount contract (`returnFocusTo`), which is what the
   *  boards-menu route has always used.
   *
   *  ROUND 6, ITEM 3 — this is also where an ABANDONED typed name is dropped:
   *  every exit that is not a create (Cancel, the ✕, Escape, the scrim, a rename
   *  or delete submitting) goes through here, and a name the user walked away
   *  from must not name a board they create later. The two exits that DO carry a
   *  name — the "Blank" row and "Use template" — do not use this path: the first
   *  hands the name to `onBoardDialog` and the second stashes it for the
   *  gallery. */
  const closeBoardDlg = useCallback(() => {
    pendingBoardName.current = '';
    setBoardDlg(null);
  }, []);

  /** L2 — New board. Opens the designed dialog (item 6b); the work moved to
   *  `onBoardDialog`, where the name arrives as data instead of through a
   *  blocking native browser prompt + confirm chain. */
  const newBoard = useCallback(() => { setBoardDlg('create'); }, []);

  /** ROUND 6, ITEM 3 — THE NAME TYPED IN THE DIALOG, CARRIED ACROSS THE HOP.
   *
   *  Harvey, verbatim: "khi đổi tên và ấn chọn use template => thì nó lại ra là
   *  untitled X chứ k phải tên đã ghi trong New board". Type a name, press "Use
   *  template", and the board came out `Untitled N`.
   *
   *  WHY A REF AND NOT STATE. The dialog's `onBrowse` row does two things at once
   *  — it closes the dialog and opens the gallery — and the name has to survive
   *  that handover without re-rendering for it. A `useState` would be a render
   *  for a value nothing PAINTS; a ref is the value's real shape: written once on
   *  the row press, read once when the gallery's card is chosen, and cleared
   *  again at every point where it would otherwise go stale.
   *
   *  THE STALE-NAME RULE (each clear site, and why it is there):
   *    - opening the gallery from the BOARDS MENU row (`Templates`; it read
   *      `Create from Templates` until ITEM B, 2026-10-22, shortened so the
   *      row never wraps at the popover's 360px)
   *      starts an EMPTY stash, because that route has no typed name and the
   *      board must auto-number — without this clear, a name abandoned in an
   *      earlier dialog would silently name a later, unrelated board;
   *    - `useTemplate` consumes it and clears it, so a second pick from a
   *      re-opened gallery cannot reuse the first board's name;
   *    - cancelling the dialog clears it, so abandoning a typed name is not a
   *      deferred naming of the next board either.
   *
   *  DECLARED ABOVE `createFromTemplate` deliberately: both `useTemplate` and
   *  `onBoardDialog` are `useCallback`s that close over it, and a `useCallback`
   *  cannot reference a `const` that has not been initialised yet. */
  const pendingBoardName = useRef<string>('');

  /** ROUND 3 — THE ONE OWNER OF "CREATE A BOARD FROM A TEMPLATE".
   *
   *  BOTH routes call this and NEITHER keeps a copy of the body: the gallery's
   *  "Use template" (which now creates the board in ONE step, no dialog) and
   *  `Boards → New board` → Create with a row chosen. Before this round the body
   *  lived inline in `onBoardDialog`'s create branch; it was lifted here so the
   *  two paths cannot drift and there is a single owner of the seed + the save.
   *
   *  `preset`/`templateId` name the seed; both absent means "start empty", which
   *  is a real option and not a failure. The name is OPTIONAL: a caller may hand
   *  one over (the dialog's field) or omit it, in which case it is auto-numbered
   *  from the CURRENT board list — that is what makes the gallery path zero
   *  clicks while still producing `Untitled`, `Untitled 2`, `Untitled 3`, …
   *
   *  The `preset` string is only ever the SEED's own preset, never `custom`
   *  unless nothing seeded the board: a C4 template must not land under Mixed's
   *  edge defaults (the old hard-coded-`custom` defect the dialog fixed).
   *
   *  ORDERING MATTERS: this is declared ABOVE `useTemplate` because a
   *  `useCallback` cannot close over a `const` that has not been initialised
   *  yet — the same TDZ constraint `onBoardDialog` documents below. */
  const createFromTemplate = useCallback((opts: {name?: string; preset?: PresetId; templateId?: string} = {}) => {
    const wantPid: PresetId = opts.preset ?? 'custom';
    const t = opts.templateId ? getPreset(wantPid).templates?.find(x => x.id === opts.templateId) : undefined;
    const pid: PresetId = t ? wantPid : 'custom';
    /* ROUND 6, ITEM 3 — the name rule is the pure `boards.resolveBoardName`, not
       an inline ternary: the same decision is asserted by executing the shipped
       function, and there is one place where "a typed name wins over the
       auto-numbered default" is spelled. */
    const name = boards.resolveBoardName(opts.name, boardList.map(b => b.name));
    void (async () => {
      try {
        await flushSave();
        const doc = await boards.createBoard(name);
        const nodes = t ? t.nodes.map(n => ({...n})) : [];
        const edges = t ? t.edges.map(e => ({...e})) : [];
        if (t) await boards.saveBoard({id: doc.id, name, nodes, edges, preset: pid});
        setBoardList(await boards.listBoards());
        applyBoard({...doc, nodes, edges, preset: pid});
        tickTask('board');
        flash(`Created ${getPreset(pid).label} board “${name}”`);
      } catch (err) {
        flash(`New board failed: ${err?.message ?? 'unknown'}`);
      }
    })();
  }, [boardList, flushSave, applyBoard, flash, tickTask]);

  /** ROUND 3 — "Use template" CREATES THE BOARD, in ONE step.
   *
   *  Harvey, verbatim: "thấy hơi mất công khi tôi ấn Templates... xong hiện modal
   *  và tôi chọn use template thì nó qua create newboard". The old route cost an
   *  extra stop: gallery → Use template → New board dialog → press Create. Now the
   *  gallery's `key` (`${preset}:${templateId}`) is RESOLVED here and handed to
   *  `createFromTemplate`, which is the same function the dialog's create branch
   *  calls — so there is still exactly ONE owner of "create a board from a
   *  template", and this route has no name prompt and no dialog.
   *
   *  THE NAME IS OPTIONAL BY DESIGN: none is passed, so `createFromTemplate`
   *  auto-numbers it from the current board list (`Untitled`, `Untitled 2`, …).
   *  A user who wants a specific name still has the dialog route
   *  (`Boards → New board`), which carries a name field.
   *
   *  `key` is parsed at the FIRST `:` because a template id never contains one;
   *  a malformed key (no `:`) is left to create an UNSEEDED board rather than
   *  inventing a preset — `defaultTemplate`-style guessing is what the dialog
   *  path deliberately avoids.
   *
   *  ROUND 6, ITEM 3 — `pendingBoardName` is consumed HERE, and consumed means
   *  CLEARED AT THE SAME INSTANT it is read, before the key is even parsed. That
   *  is the whole fix: the dialog's "Use template" row stashes the typed name
   *  before it opens this gallery, and the pick that follows carries it into
   *  `createFromTemplate`. An EMPTY stash (the boards-menu route) arrives as an
   *  empty string, which `resolveBoardName` turns into the auto-numbered default
   *  — the two routes differ by the stash alone, not by two branches.
   *
   *  READ-AND-CLEAR IN ONE STEP, NOT `finally`: a malformed key returns from the
   *  middle of this callback, and a name left behind would silently name whatever
   *  board the NEXT pick creates. Clearing before the early return makes that
   *  impossible by construction, so no exit path can leak the value. */
  const useTemplate = useCallback((key: string) => {
    setTgOpen(false);
    const carried = pendingBoardName.current;
    pendingBoardName.current = '';
    const i = key.indexOf(':');
    if (i < 0) { createFromTemplate({name: carried}); return; }
    createFromTemplate({name: carried, preset: key.slice(0, i) as PresetId, templateId: key.slice(i + 1)});
  }, [createFromTemplate]);

  /** The gallery's own close path. The caret goes back to the Boards button —
   *  which is the one trigger that still exists on either route into the gallery
   *  (the boards-menu row unmounts with the menu; the dialog's "Browse all
   *  templates…" row unmounts with the dialog, since opening the gallery closes
   *  it — §2.3). Focusing a null ref is a no-op, so the two rules cannot fight. */
  const closeGallery = useCallback(() => { setTgOpen(false); }, []);
  /** ITEM 6b — the dialog's focus-restore target. The Boards menu button is the
   *  one trigger that still exists when the dialog closes: the menu row that was
   *  actually pressed lives inside the popup, which unmounts the moment the row
   *  is chosen. Focusing a null ref is a no-op, so a menu row ref would silently
   *  drop focus on `<body>` and the next Tab would start from the top of the page. */
  const boardsMenuBtnRef = useRef<HTMLButtonElement>(null);

  /* ITEM B (2026-10-22) — the boards popover is a FIXED PORTAL, anchored to
   * the live button rect. Measured defect it replaces: the popup hung off
   * `.panel-head` with `left: 0; right: 0`, and `.panel` is `overflow: hidden`
   * at 232px — a wider redesign is CLIPPED, not scrolled, so the width could
   * never grow inside the head. Portal'd to `document.body` (the
   * `Tooltip.tsx` precedent) it escapes that clip; the anchor is the button's
   * own rect (`left: btn.right + 6`, top pinned to the button top) so the
   * popup opens to the RIGHT of the control and the `max-width` clamp keeps
   * it inside the viewport on narrow hosts. Recomputed while open so a
   * viewport resize re-anchors instead of leaving the popup floating.
   * SHORT VIEWPORTS: below 420px of viewport height the phone tier puts a
   * `transform` on `.app`'s subtree — a `position: fixed` descendant then
   * resolves against `.app` (the transformed ancestor), not the viewport,
   * which is ACCEPTED here, not fought: the clamp loop below measures the
   * button rect AFTER that resolution (getBoundingClientRect already reports
   * post-transform geometry), so the popup lands beside the sheet either way;
   * `boardsPopClamp` asserts it. */
  const [boardsPopPos, setBoardsPopPos] = useState<{left: number; top: number; maxW: number} | null>(null);
  const boardsPopClamp = useCallback(() => {
    if (!boardsOpen) { setBoardsPopPos(null); return; }
    const r = boardsMenuBtnRef.current?.getBoundingClientRect();
    if (!r) { setBoardsPopPos(null); return; }
    const left = r.right + 6;
    const top = r.top;
    /* ITEM B — the clamp has NO floor, by design: a floor would push the popup
       past a narrow window's right edge (measured in the harness model: a 232px
       floor overflows a 360px window by 94px). max-width = 100vw − anchorX − 8;
       a degenerate sliver of a window squeezes the popup instead of overflowing. */
    const maxW = Math.max(0, window.innerWidth - left - 8);
    setBoardsPopPos({left, top, maxW});
  }, [boardsOpen]);
  useEffect(() => {
    if (!boardsOpen) { setBoardsPopPos(null); return; }
    boardsPopClamp();
    window.addEventListener('resize', boardsPopClamp);
    return () => window.removeEventListener('resize', boardsPopClamp);
  }, [boardsOpen, boardsPopClamp]);

  /** L2 — applies a preset to the CURRENT board. NO UI CALLS THIS any more:
   *  the user-facing picker was removed on 2026-09-17, so this is now the
   *  unreachable-but-authoritative helper for a preset swap (kept on purpose).
   *  A swap never rewrites existing nodes; it changes the show-mode, the edge
   *  defaults, the auto-layout, the declared caps and the suggested theme. */
  const switchPreset = useCallback((id: PresetId) => {
    if (id === presetId) return;
    const p = getPreset(id);
    setPresetId(id);
    setShowMode(p.showMode ?? 'ALL_FIELDS');
    // L2 switch point 8 — a preset's caps apply to the EXISTING toggles (there is
    // no second toolbar). `architecture` declares today's defaults, so this is a
    // no-op for the default preset.
    if (p.caps) {
      if (p.caps.cyclePrevention !== undefined) setNoCycles(p.caps.cyclePrevention);
      if (p.caps.oneInput !== undefined) setOneIn(p.caps.oneInput);
    }
    // A preset's suggested theme is a SUGGESTION, not an explicit user choice:
    // it must never overwrite a stored 'system' preference. Render-only, and
    // skipped entirely once the user has chosen (`suggestTheme` guards that).
    suggestTheme(p.theme.suggested);
    setCurBoard(c => c ? {...c, preset: id} : c);
    flushSave();
    flash(`${p.label} preset — palette, edge defaults and layout changed. Existing elements kept.`);
  }, [presetId, flushSave, flash, suggestTheme]);

  const openBoard = useCallback(async (id: string) => {
    if (id === curBoard?.id) { setBoardsOpen(false); return; }
    try {
      await flushSave();
      const doc = await boards.getBoard(id);
      setBoardsOpen(false);
      applyBoard(doc);
      flash(`Opened “${doc.name}”`);
    } catch (err) {
      flash(`Open board failed: ${err?.message ?? 'unknown'}`);
    }
  }, [curBoard, flushSave, applyBoard, flash]);

  /** ITEM 6b — opens the designed rename dialog. The name arrives from
   *  `onBoardDialog`; this callback keeps the save body verbatim. */
  const renameBoard = useCallback(() => { setBoardDlg('rename'); }, []);

  const doRenameBoard = useCallback(async (name: string) => {
    if (!curBoard || !name || name === curBoard.name) return;
    try {
      await flushSave();
      const saved = await boards.saveBoard({
        id: curBoard.id, name,
        nodes: nodesRef.current.map(n => ({...n, selected: false})),
        /* AUDIT-8 — copy edge `data` one level, matching the node branch above.
       Every current edge writer replaces `data` wholesale, so the alias was
       harmless; the copy makes that invariant ENFORCED rather than implicit —
       a future in-place patch of edge.data can no longer rewrite history. */
    edges: edgesRef.current.map(e => ({...e, data: {...(e.data as any)}, selected: false})),
        preset: presetId, legend: curBoard.legend,
      });
      setCurBoard(c => c ? {...c, name: saved.name, updatedAt: saved.updatedAt} : c);
      setBoardList(l => l.map(b => b.id === curBoard.id ? {...b, name: saved.name, updatedAt: saved.updatedAt} : b));
      flash(`Renamed to “${name}”`);
    } catch (err) {
      flash(`Rename failed: ${err?.message ?? 'unknown'}`);
    }
  }, [curBoard, flushSave, flash, presetId]);

  const doDuplicateBoard = useCallback(async () => {
    if (!curBoard) return;
    const name = `${curBoard.name} (copy)`;
    try {
      await flushSave();
      const doc = await boards.createBoard(name);
      const saved = await boards.saveBoard({
        id: doc.id, name,
        nodes: nodesRef.current.map(n => ({...n, selected: false})),
        /* AUDIT-8 — copy edge `data` one level, matching the node branch above.
       Every current edge writer replaces `data` wholesale, so the alias was
       harmless; the copy makes that invariant ENFORCED rather than implicit —
       a future in-place patch of edge.data can no longer rewrite history. */
    edges: edgesRef.current.map(e => ({...e, data: {...(e.data as any)}, selected: false})),
        preset: presetId, legend: curBoard.legend,
      });
      setBoardList(await boards.listBoards());
      applyBoard(saved);
      flash(`Duplicated to “${name}”`);
    } catch (err) {
      flash(`Duplicate failed: ${err?.message ?? 'unknown'}`);
    }
  }, [curBoard, flushSave, applyBoard, flash]);

  /** ITEM 6b — opens the designed destructive confirm. */
  const deleteBoard = useCallback(() => { setBoardDlg('delete'); }, []);

  const doDeleteBoard = useCallback(async (confirmed?: boolean) => {
    if (!curBoard || !confirmed) return;
    try {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = undefined;
      await boards.deleteBoard(curBoard.id);
      const list = await boards.listBoards();
      setBoardList(list);
      if (list.length) {
        const doc = await boards.getBoard(list[0].id);
        applyBoard(doc);
      } else {
        const doc = await boards.createBoard('Untitled');
        setBoardList(await boards.listBoards());
        applyBoard({...doc, nodes: [], edges: []});
      }
      flash('Board deleted');
    } catch (err) {
      flash(`Delete failed: ${err?.message ?? 'unknown'}`);
    }
  }, [curBoard, applyBoard, flash]);

  /** ITEM 6b — the dialog's ONE submit path for all THREE modes. Each branch is
   *  the body of the native prompt / confirm it replaces, verbatim apart from
   *  where its inputs now come from. Declared here (below the three workers)
   *  because it calls two of them — a `useCallback` cannot reference a `const`
   *  that has not been initialised yet, not even inside its dep array.
   *
   *  ROUND 3 — the CREATE branch is now a CALL, not a body: it hands the name and
   *  the (preset, templateId) seed to `createFromTemplate`, which is the single
   *  owner of board creation from a template. Both `r.seed` and the name are
   *  optional there, so this path and the gallery path run the same code.
   *
   *  ROUND 4 — this branch can ONLY be reached from the dialog's "Blank" row, so
   *  `r.seed` is always `null` in practice and the board comes out `custom`. The
   *  seeded form is what the gallery's route passes. */
  const onBoardDialog = useCallback((r: BoardDialogResult) => {
    setBoardDlg(null);
    if (r.kind === 'rename') { void doRenameBoard(r.name); return; }
    if (r.kind === 'delete') { void doDeleteBoard(true); return; }

    /* CREATE. 2026-09-17 — the type PICKER is gone; the neutral `Mixed` preset is
       the default. The stored `preset` string is still DATA: it drives edge
       defaults, auto-layout, the ERD table node and the C4 legend, so boards
       written before this change keep behaving exactly as they did.

       A chosen TEMPLATE decides the preset: the result carries a
       (preset, templateId) PAIR because a template BELONGS to a preset. Seeding
       a C4 template into a `custom` board would give it C4 nodes under Mixed's
       edge defaults. "Blank" carries no seed at all. (The old code hard-coded
       `custom` and then asked about `custom.templates[0]` — which does not exist,
       so the template question was unreachable and always answered "no".) */
    createFromTemplate({name: r.name, preset: r.seed?.preset, templateId: r.seed?.templateId});
  }, [createFromTemplate, doRenameBoard, doDeleteBoard]);

  // Close the boards popover on outside click / Escape.
  const boardsBtnRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!boardsOpen) return;
    const onDown = (e: MouseEvent) => {
      /* CONFIG-FIX (2026-10-22) — the popover is PORTAL'D to document.body, so
         it is NOT inside boardsBtnRef any more: a click inside it landed here,
         read as "outside", and closed the menu BEFORE the row's onClick ran —
         every row (open board, New board, Templates, Rename…) appeared dead.
         Exclude the portal'd popup itself from the outside test. */
      const t = e.target as Element | null;
      if (t?.closest?.('.boards-pop')) return;
      if (boardsBtnRef.current && !boardsBtnRef.current.contains(e.target as any)) setBoardsOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [boardsOpen]);

  return [boardDlg, setBoardDlg, tgOpen, setTgOpen, pendingBoardName,
    closeBoardDlg, newBoard, createFromTemplate, useTemplate, closeGallery,
    boardsMenuBtnRef, boardsPopPos, boardsPopClamp, switchPreset, openBoard,
    renameBoard, doRenameBoard, doDuplicateBoard, deleteBoard, doDeleteBoard,
    onBoardDialog, boardsBtnRef] as const;
}
