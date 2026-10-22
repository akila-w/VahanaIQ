#!/usr/bin/env python3
"""Fetch real brand marks, official model wordmarks and Lucide glyphs."""
import concurrent.futures as futures
import hashlib, io, json, re, tarfile, urllib.request as req
from pathlib import Path
from html import unescape
from html.parser import HTMLParser
from urllib.parse import urljoin
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'assets/identity';OUT.mkdir(exist_ok=True)
def get(url):
    return req.urlopen(req.Request(url,headers={'User-Agent':'VahanaIQ catalogue review'}),timeout=25).read()
result={'brands':{},'models':{}}
meta=json.loads(get('https://registry.npmjs.org/simple-icons/latest'))
tar=tarfile.open(fileobj=io.BytesIO(get(meta['dist']['tarball'])),mode='r:gz')
names={Path(m.name).stem:m for m in tar.getmembers() if '/icons/' in m.name and m.name.endswith('.svg')}
data=json.loads((ROOT/'docs/catalogue-review/input.json').read_text())
aliases={'Mercedes-Benz':'mercedesbenz','Land Rover':'landrover','GWM':'greatwall','GAC':'gac','Leapmotor':'leapmotor'}
for brand in sorted(set(v['make'] for v in data['vehicles'])):
    slug=aliases.get(brand,re.sub('[^a-z0-9]','',brand.lower()))
    if slug in names:
        file=OUT/f'{slug}.svg';file.write_bytes(tar.extractfile(names[slug]).read())
        result['brands'][brand]={'localPath':f'../assets/identity/{file.name}','sourceUrl':f'https://simpleicons.org/?q={slug}','packageVersion':meta['version']}
for member in tar.getmembers():
    if Path(member.name).name in ('LICENSE.md','LICENSE'):
        (OUT/'SIMPLE-ICONS-LICENSE.txt').write_bytes(tar.extractfile(member).read());break
glyph=ROOT/'assets/icons/lucide';glyph.mkdir(exist_ok=True)
icons=['plus','list-plus','search','sliders-horizontal','trash','wallet','target','calendar','bookmark','save','chart-no-axes-combined','car','circle-check','circle-question-mark','arrow-right','download','undo-2','layers','piggy-bank','chevron-down','fuel','badge-check','image','printer','share-2']
def icon(name):
    try:(glyph/f'{name}.svg').write_bytes(get(f'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/{name}.svg'))
    except Exception as e:print('Icon unavailable',name,str(e))
with futures.ThreadPoolExecutor(max_workers=8) as pool:list(pool.map(icon,icons))
(glyph/'LICENSE').write_bytes(get('https://raw.githubusercontent.com/lucide-icons/lucide/main/LICENSE'))
class Images(HTMLParser):
    def __init__(self):super().__init__();self.images=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='img':
            for k in ['src','data-src','data-lazy-src']:
                if a.get(k):self.images.append((a[k],a.get('alt','')))
pages=json.loads((ROOT/'docs/catalogue-review/source-index.json').read_text())
# Model logos are only taken from official pages where their name is explicit.
for page in pages:
    for u,alt in page.get('images',[]):
        if not re.search(r'logo|wordmark',u+' '+alt,re.I):continue
        for m in data['models']:
            token=re.sub('[^a-z0-9]','',m['model'].lower())
            if len(token)>=4 and re.search(r'(?<![a-z0-9])'+re.escape(m['model'])+r'(?![a-z0-9])',u+' '+alt,re.I) and re.search(r'(?<![a-z])'+re.escape(m['make'])+r'(?![a-z])',page['url'],re.I) and any(d in page['url'] for d in ['peroduasl.lk','suzuki.lk','kia.com','toyota.lk','hyundaisrilanka.lk']):
                key=m['make']+' '+m['model']
                if key in result['models']:continue
                # A Next.js URL recorded by the old extractor omitted sizing
                # parameters. Re-open the real source to get the complete src.
                if '/_next/image?' in u:
                    try:
                        parser=Images();parser.feed(get(page['url']).decode(errors='replace'))
                        full=next((x for x,a in parser.images if alt==a and 'logo' in x),None)
                        if full:u=urljoin(page['url'],unescape(full))
                    except Exception:continue
                try:
                    raw=get(u)
                    if raw[:4] not in (b'\x89PNG',b'RIFF',b'\xff\xd8\xff\xe0',b'\xff\xd8\xff\xe1') and b'<svg' not in raw[:1000]:continue
                    ext='svg' if b'<svg' in raw[:1000] else 'png' if raw[:4]==b'\x89PNG' else 'webp' if raw[:4]==b'RIFF' else 'jpg'
                    file=OUT/f'model-{hashlib.sha256(raw).hexdigest()[:20]}.{ext}';file.write_bytes(raw)
                    result['models'][key]={'localPath':f'../assets/identity/{file.name}','sourceUrl':page['url'],'imageUrl':u}
                except Exception:pass
(ROOT/'data/identity.json').write_text(json.dumps(result,indent=2))
(ROOT/'docs/catalogue-review/identity.json').write_text(json.dumps(result,indent=2))
(ROOT/'js/identity-data.js').write_text('export const identity = '+json.dumps(result,indent=2)+';\n')
print('Brand marks',len(result['brands']),'model wordmarks',len(result['models']),'glyphs',len(icons),flush=True)
