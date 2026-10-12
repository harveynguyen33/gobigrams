# Shared brief — Diagram Studio multi-diagram-type research

## The target app (what we are improving)
`/home/harvey/projects/tech-goblin/lab/diagram-studio` — a standalone, generic, dark-themed
node-based diagram editor. Stack: React 19 + Vite 5 + `@xyflow/react` v12 + TypeScript, lucide-react,
html-to-image. No backend yet (boards persist as JSON via a Vite dev middleware). Intended to be
**shared with other users eventually** → keep everything generic, self-explanatory, English.

**Today it only draws ARCHITECTURE diagrams.** What exists:
- 9 shapes (`src/shapes.tsx`): `service, database, queue, external, actor, storage, gateway, group, note`
  (each a `ShapeFrame` = kicker / title / sub / metric + a lucide icon, per-shape accent colour).
- Custom edge `src/GoblinEdge.tsx`: path types bezier / smoothstep / step / straight, inline
  double-click label edit, flow animation modes `none | dots | dash | pulse | icon | event`
  (SMIL `animateMotion` payloads along the real path, `flowCount`/`flowDuration` props).
- NodeResizer on all shapes, subflows (parent/child + `group` shape), dagre auto-layout with a CSS
  re-layout transition, helper/snap lines, snap-to-grid (16px), context menus (node/edge/pane),
  edge reconnect, cycle prevention, multi-board persistence + 800ms debounced autosave,
  PNG/SVG/JSON export + JSON import, 8-step onboarding tour + self-ticking checklist,
  hover choreography (hover edge → "electric" + endpoint pulse; hover node → light all connected
  edges + peers), a ref-counted perf guard that hides animated payloads during pan/zoom/drag,
  glow handles, and a "post-it" look on `actor`/`note` only.
- Design tokens (`src/styles.css`): `--bg #0b0b0d · --surface #131316 · --elevated #1a1b1f ·
  --border #26272c · --border-strong #33343a · --fg #e8e8ea · --dim #8a8a92 · --acc #f54e00`
  (brand, one CTA) · `--sel #3b82f6` (selection) · `--green #4ade80`. **Dark only today.**

## Harvey's goal (verbatim intent)
> "Mục tiêu của tôi không chỉ vẽ diagram cho architecture mà có khả năng vẽ flow chart, db diagrams,...
> tôi muốn có khả năng tất cả hoặc chọn type mẫu sẵn cho từng loại diagrams giúp tôi flexible hơn
> (Nhớ có mode dark và light or các mode thú vị)"

So: (1) support MANY diagram types — architecture, flowchart, ERD/database, and more (mindmap,
sequence, network/cloud, UML-ish, ...); (2) offer ready-made TYPE PRESETS/TEMPLATES per diagram type
(or let the user blend them); (3) add light mode + dark mode + other interesting themes.

## The showcase (source list)
https://reactflow.dev/showcase — the full list of apps (incl. open-source repos) is saved at
`/home/harvey/.hermes/cache/web/reactflow.dev-25e3206c57.md` (778 lines, complete page).
Notable entries relevant to us: Ameliorate (flowchart builder, OSS), Docugram (docs→flowcharts),
VisualFlows (sitemap/flowchart), ChartDB (OSS DB diagrams editor), Liam ERD (OSS ER→diagram),
DBDraw (OSS DB schema), Prismaliser (Prisma schema visualiser, OSS), TSdiagram (TS object relational
diagrams), Hubql / Datadef / Datascale (data-model viz), Heuristica + MindSnap + Traverse (mind maps),
Dify / LangFlow / Flowise / Flow-Like / Dafthunk / Waldiez / Agentok / ToolJet (AI workflow builders),
Typeform logic map, OneSignal Journeys, Datablocks, n8n-style, CircuLearn (logic circuits),
Vestige (audio modular synth), Bit Cloud (dependency graph), Flojoy, OTelBin, OpenMetadata.

## Rules for every subagent
- **Evidence-based**: read the actual live app and/or its OSS source; cite a URL (and line for code)
  for every claim. Use web_search / web_extract; the local showcase file for the list. If a page is
  bot-blocked, use the `blocked-page-recovery` approach (Camoufox etc.) — do not give up silently.
  A shallow clone (`GIT_TERMINAL_PROMPT=0 git clone --depth 1 <url>`) into /tmp is fine for OSS repos.
- **Be honest**: if a feature is not actually interesting or is a bad fit for a generic dark/light
  editor, say so. Do not pad the report with stock features.
- **Large clones are ALLOWED, but budget them.** Disk is 100 GB now. Cloning a big repo is fine when
  it genuinely helps — but: (a) before cloning anything you expect to exceed ~500 MB, note the projected
  size; (b) if a clone (or your combined /tmp usage) reaches **GB scale, STOP and report it to the
  orchestrator/Harvey before continuing** — that is the hard signal to check space; (c) check
  `df -h /` before and after every clone, (d) DELETE every clone when the report is done, (e) prefer
  `--depth 1 --filter=blob:none --sparse` and cherry-pick only the files you need. The 2026-09-14
  disk-full crash happened because clones filled a 30 GB root with no check and no cleanup — the fix
  is checking + cleaning + reporting at GB scale, not avoiding clones.
- **Map every finding to Diagram Studio**: mark it ADOPT / ADAPT / SKIP with a one-line reason, tied to
  the current shape list / tokens / features above. Concrete, not generic advice.
- **English** artifacts. Do NOT modify any code in the project — research only.
- Output a markdown report to `/home/harvey/diagram-studio-research/<your-file>.md` AND summarize
  the key findings in your final answer.
