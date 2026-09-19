"""Measure candidate colour-key-note strings in the panel's OWN mono face at the
`.hint` rule's 12px, so "one short line" is a number and not a guess.

`.hint` (styles.css:1745) is `font-family: var(--mono); font-size: 12px`.
`--mono` is JetBrains Mono (ROUND W's default), so jetbrains-mono-400-latin is
the face that renders it.

Usage: python3 scripts/measure-key-note.py
"""
from pathlib import Path
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "public" / "fonts" / "jetbrains-mono-400-latin.woff2"
PX = 12.0

CANDIDATES = [
    "Colour = our grouping, not ISO.",
    "This editor's grouping, not ISO.",
    "Colour: our grouping, not ISO.",
    "Our colour grouping, not ISO.",
    "Editor colour grouping, not ISO.",
    "Not ISO — this editor's grouping.",
    "This editor's colour grouping, not ISO.",
    "Our grouping, not an ISO convention.",
]

# The two panel widths the note must survive: `--right-w` is 288px at the
# desktop tier (styles.css:286) and 248px at the tablet tier (:301). The panel's
# sections pad 16px a side, so the content box is W - 32. The dismiss control is
# 16px plus a 6px gap, so the text's own budget is that box minus 22.
BOXES = {"desktop --right-w 288px": 288 - 32, "tablet --right-w 248px": 248 - 32}
CONTROL = 16 + 6


def advance_px(font: TTFont, text: str) -> float:
    upem = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    total = 0
    for ch in text:
        g = cmap.get(ord(ch))
        total += hmtx[g][0] if g else 0
    return total / upem * PX


f = TTFont(str(FONT))
print(f"face: {FONT.name}  unitsPerEm={f['head'].unitsPerEm}  at {PX}px")
print(f"one ASCII advance: {advance_px(f, 'M'):.2f}px\n")
for box_name, box in BOXES.items():
    budget = box - CONTROL
    print(f"{box_name}: content box {box}px, text budget {budget}px after the dismiss control")
    for s in CANDIDATES:
        w = advance_px(f, s)
        fit = "ONE LINE" if w <= budget else f"WRAPS ({w / budget:.2f} lines)"
        print(f"  {w:7.1f}px  {len(s):2d}ch  {fit:22s}  \"{s}\"")
    print()
