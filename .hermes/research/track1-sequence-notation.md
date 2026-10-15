# Sequence Diagram Research — Track 1: Notation + Standards

Sources (all fetched, verified):
- https://www.uml-diagrams.org/sequence-diagrams.html
- https://www.uml-diagrams.org/interaction-message.html
- https://www.uml-diagrams.org/sequence-diagrams-combined-fragment.html
- https://sparxsystems.com/resources/tutorials/uml2/sequence-diagram.html
- https://www.drawio.com/docs/diagram-types/uml/sequence-diagrams/
- https://plantuml.com/sequence-diagram
- https://mermaid.js.org/syntax/sequenceDiagram.html
- https://mermaid.ai/open-source/syntax/sequenceDiagram.html
- https://www.websequencediagrams.com/examples.html
- https://flowova.ai/blog/sequence-diagram-guide
- https://macmdviewer.com/blog/mermaid-sequence-diagram-guide
- https://www.geeksforgeeks.org/system-design/unified-modeling-language-uml-sequence-diagrams/
- https://schematex.js.org/examples/sequence-combined-fragments-gallery
- https://www.cse.lehigh.edu/~glennb/oose/ppt/06SystemSequenceDiagrams.ppt (binary; SSD concept confirmed via search desc only)

## 1. Notation element inventory (UML 2.5.1)

### Essential (core, must-have)
| Element | Geometry | Levels |
|---|---|---|
| Lifeline head (system/object) | white rectangle w/ name, often `name:Class` | S1 S2 S3 |
| Lifeline (stem) | vertical dashed line downward | S1 S2 S3 |
| Lifeline head (actor) | stick figure above rectangle | S1 (S2) |
| Synchronous message | solid line, FILLED arrowhead | S1 S2 S3 |
| Reply/return message | dashed line, open (thin) arrowhead | S1 S2 S3 |
| Asynchronous message | solid line, OPEN arrowhead | S2 S3 |
| Self-message | arrow loops out+back to same lifeline, nested activation | S2 S3 |
| Activation bar (execution specification/occurrence) | narrow tall rectangle overlaid on lifeline; nests for recursion | S2 S3 (optional S1) |
| Note | dog-eared rectangle, attached left/right/over | all |
| Combined fragment frame alt | solid-outline rectangle, pentagon label top-left w/ "alt"; dashed divider between operands; guard `[cond]` per operand | S2 S3 |
| Combined fragment opt | same frame, label "opt", single operand w/ guard | S2 S3 |
| Combined fragment loop | same frame, label "loop" + optional `min,max` bounds + guard | S2 S3 |
| Combined fragment par | same frame, label "par"; dotted dividers between parallel operands | S3 |
| ref (interaction occurrence) | frame labeled "ref" top-left, referenced diagram name center | S2 S3 |
| Create message | dashed line, open arrowhead, points at CREATED lifeline's head placed at that y-position | S2 S3 |
| Destroy + destruction occurrence | message to lifeline; lifeline terminates in an X at that point | S3 |
| Divider/separator | horizontal band `== Text ==` splitting diagram into phases | S2 S3 |
| autonumber | sequential numbers prefixed to messages | S2 S3 |

### Nice-to-have
| Element | Geometry | Levels |
|---|---|---|
| break fragment | frame "break"; replaces rest of enclosing fragment when guard true | S3 |
| critical region | frame "critical", nested inside par | S3 |
| strict / seq | frames imposing strict/weak ordering | S3 |
| neg / assert / ignore / consider | frames for invalid/valid-only/filtered traces (test/protocol specs) | S3 |
| gate | small square on fragment frame edge; message endpoint off-fragment | S3 |
| found / lost message | solid arrow with filled black circle at the UNKNOWN end (found=start circle, lost=end circle) | S3 |
| duration constraint + sloped message | slanted message line; `duration` bracket annotation | S3 |
| state invariant | rounded-end rectangle (stadium) pinned on a lifeline | S3 |
| continuation | stadium shape stretching across lifelines inside alt operands | S3 |
| coregion | square brackets segment on a lifeline = inline par | S3 |
| delay / elapsed time | vertical ellipsis `...` with text (PlantUML `...5 minutes later...`) | S2 S3 |
| part decomposition | second lifeline from same head ("ref" style breakdown) | S3 |
| box (participant grouping) | translucent rectangle grouping several lifelines (Mermaid `box`) | S2 |

## 2. draw.io shape inventory (UML + UML 2.5 libraries)
Per drawio.com docs, the sequence-relevant shapes are named:
- Lifelines: several lifeline types (head variants), lifeline head shape is changeable; "Destruction" shape (UML lib) / "Destruction Occurrence Specification" (UML 2.5 lib)
- "Activation" shape (drops onto lifeline, resizable start/end)
- Messages: "Synchronous Invocation" (spawns activation to the right), "Callback" (activation to the left), "Self Call", "Message", "Message Return", "Found Message"
- "Frame" shape (combined fragment; draw dashed dividers inside with General-library dashed lines)
- "Comment" shape (notes), "Diagram" shape (optional overall interaction frame)
- Labels: guards in square brackets `[value > $1000]`, role names `: Customer`, dotted message numbering `1.3: searchByItem(itemName)`
Note: draw.io offers NO generic "sequence tool" — it's flat shapes + fixed connectors. Every web editor checked (Excalidraw, tldraw) has no native sequence mode; text-to-diagram tools (PlantUML/Mermaid/WebSequenceDiagrams/Schematex) are the main alternative UX.

## 3. Mermaid sequenceDiagram cheat sheet (v11/12)
```
sequenceDiagram
  autonumber
  actor U as User
  participant API as Public API
  participant DB@{ "type": "database" } as User DB   // types: actor/participant/boundary/control/entity/database/collections/queue
  box Aqua Group Name
    participant X
  end
  U->>API: solid + filled arrowhead (sync)
  API-->>U: dashed + filled arrowhead (reply)
  U-)API: solid + open arrowhead (async)
  API--)U: dashed + open arrowhead (async reply)
  U->>API: no-arrowhead variants: -> and -->
  A-x B / A--x B: cross at end (lost/failed)
  <<->> / <<-->>: bidirectional (v11+)
  activate API ... deactivate API   // or shorthand A->>+B / B-->>-A (stackable)
  Note right of API: text
  Note over U,DB: spans two lifelines
  alt guard / else guard / end
  opt guard / end
  loop Every minute / end
  par [A] ... and [B] ... end     (nestable)
  critical Action ... option Circumstance ... end
  break ... end / rect rgb(r,g,b) ... end
  create participant B / create actor D as Donald  (before message; only recipient)
  destroy Carl  (must be followed by destroying message, e.g. A-x Carl)
  (v11.12.3+: half-arrows -\|, -\|/, central connections A->>()B)
```
Config: `mirrorActors`, margins, fonts via `mermaid.sequenceConfig`.

## 4. PlantUML sequence cheat sheet
```
@startuml
title / header / footer
actor Bob            "actor" (stick/awesome/hollow) vs "participant" (rectangle)
participant "Long Name" as B
participant types: actor, boundary, control, entity, database, collections, queue
autonumber [start [inc]] ["format"]   autonumber stop/resume; 1.1.1 hierarchical
Bob -> Alice : sync (default filled head)
Bob ->> Alice : thin head; Bob --> Alice : dashed reply; Bob ->o, <->, bidirectional
Bob ->x Alice : lost message; half arrows Bob -\ Alice (bottom) / Bob //-- (top)
Bob -[#red]> Alice : colored arrow
activate A / deactivate A / destroy C ; return label  (returns to last activation)
autoactivate on ; shorthand: alice -> bob ++ : hello   bob -> george ** : create   bob -> george !! : delete
alt/else, opt, loop N times, par/and, break, critical, group Label [secondary]
== Divider ==
note left/right (of msg), note left of/right of/over A[, B] [, across], hnote (hexagon), rnote (rect)
ref over Alice, Bob : init
... delay ... ; ||| spacing / ||45||
[-> A / A ->] / [o->, x-> : incoming/outgoing, found/lost ends ; ?-> short
create Other (before first message to it) ; newpage (split pages)
@enduml
```

## 5. WebSequenceDiagrams note
Accepts both Mermaid (`sequenceDiagram` keyword) and PlantUML (`@startuml`) syntax; unsupported features silently mapped to closest equivalent — evidence that a shared core subset is practical for round-trip import/export. Note their arrow semantics INVERT UML: `->` = filled head, `->>` = open head (Mermaid: `->>` = filled/sync). Import must normalize by style, not glyph.

## 6. Recommended 3 LEVELS (mirroring C4 levels philosophy)

**S1 — System Sequence Diagram (SSD)** (context level; Larman's term)
- Who: actors (stick figures) + the system as ONE black-box lifeline
- What: sync/async messages + replies crossing the system boundary, ordering, guards for alt paths
- Excludes: internal lifelines, activations, most fragments (opt/alt ok), notes
- Analogue: C4 L1/L2 — treats system as a single participant

**S2 — Component/Service Interaction** (component level)
- Who: services/components/databases as lifelines (typed heads: service, database, queue)
- What: full message set (sync/async/reply/self), activations, alt/opt/loop/par, create/destroy, dividers, autonumber, notes, ref frames
- Excludes: protocol minutiae (gates, lost/found, neg/assert, timing)
- This is the default preset; ~90% of real-world usage (API design, microservice flows, auth flows — flowova + macmdviewer both document this as primary use)

**S3 — Detailed Protocol / Object Interaction** (protocol level)
- Who: objects (`name:Class` heads), boundary/control/entity stereotypes
- What: everything in S2 plus break/critical/strict/seq/neg/assert, gates, lost/found messages, duration constraints + sloped messages, state invariants, continuations, coregions, part decomposition, hierarchical message numbering (1.3.2)

## Mapping to existing codebase
- New DiagramType `'sequence'` in src/palette.ts union
- New SequenceLevel = 'ssd' | 'component' | 'protocol' (mirrors PresetId pattern; presets: sequence-ssd / sequence-component / sequence-protocol in PRESETS record + LIBRARY)
- Palette categories: Lifelines (actor/person, system, object, database/queue typed), Bars (activation), Messages (sync, async, reply, self, found, lost, create, destroy), Fragments (alt, opt, loop, par, break, critical, ref), Annotations (note, divider, delay, state invariant, duration)
- Fragment pentagon label = small pentagon shape top-left of frame, text = operator name
- goblin-node kinds won't fit messages; sequence needs edge-based message rendering (arrowhead style from message kind) + frame container nodes
