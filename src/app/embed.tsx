/* embed.tsx — the /embed route: a chrome-less renderer for iframe embedding.
 * Takes the SAME `#b=` payload the share link produces (the SAME decodeShare,
 * the SAME migrations) and shows ONLY the diagram — no toolbar, no sidebar,
 * no autosave, no boards API calls. A corrupt payload shows the SAME error
 * card the share view shows (ShareBanner, reused not forked).
 *
 * Mounted from a SECOND html entry (embed.html, chunks shared with the main
 * one); main.tsx decides on path === '/embed' behind a dynamic import. It
 * deliberately does NOT reuse the app's persistence/bootstrap machinery — an
 * embed never reads or writes the visitor's boards. (feature-map: same path) */
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  ConnectionMode,
  getViewportForBounds,
  useReactFlow,
  useStoreApi,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '../styles.css';
import type {BoardDoc} from '../board/boards';
import {migrateDoc} from '../board/boardMigrations';
import {ShareBanner} from '../components/ShareBanner';
import {nodeTypes, embedNodes} from './embedNodeTypes';
import {edgeTypes} from '../edges';
import {docBox, liveBox, num, type DocBox, type SizedNode} from './embedFit';

/** Read the share payload off the current URL. Null when absent. */
function embedPayload(): string | null {
  try {
    const h = location.hash;
    return h.startsWith('#b=') ? decodeURIComponent(h.slice(3)) : null;
  } catch { return null; }
}

type EmbedState =
  | {phase: 'decoding'}
  | {phase: 'error'; reason: string}
  | {phase: 'ready'; doc: BoardDoc; nodes: Node[]; edges: Edge[]};

/* The fit options every path shares: minZoom far below the store's clamp so an
   extreme board is never clamped back into clipping; maxZoom 1 keeps a small
   board from blowing up to fill the frame. */
const FIT = {padding: 0.25, minZoom: 0.05, maxZoom: 1} as const;

/* WHY this fit exists at all (measured on the pre-fix trees): a frame the host
   has not composited suspends rAF AND ResizeObserver, so RF's queued fit is
   a silent no-op — the viewport stayed scale(1) with 6 nodes at 290x990 in an
   800x450 frame, even after the thaw. rf.fitView is banned here too: its
   getFitViewNodes DROPS unmeasured nodes, and a fit over the partial set is
   permanent (measured: scale(0.552), 6th node clipped, nothing re-ran). So the
   fit computes its OWN bounds over the store's nodes (measured first, the
   doc's declared sizes as the fallback — no node is ever dropped) and writes
   the viewport synchronously.
   EMBED-FIT-ORIGIN: and the re-fit is a store SUBSCRIPTION, not a capped poll.
   The poll keyed on the measured COUNT, so any SIZE change after its ~4.3s cap
   (a font swap settling late in a cold cross-origin partition, an auto-grow
   re-measure, a late host reflow) kept the stale viewport forever — measured,
   +200px at 7.5s left the 6th node 28px through the frame's bottom edge
   (harness f13, RED on d6e6696). The subscription keys on the count AND the
   union box; the fitView PROP is gone: one zoom authority, idempotent. */
function EmbedFlow() {
  const [state, setState] = useState<EmbedState>({phase: 'decoding'});
  const shellRef = useRef<HTMLDivElement | null>(null);
  const rf = useReactFlow();
  /* The fit reads the store's nodeLookup (INTERNAL nodes: `measured` +
     `internals.positionAbsolute`), NOT rf.getNodes() — that returns the
     user-shaped nodes, which carry neither. */
  const store = useStoreApi();
  const liveNodes = useCallback((): SizedNode[] =>
    [...store.getState().nodeLookup.values() as unknown as Iterable<SizedNode>], [store]);

  /* Write ONE viewport from a box. False when the frame has no size yet (an
     iframe the host has not laid out), so a later attempt can land it. */
  const applyBox = useCallback((box: DocBox | null): boolean => {
    const shell = shellRef.current;
    if (!shell || !box) return false;
    const r = shell.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    void rf.setViewport(getViewportForBounds(box, r.width, r.height,
      FIT.minZoom, FIT.maxZoom, FIT.padding));
    return true;
  }, [rf]);

  /* The MEASURED fit — the refinement, never the correctness. It runs after
     the doc's own viewport is on screen and re-derives from the store's live
     nodes (measured ?? persisted ?? kind default — see liveBox). No rf.fitView
     anywhere: one zoom authority, written through rf.setViewport. */
  const fit = useCallback(() => { applyBox(liveBox(liveNodes())); }, [applyBox, liveNodes]);

  /* The ONE decode+apply path (GOBI-SHARE-FIX): the mount decode and every
     hashchange route through it. The SAME decoder every door uses — never a
     local parser. */
  const applyEmbed = useCallback(async (payload: string) => {
    try {
      const mod = await import('../share');
      const res = await mod.decodeShare(payload);
      if (res.ok === false) { setState({phase: 'error', reason: res.reason}); return; }
      const doc = migrateDoc(res.board);
      setState({
        phase: 'ready', doc,
        nodes: embedNodes(doc.nodes),
        /* GoblinEdge reads its read-only flag from edge data (FB-L): thread
           it the same way, so an embedded edge never opens its label editor
           and paints no bend affordances. */
        edges: doc.edges.map(e => ({...e, selected: false, data: {...(e.data ?? {}), readOnly: true}})),
      });
    } catch { setState({phase: 'error', reason: 'network'}); }
  }, []);
  /* (applyEmbed has [] deps — stable — the listener calls it directly.) */

  /* Mount decode AND the address-bar re-decode, one effect — the same contract
     as the share view, minus the exits. One listener, removed on unmount. */
  useEffect(() => {
    const onEmbedHash = () => {
      const payload = embedPayload();
      if (payload === null) { setState({phase: 'error', reason: 'missing'}); return; }
      void applyEmbed(payload);
    };
    onEmbedHash();
    window.addEventListener('hashchange', onEmbedHash);
    return () => window.removeEventListener('hashchange', onEmbedHash);
  }, [applyEmbed]);

  /* THE FIRST VIEWPORT IS ARITHMETIC, NOT MEASUREMENT (EMBED-FIT-TIEBREAK).

     THE DEFECT (measured on 0911c57): the fit's box came from the store's
     live nodes, so a node with no persisted size contributed NOTHING until
     React Flow measured it. In a frame the host has not composited (rAF and
     ResizeObserver both suspended) nothing measures, `liveBox` returns the
     partial set, and setViewport writes it: measured translate(305px,177.5px)
     scale(1) — a ONE-NODE box — with 4 of 6 nodes painted outside an 800x450
     frame. Same class as rf.fitView's measured-only filter, one layer up.

     THE RULE: the viewport the reader sees first is computed from the DOC —
     positions plus a size per node (persisted width/height or style, else the
     palette's own default for that kind in src/layout/nodeSizes.ts, never an
     invented number). No measurement, no rAF, no ResizeObserver: this runs in
     a LAYOUT effect, so the transform is on the element before paint. The
     measured fit below is a REFINEMENT (a late font swap, an auto-grow), never
     the thing correctness depends on. */
  useLayoutEffect(() => {
    if (state.phase !== 'ready') return;
    applyBox(docBox(state.doc.nodes as unknown as SizedNode[]));
    /* state.doc changes identity on every decode — mount and hashchange. */
  }, [state.phase === 'ready' ? state.doc : null, applyBox]);

  /* EMBED-FIT-ORIGIN — the re-fit is EVENT-DRIVEN, not a ladder of guessed
     timeouts. The fitView PROP ran ONCE against whatever container the frame
     had at that moment (an iframe revealed from display:none measured 0x0 →
     translate(-19px,-119.5px) scale(0.2), only the top node visible), and the
     poll that replaced it keyed on the measured COUNT with a ~4.3s cap — so
     any SIZE change after the cap kept the stale viewport forever (see the
     WHY block near FIT). The signature below carries the measured count AND
     the union box, so ANY late measurement OR size change re-fits; the
     subscription costs a Map walk per store update and never expires.
     document.fonts.ready is the one extra nudge: a font swap can land without
     moving a box this frame, and re-running the fit is idempotent. */
  useEffect(() => {
    if (state.phase !== 'ready') return;
    const signature = () => {
      const nodes = liveNodes();
      const box = liveBox(nodes);
      const measured = nodes.filter(n => num(n.measured?.width) && num(n.measured?.height)).length;
      return `${nodes.length}|${measured}|${
        box ? [box.x, box.y, box.width, box.height].map(v => Math.round(v)).join(',') : '-'}`;
    };
    fit();
    let prev = signature();
    document.fonts?.ready.then(() => fit()).catch(() => {});
    const unsub = store.subscribe(() => {
      const next = signature();
      if (next !== prev) { prev = next; fit(); }
    });
    return unsub;
    /* state.nodes changes identity on every decode — mount and hashchange. */
  }, [state.phase === 'ready' ? state.nodes : null, fit, liveNodes, store]);

  /* When the FRAME itself resizes (the 0x0-at-load case landing at 800x450, a
     host reflow), the same fit runs again — rAF-debounced, skipping zero-size
     and no-change frames. Fit is the only zoom authority, so this can never
     fight a user zoom. */
  useEffect(() => {
    const el = shellRef.current;
    if (!el || state.phase !== 'ready' || typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    let last = '';
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const key = `${Math.round(r.width)}x${Math.round(r.height)}`;
      if (r.width < 2 || r.height < 2 || key === last) return;
      last = key;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    });
    ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [state.phase, fit]);

  /* Nothing is clickable in an embed: a click must not look like it did
     something (elementsSelectable false already suppresses selection). */
  if (state.phase === 'decoding') {
    return <div className="embed-shell" data-embed="decoding" />;
  }
  if (state.phase === 'error') {
    /* EMBED-DOOR — a MISSING payload is not corruption: it is the empty door,
       and it teaches (the ShareBanner 'empty' variant). Everything else keeps
       the SAME error card the share view shows. */
    return (
      <div className="embed-shell">
        {state.reason === 'missing'
          ? <ShareBanner mode="empty" boardName="" onEditCopy={() => {}} onOpenApp={() => {}} />
          : <ShareBanner mode="error" boardName="" reason={state.reason} onEditCopy={() => {}} onOpenApp={() => {}} />}
      </div>
    );
  }

  return (
    <div className="embed-shell" ref={shellRef}>
      <ReactFlow
        nodes={state.nodes}
        edges={state.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        proOptions={{hideAttribution: true}}
        /* READ-ONLY, review-mode style: React Flow's OWN props, widened
           panning — the same contract as the share view, minus every exit. */
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesReconnectable={false}
        selectionOnDrag={false}
        panOnDrag={true}
        deleteKeyCode={null}
        connectionMode={ConnectionMode.Loose}
        /* EMBED-FIT-ORIGIN — NO fitView prop: RF's internal queued fit is a
           SECOND zoom authority that can fire late (its getFitViewNodes
           drops unmeasured nodes — the EMBED-FIT-REAL clobber), so the
           effect above is the only fitter, first frame and every re-fit. */
        minZoom={0.05}
        maxZoom={2.5}
        zoomOnDoubleClick={false}
        /* EMBED-FIT — no zoom inputs: the frame fits the diagram, the reader
           pans. A wheel over an embedded blog iframe must scroll the HOST
           page, not hijack it into a zoom nothing can undo (the fit re-runs
           and would snap it back anyway). */
        zoomOnScroll={false}
        zoomOnPinch={false}
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={32} size={2} />
      </ReactFlow>
    </div>
  );
}

/** The /embed route's exported mount: call from a #embed root. */
export function mountEmbed(root: HTMLElement) {
  /* Lazy React import keeps the embed entry out of the main chunk; the
     ReactFlowProvider is what the re-fit effects' useReactFlow needs. */
  void import('react-dom/client').then(({createRoot}) => {
    createRoot(root).render(
      <ReactFlowProvider>
        <EmbedFlow />
      </ReactFlowProvider>,
    );
  });
}
