# SHARED BRIEF — Edge reshaping / movable waypoints (draw.io + Excalidraw + React Flow)

Date: 2026-09-18 · Status: v1
Output dir: `/home/harvey/diagram-studio-research/edges/`

## 1. GOAL

A tool called **Diagram Studio** (React 19 + Vite 5 + `@xyflow/react` v12) needs **edge reshaping**:
the user drags the MIDDLE of a connection to move/bend the line for looks, **without** changing which
shapes the ends attach to. Harvey (the owner) said:

> "chỗ line connection đang có thêm 2 Dot to để kéo connection nhưng ko cần thiết… ý tôi là thường khi bạn
> kéo 1 connect dài và như style steps or bezier, bạn thường sẽ có 1 vài dot ở giữa để bạn có thể kéo cái
> connection line đó ra vị trí khác cho đẹp => chứ k phải là đổi connect tới shape khác"

Then: **"bạn có thể tham khảo draw io ko. tôi nghĩ nó làm khoảng này rất tốt cho các loại line types"**
and **"also you can research excalidraw too"**.

So: **how do draw.io and Excalidraw implement movable edge waypoints across ALL their line types, and
what should Diagram Studio copy?**

This feeds a BUILD decision: which interaction model and which data model to implement.

## 2. WHAT DIAGRAM STUDIO ALREADY HAS (do not re-research these)

- Four path types via React Flow's generators, selected per edge by a `__type` field:
  `straight` → `getStraightPath`, `step` → `getSmoothStepPath({borderRadius:0})`,
  `smoothstep` → `getSmoothStepPath({borderRadius:12})`, else `getBezierPath`.
  Source: `src/GoblinEdge.tsx` (a custom edge component).
- **Already measured in React Flow's own types** (so treat as fact, but you may confirm):
  `GetSmoothStepPathParams` accepts `centerX` and `centerY` — a movable midpoint.
  `GetBezierPathParams` and the straight path accept **no** such parameter.
- Edge data today: `{shape?: string; offset?: 'center'|'start'|'end'}`.
- Reconnect (drag an END to another node) already exists and is wanted — it is a **different** feature.
  Do not propose replacing it.

## 3. RESEARCH QUESTION

**How do draw.io and Excalidraw let a user reshape an existing edge by dragging it, for every line type
they support — and what data model + interaction model should a React Flow app copy?**

Sub-questions:
1. **draw.io / diagrams.net** — the complete waypoint system: what a waypoint is in the model, how the
   user creates/moves/deletes one, how it behaves per line type (straight / orthogonal / curved /
   entity-relation / isometric), what snapping and reset exist, and any "drag the line itself" (not just
   a point) behaviour.
2. **Excalidraw** — how its arrows/linear elements are shaped: the `points` array model, how a user adds
   and drags a point, how endpoints bind to shapes (`startBinding`/`endBinding`), what happens when you
   drag the middle of a 2-point arrow, and how it differs from draw.io.
3. **React Flow implementation** — how real React Flow apps/libraries implement movable midpoints or
   waypoints (custom edge components, `centerX`/`centerY` for smoothstep, custom path math for bezier,
   where to store the offset, how to keep it undo-able and persisted).

## 4. SCOPE

- Time: current implementations. draw.io `dev` branch and Excalidraw `master` as of now; docs and source.
- Domain: edge/arrow routing and point editing in node-and-edge diagram editors only.
- **EXCLUDE**: shape/palette design (already researched separately), theming, collaboration/CRDT,
  performance of huge graphs, anything about labels' text editing.
- **EXCLUDE re-covering the draw.io LEFT SIDEBAR** — that was a previous research pass
  (`/home/harvey/diagram-studio-research/PALETTE-1-drawio.md`). Do not repeat it; you may read it only to
  avoid duplication.

## 5. WHAT I ALREADY KNOW (starting points — verify, don't trust)

- draw.io is built on **mxGraph**; the edge routing primitives are `mxEdgeStyle` (e.g. `Orthogonal`,
  `EntityRelation`, `ElbowConnector`), and edges carry `mxGeometry` with **`points`** and an
  `mxPoint`-based `sourcePoint`/`targetPoint`. `mxGeometry.relative` / `<Array as="points">` appear in the
  stored XML of routed edges.
- draw.io has an "Edit > Edit Style" dialog, a right-click "Edit Connection Points"/"Add waypoint"
  affordance, and waypoints snap to the grid.
- Excalidraw linear elements are `{type:'arrow'|'line', points:[[x,y],...]}` with
  `startBinding`/`endBinding` and a `focus`/`gap` on the binding. Endpoints bind to shapes; middle points
  are free.
- React Flow ships no generic waypoint UI in the OSS core (the "helper lines" / "pro" examples may have
  some) — **verify this**.

## 6. SOURCE REQUIREMENTS

- **Minimum 20 distinct sources** fetched and read, with URLs. This is the DEEP default.
- **Preference order: primary source code and official docs first.** For draw.io read the real files
  (`jgraph/drawio`, `mxgraph` sources, e.g. `mxEdgeStyle.js`, `mxGraph.js`, `mxGeometry`); for Excalidraw
  read the real package source (the `points`/binding types and the drag/point-edit handlers). Quote
  file + symbol. Blog posts and Stack Overflow are supporting evidence, not the foundation.
- Diversity: no more than ~40% of sources from a single domain. At least 6 primary (source-code or
  official-doc) sources.
- **Do NOT fabricate URLs.** Only list what you actually fetched. Mark anything unconfirmed
  `[UNVERIFIED]`.

## 7. DEPTH

- Deep. Analysis, not a summary. Compare the two tools **explicitly** and say where they disagree.
- Include what does **NOT** work well / known limitations in each tool (users complain about this area a
  lot — find the real complaints, e.g. draw.io waypoint fiddliness, Excalidraw's 2-point arrow behaviour).
- Every claim sourced. Unsupported analysis marked `[UNVERIFIED]`.

## 8. OUTPUT STRUCTURE (per child, into your OWN file)

```
# <Cluster> — <title>
## 0. Scope + what I read
## 1. The model (data structures, quoted from source)
## 2. The interaction (how the user does it, step by step)
## 3. Per-line-type behaviour (a table: line type -> how a waypoint behaves)
## 4. Known limitations / complaints
## 5. What is directly portable to a React Flow app  <- the actionable part
## 6. Sources (every URL, with what it evidenced)
## 7. Gaps / [UNVERIFIED]
```

## 9. CITATIONS

Inline `[n]` mapped to the numbered source list. Every factual claim sourced.

## 10. DEFINITION OF DONE

All sub-questions answered for your cluster; ≥20 sources total across the batch (each child should
contribute its share); nothing fabricated; saved to your assigned path under
`/home/harvey/diagram-studio-research/edges/`. If a gate fails, KEEP RESEARCHING — do not deliver partial.

## HARD RULES

- **Write your report to your OWN file** (assigned below) and **append progress as you go** — write a
  skeleton early, then fill it. A partial report on disk is a success; an empty file is a failure.
- **Never run `git clone` of a huge repo without checking disk first** (`df -h /`). Prefer reading files
  directly from GitHub's raw/blob URLs over cloning. draw.io is a big repo — do NOT clone it. If you must
  clone Excalidraw, use `--depth 1 --filter=blob:none` and `df -h /` before and after, and DELETE the
  clone when done.
- Respond in ENGLISH.
- No image analysis.
