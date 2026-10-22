#!/usr/bin/env python3
"""Collect attributable review candidates, never change the public catalogue.

Input is exported from the existing JS registry/catalogue. Images are discovered
on real source pages, decoded, deduplicated and saved under a content hash.
No fixed photo count/angle, fabricated URL, automatic approval or cache fallback.
"""
import concurrent.futures as futures
import hashlib
import io
import json
import re
import threading
import urllib.error
import urllib.parse as up
import urllib.request as request
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'docs/catalogue-review'
ASSETS = ROOT / 'assets/images/review-catalogue'
OUT.mkdir(exist_ok=True)
ASSETS.mkdir(exist_ok=True)
INPUT = json.loads((OUT / 'input.json').read_text())
UA = 'VahanaIQ catalogue review (+https://akila-w.github.io/vahanaiq/)'
LOCK = threading.Lock()
HOSTS = {}
PAGE_CACHE = {}
# Third-party listings and community photos remain outside the official gallery.
OFFICIAL = {'toyota.lk','global.toyota','globalsuzuki.com','suzuki.lk','suzuki.co.jp',
 'johnkeellscgauto.com','kia.lk','kia.com','hyundaisrilanka.lk','gwmsrilanka.lk',
 'gwm.lk','cherysrilanka.lk','cars.tatamotors.lk','renault.lk','peroduasl.lk',
 'audi.lk','jetourglobal.com','mgsrilanka.lk','mahindrasrilanka.lk','volkswagen.lk',
 'global.honda','honda.co.jp','unitedmotors.lk','mitsubishisl.lk','peugeot.co.uk',
 'press.bmwgroup.com','mercedes-benz-media.co.uk','daihatsu.co.jp','landrover.lk',
 'sathosamotorsplc.com','mazdalanka.lk','models.porsche.com','leapmotor.lk','gacsrilanka.com'}

def host(url):
    return up.urlsplit(url).hostname.lower().removeprefix('www.')

def norm(text):
    return re.sub(r'[^a-z0-9]', '', up.unquote(text).lower())

def get(url, image=False):
    h = host(url)
    with LOCK:
        sem = HOSTS.setdefault(h, threading.Semaphore(2))
    with sem:
        req = request.Request(url, headers={'User-Agent': UA, 'Accept': 'image/*' if image else 'text/html'})
        with request.urlopen(req, timeout=20) as response:
            return response.read(24_000_000), response.geturl(), response.headers.get_content_type()

class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.images = []; self.text = []; self.skip = 0; self.title = []; self.in_title = False
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('script','style','svg'): self.skip += 1
        if tag == 'title': self.in_title = True
        if tag == 'img':
            for key in ('src','data-src','data-lazy-src'):
                value=a.get(key,'')
                if value and not value.startswith('data:'):self.images.append((value,a.get('alt','')))
        if tag in ('img','source','meta','a'):
            label = a.get('alt','') or a.get('title','')
            for key in ('src','data-src','data-lazy-src','srcset','data-srcset','content','href'):
                value = a.get(key,'')
                if tag == 'meta' and a.get('property') not in ('og:image','twitter:image'): continue
                for url in re.findall(r'[^\s,]+\.(?:jpe?g|png|webp)(?:\?[^\s,\"\<>]*)?', unescape(value), re.I):
                    self.images.append((url,label))
        for url in re.findall(r'url\([\"\x27]?([^\)\"\x27]+\.(?:jpe?g|png|webp)(?:\?[^\)\"\x27]*)?)',a.get('style',''),re.I):
            self.images.append((url,''))
    def handle_endtag(self, tag):
        if tag in ('script','style','svg'): self.skip = max(0,self.skip-1)
        if tag == 'title': self.in_title = False
    def handle_data(self, data):
        if self.in_title: self.title.append(data)
        if not self.skip and data.strip(): self.text.append(data.strip())

def page(url):
    key = hashlib.sha256(url.encode()).hexdigest()[:16]
    file = OUT / f'source-{key}.json'
    if file.exists(): return json.loads(file.read_text())
    try:
        raw, final, mime = get(url)
        if mime == 'application/pdf':
            (OUT/f'source-{key}.pdf').write_bytes(raw)
            result = {'url':url,'finalUrl':final,'status':'pdf','title':'PDF source','text':'','images':[]}
        else:
            p=Page(); p.feed(raw.decode('utf-8',errors='replace'))
            result={'url':url,'finalUrl':final,'status':'ok','title':' '.join(p.title),
                    'text':' '.join(p.text),'images':[(up.urljoin(final,u),a) for u,a in p.images]}
    except Exception as e:
        result={'url':url,'status':'unavailable','error':str(e),'text':'','images':[]}
    file.write_text(json.dumps(result,ensure_ascii=False,indent=2))
    return result

def aliases(model):
    s=model['model']
    remove=[' Auto',' Hybrid Z',' e:HEV Z',' REEV',' Chrome',' MCE',' Plug-In Hybrid',' Hybrid+',' Allure Premium',' M Sport',' Avantgarde']
    vals=[s]
    for suffix in remove:
        if s.endswith(suffix): vals.append(s[:-len(suffix)])
    if s=='Raize Hybrid Z': vals.append('Raize')
    if s=='Swift MZ': vals.append('Swift')
    if s=='Urban Cruiser Hyryder V': vals.append('Hyryder')
    if s=='Urban Cruiser Taisor': vals.append('Taisor')
    return [norm(x) for x in vals]

def matches(model, url, alt=''):
    hay=norm(up.urlsplit(url).path+' '+alt)
    own=aliases(model)
    if not any(a in hay for a in own): return False
    if all(len(a)<4 for a in own) and not any(re.search(r'(?<![a-z0-9])'+r'[^a-z0-9]*'.join(map(re.escape,a))+r'(?![a-z0-9])',up.unquote(url+' '+alt).lower()) for a in own): return False
    # A Corolla is not a Corolla Cross, nor a Range Rover a Sport/Evoque.
    # Prefer the more specific name when one model name contains another.
    for other in INPUT['models']:
        if other['make']!=model['make'] or other['name']==model['name']: continue
        for a in own:
            b=norm(other['model'])
            if b!=a and b.startswith(a) and b in hay: return False
    return True

def collect(model):
    source=PAGE_CACHE.get(model['distributorUrl'],{})
    candidates=[]; seen=set(); errors=[]
    if host(model['distributorUrl']) not in OFFICIAL:
        return dict(name=model['name'], photos=[], pageStatus='No official model page in inherited registry', errors=[])
    proposed=source.get('images',[])
    # Existing URLs are candidates only; download their actual bytes anew so an
    # older file with the same model/angle name cannot impersonate this URL.
    proposed=proposed+([(model['officialImgUrl'],'Inherited primary candidate')] if model.get('officialImgUrl') else [])
    for url,alt in proposed:
        if not url.startswith('https://') or not matches(model,url,alt): continue
        if re.search(r'logo|icon|swatch|sprite|360|/nav/|thumbnail-nav|flag|favicon',url,re.I): continue
        # Ignore only WP resize suffixes for URL deduplication; don't invent a full-size URL.
        canonical=re.sub(r'-\d{2,4}x\d{2,4}(?=\.)','',url)
        if canonical in seen: continue
        seen.add(canonical)
        try:
            raw,final,mime=get(url,True)
            if not mime.startswith('image/'): raise ValueError('Not an image response')
            image=Image.open(io.BytesIO(raw)); w,h=image.size; image.verify()
            if w<240 or h<120 or not 0.6<=w/h<=5: continue
            sha=hashlib.sha256(raw).hexdigest()
            if any(p['sha256']==sha for p in candidates): continue
            ext={'JPEG':'jpg','PNG':'png','WEBP':'webp','AVIF':'avif'}.get(image.format)
            if not ext: continue
            file=ASSETS/f'{sha[:24]}.{ext}'; file.write_bytes(raw)
            candidates.append({'id':sha[:24],'sha256':sha,'url':url,'resolvedUrl':final,
                'sourcePage':model['distributorUrl'],'localPath':f'../assets/images/review-catalogue/{file.name}',
                'width':w,'height':h,'caption':alt or 'Official page image candidate',
                'status':'pending','origin':'official-page-candidate'})
        except Exception as e: errors.append({'url':url,'error':str(e)})
    print(f"{model['name']}: {len(candidates)} candidates ({source.get('status','not fetched')})",flush=True)
    return dict(name=model['name'],photos=candidates,pageStatus=source.get('status','unavailable'),errors=errors)

if __name__=='__main__':
    urls=set(v['priceSourceUrl'] for v in INPUT['vehicles'] if v.get('priceSourceUrl'))
    urls.update(m['distributorUrl'] for m in INPUT['models'] if host(m['distributorUrl']) in OFFICIAL)
    # Nissan's published robots policy excludes automated clients: use search-index evidence.
    urls={u for u in urls if host(u)!='nissanlk.com'}
    with futures.ThreadPoolExecutor(max_workers=10) as pool:
        for result in pool.map(page,sorted(urls)):
            PAGE_CACHE[result['url']]=result
            print(f"Source {len(PAGE_CACHE)}/{len(urls)}: {result['status']} {result['url']}",flush=True)
    (OUT/'source-index.json').write_text(json.dumps(list(PAGE_CACHE.values()),ensure_ascii=False,indent=2))
    with futures.ThreadPoolExecutor(max_workers=8) as pool:
        models=list(pool.map(collect,INPUT['models']))
    (OUT/'photo-candidates.json').write_text(json.dumps(models,ensure_ascii=False,indent=2))
    print('DONE',sum(len(m['photos']) for m in models),'photos across',sum(bool(m['photos']) for m in models),'models',flush=True)
