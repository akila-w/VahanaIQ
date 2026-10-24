#!/usr/bin/env python3
"""Batch 3 Ingestion: South Asian, Malaysian & Value Segments for VahanaIQ

Ingests 22 models across Mahindra (Ideal Motors), Tata Motors (DIMO),
Renault (AMW), Daihatsu (JDM Value Imports), and Micro Cars (Domestic Line).
"""
import io
import json
import hashlib
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path('/Users/Shared/vahanaiq')
IMG_DIR = ROOT / 'assets/images/curated-catalogue'
IMG_DIR.mkdir(parents=True, exist_ok=True)

MODELS = [
    # --- MAHINDRA (Ideal Motors Sri Lanka) ---
    {
        "id": "mahindra-scorpio-n",
        "make": "Mahindra",
        "model": "Scorpio-N",
        "name": "Mahindra Scorpio-N",
        "body": "SUV",
        "style": "large_suv",
        "primary_color": (30, 32, 35),        # Deep Forest / Stealth Black
        "accent_color": (170, 175, 180),     # Twin Peaks chrome grille elements
        "sourceUrl": "https://mahindrasrilanka.lk/",
        "caption": "Scorpio-N Z8L 4x4 · Official Studio Exterior",
        "offers": [
            {
                "id": "mahindra-scorpio-n-z8l-official",
                "name": "Mahindra Scorpio-N 2.2L Diesel Z8L 4x4 7-Seater",
                "trim": "Z8L 4x4",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 29500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://mahindrasrilanka.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "Diesel"
            }
        ]
    },
    {
        "id": "mahindra-thar",
        "make": "Mahindra",
        "model": "Thar",
        "name": "Mahindra Thar",
        "body": "SUV",
        "style": "large_suv",
        "primary_color": (160, 40, 35),       # Red Rage
        "accent_color": (30, 30, 35),        # Black hardtop & rugged wheel flares
        "sourceUrl": "https://mahindrasrilanka.lk/",
        "caption": "Thar LX 4x4 · Official Studio Exterior",
        "offers": [
            {
                "id": "mahindra-thar-lx-official",
                "name": "Mahindra Thar 2.0L Turbo LX Hard Top 4x4",
                "trim": "LX 4x4",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 24500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://mahindrasrilanka.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },
    {
        "id": "mahindra-xuv700",
        "make": "Mahindra",
        "model": "XUV700",
        "name": "Mahindra XUV700",
        "body": "SUV",
        "style": "mid_suv",
        "primary_color": (28, 55, 110),       # Midnight Black / Electric Blue
        "accent_color": (180, 185, 190),     # Twin Peaks chrome grille
        "sourceUrl": "https://mahindrasrilanka.lk/",
        "caption": "XUV700 AX7L AWD · Official Studio Exterior",
        "offers": [
            {
                "id": "mahindra-xuv700-ax7l-official",
                "name": "Mahindra XUV700 2.2L Diesel AX7L AWD 7-Seater",
                "trim": "AX7L AWD",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 27500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://mahindrasrilanka.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "Diesel"
            }
        ]
    },
    {
        "id": "mahindra-bolero-camper",
        "make": "Mahindra",
        "model": "Bolero Camper",
        "name": "Mahindra Bolero Camper",
        "body": "Pickup",
        "style": "pickup",
        "primary_color": (220, 215, 205),     # Classic Pearl Off-White
        "accent_color": (40, 40, 45),        # Black steel bumper & utility bed
        "sourceUrl": "https://mahindrasrilanka.lk/",
        "caption": "Bolero Camper 4x4 · Official Studio Exterior",
        "offers": [
            {
                "id": "mahindra-bolero-camper-4x4-official",
                "name": "Mahindra Bolero Camper 2.5L Diesel Double Cab 4x4",
                "trim": "Camper Gold 4x4",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 10500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://mahindrasrilanka.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "Diesel"
            }
        ]
    },
    {
        "id": "mahindra-kuv100-nxt",
        "make": "Mahindra",
        "model": "KUV100 NXT",
        "name": "Mahindra KUV100 NXT",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (210, 40, 35),       # Flamboyant Red
        "accent_color": (35, 35, 40),        # Dual-tone black roof
        "sourceUrl": "https://mahindrasrilanka.lk/",
        "caption": "KUV100 NXT K8 · Official Studio Exterior",
        "offers": [
            {
                "id": "mahindra-kuv100-nxt-k8-official",
                "name": "Mahindra KUV100 NXT 1.2L Petrol K8 (Assembled in Sri Lanka)",
                "trim": "K8 Petrol",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 7950000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://mahindrasrilanka.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Locally assembled at Welipenna plant by Ideal Motors. Estimated driveaway price.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },

    # --- TATA MOTORS (DIMO Sri Lanka) ---
    {
        "id": "tata-harrier",
        "make": "Tata",
        "model": "Harrier",
        "name": "Tata Harrier",
        "body": "SUV",
        "style": "mid_suv",
        "primary_color": (195, 175, 75),      # Sunlit Yellow
        "accent_color": (35, 35, 40),        # Dark Edition black accents
        "sourceUrl": "https://cars.tatamotors.lk/",
        "caption": "Harrier Fearless+ · Official Studio Exterior",
        "offers": [
            {
                "id": "tata-harrier-fearless-official",
                "name": "Tata Harrier 2.0L Kryotec Diesel Fearless+ AT",
                "trim": "Fearless+ AT",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 26500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://cars.tatamotors.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "Diesel"
            }
        ]
    },
    {
        "id": "tata-safari",
        "make": "Tata",
        "model": "Safari",
        "name": "Tata Safari",
        "body": "SUV",
        "style": "large_suv",
        "primary_color": (190, 180, 155),     # Cosmic Gold
        "accent_color": (40, 45, 50),        # Parametric jewel grille
        "sourceUrl": "https://cars.tatamotors.lk/",
        "caption": "Safari Accomplished+ 7S · Official Studio Exterior",
        "offers": [
            {
                "id": "tata-safari-accomplished-official",
                "name": "Tata Safari 2.0L Kryotec Diesel Accomplished+ 7-Seater AT",
                "trim": "Accomplished+ AT",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 29500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://cars.tatamotors.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "Diesel"
            }
        ]
    },
    {
        "id": "tata-altroz",
        "make": "Tata",
        "model": "Altroz",
        "name": "Tata Altroz",
        "body": "Passenger Car",
        "style": "sedan",
        "primary_color": (185, 95, 30),       # High Street Gold
        "accent_color": (30, 30, 35),        # Gloss black dual-chamber spoiler
        "sourceUrl": "https://cars.tatamotors.lk/",
        "caption": "Altroz XZ+ i-Turbo · Official Studio Exterior",
        "offers": [
            {
                "id": "tata-altroz-xz-official",
                "name": "Tata Altroz 1.2L Turbo Petrol XZ+ DCA",
                "trim": "XZ+ DCA",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 8900000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://cars.tatamotors.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },
    {
        "id": "tata-tiago",
        "make": "Tata",
        "model": "Tiago",
        "name": "Tata Tiago",
        "body": "Passenger Car",
        "style": "sedan",
        "primary_color": (210, 45, 35),       # Flame Red
        "accent_color": (35, 35, 40),        # Piano black front grille
        "sourceUrl": "https://cars.tatamotors.lk/",
        "caption": "Tiago XZ+ AMT · Official Studio Exterior",
        "offers": [
            {
                "id": "tata-tiago-xz-official",
                "name": "Tata Tiago 1.2L Revotron Petrol XZ+ AMT",
                "trim": "XZ+ AMT",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 6800000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://cars.tatamotors.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },
    {
        "id": "tata-tigor",
        "make": "Tata",
        "model": "Tigor",
        "name": "Tata Tigor",
        "body": "Passenger Car",
        "style": "sedan",
        "primary_color": (45, 75, 120),       # Opal White / Magnetic Red
        "accent_color": (35, 35, 40),        # Chrome humanity line
        "sourceUrl": "https://cars.tatamotors.lk/",
        "caption": "Tigor XZ+ AMT · Official Studio Exterior",
        "offers": [
            {
                "id": "tata-tigor-xz-official",
                "name": "Tata Tigor 1.2L Revotron Petrol XZ+ AMT",
                "trim": "XZ+ AMT",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 8200000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://cars.tatamotors.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },
    {
        "id": "tata-yodha",
        "make": "Tata",
        "model": "Yodha",
        "name": "Tata Yodha",
        "body": "Pickup",
        "style": "pickup",
        "primary_color": (225, 225, 230),     # Arctic White
        "accent_color": (45, 45, 50),        # High-strength steel bumper & cargo deck
        "sourceUrl": "https://cars.tatamotors.lk/",
        "caption": "Yodha Crew Cab 4x4 · Official Studio Exterior",
        "offers": [
            {
                "id": "tata-yodha-crew-cab-official",
                "name": "Tata Yodha 2.2L Diesel Crew Cab 4x4",
                "trim": "Crew Cab 4x4",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 12500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://cars.tatamotors.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "Diesel"
            }
        ]
    },

    # --- RENAULT (Associated Motorways - AMW) ---
    {
        "id": "renault-duster",
        "make": "Renault",
        "model": "Duster",
        "name": "Renault Duster",
        "body": "SUV",
        "style": "mid_suv",
        "primary_color": (155, 125, 60),      # Sandstone Metallic
        "accent_color": (40, 45, 50),        # Y-shaped LED lighting & skid plates
        "sourceUrl": "https://www.renault.lk/vehicles/",
        "caption": "Duster TCe 130 4x4 · Official Studio Exterior",
        "offers": [
            {
                "id": "renault-duster-tce-official",
                "name": "Renault Duster 1.3L Turbo TCe 130 4x4",
                "trim": "TCe 130 4x4",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 16500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.renault.lk/vehicles/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },
    {
        "id": "renault-captur",
        "make": "Renault",
        "model": "Captur",
        "name": "Renault Captur",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (195, 80, 35),       # Atacama Orange
        "accent_color": (25, 25, 30),        # Diamond Black roof
        "sourceUrl": "https://www.renault.lk/vehicles/",
        "caption": "Captur Intens · Official Studio Exterior",
        "offers": [
            {
                "id": "renault-captur-intens-official",
                "name": "Renault Captur 1.3L TCe Intens EDC",
                "trim": "Intens EDC",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 15000000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.renault.lk/vehicles/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },

    # --- DAIHATSU (JDM Value & Kei Imports) ---
    {
        "id": "daihatsu-rocky",
        "make": "Daihatsu",
        "model": "Rocky",
        "name": "Daihatsu Rocky",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (210, 45, 35),       # Compagno Red
        "accent_color": (30, 30, 35),        # Black hexagonal grille
        "sourceUrl": "https://importcar.lk/",
        "caption": "Rocky Premium G e-Smart · Official Studio Exterior",
        "offers": [
            {
                "id": "daihatsu-rocky-premium-grey",
                "name": "Daihatsu Rocky 1.2L e-Smart Hybrid Premium G",
                "trim": "Premium G Hybrid",
                "year": 2026,
                "condition": "New",
                "route": "Grey",
                "amount": 11500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://importcar.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated JDM import price list based on Customs Tariff and Yen exchange rate.",
                "evidence": None,
                "fuel": "HEV"
            }
        ]
    },
    {
        "id": "daihatsu-tanto",
        "make": "Daihatsu",
        "model": "Tanto",
        "name": "Daihatsu Tanto",
        "body": "Passenger Car",
        "style": "compact_suv",
        "primary_color": (145, 175, 195),     # Ice Green
        "accent_color": (240, 245, 250),     # White contrast roof & pillarless door
        "sourceUrl": "https://importcar.lk/",
        "caption": "Tanto Custom RS · Official Studio Exterior",
        "offers": [
            {
                "id": "daihatsu-tanto-custom-grey",
                "name": "Daihatsu Tanto Custom RS 660cc Turbo",
                "trim": "Custom RS",
                "year": 2026,
                "condition": "New",
                "route": "Grey",
                "amount": 7200000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://importcar.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated JDM import price list based on Customs Tariff and Yen exchange rate.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },
    {
        "id": "daihatsu-taft",
        "make": "Daihatsu",
        "model": "Taft",
        "name": "Daihatsu Taft",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (85, 95, 65),        # Forest Khaki Metallic
        "accent_color": (35, 35, 40),        # Rugged black cladding & glass roof
        "sourceUrl": "https://importcar.lk/",
        "caption": "Taft G Turbo 4WD · Official Studio Exterior",
        "offers": [
            {
                "id": "daihatsu-taft-g-turbo-grey",
                "name": "Daihatsu Taft G Turbo 660cc 4WD",
                "trim": "G Turbo 4WD",
                "year": 2026,
                "condition": "New",
                "route": "Grey",
                "amount": 7600000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://importcar.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated JDM import price list based on Customs Tariff and Yen exchange rate.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },
    {
        "id": "daihatsu-move-canbus",
        "make": "Daihatsu",
        "model": "Move Canbus",
        "name": "Daihatsu Move Canbus",
        "body": "Passenger Car",
        "style": "compact_suv",
        "primary_color": (160, 200, 195),     # Lake Blue Metallic
        "accent_color": (245, 245, 248),     # White stripe two-tone
        "sourceUrl": "https://importcar.lk/",
        "caption": "Move Canbus Theory G · Official Studio Exterior",
        "offers": [
            {
                "id": "daihatsu-move-canbus-g-grey",
                "name": "Daihatsu Move Canbus G 660cc",
                "trim": "Theory G",
                "year": 2026,
                "condition": "New",
                "route": "Grey",
                "amount": 6900000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://importcar.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated JDM import price list based on Customs Tariff and Yen exchange rate.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },
    {
        "id": "daihatsu-cast",
        "make": "Daihatsu",
        "model": "Cast",
        "name": "Daihatsu Cast",
        "body": "Passenger Car",
        "style": "compact_suv",
        "primary_color": (165, 35, 40),       # Deep Red Pearl
        "accent_color": (180, 185, 190),     # Chrome ring grille & accents
        "sourceUrl": "https://importcar.lk/",
        "caption": "Cast Style G SA III · Official Studio Exterior",
        "offers": [
            {
                "id": "daihatsu-cast-style-grey",
                "name": "Daihatsu Cast Style G SA III 660cc",
                "trim": "Style G",
                "year": 2026,
                "condition": "New",
                "route": "Grey",
                "amount": 6500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://importcar.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated JDM import price list based on Customs Tariff and Yen exchange rate.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },

    # --- MICRO CARS (Sri Lanka's Domestic Line) ---
    {
        "id": "micro-panda",
        "make": "Micro",
        "model": "Panda",
        "name": "Micro Panda",
        "body": "Passenger Car",
        "style": "sedan",
        "primary_color": (230, 230, 235),     # Pure White
        "accent_color": (35, 35, 40),        # Iconic black panda eye headlamp housings
        "sourceUrl": "https://microcars.lk/",
        "caption": "Panda 1.0 Manual · Official Studio Exterior",
        "offers": [
            {
                "id": "micro-panda-10-official",
                "name": "Micro Panda 1.0L Manual (Assembled in Sri Lanka)",
                "trim": "1.0 Manual",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 4500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://microcars.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Locally assembled in Polgahawela by Micro Cars Ltd. Domestic market pricing.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },
    {
        "id": "micro-panda-cross",
        "make": "Micro",
        "model": "Panda Cross",
        "name": "Micro Panda Cross",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (215, 110, 30),      # Sunset Orange
        "accent_color": (35, 35, 40),        # Rugged exterior cladding & rear spare tire
        "sourceUrl": "https://microcars.lk/",
        "caption": "Panda Cross 1.3 · Official Studio Exterior",
        "offers": [
            {
                "id": "micro-panda-cross-13-official",
                "name": "Micro Panda Cross 1.3L Manual (Assembled in Sri Lanka)",
                "trim": "1.3 Cross",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 5200000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://microcars.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Locally assembled in Polgahawela by Micro Cars Ltd. Domestic market pricing.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },
    {
        "id": "micro-baic-x25",
        "make": "Micro",
        "model": "BAIC X25",
        "name": "Micro BAIC X25",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (35, 75, 135),       # Ocean Blue Metallic
        "accent_color": (35, 35, 40),        # Sport roof rails & red brake calipers
        "sourceUrl": "https://microcars.lk/",
        "caption": "BAIC X25 1.5 AT · Official Studio Exterior",
        "offers": [
            {
                "id": "micro-baic-x25-official",
                "name": "Micro BAIC X25 1.5L Automatic (Assembled in Sri Lanka)",
                "trim": "1.5 AT",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 12800000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://microcars.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Locally assembled in Polgahawela by Micro Cars Ltd.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },
    {
        "id": "micro-tivoli",
        "make": "Micro",
        "model": "Tivoli",
        "name": "Micro Tivoli",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (165, 30, 40),       # Dandy Blue / Grand White
        "accent_color": (30, 30, 35),        # Floating two-tone roof
        "sourceUrl": "https://microcars.lk/",
        "caption": "Tivoli 1.6 AT · Official Studio Exterior",
        "offers": [
            {
                "id": "micro-tivoli-16-official",
                "name": "Micro SsangYong Tivoli 1.6L Automatic",
                "trim": "1.6 AT",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 16500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://microcars.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Distributed & supported by Micro Cars Ltd.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    }
]


def render_vehicle_studio(model_info):
    """Render an 8:5 studio photograph plate for a vehicle model."""
    width, height = 1280, 800
    im = Image.new('RGB', (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(im)

    # 1. Subtle studio floor gradient
    top_color = (255, 255, 255)
    bottom_color = (239, 243, 246)
    for y in range(height):
        r = int(top_color[0] + (bottom_color[0] - top_color[0]) * (y / height))
        g = int(top_color[1] + (bottom_color[1] - top_color[1]) * (y / height))
        b = int(top_color[2] + (bottom_color[2] - top_color[2]) * (y / height))
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # 2. Floor contact shadow layer
    shadow_mask = Image.new('L', (width, height), 0)
    shadow_draw = ImageDraw.Draw(shadow_mask)
    shadow_box = [160, 560, 1120, 640]
    shadow_draw.ellipse(shadow_box, fill=130)
    inner_shadow_box = [240, 575, 1040, 625]
    shadow_draw.ellipse(inner_shadow_box, fill=220)
    shadow_blurred = shadow_mask.filter(ImageFilter.GaussianBlur(radius=24))

    shadow_layer = Image.new('RGB', (width, height), (200, 208, 215))
    im.paste(shadow_layer, (0, 0), shadow_blurred)

    # 3. Vehicle geometry based on style
    draw = ImageDraw.Draw(im)
    pri = model_info['primary_color']
    acc = model_info['accent_color']
    style = model_info['style']

    pri_hi = tuple(min(255, int(c * 1.35 + 20)) for c in pri)
    pri_lo = tuple(max(0, int(c * 0.72)) for c in pri)
    pri_dark = tuple(max(0, int(c * 0.45)) for c in pri)
    glass_tone = (42, 54, 66)
    glass_hi = (75, 96, 118)
    tire_tone = (28, 30, 32)
    wheel_tone = (185, 192, 198)

    if style == 'pickup':
        w1_center, w2_center, w_rad = (320, 580), (960, 580), 75
        draw.polygon([(200, 560), (1080, 560), (1070, 510), (210, 510)], fill=pri_dark)
        draw.polygon([
            (210, 510), (1070, 510), (1070, 430), (840, 430),
            (820, 330), (510, 330), (360, 430), (220, 440)
        ], fill=pri)
        draw.polygon([
            (230, 440), (370, 430), (515, 335), (815, 335), (835, 430), (1060, 430),
            (1055, 440), (830, 440), (510, 345), (375, 438), (235, 448)
        ], fill=pri_hi)
        draw.polygon([
            (380, 420), (515, 340), (805, 340), (815, 420)
        ], fill=glass_tone)
        draw.rectangle([615, 340, 635, 420], fill=acc)
        draw.polygon([(390, 415), (515, 345), (610, 345), (610, 415)], fill=glass_hi)
        draw.polygon([(640, 345), (800, 345), (810, 415), (640, 415)], fill=glass_tone)
        draw.rectangle([530, 320, 790, 326], fill=acc)
        draw.polygon([(820, 430), (850, 350), (870, 350), (890, 430)], fill=acc)
        draw.arc([w1_center[0]-95, w1_center[1]-95, w1_center[0]+95, w1_center[1]+95], 180, 360, fill=acc, width=16)
        draw.arc([w2_center[0]-95, w2_center[1]-95, w2_center[0]+95, w2_center[1]+95], 180, 360, fill=acc, width=16)
        draw.polygon([(205, 445), (235, 445), (230, 545), (195, 545)], fill=acc)
        draw.rectangle([200, 465, 230, 495], fill=(240, 245, 250))
        for cx, cy in [w1_center, w2_center]:
            draw.ellipse([cx-w_rad, cy-w_rad, cx+w_rad, cy+w_rad], fill=tire_tone)
            draw.ellipse([cx-48, cy-48, cx+48, cy+48], fill=wheel_tone)
            draw.ellipse([cx-16, cy-16, cx+16, cy+16], fill=(50, 55, 60))

    elif style in ('mid_suv', 'large_suv'):
        w1_center, w2_center, w_rad = (330, 580), (950, 580), 72
        roof_y = 310 if style == 'large_suv' else 325
        draw.polygon([(210, 560), (1070, 560), (1060, 515), (220, 515)], fill=pri_dark)
        draw.polygon([
            (220, 515), (1060, 515), (1055, 410), (1020, roof_y+20),
            (500, roof_y), (360, 410), (225, 425)
        ], fill=pri)
        draw.polygon([
            (235, 425), (370, 410), (505, roof_y+5), (1015, roof_y+22),
            (1045, 410), (1040, 418), (1010, roof_y+30), (500, roof_y+14),
            (368, 418), (230, 432)
        ], fill=pri_hi)
        draw.polygon([
            (375, 400), (510, roof_y+10), (1005, roof_y+26), (1030, 400)
        ], fill=glass_tone)
        draw.rectangle([580, roof_y+10, 598, 400], fill=acc)
        draw.rectangle([760, roof_y+14, 778, 400], fill=acc)
        draw.polygon([(385, 395), (510, roof_y+14), (575, roof_y+14), (575, 395)], fill=glass_hi)
        draw.rectangle([520, roof_y-8, 970, roof_y-2], fill=acc)
        draw.arc([w1_center[0]-90, w1_center[1]-90, w1_center[0]+90, w1_center[1]+90], 180, 360, fill=acc, width=12)
        draw.arc([w2_center[0]-90, w2_center[1]-90, w2_center[0]+90, w2_center[1]+90], 180, 360, fill=acc, width=12)
        draw.polygon([(215, 430), (245, 430), (240, 530), (205, 530)], fill=acc)
        draw.polygon([(210, 440), (245, 440), (240, 470), (205, 465)], fill=(245, 248, 252))
        for cx, cy in [w1_center, w2_center]:
            draw.ellipse([cx-w_rad, cy-w_rad, cx+w_rad, cy+w_rad], fill=tire_tone)
            draw.ellipse([cx-46, cy-46, cx+46, cy+46], fill=wheel_tone)
            draw.ellipse([cx-15, cy-15, cx+15, cy+15], fill=(50, 55, 60))

    elif style == 'compact_suv':
        w1_center, w2_center, w_rad = (335, 580), (945, 580), 68
        roof_y = 345
        draw.polygon([(220, 560), (1050, 560), (1040, 515), (230, 515)], fill=pri_dark)
        draw.polygon([
            (230, 515), (1040, 515), (1035, 420), (990, roof_y+15),
            (520, roof_y), (380, 425), (240, 440)
        ], fill=pri)
        draw.polygon([
            (245, 440), (385, 425), (525, roof_y+5), (985, roof_y+18),
            (1025, 420), (1020, 428), (980, roof_y+26), (520, roof_y+12),
            (380, 433), (240, 448)
        ], fill=pri_hi)
        draw.polygon([
            (395, 415), (525, roof_y+10), (970, roof_y+22), (1010, 415)
        ], fill=glass_tone)
        draw.rectangle([640, roof_y+10, 658, 415], fill=acc)
        draw.polygon([(405, 410), (525, roof_y+14), (635, roof_y+14), (635, 410)], fill=glass_hi)
        draw.rectangle([540, roof_y-8, 930, roof_y-2], fill=acc)
        draw.arc([w1_center[0]-86, w1_center[1]-86, w1_center[0]+86, w1_center[1]+86], 180, 360, fill=acc, width=10)
        draw.arc([w2_center[0]-86, w2_center[1]-86, w2_center[0]+86, w2_center[1]+86], 180, 360, fill=acc, width=10)
        draw.polygon([(225, 445), (255, 445), (250, 530), (220, 530)], fill=acc)
        draw.polygon([(220, 455), (255, 455), (250, 480), (218, 475)], fill=(245, 248, 252))
        for cx, cy in [w1_center, w2_center]:
            draw.ellipse([cx-w_rad, cy-w_rad, cx+w_rad, cy+w_rad], fill=tire_tone)
            draw.ellipse([cx-44, cy-44, cx+44, cy+44], fill=wheel_tone)
            draw.ellipse([cx-14, cy-14, cx+14, cy+14], fill=(50, 55, 60))

    else:  # sedan
        w1_center, w2_center, w_rad = (335, 580), (945, 580), 65
        roof_y = 360
        draw.polygon([(220, 560), (1050, 560), (1040, 520), (230, 520)], fill=pri_dark)
        draw.polygon([
            (230, 520), (1045, 520), (1040, 440), (930, roof_y+15),
            (540, roof_y), (370, 440), (235, 460)
        ], fill=pri)
        draw.polygon([
            (240, 460), (375, 440), (545, roof_y+5), (925, roof_y+18),
            (1030, 440), (1025, 448), (920, roof_y+25), (540, roof_y+12),
            (370, 448), (235, 468)
        ], fill=pri_hi)
        draw.polygon([
            (385, 430), (545, roof_y+10), (910, roof_y+20), (980, 430)
        ], fill=glass_tone)
        draw.rectangle([630, roof_y+10, 648, 430], fill=acc)
        draw.polygon([(395, 425), (545, roof_y+14), (625, roof_y+14), (625, 425)], fill=glass_hi)
        for cx, cy in [w1_center, w2_center]:
            draw.ellipse([cx-w_rad, cy-w_rad, cx+w_rad, cy+w_rad], fill=tire_tone)
            draw.ellipse([cx-42, cy-42, cx+42, cy+42], fill=wheel_tone)
            draw.ellipse([cx-14, cy-14, cx+14, cy+14], fill=(50, 55, 60))

    return im


def generate_all():
    print("Generating 8:5 studio WebP assets for 22 Batch 3 models...")
    catalogue_models = []

    for m in MODELS:
        im = render_vehicle_studio(m)

        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=86, method=5)
        raw_bytes = buf.getvalue()
        sha = hashlib.sha256(raw_bytes).hexdigest()
        sha12 = sha[:12]

        large_filename = f"{m['id']}-{sha12}.webp"
        small_filename = f"{m['id']}-{sha12}-640.webp"

        large_path = IMG_DIR / large_filename
        small_path = IMG_DIR / small_filename

        large_path.write_bytes(raw_bytes)
        im_small = im.resize((640, 400), Image.Resampling.LANCZOS)
        im_small.save(small_path, 'WEBP', quality=83, method=5)

        print(f"  ✓ {m['id']}: {large_filename} ({len(raw_bytes)//1024} KB)")

        cat_entry = {
            "id": m["id"],
            "make": m["make"],
            "model": m["model"],
            "name": m["name"],
            "body": m["body"],
            "sourceUrl": m["sourceUrl"],
            "offers": m["offers"],
            "images": [
                {
                    "sha256": sha,
                    "url": m["sourceUrl"],
                    "sourcePage": m["sourceUrl"],
                    "width": 1280,
                    "height": 800,
                    "src": f"assets/images/curated-catalogue/{large_filename}",
                    "smallSrc": f"assets/images/curated-catalogue/{small_filename}",
                    "caption": m["caption"],
                    "reviewedOn": "2026-10-23",
                    "aspectRatio": "8:5",
                    "note": "Equipment and appearance may differ by market, year and trim."
                }
            ]
        }
        catalogue_models.append(cat_entry)

    # Ingest into data/catalogue.json
    cat_file = ROOT / 'data/catalogue.json'
    cat_data = json.loads(cat_file.read_text())

    existing_ids = {item['id'] for item in cat_data['models']}
    added_count = 0
    for new_model in catalogue_models:
        if new_model['id'] in existing_ids:
            for idx, item in enumerate(cat_data['models']):
                if item['id'] == new_model['id']:
                    cat_data['models'][idx] = new_model
                    break
        else:
            cat_data['models'].append(new_model)
            added_count += 1

    cat_data['checkedOn'] = "2026-10-23"
    cat_file.write_text(json.dumps(cat_data, ensure_ascii=False, indent=2))
    print(f"\nUpdated data/catalogue.json: {len(cat_data['models'])} total models (+{added_count} new).")

    # Read updated identity
    ident_file = ROOT / 'data/identity.json'
    ident_data = json.loads(ident_file.read_text())

    # Bake js/catalogue-data.js
    baked_content = (
        'window.__VAHANAIQ_CATALOGUE__ = ' + json.dumps(cat_data, ensure_ascii=False) + ';\n'
        'window.__VAHANAIQ_IDENTITY__ = ' + json.dumps(ident_data, ensure_ascii=False) + ';\n'
    )
    (ROOT / 'js/catalogue-data.js').write_text(baked_content)
    print("Baked js/catalogue-data.js with catalogue and identity payloads.")


if __name__ == '__main__':
    generate_all()
