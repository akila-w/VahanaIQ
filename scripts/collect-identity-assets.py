#!/usr/bin/env python3
"""Fetch authentic brand marks directly from official manufacturer home portals."""
import json, ssl, subprocess, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/identity'
OUT.mkdir(exist_ok=True)

# Direct OEM home-market sources (local to the manufacturer, NOT Sri Lanka)
OEM_SOURCES = {
    "Toyota": {
        "urls": [
            "https://global.toyota/common/img/logo.svg",
            "https://toyota.jp/cmn/img/header/logo.png"
        ],
        "home": "https://global.toyota/en/",
        "dark": False,
        "name": "toyota"
    },
    "Honda": {
        "urls": [
            "https://global.honda/en/top-page/common/img/discover/logo-discoverHonda.svg",
            "https://www.honda.co.jp/shared/templates/v1/images/header/logo_honda.svg"
        ],
        "home": "https://global.honda/en/",
        "dark": False,
        "name": "honda"
    },
    "Nissan": {
        "urls": [
            "https://www.nissan-global.com/library/assets/img/hd_logo.svg",
            "https://www.nissan.co.jp/COMMON/IMG/LOGO/nissan_logo.svg"
        ],
        "home": "https://www.nissan-global.com/EN/",
        "dark": False,
        "name": "nissan"
    },
    "Suzuki": {
        "urls": [
            "https://www.suzuki.co.jp/commons/v1/img/suzukiLogo.svg",
            "https://www.globalsuzuki.com/common/img/logo.svg"
        ],
        "home": "https://www.suzuki.co.jp/",
        "dark": False,
        "name": "suzuki"
    },
    "Mazda": {
        "urls": [
            "https://www.mazda.co.jp/etc.clientlibs/mazda-co-jp/clientlibs/clientlib-site/resources/images/mazdalogo_white.svg"
        ],
        "home": "https://www.mazda.co.jp/",
        "dark": True,
        "name": "mazda"
    },
    "Mitsubishi": {
        "urls": [
            "https://www.mitsubishi-motors.com/content/dam/mitsubishi-motors/common/img/header_logo.png"
        ],
        "home": "https://www.mitsubishi-motors.com/en/",
        "dark": False,
        "name": "mitsubishi"
    },
    "Daihatsu": {
        "urls": [
            "https://www.daihatsu.com/en/common/img/logo.svg"
        ],
        "home": "https://www.daihatsu.co.jp/",
        "dark": False,
        "name": "daihatsu"
    },
    "Isuzu": {
        "urls": [
            "https://www.isuzu.co.jp/world/app-files/img/symbol/logo.png"
        ],
        "home": "https://www.isuzu.co.jp/world/",
        "dark": False,
        "name": "isuzu"
    },
    "Hyundai": {
        "urls": [
            "https://www.hyundai.com/etc/designs/hyundai/ww/en/images/common/logo.png"
        ],
        "home": "https://www.hyundai.com/worldwide/en",
        "dark": False,
        "name": "hyundai"
    },
    "Kia": {
        "urls": [
            "https://worldwide.kia.com/asset/image/common/logo-w.svg"
        ],
        "home": "https://worldwide.kia.com/int",
        "dark": True,
        "name": "kia"
    },
    "BYD": {
        "urls": [
            "https://www.bydglobal.com/material/group-official-website/cn/home/byd-logo.svg"
        ],
        "home": "https://www.bydglobal.com/en/index.html",
        "dark": True,
        "name": "byd"
    },
    "Chery": {
        "urls": [
            "https://www.cheryinternational.com/data/tms/website/html/images/header/logo-new-black.png"
        ],
        "home": "https://www.cheryinternational.com/",
        "dark": False,
        "name": "chery"
    },
    "GWM": {
        "urls": [
            "https://www.gwm-global.com/dist/images/home-page/brand_right_logo.png"
        ],
        "home": "https://www.gwm-global.com/",
        "dark": False,
        "name": "gwm"
    },
    "GAC": {
        "urls": [
            "https://www.gac-motor.com/dist/images/logo.png"
        ],
        "home": "https://www.gac-motor.com/",
        "dark": False,
        "name": "gac"
    },
    "Jetour": {
        "urls": [
            "https://www.jetourglobal.com/static/images/header/logo.png"
        ],
        "home": "https://www.jetourglobal.com/",
        "dark": False,
        "name": "jetour"
    },
    "Leapmotor": {
        "urls": [
            "https://www.leapmotor.com/images/common/logo.svg"
        ],
        "home": "https://www.leapmotor.com/",
        "dark": True,
        "name": "leapmotor"
    },
    "Tata": {
        "urls": [
            "https://www.tatamotors.com/wp-content/themes/TataMotors/images/Tata-Motors-logo.svg"
        ],
        "home": "https://www.tatamotors.com/",
        "dark": False,
        "name": "tata"
    },
    "Mahindra": {
        "urls": [
            "https://auto.mahindra.com/dw/image/v2/BKRC_PRD/on/demandware.static/-/Sites-amc-Library/default/dw38e8ffcd/homepage/composite-logo-343x192.png"
        ],
        "home": "https://auto.mahindra.com/",
        "dark": False,
        "name": "mahindra"
    },
    "Perodua": {
        "urls": [
            "https://www.perodua.com.my/assets/car/traz/traz_emblem_img_2x.webp"
        ],
        "home": "https://www.perodua.com.my/",
        "dark": False,
        "name": "perodua"
    },
    "Audi": {
        "urls": [
            "https://www.audi.com/content/dam/gbp2/experience-audi/audi-brand/audi-rings.svg"
        ],
        "home": "https://www.audi.com/en.html",
        "dark": False,
        "name": "audi"
    },
    "BMW": {
        "urls": [
            "https://www.bmw.com/etc.clientlibs/settings/wcm/designs/bmwcom/base/resources/ci2020/img/BMW_Grey-Grey_Logo.svg"
        ],
        "home": "https://www.bmw.de/",
        "dark": False,
        "name": "bmw"
    },
    "Mercedes-Benz": {
        "urls": [
            "https://www.mercedes-benz.com/content/dam/brandhub/global/logos/mb-star.svg"
        ],
        "home": "https://www.mercedes-benz.de/",
        "dark": False,
        "name": "mercedes-benz"
    },
    "Porsche": {
        "urls": [
            "https://cdn.ui.porsche.com/porsche-design-system/crest/porsche-crest.svg"
        ],
        "home": "https://www.porsche.com/germany/",
        "dark": False,
        "name": "porsche"
    },
    "Volkswagen": {
        "urls": [
            "https://www.volkswagen.de/etc.clientlibs/clientlibs/vwa-ngw18/ngw18-frontend/apps/resources/statics/img/vw-logo-2x.png"
        ],
        "home": "https://www.volkswagen.de/",
        "dark": False,
        "name": "volkswagen"
    },
    "Land Rover": {
        "urls": [
            "https://www.landrover.co.uk/content/dam/lrdx/logo/lrdx-brand-logo-dark.svg"
        ],
        "home": "https://www.landrover.co.uk/",
        "dark": False,
        "name": "land-rover"
    },
    "Jaguar": {
        "urls": [
            "https://www.jaguar.co.uk/content/dam/jaguar/global/logos/jaguar-logo.svg"
        ],
        "home": "https://www.jaguar.co.uk/",
        "dark": False,
        "name": "jaguar"
    },
    "MINI": {
        "urls": [
            "https://www.mini.co.uk/content/dam/mini/common/images/logo/mini-logo.svg"
        ],
        "home": "https://www.mini.co.uk/",
        "dark": False,
        "name": "mini"
    },
    "Peugeot": {
        "urls": [
            "https://www.peugeot.fr/content/dam/peugeot/global/logos/peugeot-logo-2021.svg"
        ],
        "home": "https://www.peugeot.fr/",
        "dark": False,
        "name": "peugeot"
    },
    "Renault": {
        "urls": [
            "https://www.renault.fr/content/dam/renault/FR/redesign/brand-logo-dark.svg"
        ],
        "home": "https://www.renault.fr/",
        "dark": False,
        "name": "renault"
    },
    "Jeep": {
        "urls": [
            "https://www.jeep.com/content/dam/fca-brands/na/jeep/en_us/global/header/jeep-logo.svg"
        ],
        "home": "https://www.jeep.com/",
        "dark": False,
        "name": "jeep"
    },
    "MG": {
        "urls": [
            "https://www.mg.co.uk/sites/default/files/mg-logo.svg"
        ],
        "home": "https://www.mg.co.uk/",
        "dark": False,
        "name": "mg"
    }
}

ident_path = ROOT / 'data/identity.json'
ident = json.loads(ident_path.read_text()) if ident_path.exists() else {"brands": {}, "models": {}}

for make, meta in OEM_SOURCES.items():
    slug = meta["name"]
    for u in meta["urls"]:
        try:
            cmd = ['curl', '-s', '-k', '-L', '--max-time', '6',
                   '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                   u]
            data = subprocess.check_output(cmd, stderr=subprocess.DEVNULL)
            if len(data) > 150 and b'<html' not in data[:200].lower():
                ext = u.split('.')[-1].split('?')[0]
                fname = f"{slug}.{ext}"
                (OUT / fname).write_bytes(data)
                ident['brands'][make] = {
                    "localPath": f"../assets/identity/{fname}",
                    "sourceUrl": meta["home"],
                    "origin": f"{make} Official Manufacturer Home Portal",
                    "dark": meta["dark"]
                }
                print(f"Downloaded {make:15} -> {fname} ({len(data)} B)")
                break
        except Exception:
            pass

(ROOT / 'data/identity.json').write_text(json.dumps(ident, indent=2))
(ROOT / 'docs/catalogue-review/identity.json').write_text(json.dumps(ident, indent=2))
(ROOT / 'js/identity-data.js').write_text('export const identity = ' + json.dumps(ident, indent=2) + ';\n')

cat_file = ROOT / 'data/catalogue.json'
cat = json.loads(cat_file.read_text())
(ROOT / 'js/catalogue-data.js').write_text(
    'window.__VAHANAIQ_CATALOGUE__ = ' + json.dumps(cat, ensure_ascii=False) + ';\n'
    'window.__VAHANAIQ_IDENTITY__ = ' + json.dumps(ident, ensure_ascii=False) + ';\n'
)
print("Updated identity manifest and re-baked catalogue-data.js!")
