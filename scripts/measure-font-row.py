"""Measure the real advance width of the four font-row labels in each family,
read off the actual woff2 files in public/fonts/ (no browser, no guessing).

Usage: python3 scripts/measure-font-row.py <px>
"""
import sys
from pathlib import Path
from fontTools.ttLib import TTFont

PX = float(sys.argv[1]) if len(sys.argv) > 1 else 12.5
ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "public" / "fonts"

# label -> file stem prefix of the family that renders it
ROWS = [
    ("Mono", "jetbrains-mono-400-latin"),
    ("UI", "inter-400-latin"),
    ("Read", "lexend-400-latin"),
    ("Viet", "be-vietnam-pro-400-latin"),
]


def width_px(stem: str, text: str) -> float:
    f = TTFont(str(FONTS / f"{stem}.woff2"))
    upem = f["head"].unitsPerEm
    cmap = f.getBestCmap()
    hmtx = f["hmtx"]
    total = 0
    for ch in text:
        g = cmap.get(ord(ch))
        if g is None:
            raise SystemExit(f"{stem}: no glyph for {ch!r}")
        total += hmtx[g][0]
    return total / upem * PX


print(f"font-size: {PX}px   (advance widths read from public/fonts/*.woff2)")
print(f"{'label':6} {'family (own)':34} {'px':>7}")
worst = 0.0
for label, stem in ROWS:
    w = width_px(stem, label)
    worst = max(worst, w)
    print(f"{label:6} {stem:34} {w:7.2f}")
print()
# The row: 253px field, 4 columns 1fr + 3 x 5px gap  ->  (253-15)/4
btn = (253 - 3 * 5) / 4
print(f"field width (given, measured in ROUND X): 253px")
print(f"4 columns 1fr + 3x5px gap -> each button: {btn:.2f}px")
print(f"button padding 7px 6px + 1px border each side -> content box: {btn - 12 - 2:.2f}px")
print(f"widest label: {worst:.2f}px  ->  slack {btn - 12 - 2 - worst:.2f}px")
print("FITS" if worst <= btn - 14 else "DOES NOT FIT")
