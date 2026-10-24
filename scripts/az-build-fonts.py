#!/usr/bin/env python3
"""ROUND AZ (t_96100cb2) — build the shipped font subsets.

Provenance (pinned upstream, no CDN):
  Inter 4.1     https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip
                InterVariable.ttf  sha256 4989b125924991b90d05b2d16e0e388c48f7d5bb8b30539bbf9c755278d0ccaf
  JetBrainsMono https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip
                fonts/variable/JetBrainsMono[wght].ttf
                                   sha256 662a196d58f1183bf2d77428b6d5283fe3f45161ab021bea4036bc98e5cac016

Outputs (all into public/fonts/):
  - @font-face woff2 subsets per family x weight x {latin, latin-ext, vietnamese}
    (weights: Inter 400/500/600/700 static instances; JetBrains Mono 400/600/700
    static instances — every weight the sheet paints except 650)
  - ONE variable subset per family (wght axis kept), as BOTH:
      * .woff2  -> the @font-face '650' face (the card prefers the variable file
        for exactly this weight; static sets usually lack it)
      * .ttf    -> the OUTLINE SHAPER's bytes (harfbuzzjs takes raw OpenType;
        woff2 would need runtime inflation) + the EMBED licence/fsType check
  - SHA256S.txt pinning every output + the two upstream sources.
"""
import hashlib
import os
import subprocess
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

DL = '/tmp/az2-dl'          # pinned upstream downloads (already sha256-verified)
OUT = 'public/fonts'
TMP = '/tmp/az2-build'      # scratch: instanced statics + pre-rename work

# Vietnamese-safe coverage (the card's trap): Basic Latin, Latin-1 Supplement,
# Latin Ext-A, Latin Ext-B (cheap, avoids silent gaps), combining marks (NFD
# fallback), Latin Extended Additional U+1EA0-1EF9 (the card's named range),
# general punctuation, the dong sign, the arrows the app draws, script-l.
#
# ORCHESTRATOR ADDITION (2026-10-22, Harvey: "làm 1"): the original latin range
# stopped at general punctuation, so the euro sign had NO glyph — measured: '€'
# missing from both shipped variable faces, while U+20AB (₫) was covered only
# because the vietnamese range names it. A diagram label containing € fell back
# to another typeface mid-word, and the same character was unrenderable from the
# embedded subset in an exported SVG. Added: the Currency Symbols block, letterlike
# symbols (™ ℃ №), the full arrows block, math operators (≈ ≤ ≥ ≠ ∞ ∑ √),
# box drawing (ASCII-diagram arrows), geometric shapes (■ ▲ ● ◆) and dingbats
# (✓ ✔ ✗ ★ ⚠). All of it lands in the EXISTING 'latin' group on purpose: the file
# names must stay stable, because the @font-face declarations and the embed look
# them up by name.
SUBSETS = {
    'latin': ('U+0020-007E,U+00A0-00FF,U+2000-206F,U+20A0-20CF,U+2100-214F,'
              'U+2190-21FF,U+2200-22FF,U+2500-257F,U+25A0-25FF,U+2600-26FF,'
              'U+2700-27BF,U+2113'),
    'latin-ext': 'U+0100-017F,U+0180-024F,U+0259,U+1E00-1EFF',
    'vietnamese': ('U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,'
                   'U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,'
                   'U+1EA0-1EF9,U+20AB'),
}

# weights the sheet paints per family (census: 400x23 500x5 600x15 650x8 700x34;
# 650 is sans-only — note/database titles — and comes from the variable face)
STATIC_WEIGHTS = {
    'inter': [400, 500, 600, 700],
    'jetbrains-mono': [400, 600, 700],
}
SOURCES = {
    'inter': (f'{DL}/inter/InterVariable.ttf', {'wght': None, 'opsz': 14}),
    'jetbrains-mono': (f'{DL}/jbmon/fonts/variable/JetBrainsMono[wght].ttf', {'wght': None}),
}
SUBSET_ARGS = [
    "--layout-features='*'", '--glyph-names', '--notdef-outline',
    '--recommended-glyphs', "--name-IDs='*'", '--name-legacy', "--name-languages='*'",
]


def sh(cmd):
    # cmd is built from THIS file's own constants only — no user input.
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        print('CMD FAILED:', cmd, '\n', r.stdout, r.stderr)
        sys.exit(1)


def sha256_of(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def subset_file(src, dst, ranges, flavor=None):
    flav = f'--flavor={flavor} ' if flavor else ''
    sh(f'pyftsubset "{src}" --output-file="{dst}" {flav}--unicodes="{ranges}" '
       + ' '.join(SUBSET_ARGS))
    return os.path.getsize(dst)


def main():
    os.makedirs(TMP, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    outputs = []  # (path, note)

    # 1. variable shaper masters: Inter pinned to opsz=14 (UI optical size);
    #    JetBrains Mono has a single wght axis already.
    var_master = {}
    for fam, (src, pin) in SOURCES.items():
        f = TTFont(src)
        axes = {a.axisTag: a for a in f['fvar'].axes}
        pin_args = {k: v for k, v in pin.items() if v is not None and k in axes}
        if pin_args:
            instantiateVariableFont(f, pin_args, inplace=True)
        # keep the variable family name distinct from the statics
        p = f'{TMP}/{fam}-var.ttf'
        f.save(p)
        var_master[fam] = p
        print(f'{fam} variable master:', os.path.getsize(p), 'bytes, pinned', pin_args)

    # 2. static instances -> woff2 subsets (the @font-face weights)
    for fam, ws in STATIC_WEIGHTS.items():
        for w in ws:
            f = TTFont(var_master[fam])
            # masters are ALREADY opsz-pinned (step 1) - only wght moves here
            pin = {'wght': w}
            instantiateVariableFont(f, pin, inplace=True)
            static = f'{TMP}/{fam}-{w}.ttf'
            f.save(static)
            for sub, ranges in SUBSETS.items():
                out = f'{OUT}/{fam}-{w}-{sub}.woff2'
                n = subset_file(static, out, ranges, flavor='woff2')
                outputs.append((out, f'{fam} w{w} {sub}'))
                print(out, n, 'bytes')

    # 3. the variable subset per family: woff2 (the @font-face 650 face)
    #    AND ttf (the shaper's bytes; hb takes raw sfnt)
    for fam in SOURCES:
        for sub, ranges in SUBSETS.items():
            out = f'{TMP}/{fam}-var-{sub}.ttf'
            subset_file(var_master[fam], out, ranges)
            outputs.append((out, f'{fam} variable {sub} (shaper ttf)'))
            print(out, os.path.getsize(out), 'bytes')
        # single MERGED variable subset (all ranges in one file) — this is the
        # file the shaper fetches (one fetch, no per-codepoint file picking)
        merged = f'{TMP}/{fam}-var-merged.ttf'
        all_ranges = ','.join(SUBSETS.values())
        subset_file(var_master[fam], merged, all_ranges)
        woff2_out = f'{OUT}/{fam}-variable.woff2'
        subset_file(var_master[fam], woff2_out, all_ranges, flavor='woff2')
        outputs.append((woff2_out, f'{fam} variable merged (650 face)'))
        print(woff2_out, os.path.getsize(woff2_out), 'bytes')

    # 4. rename: the variable TTF subset for the shaper becomes
    #    <fam>-variable.ttf under public/fonts/
    for fam in SOURCES:
        src = f'{TMP}/{fam}-var-merged.ttf'
        dst = f'{OUT}/{fam}-variable.ttf'
        sh(f'cp "{src}" "{dst}"')
        outputs.append((dst, f'{fam} variable merged (shaper bytes)'))
        print(dst, os.path.getsize(dst), 'bytes')

    # 5. SHA256S.txt — every shipped file + the upstream sources
    lines = ['# AZ2 (t_96100cb2) — pinned provenance. Regenerate with scripts/az-build-fonts.py',
             '# Upstream sources:',
             f'#   Inter 4.1 InterVariable.ttf          {sha256_of(SOURCES["inter"][0])}',
             f'#   JetBrainsMono 2.304 variable ttf     {sha256_of(SOURCES["jetbrains-mono"][0])}',
             '# Shipped files (name  sha256):']
    for path, note in outputs:
        if path.startswith(OUT) and os.path.exists(path):
            lines.append(f'{os.path.basename(path)}  {sha256_of(path)}  # {note}')
    with open(f'{OUT}/SHA256S.txt', 'w') as fh:
        fh.write('\n'.join(lines) + '\n')
    print(f'\nwrote {OUT}/SHA256S.txt with {len(outputs)} outputs')


if __name__ == '__main__':
    main()
