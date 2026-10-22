import json
from pathlib import Path

ROOT = Path('/Users/Shared/vahanaiq')
DATA = ROOT / 'docs/catalogue-rebuild'

with open(DATA / 'selections.json') as f:
    sel = json.load(f)

with open(ROOT / 'data/catalogue.json') as f:
    cat = json.load(f)

models_by_name = {m['name']: m for m in cat['models']}

items = []
for name, sel_info in sel.items():
    idx = sel_info.get('seedIndex', 999)
    m = models_by_name.get(name)
    items.append((idx, name, sel_info, m))

items.sort(key=lambda x: x[0])

cards_html = []
for idx, name, sel_info, m in items:
    if not m or not m['images']:
        continue
    hero = m['images'][0]
    make = m['make'].lower()
    body = m.get('body', '')
    w, h = hero.get('width', 0), hero.get('height', 0)
    caption = hero.get('caption', 'Manufacturer Image')
    url = hero.get('url', '#')
    source_page = hero.get('sourcePage', url)
    src_large = '../../' + hero['src']
    src_small = '../../' + hero['smallSrc']
    
    sub_strip = ''
    if len(m['images']) > 1:
        thumbs = []
        for g_idx, g_img in enumerate(m['images'][1:], start=2):
            g_src = '../../' + g_img.get('smallSrc', g_img['src'])
            g_orig = '../../' + g_img['src']
            thumbs.append(f'<a href="{g_orig}" target="_blank" title="Gallery {g_idx}"><img src="{g_src}" alt="Gallery {g_idx}" loading="lazy"><span>#{g_idx}</span></a>')
        sub_strip = f'<div class="sub-strip">{" ".join(thumbs)}</div>'
    
    badges = [f'<span class="badge body">{body}</span>']
    if len(m['images']) > 1:
        badges.append(f'<span class="badge gallery">{len(m["images"])} gallery photos</span>')
    zoom_val = sel_info['images'][0].get('zoom', 1.0)
    if zoom_val > 1.0:
        badges.append(f'<span class="badge zoom">zoom ×{zoom_val}</span>')
    
    card = f'''    <article class="card" data-make="{make}" data-name="{name.lower()}" data-idx="{idx}">
      <div class="card-head">
        <span class="idx">#{idx}</span>
        <div class="titles">
          <h2>{name}</h2>
          <div class="badges">{''.join(badges)}</div>
        </div>
      </div>
      <a class="cover-link" href="{src_large}" target="_blank" title="Open full 1280×800 WebP">
        <img class="cover" src="{src_small}" width="640" height="400" alt="{name}" loading="lazy">
      </a>
      {sub_strip}
      <div class="meta">
        <div class="caption">{caption} · <code>{w}×{h}</code></div>
        <div class="links">
          <a href="{source_page}" target="_blank" rel="noopener">Source Page ↗</a>
          <a href="{url}" target="_blank" rel="noopener">Direct Original ↗</a>
          <a href="{src_large}" target="_blank">1280×800 WebP ↗</a>
        </div>
      </div>
    </article>'''
    cards_html.append(card)

cards_joined = '\n'.join(cards_html)
total_count = len(cards_html)

template = f'''<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VahanaIQ · All {total_count} Catalogue Covers Review</title>
  <style>
    :root {{ color-scheme: light; }}
    * {{ box-sizing: border-box; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; background: #f4f6f8; color: #111827; }}
    header {{ display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #dde1e7; }}
    h1 {{ font-size: 22px; margin: 0; }}
    p.sub {{ margin: 4px 0 0; color: #4b5563; font-size: 14px; }}
    .controls {{ display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }}
    input[type="search"], select {{ padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; background: #fff; }}
    input[type="search"] {{ min-width: 240px; }}
    .count {{ font-size: 13px; color: #4b5563; font-weight: 500; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }}
    .card {{ background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }}
    .card-head {{ display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }}
    .idx {{ background: #103e36; color: #fff; font-weight: 700; font-size: 13px; padding: 3px 8px; border-radius: 6px; font-variant-numeric: tabular-nums; }}
    .titles {{ flex: 1; min-width: 0; }}
    .titles h2 {{ font-size: 15px; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
    .badges {{ display: flex; gap: 4px; flex-wrap: wrap; margin-top: 3px; }}
    .badge {{ font-size: 11px; padding: 1px 6px; border-radius: 999px; background: #f1f5f9; color: #475569; }}
    .badge.gallery {{ background: #e0f2fe; color: #0369a1; }}
    .badge.trim {{ background: #dcfce7; color: #15803d; }}
    .badge.zoom {{ background: #fef3c7; color: #92400e; font-weight: 600; }}
    .cover-link {{ display: block; background: #fff; border-bottom: 1px solid #f1f5f9; }}
    img.cover {{ display: block; width: 100%; height: auto; aspect-ratio: 8 / 5; object-fit: contain; background: #fff; }}
    .sub-strip {{ display: flex; gap: 6px; padding: 8px 12px; background: #f8fafc; border-bottom: 1px solid #f1f5f9; overflow-x: auto; }}
    .sub-strip a {{ position: relative; display: block; flex: 0 0 72px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: #fff; }}
    .sub-strip img {{ display: block; width: 72px; height: 45px; object-fit: contain; }}
    .sub-strip span {{ position: absolute; bottom: 2px; right: 3px; background: rgba(15,23,42,0.75); color: #fff; font-size: 9px; padding: 0 4px; border-radius: 3px; }}
    .meta {{ padding: 10px 12px; font-size: 12px; color: #475569; display: flex; flex-direction: column; gap: 6px; margin-top: auto; }}
    .caption {{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
    code {{ font-size: 11px; color: #0f172a; background: #f1f5f9; padding: 1px 4px; border-radius: 4px; }}
    .links {{ display: flex; gap: 10px; flex-wrap: wrap; }}
    .links a {{ color: #0f766e; text-decoration: none; font-weight: 500; }}
    .links a:hover {{ text-decoration: underline; }}
  </style>
</head>
<body>
  <header>
    <div>
      <h1>VahanaIQ · All {total_count} Catalogue Covers</h1>
      <p class="sub">Visual review of all {total_count} models in the catalogue, with framing, zoom, and gallery thumbnails.</p>
    </div>
    <div class="controls">
      <input type="search" id="search" placeholder="Search make, model, or #index…" aria-label="Search models">
      <span class="count" id="count">Showing {total_count} of {total_count}</span>
    </div>
  </header>
  <main class="grid" id="grid">
{cards_joined}
  </main>
  <script>
    const search = document.getElementById('search');
    const cards = Array.from(document.querySelectorAll('.card'));
    const count = document.getElementById('count');
    search.addEventListener('input', () => {{
      const q = search.value.trim().toLowerCase();
      let visible = 0;
      cards.forEach(card => {{
        const text = (card.dataset.name + ' #' + card.dataset.idx + ' ' + card.dataset.make).toLowerCase();
        const match = !q || text.includes(q);
        card.style.display = match ? '' : 'none';
        if (match) visible++;
      }});
      count.textContent = 'Showing ' + visible + ' of ' + cards.length;
    }});
  </script>
</body>
</html>
'''

(DATA / 'cover-review.html').write_text(template)
print(f'Wrote cover-review.html with {total_count} cards')
