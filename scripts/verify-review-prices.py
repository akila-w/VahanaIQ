#!/usr/bin/env python3
"""Build a complete price evidence register; never infer an exact price.

Confirmed = a model/trim/condition match in a primary agent/dealer source.
Secondary ranges and old launch prices remain separate from confirmed amounts.
"""
import json
import re
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'docs/catalogue-review'
data=json.loads((OUT/'input.json').read_text())
sources={s['url']:s for s in json.loads((OUT/'source-index.json').read_text())}
scan=json.loads((ROOT/'price-scan/review-2026-10-21/prices.json').read_text())
listings=json.loads((ROOT/'price-scan/review-2026-10-21/listings.json').read_text())
models={(m['make'],m['model']):m for m in data['models']}
rows=[]
def n(s):return re.sub('[^a-z0-9]','',unquote(s).lower())
def set_result(r,status,price,note,url=None,**kw):
    r.update(status=status,verifiedPrice=price,note=note,**kw)
    if url:r['verifiedSourceUrl']=url
def getrow(id):return next(r for r in rows if r['id']==id)

for v in data['vehicles']:
    source=sources.get(v['priceSourceUrl'],{})
    model=models[(v['make'],v['model'])]
    r=dict(id=v['id'],name=v['name'],inheritedPrice=v['price'],inheritedBasis=v['priceBasis'],
           inheritedSourceUrl=v['priceSourceUrl'],checkedOn='2026-10-21',status='unverified',
           verifiedPrice=None,verifiedSourceUrl=None,note='No exact current price substantiated in the pages checked.',
           checkedSources=[{'url':u,'result':sources.get(u,{}).get('status','search-index check')}
                           for u in dict.fromkeys([v['priceSourceUrl'],model['distributorUrl'],v['sourceUrl']])])
    title=source.get('title','');text=source.get('text','');url=v['priceSourceUrl']
    if source.get('status')=='unavailable':
        set_result(r,'blocked',None,'The inherited source could not be retrieved; its amount is not verified.')
    if 'motorguide.lk' in url:
        core=v['model']
        for s in [' Auto',' e-4ORCE',' Hybrid',' HEV',' EV',' MCE',' Plus']:
            core=core.replace(s,'')
        if n(core) not in n(title):
            set_result(r,'wrong-source',None,f'The linked page is for another model: {title.split(" Price")[0]}.')
        else:
            match=re.search(r'Price\s*:?\s*Rs\s*([\d.]+)M\s*[–-]\s*([\d.]+)M',text,re.I)
            if match:
                low,high=[round(float(x)*1e6) for x in match.groups()]
                set_result(r,'range-only',None,'A secondary review reports a model-level market range; it does not verify this exact trim or an agent quote.',url,reportedRange=[low,high])
    netloc = (urlsplit(url).netloc or '').lower()
    if ('dailymirror.lk' in netloc or netloc.endswith('dailymirror.lk')) and '302123' in url:
        set_result(r,'historical',None,'Amount matches a launch-price report dated 11/02/2025. Toyota currently requests a quote; a current price is not confirmed.',url,sourceDate='2025-02-11')
    if netloc == 'srilanka-promotions.com' or netloc.endswith('.srilanka-promotions.com'):
        set_result(r,'historical',None,'This is a 2025 promotional/launch-price page, not current agent evidence. Exact variant and current amount require confirmation.',url,sourceDate='2025')
    if netloc == 'firstcar.lk' or netloc.endswith('.firstcar.lk'):
        set_result(r,'unverified',None,'The linked specification page did not substantiate the inherited amount as a current asking price.')
    if v['make']=='Perodua':
        set_result(r,'unverified',None,'The official site displays a zero-value price placeholder. It does not substantiate the inherited amount. A quote is required.','https://www.peroduasl.lk/')
    rows.append(r)

# Existing scanner matches exact model/trim and brand-new condition. No +/-25%
# gate here: this is a review register, so even a large genuine change is shown.
for item in scan['vehicles']:
    r=getrow(item['id']);p=item['prices'][0];price=p['brand_new_price_lkr']
    set_result(r,'confirmed' if price==r['inheritedPrice'] else 'correction',price,
      'Matched the published agent amount or brand-new dealer listing. Confirm seller stock before purchase.',
      p['source_url'],evidence=p.get('evidence',''),condition='New',scope='listing' if 'listing' in p['price_basis'] else 'range/starting')

# Individually reviewed primary sources, including sources outside the scanner.
for suffix,price in [('mx3',11595000),('ax5',12695000),('ax7l',13695000)]:
    set_result(getrow(f'mahindra-xuv-3xo-{suffix}-official'),'confirmed',price,
      'Official starting price for this grade, inclusive of VAT.','https://mahindrasrilanka.lk/',scope='starting')
set_result(getrow('mg-hs-hybrid-range-official'),'confirmed',21450000,
 'Official model page publishes this amount.','https://mgsrilanka.lk/models/mg-hs-hybrid/',scope='model')
for suffix,price in [('style',22150000),('design',22700000)]:
    set_result(getrow(f'leapmotor-c10-reev-{suffix}-official'),'confirmed',price,
      'Official all-inclusive introductory price for this grade; offer duration is unspecified.','https://leapmotor.lk/',scope='introductory')
for suffix,price in [('accenta-1-0-automatic',8190000),('tekna-1-0-automatic',9390000),('n-connecta-1-0-turbo-cvt',9990000)]:
    set_result(getrow(f'nissan-magnite-{suffix}-official'),'confirmed',price,
      'Exact grade and transmission match on the official page, checked through the web index.','https://www.nissanlk.com/nissan-magnite/',scope='trim')
set_result(getrow('nissan-magnite-tekna-1-0-turbo-cvt-official'),'conflict',None,
 'Official page displays both LKR 10,590,000.00 and LKR 9,950,000.00 for Turbo CVT Tekna+. Neither matches the inherited LKR 10,790,000.00. Confirm the applicable offer with AMW.',
 'https://www.nissanlk.com/nissan-magnite/',reportedRange=[9950000,10590000])
for suffix,price,scope,note in [
 ('range-rover-sport',143296000,'Autobiography stock listing','Amount is for a specific Range Rover Sport Autobiography, not every Sport grade.'),
 ('range-rover-evoque',48970000,'S stock listing','Amount is for a specific Evoque S stock listing, not every Evoque grade.'),
 ('defender',99720682,'110 X-Dynamic SE stock listing','Amount is for a specific Defender 110 X-Dynamic SE; listings say available soon.')]:
    u='https://www.landrover.lk/stock-locator/new-vehicles/'+('defender' if suffix=='defender' else 'range-rover')
    set_result(getrow(f'land-rover-{suffix}-range-official'),'confirmed',price,note,u,scope=scope)
for model,price in [('Dashing',16950000),('X70 Plus',17500000),('T2',28500000)]:
    r=next(r for r in rows if r['name']=='Jetour '+model)
    set_result(r,'confirmed' if r['inheritedPrice']==price else 'correction',price,
      'Local distributor publishes this model starting price; an exact trim quote is still required.','https://www.euromotors.lk/index.html',scope='starting')

# Used cars are matched to their own model year and grade, never a newer press photo.
for v in data['vehicles']:
    if v['availability']!='used-listed':continue
    found=[l for l in listings if l['source']=='cartivate' and l['condition']=='Used' and l['year']==v['year']
           and n(v['model']) in n(l['title']) and (not v['trim'] or n(v['trim']) in n(l['title']))]
    if len(found)==1:
        l=found[0];r=getrow(v['id']);set_result(r,'confirmed' if r['inheritedPrice']==l['price'] else 'correction',l['price'],
          f"Matched this {l['year']} used-car listing ({l['mileageKm']:,} km); this is an individual asking price.",l['url'],scope='used listing',condition='Used')

set_result(getrow('mg-4-electric-range-official'),'conflict',None,
 'The official MG4 page has inconsistent model/price wording (MG U9 and 15,785 /Million). The inherited figure cannot be safely verified from it.',
 'https://mgsrilanka.lk/models/mg4-urban-ev/')
set_result(getrow('tata-nexon-range-official'),'specification-mismatch',None,
 'The cited 2025 promotion associates LKR 14,300,000.00 with Nexon EV. This catalogue entry describes a petrol Nexon; do not transfer the EV amount to it.',
 getrow('tata-nexon-range-official')['inheritedSourceUrl'])
for id,price,url,scope in [
 ('byd-atto-1-range-official',9300000,'byd-atto-1-dynamic','Dynamic grade; range entry needs a named trim'),
 ('byd-atto-2-range-official',13635000,'byd-atto-2','ATTO 2 model'),
 ('byd-sealion-5-premium-official',20745000,'byd-sealion-5-premium','Premium grade'),
 ('byd-sealion-5-dynamic-official',19477000,'byd-sealion-5-dynamic','Dynamic grade'),
 ('byd-sealion-6-premium-awd-official',27700000,'byd-sealion-6-premium','Premium grade'),
 ('byd-sealion-6-superior-official',23850000,'byd-sealion-6-superior','Superior grade')]:
    set_result(getrow(id),'correction',price,
      'Current official product page amount, valid through 31/12/2026. '+scope+'.',
      'https://www.johnkeellscgauto.com/product/'+url+'/',scope=scope,validUntil='2026-12-31')
set_result(getrow('mitsubishi-destinator-range-official'),'correction',26250000,
 'Official model FAQ publishes LKR 26,250,000.00, subject to change.','https://www.mitsubishisl.lk/destinator',scope='model')
for r in rows:
    # URLs explicitly checked outside the initial registry are inspectable too.
    if r.get('verifiedSourceUrl') and r['verifiedSourceUrl'] not in [x['url'] for x in r['checkedSources']]:
        r['checkedSources'].append({'url':r['verifiedSourceUrl'],'result':'reviewed primary source' if r['status'] in ['confirmed','correction'] else 'reviewed source'})

# Later source-backed scope additions retain their explicit primary-source evidence.
expansion=ROOT/'data/passenger-expansion.json'
if expansion.exists():
    for v in json.loads(expansion.read_text()):
        row=getrow(v['id'])
        source=sources.get(v['priceSourceUrl'],{})
        if v.get('priceVerifiedOn') and v.get('price') and format(v['price'],',') in source.get('text',''):
            set_result(row,'confirmed',v['price'],'Official advertised variant/offer; confirm exact specification and offer validity.',v['priceSourceUrl'],scope=v['priceScope'])

counts={s:sum(r['status']==s for r in rows) for s in sorted(set(r['status'] for r in rows))}
result={'checkedOn':'2026-10-21','counts':counts,'entries':rows,
 'method':'Each inherited source checked online; matching primary agent/dealer evidence takes priority. Old reports, secondary ranges, wrong-model links and ambiguous specifications do not establish an exact current price. The original snapshot is retained for comparison; reviewed amounts are applied separately.'}
(OUT/'prices.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(counts),len(rows),'entries')
