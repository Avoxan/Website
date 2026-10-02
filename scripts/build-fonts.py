#!/usr/bin/env python3
"""Rebuild the self-hosted webfonts in /fonts from Google Fonts.

    pip install fonttools brotli zopfli
    python3 scripts/build-fonts.py

Why each font is treated differently is not arbitrary — every choice below was
measured, and the ones that looked obvious but made things worse are recorded
so nobody re-tries them:

  Fraunces (roman + italic)  left completely alone on both axes.
      Narrowing wght to the 300-600 the stylesheet uses takes the roman from
      66 KB to 78 KB, and narrowing opsz takes it to 76 KB: fontTools rebuilds
      the variation deltas at the new axis endpoints and the result compresses
      worse than the original. Pinning opsz *does* shrink it (81 KB -> 43 KB
      for the italic) but visibly wrecks the typography — narrower letterforms,
      different line breaks, thin cramped small text. Don't.

  Geist   wght pinned to 300-600. Here narrowing does help (29 KB -> 23 KB).

  JetBrains Mono  was the real waste. Google served it as TWO byte-identical
      31 KB files, one per requested weight, each carrying ~20 KB of
      programming ligatures (=>, !=, ->) this site never renders. One variable
      file with the ligature features dropped: 13 KB.

Character coverage is Google's own "latin" unicode-range, unchanged, so no
glyph the site can render today goes missing. The arrows, check marks and
box-drawing characters the site uses (-> checkmark etc.) are not in that range
and fall back to a system font — exactly as they already did.
"""
import os, re, subprocess, sys, tempfile, urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

GF_CSS = ("https://fonts.googleapis.com/css2?"
          "family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700"
          "&family=Geist:wght@300..700"
          "&family=JetBrains+Mono:wght@400;500&display=swap")

# Google's own "latin" subset range, copied verbatim from the CSS it serves.
LATIN = ("U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
         "U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,"
         "U+2212,U+2215,U+FEFF,U+FFFD")

# Dropped: calt/frac/dnom/numr/pnum/tnum. Kept: everything that affects how
# ordinary prose renders, including rvrn (variable-font substitution, required)
# and the combining-mark features that build accented characters.
KEEP = "kern,liga,rlig,ccmp,locl,mark,mkmk,rvrn"

UA = "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36"

#     source face (family, style)          output file                        wght limit
JOBS = [
    (("Fraunces", "normal"), "fraunces-latin-var.woff2",        None),
    (("Fraunces", "italic"), "fraunces-italic-latin-var.woff2", None),
    (("Geist", "normal"),    "geist-latin-var.woff2",           (300, 400, 600)),
    (("JetBrains Mono", "normal"), "jetbrains-mono-latin-var.woff2", (400, 400, 500)),
]

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, "fonts")


def fetch_css():
    req = urllib.request.Request(GF_CSS, headers={"User-Agent": UA})
    return urllib.request.urlopen(req).read().decode()


def latin_sources(css):
    """Map (family, style) -> URL of the latin woff2, ignoring the other subsets."""
    out = {}
    for subset, body in re.findall(r"/\*\s*([a-z-]+)\s*\*/\s*@font-face\s*\{(.*?)\}", css, re.S):
        if subset != "latin":
            continue
        fam = re.search(r"font-family:\s*'([^']+)'", body).group(1)
        style = re.search(r"font-style:\s*(\S+);", body).group(1)
        out.setdefault((fam, style), re.search(r"url\(([^)]+)\)", body).group(1))
    return out


def main():
    os.makedirs(DEST, exist_ok=True)
    sources = latin_sources(fetch_css())
    total = 0
    for face, out_name, wght in JOBS:
        url = sources.get(face)
        if url is None:
            sys.exit(f"Google Fonts no longer serves a latin subset for {face}")
        raw = urllib.request.urlopen(
            urllib.request.Request(url, headers={"User-Agent": UA})).read()

        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "src.woff2")
            open(src, "wb").write(raw)
            font = TTFont(src)
            if wght:
                font = instancer.instantiateVariableFont(
                    font, {"wght": wght}, updateFontNames=False,
                    inplace=True, optimize=True)
            flat = os.path.join(tmp, "flat.ttf")
            font.flavor = None
            font.save(flat)
            subprocess.run([
                "pyftsubset", flat,
                f"--output-file={os.path.join(DEST, out_name)}",
                f"--unicodes={LATIN}", f"--layout-features={KEEP}",
                "--flavor=woff2", "--with-zopfli", "--drop-tables+=DSIG",
                "--name-IDs=1,2,3,4,5,6", "--no-notdef-outline",
            ], check=True)

        size = os.path.getsize(os.path.join(DEST, out_name))
        total += size
        print(f"{size:>8,}  {out_name}  (from {len(raw):,})")
    print(f"{total:>8,}  total")
    print("\nIf any filename changes, update the @font-face src in "
          "css/avoxan-v2.css and bump its ?v= string.")


if __name__ == "__main__":
    main()
