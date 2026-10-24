#!/usr/bin/env python3
import os, sys, json, urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path('/Users/Shared/vahanaiq')
DEST = ROOT / 'assets/identity'
DEST.mkdir(exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

DOWNLOADS = [
    {
        "brand": "Chery",
        "url": "https://logos-world.net/wp-content/uploads/2021/08/Chery-Emblem.png",
        "filename": "chery.png",
        "make": "Chery"
    },
    {
        "brand": "Daihatsu",
        "url": "https://download.logo.wine/logo/Daihatsu/Daihatsu-Logo.wine.png",
        "filename": "daihatsu.png",
        "make": "Daihatsu"
    },
    {
        "brand": "Kia",
        "url": "https://logos-world.net/wp-content/uploads/2021/03/Kia-Logo.png",
        "filename": "kia.png",
        "make": "Kia"
    },
    {
        "brand": "Leapmotor",
        "url": "https://images.seeklogo.com/logo-png/50/2/leapmotor-logo-png_seeklogo-505249.png",
        "filename": "leapmotor.png",
        "make": "Leapmotor"
    },
    {
        "brand": "Mahindra",
        "url": "https://upload.wikimedia.org/wikipedia/commons/d/da/Mahindra_Automotive_new_logo.png",
        "filename": "mahindra.png",
        "make": "Mahindra"
    },
    {
        "brand": "Mazda",
        "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/46/Mazda_logo_2024.svg/1920px-Mazda_logo_2024.svg.png",
        "filename": "mazda.png",
        "make": "Mazda"
    },
    {
        "brand": "Mercedes-Benz",
        "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9e/Mercedes-Benz_Logo_2010.svg/3840px-Mercedes-Benz_Logo_2010.svg.png",
        "filename": "mercedes-benz.png",
        "make": "Mercedes-Benz"
    },
    {
        "brand": "Mitsubishi",
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Mitsubishi_Motors_Logo.svg/2560px-Mitsubishi_Motors_Logo.svg.png",
        "fallback_url": "https://upload.wikimedia.org/wikipedia/commons/5/5a/Mitsubishi_Motors_Logo.svg",
        "filename": "mitsubishi.png",
        "make": "Mitsubishi"
    },
    {
        "brand": "Nissan",
        "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/23/Nissan_2020_logo.svg/1280px-Nissan_2020_logo.svg.png",
        "filename": "nissan.png",
        "make": "Nissan"
    },
    {
        "brand": "Porsche",
        "url": "https://www.edigitalagency.com.au/wp-content/uploads/Porsche-logo-PNG-large-size.png",
        "fallback_url": "https://cdn.freebiesupply.com/logos/large/2x/porsche-1-logo-black-and-white.png",
        "filename": "porsche.png",
        "make": "Porsche"
    },
    {
        "brand": "Toyota",
        "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7e/Logo_Toyota.svg/960px-Logo_Toyota.svg.png",
        "filename": "toyota.png",
        "make": "Toyota"
    }
]

def auto_crop(path):
    try:
        img = Image.open(path).convert('RGBA')
        # If there is a solid white background with no alpha, let's make white transparent if needed, or get bbox
        # Check alpha channel
        alpha = img.split()[-1]
        bbox = alpha.getbbox()
        # If alpha is completely opaque (255 everywhere, e.g. white background jpeg/png)
        if not bbox or alpha.getextrema() == (255, 255):
            # Check corners to see if background is white
            corners = [img.getpixel((0, 0)), img.getpixel((img.width - 1, 0)), img.getpixel((0, img.height - 1)), img.getpixel((img.width - 1, img.height - 1))]
            if all(c[0] > 240 and c[1] > 240 and c[2] > 240 for c in corners):
                # Convert pure white to transparent
                datas = img.getdata()
                new_data = []
                for item in datas:
                    if item[0] > 245 and item[1] > 245 and item[2] > 245:
                        new_data.append((255, 255, 255, 0))
                    else:
                        new_data.append(item)
                img.putdata(new_data)
                bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
        img.save(path, 'PNG')
        print(f"Cropped {path.name}: {img.size}")
    except Exception as e:
        print(f"Error cropping {path}: {e}")

results = {}
for item in DOWNLOADS:
    name = item["brand"]
    url = item["url"]
    out_path = DEST / item["filename"]
    success = False
    for target_url in [url, item.get("fallback_url")]:
        if not target_url:
            continue
        try:
            print(f"Fetching {name} from {target_url}...")
            req = urllib.request.Request(target_url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
                if len(data) > 500:
                    out_path.write_bytes(data)
                    print(f"  Downloaded {len(data)} bytes to {out_path.name}")
                    auto_crop(out_path)
                    success = True
                    results[item["make"]] = f"../assets/identity/{item['filename']}"
                    break
        except Exception as err:
            print(f"  Failed from {target_url}: {err}")
    if not success:
        print(f"!! FAILED to download {name}")

# Now update data/identity.json with the new localPaths and sourceUrls
ident_file = ROOT / 'data/identity.json'
with open(ident_file, 'r') as f:
    ident = json.load(f)

for item in DOWNLOADS:
    make = item["make"]
    if make in results:
        if make not in ident["brands"]:
            ident["brands"][make] = {}
        ident["brands"][make]["localPath"] = results[make]
        ident["brands"][make]["sourceUrl"] = item["url"]
        ident["brands"][make]["adaptive"] = False  # Full color / black marks don't need dark inversion

# Make sure Tata and Micro are properly tracked
if "Tata" in ident["brands"]:
    ident["brands"]["Tata"]["localPath"] = "../assets/identity/tata.svg"
    ident["brands"]["Tata"]["adaptive"] = False
if "Micro" in ident["brands"]:
    ident["brands"]["Micro"]["localPath"] = "../assets/identity/micro.png"
    ident["brands"]["Micro"]["adaptive"] = False

with open(ident_file, 'w') as f:
    json.dump(ident, f, indent=2)

# Update js/identity-data.js and js/catalogue-data.js
(ROOT / 'js/identity-data.js').write_text('export const identity = ' + json.dumps(ident, indent=2) + ';\n')

cat_file = ROOT / 'data/catalogue.json'
with open(cat_file, 'r') as f:
    cat = json.load(f)

(ROOT / 'js/catalogue-data.js').write_text(
    'window.__VAHANAIQ_CATALOGUE__ = ' + json.dumps(cat, ensure_ascii=False) + ';\n'
    'window.__VAHANAIQ_IDENTITY__ = ' + json.dumps(ident, ensure_ascii=False) + ';\n'
)

print("Finished updating identity and catalogue data!")
