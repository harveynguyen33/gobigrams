/* useExportActions.ts — ROUND BN-2: the export cluster moved out of App()
 *  verbatim (mountThemed, the ROUND BJ/AZ/AY export builders, the ROUND C
 *  probe seam effect and the AQ21 Mermaid-import effect). Behaviour-neutral:
 *  bodies are byte-identical except the Mermaid import's id-mint, which calls
 *  the `setNextId` parameter (App owns the module-level `idc` counter).
 *  THE LAZY THUNKS STAY LAZY: exportSvg/exportPng/textOutline/textOutlineHb/
 *  fontFiles/printView are loaded ONLY through dynamic import() inside this
 *  hook — never statically imported here or anywhere (the ROUND BJ lazy
 *  chunk must survive; round-ay harnesses prove it).
 *  buildSvg's svg-string download sites (the menu buttons and the keyboard
 *  shortcut) stay in App — they read 30+ states — and call this hook's
 *  builders through the returned tuple. No context. */
import {useCallback, useEffect, useRef} from 'react';
import type * as React from 'react';
import type {Node, Edge, ReactFlowInstance} from '@xyflow/react';
import {readToken, tokensFor, EXPORT_TOKENS} from './theme';
import {mermaidToGraph} from './mermaid';
import type {ExportNode, ExportEdge, ExportInput, SvgMeasurer} from './exportSvg';
import type {OutlineShaper} from './textOutline';

/* Lazy thunks, verbatim from App.tsx's module scope — dynamic imports ONLY
   (ROUND BJ; the round-ay harnesses assert no static import appears). */
const exportSvgLazy = (): Promise<typeof import('./exportSvg')> => import('./exportSvg');
const exportPngLazy = (): Promise<typeof import('./exportPng')> => import('./exportPng');
const textOutlineLazy = (): Promise<typeof import('./textOutline')> => import('./textOutline');
const textOutlineHbLazy = (): Promise<typeof import('./textOutlineHb')> => import('./textOutlineHb');
const fontFilesLazy = (): Promise<typeof import('./fontFiles')> => import('./fontFiles');
const printViewLazy = (): Promise<typeof import('./printView')> => import('./printView');

/* Positional parameters, not an opts object (AGENTS.md perf ratchet). */
export function useExportActions(
  wrap: React.RefObject<HTMLDivElement | null>,
  rf: ReactFlowInstance | null,
  theme: string,
  nodes: Node[],
  edges: Edge[],
  pngScale: number,
  pngPad: number,
  curBoard: {name: string} | null,
  pushHistory: () => void,
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
  bumpHist: (fn: (v: number) => number) => void,
  flash: (msg: string) => void,
  tickTask: (id: 'node' | 'edge' | 'label' | 'move' | 'export' | 'board') => void,
  readNextId: () => number,
  setNextId: (n: number) => void,
) {

  /* AQ21-H — RE-THEME IN THE DOCUMENT. Serializing tokens can't fully
     reproduce a theme switch: some styles (text colour mixers, shadows,
     pseudo-elements, theme-scoped rules) resolve at paint time against the
     LIVE document theme. So both builders now mount the clone OFFSCREEN under
     `data-theme=<target>` and let the real stylesheet style it — identical
     mechanics to switching Appearance, without touching the visible board. */
  /* AR-4 — identity-stable so the export modal's preview effect does not
     re-fire on unrelated App re-renders: the builders used to be plain consts
     re-created every render (and passed inline to <ExportModal>), so ANY App
     re-render invalidated the effect deps [.., buildSvg, buildPng, ..] and
     rebuilt the preview. Every function these builders read is itself a
     useCallback now, so their deps are the honest reactive set. */
  const mountThemed = useCallback((source: HTMLElement, themeName: string): {host: HTMLDivElement; clone: HTMLElement; done: () => void} => {
    const host = document.createElement('div');
    host.setAttribute('data-theme', themeName);
    host.className = 'react-flow ds-flow-wrap';
    host.style.cssText = 'position:fixed;left:-100000px;top:0;width:1600px;height:1200px;overflow:hidden;pointer-events:none;';
    const clone = source.cloneNode(true) as HTMLElement;
    clone.style.transform = 'none';
    host.appendChild(clone);
    document.body.appendChild(host);
    return {
      host, clone,
      done: () => host.remove(),
    };
  /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  /* AQ21 — parametrised builders. The modal and the one-click menu buttons
     share THESE; the difference is only defaults (live theme, full board). */
  /* ROUND AR, AR-1 — buildSvg is now a THIN WRAPPER around `src/exportSvg.ts`:
     it mounts the themed offscreen clone ONLY to take measurements (text
     boxes, edge routes, the clone→model origin shift), resolves the token
     map for the target theme, and hands everything to the pure emitter.
     The emitted file is real SVG primitives — no foreignObject, no HTML —
     so image-context consumers (<img>, Quick Look, Figma, Illustrator)
     actually paint it. */
  /* ROUND C — the outline shapers for one export. The canvas paints rows in
   * TWO families (mono rows + sans rows); ONE harfbuzzjs face per distinct
   * resolved family, keyed by the EXACT family string the rows carry, so
   * the emitter's rowMarkup lookup is the row's own family. Rows whose
   * family has no resolvable bytes (no permission, non-matching stack)
   * keep <text> per row — the emitter's per-row fallback.
   * ROUND AZ — FILE-FIRST: bytes come from the committed subsets
   * (src/fontFiles.ts -> public/fonts/<slug>-variable.ttf), the variable
   * wght axis is instantiated per weight, and queryLocalFonts drops to a
   * LAST-RESORT for families the tree does not ship. The unresolved
   * families are RETURNED so the caller can surface a visible note (never
   * a silent no-op). */
  const buildOutlineShaper = useCallback(async (
    nodes: ExportNode[], edges: ExportEdge[], measure: SvgMeasurer,
  ): Promise<{ctx: NonNullable<ExportInput['outline']> | null; unresolved: string[]}> => {
    void edges;
    /* edge LABEL rows too: collect pairs off the nodes AND the measured
     * edge label fonts (ROUND-AR-DEFECT-1's portalled rows). */
    const pairs = new Map<string, {family: string; weight: number}>();
    let defaultFamily = measure.defaultFamily?.() ?? '';
    const collect = (fam: string | undefined, weight: number | undefined) => {
      const f = fam ?? defaultFamily;
      if (!f) return;
      const key = `${f}|${weight ?? 500}`;
      if (!pairs.has(key)) pairs.set(key, {family: f, weight: weight ?? 500});
    };
    for (const n of nodes) {
      const t = measure.text(n.el);
      collect(t?.family, t?.weight ?? 650);
      /* table column rows (t.rows.tcol) and the other measured rows carry
       * their own families — collect every distinct one */
      if (t?.rows) {
        for (const rf of Object.values(t.rows)) {
          if (rf?.family) collect(rf.family, rf.weight);
        }
      }
    }
    for (const e of edges) {
      const lf = measure.edgeLabelFont?.(e.id);
      collect(lf?.family, lf?.weight);
    }
    if (!pairs.size) return {ctx: null, unresolved: []};
    const shapers = new Map<string, OutlineShaper>();
    const unresolved = new Set<string>();
    /* one resolved face per (family, weight): the committed variable twins
     * cover every weight (instantiated per weight via set_variations), so
     * the cache key carries the weight. */
    const resolvedAt = new Map<string, OutlineShaper>(); // family|weight -> shaper
    const register = (k: string, shaper: OutlineShaper) => {
      if (k && !shapers.has(k)) shapers.set(k, shaper);
      const squeezed = k.replace(/\s+/g, ' ').trim();
      if (squeezed && !shapers.has(squeezed)) shapers.set(squeezed, shaper);
      const squeezedQuotes = squeezed.replace(/"/g, '');
      if (squeezedQuotes && !shapers.has(squeezedQuotes)) shapers.set(squeezedQuotes, shaper);
    };
    /* ROUND BJ — the shaper stack lives behind the lazy export chunk: fetch
     * the modules ONCE here, then use them synchronously below. */
    const [{makeShaper}, {localFontBytes}, {committedFontBytes}] = await Promise.all([
      textOutlineHbLazy(), textOutlineLazy(), fontFilesLazy(),
    ]);
    for (const {family, weight} of pairs.values()) {
      const pairKey = `${family}|${weight}`;
      const already = resolvedAt.get(pairKey);
      if (already) { register(family, already); continue; }
      /* FILE-FIRST: the committed variable subset */
      const committed = await committedFontBytes(family);
      let shaper: OutlineShaper | null = null;
      if (committed) {
        const key = `${committed.name}@${weight}`;
        shaper = await makeShaper(committed.bytes, key, weight);
      }
      /* LAST-RESORT: the queryLocalFonts API for a family the tree does
       * not ship (an opt-in ROUND W face at an unshipped weight) */
      if (!shaper) {
        const hit = await localFontBytes(family, weight);
        if (hit) shaper = await makeShaper(hit.bytes, `${hit.name}@${weight}`);
      }
      if (shaper) {
        resolvedAt.set(pairKey, shaper);
        register(family, shaper);
        const parts = family.split(',');
        for (let i = 2; i <= parts.length; i++) {
          register(parts.slice(0, i).join(',').trimEnd().replace(/,\s*$/, ''), shaper);
        }
        /* register the concrete family name itself too (a row measured
         * AFTER the font resolved can carry the concrete name) */
        register(committed?.name ?? '', shaper);
      } else {
        unresolved.add(family);
      }
    }
    if (!shapers.size) return {ctx: null, unresolved: [...unresolved]};
    /* the default face: the measurer's defaultFamily when IT resolved */
    const defaultShaper = defaultFamily ? shapers.get(defaultFamily) : undefined;
    return {ctx: {shapers, defaultShaper}, unresolved: [...unresolved]};
  }, []);

  /* ROUND AZ — the font-embed builder (§4): base64 woff2 @font-face inside
   * the exported SVG's <defs><style>, ONLY the families/weights the exported
   * scene paints, ONLY faces whose OS/2 fsType permits embedding (the guard
   * in fontFiles.ts — implemented, not assumed). The embedded faces are the
   * committed VARIABLE woff2 twins (one per family — a variable face with a
   * `font-weight: 100 900` descriptor covers every painted weight, so the
   * browser instantiates rather than us shipping per-weight base64 blobs).
   * The rows already carry their font-family/font-weight attributes, so the
   * SVG's own paint code needs NO change to consume the embed. */
  const buildFontEmbedCss = useCallback(async (
    nodes: ExportNode[], edges: ExportEdge[], measure: SvgMeasurer,
  ): Promise<{css?: string; bytes: number; refusals: string[]}> => {
    void edges; void nodes;
    /* ROUND BJ — fontFiles is behind the lazy export chunk. */
    const {committedFontBytes, embeddingRefusal} = await fontFilesLazy();
    /* the same pair-collection the outline shaper does (defaultFamily covers
     * both stacks once the AZ swap landed) — but here only the FAMILY set
     * matters: the variable face embeds once per family. */
    const families = new Set<string>();
    const defaultFamily = measure.defaultFamily?.() ?? '';
    const collectFam = (fam: string | undefined) => {
      const f = fam ?? defaultFamily;
      if (f) families.add(f);
    };
    for (const n of nodes) {
      const t = measure.text(n.el);
      collectFam(t?.family);
      if (t?.rows) for (const rf of Object.values(t.rows)) collectFam(rf?.family);
    }
    collectFam(undefined); /* the document default paints the unmeasured rows */
    const blocks: string[] = [];
    const refusals: string[] = [];
    let bytes = 0;
    /* de-duplicate families down to the SHIPPED faces (one embed per face) */
    const embedded = new Set<string>();
    for (const stack of families) {
      const committed = await committedFontBytes(stack);
      if (!committed || embedded.has(committed.name)) continue;
      embedded.add(committed.name);
      const refusal = embeddingRefusal(committed.fsType);
      if (refusal) { refusals.push(`${committed.name}: ${refusal}`); continue; }
      /* the WOFF2 twin (same subset, smaller): fetch + base64 */
      const woff2Url = stack.includes('JetBrains') && !stack.includes('Inter')
        ? '/fonts/jetbrains-mono-variable.woff2'
        : '/fonts/inter-variable.woff2';
      const face = committed.name.includes('JetBrains') ? 'JetBrains Mono' : 'Inter';
      if (embedded.has(`css:${face}`)) continue;
      embedded.add(`css:${face}`);
      try {
        const r = await fetch(woff2Url);
        if (!r.ok) { refusals.push(`${face}: woff2 fetch failed (${r.status})`); continue; }
        const buf = new Uint8Array(await r.arrayBuffer());
        bytes += buf.byteLength;
        let bin = '';
        const CHUNK = 0x8000;
        for (let i = 0; i < buf.length; i += CHUNK) {
          bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
        }
        const b64 = btoa(bin);
        blocks.push(
          `@font-face { font-family: '${face}'; font-style: normal; font-weight: 100 900; ` +
          `src: url(data:font/woff2;base64,${b64}) format('woff2-variations'); }`);
      } catch (e) {
        console.error('[fontEmbed] fetch failed:', woff2Url, e);
        refusals.push(`${face}: woff2 fetch threw`);
      }
    }
    if (!blocks.length) return {css: undefined, bytes, refusals};
    return {css: blocks.join('\n'), bytes, refusals};
  }, []);

  /* Dev note (measured under automation): the ROW families are stacks
   * ('ui-monospace, SFMono-Regular, …'). localFontBytes matches stack
   * parts against queryLocalFonts' response; on this Linux box the sans
   * stack's 'Roboto' part resolves (Roboto-Black etc.) while generic
   * keywords (ui-*, system-ui, monospace, sans-serif) correctly never
   * name a face. A stack that matches nothing keeps <text> per row. */

  const buildSvg = useCallback(async (o: {nodes: Node[]; edges: Edge[]; theme: string; outline?: boolean}): Promise<string> => {
    const el = wrap.current?.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!el || !rf) return '';
    const b = (rf as any).getNodesBounds(o.nodes) as {x: number; y: number; width: number; height: number};
    const pad = pngPad;
    void b; void pad; /* bounds + pad are derived inside the emitter from the node boxes */
    const eff = o.theme || theme;
    const pre = mountThemed(el, eff);
    try {
      const clone = pre.clone;
      /* scope: keep only the requested nodes + their edge children */
      const keep = new Set(o.nodes.map(n => n.id));
      const modelById = new Map(o.nodes.map(n => [n.id, n]));
      const cloneNodes = [...clone.querySelectorAll<HTMLElement>('.react-flow__node')];
      const exportNodes: ExportNode[] = [];
      for (const cn of cloneNodes) {
        const id = cn.getAttribute('data-id') ?? '';
        const model = modelById.get(id);
        if (!model) continue;
        const me = (model as any).measured;
        const st = (model as any).style;
        exportNodes.push({
          id,
          type: (model as any).type,
          position: {x: (model as any).position.x, y: (model as any).position.y},
          measured: me ?? null,
          style: st ?? null,
          data: ((model as any).data ?? null) as Record<string, unknown> | null,
          parentId: (model as any).parentId ?? null,
          el: cn,
        });
      }
      const modelEdges = new Map(o.edges.map(e => [e.id, e]));
      const exportEdges: ExportEdge[] = [];
      /* ROUND AR-2 — buildSvg must CARRY the label: the export pipeline
         reads `e.label` (the one storage), and this push is where the
         model edge becomes the export edge. Asserted live: without the
         field both painted labels vanished from the real export. */
      /* ROUND AU — the edge's LIVE clone element must ride along: the emitter's
         measurer (`edgePath`) reads the MEASURED route off
         `.react-flow__edge-path` inside the clone. `m.el` is always undefined
         on a model Edge (React Flow never sets it), so before this every edge
         fell to `stubEdgePath` — a straight centre-to-centre segment (the
         live smoothstep exported as `M 380,431 L 750,440.5`, all bends
         discarded). The clone element is looked up by the same data-id the
         nodes use. */
      const cloneEdgeById = new Map(
        [...clone.querySelectorAll<HTMLElement>('.react-flow__edge')]
          .map(ce => [ce.getAttribute('data-id') ?? '', ce]),
      );
      const exportEdgeOf = (model: unknown): ExportEdge => {
        const m = model as {id: string; source: string; target: string; label?: unknown; data?: Record<string, unknown> | null; el?: unknown};
        return {
          id: m.id, source: m.source, target: m.target,
          label: typeof m.label === 'string' && m.label ? m.label : undefined,
          data: m.data ?? null,
          /* the CLONE's edge element (never the model's): its path is drawn in
             flow coordinates, which is exactly the emitter's edge space. */
          el: cloneEdgeById.get(m.id) ?? undefined,
        };
      };
      for (const ce of clone.querySelectorAll<HTMLElement>('.react-flow__edge')) {
        const id = ce.getAttribute('data-id') ?? '';
        const model = modelEdges.get(id);
        if (!model) continue;
        exportEdges.push(exportEdgeOf(model));
      }
      /* let the real stylesheet apply to the offscreen mount before measuring */
      await new Promise<void>(res => requestAnimationFrame(() => requestAnimationFrame(() => res())));
      const tokens = eff === theme
        ? Object.fromEntries(EXPORT_TOKENS.map(t => [t, readToken(t, '#888')]))
        : tokensFor(eff, EXPORT_TOKENS);
      /* DEFECT-2: one measurer per export, with measureText for the wrap —
         disposed in the finally so the hidden measuring <svg> never leaks.
         ROUND-AR-DEFECT-1: the measurer gets the CLONE ROOT so it can read
         the portalled `.edge-label[data-edge-id]` rows the EdgeLabelRenderer
         paints outside each edge's own element. */
      /* ROUND BJ — domMeasurer comes with the lazy export chunk. */
      const {domMeasurer} = await exportSvgLazy();
      const measure = domMeasurer(() => clone);
      try {
        /* ROUND C — outline mode: when requested, build the outline shaper
         * ONCE per export from the rows' own families and hand it to the
         * emitter through ctx. ROUND AZ — FILE-FIRST (committed subsets,
         * no permission): an unresolvable family is surfaced VISIBLY via
         * the gobi:export-note event + __ds_outline_note — never a silent
         * no-op preview. */
        let outlineCtx: NonNullable<ExportInput['outline']> | undefined;
        if (o.outline) {
          const built = await buildOutlineShaper(exportNodes, exportEdges, measure);
          outlineCtx = built.ctx ?? undefined;
          (window as unknown as Record<string, unknown>).__ds_outline_map = outlineCtx?.shapers ?? null;
          (window as unknown as Record<string, unknown>).__ds_outline_note = outlineCtx
            ? (built.unresolved.length
              ? `outlined every family except: ${built.unresolved.join('; ')} (no committed bytes, no local-font match)`
              : undefined)
            : 'no font bytes available for any text family (no committed subset matched, no local-font match)';
          if (built.unresolved.length || !outlineCtx) {
            window.dispatchEvent(new CustomEvent('gobi:export-note', {
              detail: outlineCtx
                ? `Outline text: some families kept selectable text — ${built.unresolved.join('; ')}`
                : 'Outline text: no font bytes available for any text family — text stayed selectable.',
            }));
          }
        }
        /* ROUND AZ fix (orchestrator, measured live) — the embed belongs to the TEXT path, not the
         * outline path. Outlined glyphs ARE paths: they need no font at all, so embedding there only
         * bloated the file (measured: 318,713 B outlined with an embed against ~78 KB it needs).
         * Meanwhile the default export — the one Harvey sends to clients — carried NO @font-face, so a
         * viewer without Inter saw substitution, which is the exact problem ROUTE 1 exists to solve.
         * Embed only when text stays text, only the families the scene paints, only faces whose fsType
         * permits it. */
        const embed = o.outline
          ? {css: undefined as string | undefined, bytes: 0, refusals: [] as string[]}
          : await buildFontEmbedCss(exportNodes, exportEdges, measure);
        (window as unknown as Record<string, unknown>).__ds_embed_bytes = embed.bytes;
        (window as unknown as Record<string, unknown>).__ds_embed_css = embed.css;
        if (embed.refusals.length) {
          (window as unknown as Record<string, unknown>).__ds_embed_refusals = embed.refusals;
          window.dispatchEvent(new CustomEvent('gobi:export-note', {
            detail: `Font embed: skipped — ${embed.refusals.join('; ')}`,
          }));
        }
        /* ROUND BJ — exportSvgOf comes with the lazy export chunk (same
         * module the measurer came from; the promise is memoised by the
         * dynamic-import machinery, so this second await is free). */
        return (await exportSvgLazy()).exportSvgOf({
          nodes: exportNodes,
          edges: exportEdges,
          theme: eff,
          tokens,
          measurer: measure,
          pad: pngPad,
          outline: outlineCtx,
          fontEmbedCss: embed.css,
        });
      } finally {
        measure.dispose?.();
      }
    } finally {
      pre.done();
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [rf, theme, pngPad, mountThemed]);

  /* ROUND AY item 4 (OPTION B, spec §4) — buildPng is now TWO LINES: build the
     SVG (the same string the .svg download gets) and rasterise it. ONE painter
     per pixel class: the scene/emitter is the single source of the picture and
     the canvas merely scales it. The old DOM-clone path (themed clone + the
     AU-1 chrome strip + the AV fill fold + the AV icon inline + the BA paint
     walk + html-to-image's toPng) is REPLACED, not patched — chrome cannot
     appear because the scene never contains editor affordances, and every
     paint value arrives in the svgString as a literal. The pixel-diff gate
     (checks/fixtures/round-ay-png-before vs the new path) is the proof. */
  const buildPng = useCallback(async (o: {nodes: Node[]; edges: Edge[]; theme: string}): Promise<string> => {
    const svg = await buildSvg(o);
    if (!svg) return '';
    const eff = o.theme || theme;
    const bg = eff === theme
      ? readToken('--bg', '#0b0b0d')
      : tokensFor(eff, ['--bg'])['--bg'];
    /* ROUND BJ — rasterise comes with the lazy export chunk. */
    const {rasterise} = await exportPngLazy();
    return rasterise(svg, {scale: pngScale, bg});
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [theme, pngScale, buildSvg]);

  /* ROUND BI — the feedback dialog's screenshot helper reuses THIS export path
     verbatim (SVG emitter → rasterise, the same string the .png download gets):
     one painter per pixel class, no second renderer. It resolves a DATA URL and
     the pure clipboard module turns it into a Blob; App passes null when the
     board is empty, which is what makes the helper row disappear. */
  const boardPngForFeedback = useCallback(
    () => buildPng({nodes, edges, theme}),
    [buildPng, nodes, edges, theme],
  );

  /* ROUND C — the print PDF route (Harvey-approved route (i)): build the
   * SAME svg string the .svg download gets (theme/scope already baked by
   * the caller; outline rides `outline: true` — the modal's checkbox
   * reaches the print view through this flag), inline it in a print
   * window with a print stylesheet, and open the browser's dialog. */
  const printPdf = useCallback(async (o: {nodes: Node[]; edges: Edge[]; theme: string; outline?: boolean}): Promise<void> => {
    /* ORCHESTRATOR FIX (2026-10-22, Harvey: "dù không chọn Outline, PDF vẫn ra như khi chọn outline") —
     * this call hardcoded `outline: true`, so the print route ALWAYS outlined: the PDF carried glyph
     * paths and the text was never selectable, regardless of the checkbox. The checkbox is the only
     * thing that decides; the print view inherits whatever the modal shows. */
    const svg = await buildSvg({nodes: o.nodes, edges: o.edges, theme: o.theme, outline: !!o.outline});
    if (!svg) return;
    /* ROUND BJ — the print route comes with the lazy export chunk. */
    const {printSvgAsPdf} = await printViewLazy();
    printSvgAsPdf(svg, curBoard?.name || 'Gobigrams');
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [buildSvg, curBoard]);

  /* ROUND C — the probe seam: the harness drives the app's OWN build
   * path (not a re-implementation) to measure the outlined vs text
   * exports. Dev/test only; it reads nothing beyond the builders. */
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__ds_export =
      async (o: {board?: string; theme: string; outline: boolean}) => {
        try {
          const svg = await buildSvg({nodes, edges, theme: o.theme, outline: o.outline});
          return {svg, note: o.outline ? (window as unknown as {__ds_outline_note?: string}).__ds_outline_note : undefined};
        } catch (e) {
          return {error: String(e)};
        }
      };
    return () => { delete (window as unknown as Record<string, unknown>).__ds_export; };
  }, [buildSvg, nodes, edges]);

  // ---- import JSON ----
  const fileRef = useRef<HTMLInputElement>(null);

  /* AQ21 — the export modal's Mermaid import lands here. Fresh ids, grid
     layout. AS-3: the import is ADDITIVE (setNodes/setEdges append), so it is
     ONE undo entry: pushHistory() snapshots the pre-import graph (and clears
     `future`, the redo contract) BEFORE the append — a single Cmd+Z removes
     exactly the import, redo restores it. (The old code wiped history here,
     which was copied from the JSON import — but that path REPLACES the
     board; this one appends, so the reset destroyed undoable work.) */
  useEffect(() => {
    const h = (ev: Event) => {
      const parsed = (ev as CustomEvent).detail;
      if (!parsed) return;
      const {nodes: mmNodes, edges: mmEdges, nextId} = mermaidToGraph(parsed, readNextId());
      setNextId(nextId);
      pushHistory();
      setNodes(ns => [...ns, ...mmNodes]);
      setEdges(es => [...es, ...mmEdges]);
      bumpHist(v => v + 1);
      flash(`Imported ${mmNodes.length} nodes · ${mmEdges.length} edges from Mermaid`);
    };
    window.addEventListener('gobi:mermaid-import', h);
    return () => window.removeEventListener('gobi:mermaid-import', h);
  }, [flash, tickTask]);

  return [buildSvg, buildPng, boardPngForFeedback, printPdf, fileRef] as const;
}
