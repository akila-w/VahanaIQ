"""Build-time verification only: run with fonttools[woff]==4.63.0.
Regenerate assets with: python -m fontTools.ttLib.woff2 compress INPUT.ttf -o OUTPUT.woff2
No subsetting, instancing, hint removal or font renaming is performed.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
import json
root = Path(__file__).resolve().parent.parent
results = []
for family in ('inter', 'manrope'):
    stem = root / 'assets/fonts' / family / (family.title() + '-variable')
    a, b = TTFont(stem.with_suffix('.ttf')), TTFont(stem.with_suffix('.woff2'))
    assert a.getBestCmap() == b.getBestCmap(), 'Character mapping changed'
    assert a.getGlyphOrder() == b.getGlyphOrder(), 'Glyph order changed'
    # Compare decoded table XML; head/loca/glyf are reconstructed by the WOFF2
    # lossless transform. Compare each glyph's coordinates and instructions below.
    from io import BytesIO
    for tag in set(a.keys()) - {'GlyphOrder', 'head', 'loca', 'glyf'}:
        ax, bx = BytesIO(), BytesIO()
        a.saveXML(ax, tables=[tag]); b.saveXML(bx, tables=[tag])
        assert ax.getvalue() == bx.getvalue(), f'{family}: {tag} differs'
    for name in a.getGlyphOrder():
        ga, gb = a['glyf'][name], b['glyf'][name]
        assert ga.getCoordinates(a['glyf']) == gb.getCoordinates(b['glyf']), name
        assert getattr(ga, 'program', None) == getattr(gb, 'program', None), name
    axes = [(x.axisTag, x.minValue, x.defaultValue, x.maxValue) for x in a['fvar'].axes]
    cmap = a.getBestCmap()
    results.append(dict(family=family, ttf=stem.with_suffix('.ttf').stat().st_size,
        woff2=stem.with_suffix('.woff2').stat().st_size, glyphs=len(a.getGlyphOrder()),
        codepoints=len(cmap), axes=axes, currency={c: ord(c) in cmap for c in '£€₹₨'},
        scripts={label: any(low <= c <= high for c in cmap) for label,low,high in
                 [('Greek',0x370,0x3ff),('Cyrillic',0x400,0x4ff),('Sinhala',0xd80,0xdff),('Tamil',0xb80,0xbff)]}))
print(json.dumps(results, indent=2, ensure_ascii=False))
