/* embed.tsx — ROUND GOBI-S2: the /embed route. A chrome-less renderer for
 * iframe embedding anywhere: it takes the SAME `#b=` payload the share-link
 * produces (the SAME decodeShare, the SAME migrations) and shows ONLY the
 * diagram — no toolbar, no sidebar, no autosave, no boards API calls. A
 * corrupt payload shows the SAME error card the share view shows (ShareBanner
 * 'error', reused not forked).
 *
 * HOW IT IS MOUNTED: this is NOT App — vite builds a SECOND html entry
 * (embed.html) whose module graph shares chunks with the main one, so the
 * main chunk does not grow by a byte (harness E6). The mount decision lives
 * in main.tsx (path === '/embed' or '/embed.html') behind a dynamic import,
 * the round-bn2 lazy law.
 *
 * WHAT IT SHARES with the share view (src/useShareView.ts): the codec, the
 * migrations and the error card. What it deliberately does NOT reuse: the
 * app-wide persistence/bootstrap machinery — an embed must never read or
 * write the visitor's boards, so this component owns no board state at all.
 * (feature-map home: src/embed.tsx) */
import {useCallback, useEffect, useRef, useState} from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ConnectionMode,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './styles.css';
import type {BoardDoc} from './boards';
import {migrateDoc} from './boardMigrations';
import {ShareBanner} from './components/ShareBanner';
import {nodeTypes, embedNodes} from './embedNodeTypes';
import {edgeTypes} from './edges';

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

function EmbedFlow() {
  const [state, setState] = useState<EmbedState>({phase: 'decoding'});
  const fitted = useRef(false);

  /* The ONE decode+apply path (GOBI-SHARE-FIX): the mount decode and every
     hashchange route through it. The SAME decoder every door uses — never a
     local parser. */
  const applyEmbed = useCallback(async (payload: string) => {
    try {
      const mod = await import('./share');
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
  /* (applyEmbed has [] deps — stable — so the listener calls it directly.) */

  /* Mount decode AND the address-bar re-decode (GOBI-SHARE-FIX), one effect
     — the same contract as the share view, minus the exits. One listener,
     removed on unmount. */
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

  /* Nothing is clickable in an embed: selection would only paint state the
     embed cannot use, and a click must not look like it did something
     (elementsSelectable false already suppresses selection). */
  if (state.phase === 'decoding') {
    return <div className="embed-shell" data-embed="decoding" />;
  }
  if (state.phase === 'error') {
    return (
      <div className="embed-shell">
        <ShareBanner mode="error" boardName="" reason={state.reason} onEditCopy={() => {}} onOpenApp={() => {}} />
      </div>
    );
  }

  return (
    <div className="embed-shell">
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
        fitView={!fitted.current}
        fitViewOptions={{padding: 0.25, maxZoom: 1}}
        minZoom={0.2}
        maxZoom={2.5}
        zoomOnDoubleClick={false}
        zoomOnScroll
        zoomOnPinch
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={32} size={2} />
      </ReactFlow>
    </div>
  );
}

/** The /embed route's exported mount: call from a #embed root. */
export function mountEmbed(root: HTMLElement) {
  /* Lazy React import keeps the embed entry out of the main chunk. No
     ReactFlowProvider: the embed uses no useReactFlow hook, so the bare
     <ReactFlow> context is all it needs — one less module in the graph. */
  void import('react-dom/client').then(({createRoot}) => {
    createRoot(root).render(<EmbedFlow />);
  });
}
