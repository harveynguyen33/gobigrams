# ROUND-AQ2-SPEC — device-test feedback batch (2026-10-13)

Base: 53dbece. All items from Harvey's Mac device test. Where a root cause is not
yet found (#6, #7) the item starts with a live reproduction BEFORE any fix
(systematic-debugging phase 1).

## Q1 — About pane rewrite
- Name/description: "Gobigrams" wordmark + playful one-liner (funny, mischievous,
  pun on Goblin Diagrams). English text, Harvey reviews wording on device.
- Version: show ONLY the number (drop the "bumped with package.json" hint).
- Licence row: REMOVE (Harvey undecided on licensing; an MIT row contradicts the
  anti-reverse-engineering intent — licensing is its own research, not a pane row).
- Building blocks row: REMOVE.
- Self-host note (Boards are plain JSON / --host 0.0.0.0): REMOVE both lines.

## Q2 — "5 groups · room to grow" nav note: REMOVE.

## Q3 — Roadmap Shipped block: REMOVE the block from the pane (data stays in
  roadmap.ts; the ratchet probe re-anchored to assert the pane no longer renders it).

## Q4 — X buttons on fav/cust tiles: replace the text 'x' glyph with lucide X icon
  (size 12) and drop border-radius 50% -> 7px rounded-square to match the chip
  system. key-note-x keeps its circle (16px, separate context) unless it looks
  broken too - not in this round's scope.

## Q5 — white swatch invisible on light/paper: give TEXT nodes a colourKey.
  The text colour becomes a stored symbolic key (default 'none' = today's --fg),
  edited from the same colour rows when a node is selected. White text on a white
  board is then the user's choice and reads correctly on dark. Also add a subtle
  border to the white swatch cell so the CELL is visible on light themes.

## Q6 - xN count -> nodes overlap (needs live repro first)
## Q7 - bend handle missing after 2nd+ top/bottom connection (needs repro + Harvey detail)
## Q8 - Saved failed: fetch = server death (infra fixed already); add fetch retry
  with backoff (2 retries, 1s/3s) in the save path so a transient blip self-heals.
