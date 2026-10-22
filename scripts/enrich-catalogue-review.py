#!/usr/bin/env python3
"""Follow actual model links on official range pages; retain source evidence."""
import concurrent.futures as futures
import json
import re
import runpy
import urllib.parse as up
from html import unescape

api=runpy.run_path('scripts/collect-catalogue-review.py')
OUT=api['OUT']; models=api['INPUT']['models']
pages=json.loads((OUT/'source-index.json').read_text())
existing={p['url']:p for p in pages}
photos={m['name']:m for m in json.loads((OUT/'photo-candidates.json').read_text())}
indexes=['https://www.suzuki.lk/vehicles/','https://www.kia.lk/brand-new-cars-suvs/',
 'https://hyundaisrilanka.lk/vehicles','https://www.peroduasl.lk/',
 'https://www.euromotors.lk/index.html','https://gacsrilanka.com/']
api['OFFICIAL'].add('euromotors.lk')
changes=[]
for url in indexes:
    try:
        raw,final,_=api['get'](url)
        html=raw.decode(errors='replace')
        links=list(dict.fromkeys(up.urljoin(final,unescape(u)) for u in re.findall(r'href=[\"\x27]([^\"\x27]+)',html)))
        existing[url]=api['page'](url)
        for m in models:
            if api['host'](m['distributorUrl'])!=api['host'](url) and not(m['make']=='Jetour' and 'euromotors' in url):continue
            found=[u for u in links if u.startswith('https://') and api['host'](u)==api['host'](url)
                   and api['matches'](m,u) and not re.search(r'uploads|\.pdf|blog|news|\.jpg|\.png|\?|#',u)]
            if found:
                # Prefer actual product/vehicle path over related stories.
                found.sort(key=lambda u: ('/vehicles/' not in u and '/vehicle/' not in u and '/product/' not in u,len(u)))
                target=found[0]
                if target!=m['distributorUrl']:
                    m=dict(m,distributorUrl=target);changes.append(m)
    except Exception as e: print('Index unavailable',url,str(e),flush=True)
with futures.ThreadPoolExecutor(max_workers=8) as pool:
    for p in pool.map(api['page'],[m['distributorUrl'] for m in changes]):existing[p['url']]=p
api['PAGE_CACHE'].update(existing)
with futures.ThreadPoolExecutor(max_workers=8) as pool:
    for m in pool.map(api['collect'],changes):
        previous=photos[m['name']]
        seen={p['sha256'] for p in previous['photos']}
        previous['photos'] += [p for p in m['photos'] if p['sha256'] not in seen]
        previous['pageStatus']=m['pageStatus'];previous['errors']+=m['errors']
for m in models:
    photos[m['name']]['photos']=[p for p in photos[m['name']]['photos'] if api['matches'](m,p['url'],p['caption'])]
(OUT/'photo-candidates.json').write_text(json.dumps(list(photos.values()),ensure_ascii=False,indent=2))
(OUT/'source-index.json').write_text(json.dumps(list(existing.values()),ensure_ascii=False,indent=2))
print('Enriched',len(changes),'model pages; total candidates',sum(len(m['photos']) for m in photos.values()),flush=True)
