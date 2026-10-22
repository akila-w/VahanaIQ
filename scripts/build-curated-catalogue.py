#!/usr/bin/env python3
"""Build the separate catalogue from explicit image selections and price evidence.

No ranking, inherited hero flag or unreviewed candidate can select an image here.
Run with Pillow installed. Originals and the earlier review library are preserved.
"""
from pathlib import Path
from PIL import Image, ImageOps, ImageChops
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'docs/catalogue-rebuild'
OUT = ROOT / 'assets/images/curated-catalogue'
OUT.mkdir(exist_ok=True)
# Inputs (seed, selections, prices) stay in docs/catalogue-rebuild, which is a working folder and
# is excluded from the published site. The catalogue itself is published from data/ and js/ so no
# page ever has to serve anything out of docs/. See _config.yml.
OUT_DATA = ROOT / 'data'
OUT_JS = ROOT / 'js'
OUT_DATA.mkdir(exist_ok=True)
seed = json.loads((DATA / 'seed.json').read_text())
selections = json.loads((DATA / 'selections.json').read_text())
prices = json.loads((DATA / 'prices.json').read_text())
offers = {p['id']: p for p in prices['offers']}


def frame(photo, slug):
    source = ROOT / photo['localPath'].removeprefix('../')
    if hashlib.sha256(source.read_bytes()).hexdigest() != photo['sha256']:
        raise ValueError(f'Image bytes differ from the selected source: {source}')
    if '.pdf' in photo['url'].lower() or '.pdf' in photo['sourcePage'].lower():
        raise ValueError('PDF extracts are excluded from this catalogue')
    with Image.open(source) as original:
        im = ImageOps.exif_transpose(original).convert('RGBA')
        if photo.get('crop'):
            im = im.crop(tuple(round(v * (im.width if i % 2 == 0 else im.height))
                               for i, v in enumerate(photo['crop'])))
        transparent = photo.get('mode') != 'scene' and im.getextrema()[3][0] < 255
        corners = [im.getpixel(p) for p in [(0, 0), (im.width-1, 0),
                                            (0, im.height-1), (im.width-1, im.height-1)]]
        white = photo.get('mode') != 'scene' and all(min(c[:3]) > 238 for c in corners)
        zoom = float(photo.get('zoom', 1.0))
        focus = tuple(photo.get('focus', [0.5, 0.5]))
        if transparent or white:
            flat = Image.new('RGBA', im.size, 'white')
            flat.alpha_composite(im)
            diff = ImageChops.difference(flat.convert('RGB'), Image.new('RGB', im.size, 'white'))
            box = diff.convert('L').point(lambda x: 255 if x > 24 else 0).getbbox()
            if box:
                im = im.crop(box)
            im = ImageOps.contain(im, (round(1160*zoom), round(680*zoom)), Image.Resampling.LANCZOS)
            if im.width > 1280 or im.height > 800:
                # A zoom above 1 is allowed to run past the card; the overflow is trimmed.
                w, h = min(im.width, 1280), min(im.height, 800)
                left = round((im.width - w) * focus[0])
                top = round((im.height - h) * focus[1])
                im = im.crop((left, top, left + w, top + h))
            # A consistent silhouette scale on a continuous backdrop, without an inset border.
            canvas = Image.new('RGBA', (1280, 800), 'white')
            canvas.alpha_composite(im, ((1280-im.width)//2, (800-im.height)//2))
        else:
            # Crop to the card aspect, then resize. At zoom 1 this is exactly ImageOps.fit.
            ratio = 1280 / 800
            if im.width / im.height >= ratio:
                crop_h, crop_w = im.height, ratio * im.height
            else:
                crop_w, crop_h = im.width, im.width / ratio
            crop_w, crop_h = crop_w / zoom, crop_h / zoom
            left = (im.width - crop_w) * focus[0]
            top = (im.height - crop_h) * focus[1]
            canvas = im.resize((1280, 800), Image.Resampling.LANCZOS,
                                box=(left, top, left + crop_w, top + crop_h))
        name = slug + '-' + photo['sha256'][:12]
        large = OUT / (name + '.webp')
        small = OUT / (name + '-640.webp')
        canvas = canvas.convert('RGB')
        canvas.save(large, 'WEBP', quality=86, method=5)
        canvas.resize((640, 400), Image.Resampling.LANCZOS).save(small, 'WEBP', quality=83, method=5)
    return {k: photo[k] for k in ['sha256', 'url', 'sourcePage', 'width', 'height']} | {
        'src': str(large.relative_to(ROOT)), 'smallSrc': str(small.relative_to(ROOT)),
        'caption': photo.get('displayCaption', 'Manufacturer Image'),
        'reviewedOn': '2026-10-22', 'aspectRatio': '8:5',
        'note': photo.get('note', 'Equipment and appearance may differ by market, year and trim.'),
    }


models = []
for m in seed['models']:
    selection = selections.get(m['name'])
    if not selection or not selection.get('images'):
        continue
    model_images = [frame(p, m['id']) for p in selection['images']]
    images_by_sha = {img['sha256']: img for img in model_images}
    record = {
        'id': m['id'], 'make': m['make'], 'model': m['model'], 'name': m['name'],
        'body': {'Passenger car':'Passenger Car','Passenger van':'Passenger Van'}.get(m['category'],m['category']), 'sourceUrl': m['distributorUrl'],
        'images': model_images,
        'offers': [],
    }
    for v in m['variants']:
        offer = dict(offers[v['id']])
        offer['fuel'] = v.get('fuel')
        if offer['kind'] == 'quote':
            # An unrelated inherited price URL is never presented as useful evidence.
            offer['sourceUrl'] = m['distributorUrl']
            offer['note'] = 'A matching current numerical price has not been substantiated. Request a written quotation.'
        if v['id'] in selection.get('variantImages', {}):
            variant = selection['variantImages'][v['id']]
            # One file per source: a trim image already in the gallery is reused.
            offer['image'] = images_by_sha.get(variant['sha256']) or frame(variant, m['id']+'-japan')
        record['offers'].append(offer)
    models.append(record)

result = {'schemaVersion': 1, 'checkedOn': '2026-10-22', 'models': models,
          'scope': 'Passenger vehicles and pickups in the existing Sri Lankan vehicle register. Coverage is not exhaustive.',
          'imagePolicy': 'Visually selected official website imagery. Manuals, adverts and colour repetitions excluded.',
          'pricePolicy': 'Published local prices and asking prices, with individual sources. Quote requests remain explicit.'}
(OUT_DATA / 'catalogue.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
identity_path = ROOT / 'data/identity.json'
if not identity_path.exists():
    identity_path = ROOT / 'docs/catalogue-review/identity.json'
identity_obj = json.loads(identity_path.read_text()) if identity_path.exists() else {}
(OUT_JS / 'catalogue-data.js').write_text(
    'window.__VAHANAIQ_CATALOGUE__ = ' + json.dumps(result, ensure_ascii=False) + ';\n'
    'window.__VAHANAIQ_IDENTITY__ = ' + json.dumps(identity_obj, ensure_ascii=False) + ';\n'
)
print(f'{len(models)} models; {sum(len(m["images"]) for m in models)} selected images; '
      f'{sum(o["amount"] is not None for m in models for o in m["offers"])} priced offers')
