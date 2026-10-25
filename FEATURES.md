# Feature list

What the goblin actually ships, by category. (The README stays for humans; this
list is for people deciding whether to adopt.)

## Canvas & shapes

- 60+ shapes across Basic, Flowchart, Data & storage, Architecture, Groups & boundaries
- Custom SVG shapes — drop any SVG file onto the palette to make it a node
- Tables and checklists as first-class nodes
- Drag, nudge (arrow keys), multi-select, marquee, align/distribute, z-order
- Snap to grid, alignment guides, read-only review mode

## Edges

- Solid, dashed and animated strokes; start/end markers
- ERD-style cardinality (crow's foot), including on plain connections
- Labels that live on the line and can be dragged along it
- Flow payloads: dots, dashes, pulses, icons, envelopes — animate data moving

## Boards & storage

- Named boards with autosave; duplicate, rename, delete
- Storage is honest: server-side when a board API exists, browser IndexedDB otherwise — the UI says which
- On-read migrations: boards from older versions keep opening
- Import a board from JSON as ONE undo step

## Export & import

- SVG export with real, selectable `<text>` (not a screenshot, not outlined curves)
- PNG and PDF export
- JSON round-trip (board backup / machine transfer)
- Mermaid `flowchart` source import

## Appearance

- Dark, Light, Paper, Midnight + a high-contrast theme
- Per-element authored colours that survive theme switches

## Feedback & telemetry

- In-app feedback prefills a GitHub issue (no account needed to write, one click to file)
- Cookieless, self-hosted analytics (Umami) — no cookies, no trackers, no consent banner
