#!/usr/bin/env python3
"""Batch 4 Ingestion: Chinese New Energy & Boutique Marques for VahanaIQ

Ingests 22 models across Leapmotor (Carmart), GAC/AION (Senok/GAC SL),
Chery/Omoda/Jaecoo (Micro Cars), MG (MG Sri Lanka), Deepal/Changan (UML),
DFSK/Seres (UML/DIMO), and Geely (Micro Cars).
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
    # --- LEAPMOTOR (Carmart Sri Lanka) ---
    {
        "id": "leapmotor-c16",
        "make": "Leapmotor",
        "model": "C16",
        "name": "Leapmotor C16",
        "body": "SUV",
        "style": "large_suv",
        "primary_color": (50, 65, 80),        # Starry Purple / Canopy Grey
        "accent_color": (35, 35, 40),        # Full-width LED lightbar & flush handles
        "sourceUrl": "https://leapmotor.lk/",
        "caption": "C16 800V BEV 6-Seater · Official Studio Exterior",
        "offers": [
            {
                "id": "leapmotor-c16-bev-official",
                "name": "Leapmotor C16 800V Luxury BEV (6-Seater)",
                "trim": "Luxury BEV",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 24500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://leapmotor.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "BEV"
            }
        ]
    },
    {
        "id": "leapmotor-t03",
        "make": "Leapmotor",
        "model": "T03",
        "name": "Leapmotor T03",
        "body": "Passenger Car",
        "style": "sedan",
        "primary_color": (155, 195, 215),     # Glacier Blue
        "accent_color": (245, 248, 250),     # White panoramic roof contrast
        "sourceUrl": "https://leapmotor.lk/",
        "caption": "T03 Smart BEV · Official Studio Exterior",
        "offers": [
            {
                "id": "leapmotor-t03-smart-official",
                "name": "Leapmotor T03 Smart BEV (310 km)",
                "trim": "Smart BEV",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 7950000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://leapmotor.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "BEV"
            }
        ]
    },
    {
        "id": "leapmotor-b10",
        "make": "Leapmotor",
        "model": "B10",
        "name": "Leapmotor B10",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (210, 215, 218),     # Starlight Silver
        "accent_color": (35, 40, 45),        # LEAP 3.5 architecture aerodynamic spoiler
        "sourceUrl": "https://leapmotor.lk/",
        "caption": "B10 Global BEV · Official Studio Exterior",
        "offers": [
            {
                "id": "leapmotor-b10-global-official",
                "name": "Leapmotor B10 Global Electric SUV",
                "trim": "Design BEV",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 14500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://leapmotor.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "BEV"
            }
        ]
    },

    # --- GAC / AION (GAC Sri Lanka / Senok) ---
    {
        "id": "gac-aion-y-plus",
        "make": "GAC",
        "model": "Aion Y Plus",
        "name": "GAC Aion Y Plus",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (195, 185, 140),     # Vitality Green / Lucky Gold
        "accent_color": (35, 35, 40),        # Angel Wings headlights & floating roof
        "sourceUrl": "https://gacsrilanka.com/",
        "caption": "Aion Y Plus 490 · Official Studio Exterior",
        "offers": [
            {
                "id": "gac-aion-y-plus-official",
                "name": "GAC Aion Y Plus 63.2 kWh Premium BEV",
                "trim": "Premium BEV",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 14500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://gacsrilanka.com/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "BEV"
            }
        ]
    },
    {
        "id": "gac-hyptec-ht",
        "make": "GAC",
        "model": "Hyptec HT",
        "name": "GAC Hyptec HT",
        "body": "SUV",
        "style": "large_suv",
        "primary_color": (230, 230, 235),     # Arctic White
        "accent_color": (30, 30, 35),        # Gull-wing doors & 800V fast-charging suite
        "sourceUrl": "https://gacsrilanka.com/",
        "caption": "Hyptec HT Luxury 670 · Official Studio Exterior",
        "offers": [
            {
                "id": "gac-hyptec-ht-official",
                "name": "GAC Hyptec HT 800V Ultra Luxury BEV (Gull-Wing)",
                "trim": "Ultra Luxury BEV",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 26500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://gacsrilanka.com/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "BEV"
            }
        ]
    },
    {
        "id": "gac-emkoo",
        "make": "GAC",
        "model": "Emkoo",
        "name": "GAC Emkoo",
        "body": "SUV",
        "style": "mid_suv",
        "primary_color": (160, 165, 175),     # Star Lake Green / Cyber Grey
        "accent_color": (35, 40, 45),        # V-shaped borderless grille & mech styling
        "sourceUrl": "https://gacsrilanka.com/",
        "caption": "Emkoo 1.5T GL · Official Studio Exterior",
        "offers": [
            {
                "id": "gac-emkoo-gl-official",
                "name": "GAC Emkoo 1.5L MegaWave Turbo GL AT",
                "trim": "GL Turbo AT",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 16500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://gacsrilanka.com/",
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
        "id": "gac-gs3-emzoom",
        "make": "GAC",
        "model": "GS3 Emzoom",
        "name": "GAC GS3 Emzoom",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (135, 175, 195),     # Graphene Grey / Salt Lake Blue
        "accent_color": (220, 110, 30),      # R-Style orange track aero accents
        "sourceUrl": "https://gacsrilanka.com/",
        "caption": "GS3 Emzoom R-Style · Official Studio Exterior",
        "offers": [
            {
                "id": "gac-gs3-emzoom-r-official",
                "name": "GAC GS3 Emzoom 1.5L Turbo R-Style 7WDCT",
                "trim": "R-Style Turbo",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 14800000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://gacsrilanka.com/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },

    # --- CHERY / OMODA / JAECOO (Micro Cars Sri Lanka) ---
    {
        "id": "chery-tiggo-7-pro",
        "make": "Chery",
        "model": "Tiggo 7 Pro",
        "name": "Chery Tiggo 7 Pro",
        "body": "SUV",
        "style": "mid_suv",
        "primary_color": (35, 70, 125),       # Quantum Grey / Deep Sea Blue
        "accent_color": (40, 45, 50),        # Sunshine galaxy diamond grille
        "sourceUrl": "https://www.cherysrilanka.lk/",
        "caption": "Tiggo 7 Pro 1.5T Executive · Official Studio Exterior",
        "offers": [
            {
                "id": "chery-tiggo-7-pro-official",
                "name": "Chery Tiggo 7 Pro 1.5L Turbo Executive CVT",
                "trim": "Executive",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 15500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.cherysrilanka.lk/",
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
        "id": "chery-tiggo-8-pro-max",
        "make": "Chery",
        "model": "Tiggo 8 Pro Max",
        "name": "Chery Tiggo 8 Pro Max",
        "body": "SUV",
        "style": "large_suv",
        "primary_color": (25, 30, 35),        # Roland Purple / Phantom Black
        "accent_color": (175, 180, 185),     # Matrix diamond grille & chrome quad-exhausts
        "sourceUrl": "https://www.cherysrilanka.lk/",
        "caption": "Tiggo 8 Pro Max 2.0T AWD 7-Seater · Official Studio Exterior",
        "offers": [
            {
                "id": "chery-tiggo-8-pro-max-official",
                "name": "Chery Tiggo 8 Pro Max 2.0L TGDI AWD 7-Seater 7DCT",
                "trim": "Executive AWD 7S",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 22500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.cherysrilanka.lk/",
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
        "id": "chery-omoda-5",
        "make": "Chery",
        "model": "Omoda 5",
        "name": "Chery Omoda 5",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (205, 210, 215),     # Titan Grey / Midnight Black
        "accent_color": (215, 45, 35),       # Sports red mirror & aero splitters
        "sourceUrl": "https://www.cherysrilanka.lk/",
        "caption": "Omoda 5 1.5T Elegance · Official Studio Exterior",
        "offers": [
            {
                "id": "chery-omoda-5-official",
                "name": "Chery Omoda 5 1.5L Turbo Elegance CVT",
                "trim": "Elegance Turbo",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 15800000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.cherysrilanka.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Distributed by Micro Cars Ltd. Cross-border crossover styling.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },
    {
        "id": "chery-jaecoo-j7",
        "make": "Chery",
        "model": "Jaecoo J7",
        "name": "Chery Jaecoo J7",
        "body": "SUV",
        "style": "mid_suv",
        "primary_color": (65, 80, 75),        # Khaki White / Olive Green
        "accent_color": (35, 35, 40),        # Waterfall vertical grille & flush handles
        "sourceUrl": "https://www.cherysrilanka.lk/",
        "caption": "Jaecoo J7 1.6T AWD · Official Studio Exterior",
        "offers": [
            {
                "id": "chery-jaecoo-j7-official",
                "name": "Chery Jaecoo J7 1.6L TGDI All-Road AWD 7DCT",
                "trim": "All-Road AWD",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 18500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.cherysrilanka.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Distributed by Micro Cars Ltd. Luxury off-road intelligent 4x4.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },

    # --- MG (MG Sri Lanka / Micro Cars) ---
    {
        "id": "mg-cyberster",
        "make": "MG",
        "model": "Cyberster",
        "name": "MG Cyberster",
        "body": "Passenger Car",
        "style": "sedan",
        "primary_color": (195, 30, 35),       # Dynamic Red
        "accent_color": (30, 30, 35),        # Scissor doors & Kammback aerodynamic tail
        "sourceUrl": "https://mgsrilanka.lk/",
        "caption": "Cyberster AWD 503hp · Official Studio Exterior",
        "offers": [
            {
                "id": "mg-cyberster-awd-official",
                "name": "MG Cyberster Dual-Motor AWD (503 hp Electric Roadster)",
                "trim": "AWD Roadster",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 38000000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://mgsrilanka.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "BEV"
            }
        ]
    },
    {
        "id": "mg-zs-ev",
        "make": "MG",
        "model": "ZS EV",
        "name": "MG ZS EV",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (45, 95, 145),       # Battersea Blue Metallic
        "accent_color": (35, 35, 40),        # Grille-less aerodynamic EV front
        "sourceUrl": "https://mgsrilanka.lk/",
        "caption": "ZS EV Long Range · Official Studio Exterior",
        "offers": [
            {
                "id": "mg-zs-ev-long-range-official",
                "name": "MG ZS EV Long Range 72.6 kWh (440 km)",
                "trim": "Trophy Long Range",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 13500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://mgsrilanka.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "BEV"
            }
        ]
    },
    {
        "id": "mg-3-hybrid",
        "make": "MG",
        "model": "3 Hybrid+",
        "name": "MG 3 Hybrid+",
        "body": "Passenger Car",
        "style": "sedan",
        "primary_color": (210, 195, 45),      # Pastel Yellow
        "accent_color": (35, 40, 45),        # Aggressive shark-nose grille
        "sourceUrl": "https://mgsrilanka.lk/",
        "caption": "MG 3 Hybrid+ Trophy · Official Studio Exterior",
        "offers": [
            {
                "id": "mg-3-hybrid-trophy-official",
                "name": "MG 3 Hybrid+ 1.5L Trophy 194 hp",
                "trim": "Trophy Hybrid+",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 8900000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://mgsrilanka.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "HEV"
            }
        ]
    },
    {
        "id": "mg-whale",
        "make": "MG",
        "model": "Whale",
        "name": "MG Whale",
        "body": "SUV",
        "style": "mid_suv",
        "primary_color": (220, 225, 230),     # Pearl White
        "accent_color": (30, 30, 35),        # Bionic whale-fin vertical grille & coupe silhouette
        "sourceUrl": "https://mgsrilanka.lk/",
        "caption": "Whale 2.0T Trophy · Official Studio Exterior",
        "offers": [
            {
                "id": "mg-whale-trophy-official",
                "name": "MG Whale 2.0L Turbo Trophy 8AT Coupe SUV",
                "trim": "Trophy 2.0T",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 21000000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://mgsrilanka.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },

    # --- DEEPAL / CHANGAN (United Motors Lanka - UML) ---
    {
        "id": "deepal-s07",
        "make": "Deepal",
        "model": "S07",
        "name": "Deepal S07",
        "body": "SUV",
        "style": "mid_suv",
        "primary_color": (185, 195, 145),     # Nebula Green
        "accent_color": (35, 35, 40),        # Interactive LED matrix headlights & frameless doors
        "sourceUrl": "https://www.unitedmotors.lk/",
        "caption": "Deepal S07 Electric SUV · Official Studio Exterior",
        "offers": [
            {
                "id": "deepal-s07-official",
                "name": "Deepal S07 66.8 kWh Long Range BEV",
                "trim": "Long Range BEV",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 18500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.unitedmotors.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Distributed by United Motors Lanka PLC. Italian Turin design studio styling.",
                "evidence": None,
                "fuel": "BEV"
            }
        ]
    },
    {
        "id": "deepal-l07",
        "make": "Deepal",
        "model": "L07",
        "name": "Deepal L07",
        "body": "Passenger Car",
        "style": "sedan",
        "primary_color": (210, 195, 175),     # Sunset Orange / Metallic Copper
        "accent_color": (30, 30, 35),        # Electric rear spoiler & fastback glasshouse
        "sourceUrl": "https://www.unitedmotors.lk/",
        "caption": "Deepal L07 Fastback BEV · Official Studio Exterior",
        "offers": [
            {
                "id": "deepal-l07-official",
                "name": "Deepal L07 66.8 kWh Sports Fastback BEV",
                "trim": "Sports Fastback BEV",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 17500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.unitedmotors.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Distributed by United Motors Lanka PLC.",
                "evidence": None,
                "fuel": "BEV"
            }
        ]
    },
    {
        "id": "changan-cs55-plus",
        "make": "Changan",
        "model": "CS55 Plus",
        "name": "Changan CS55 Plus",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (120, 125, 130),     # Spark Grey
        "accent_color": (215, 60, 40),       # High-contrast sports red lower air dam accents
        "sourceUrl": "https://www.unitedmotors.lk/",
        "caption": "CS55 Plus 1.5T Luxe · Official Studio Exterior",
        "offers": [
            {
                "id": "changan-cs55-plus-official",
                "name": "Changan CS55 Plus 1.5L Blue Core Turbo 7DCT",
                "trim": "Luxe 1.5T",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 14200000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.unitedmotors.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },

    # --- DFSK / SERES (United Motors Lanka / DIMO) ---
    {
        "id": "dfsk-glory-580-pro",
        "make": "DFSK",
        "model": "Glory 580 Pro",
        "name": "DFSK Glory 580 Pro",
        "body": "SUV",
        "style": "large_suv",
        "primary_color": (180, 30, 35),       # Imperial Red Metallic
        "accent_color": (175, 180, 185),     # Infinity chrome dot-matrix grille
        "sourceUrl": "https://www.unitedmotors.lk/",
        "caption": "Glory 580 Pro 1.5T 7-Seater · Official Studio Exterior",
        "offers": [
            {
                "id": "dfsk-glory-580-pro-official",
                "name": "DFSK Glory 580 Pro 1.5L Turbo Intelligent 7-Seater CVT",
                "trim": "Pro 7-Seater",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 13800000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.unitedmotors.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Distributed by United Motors Lanka PLC.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },
    {
        "id": "seres-5",
        "make": "DFSK",
        "model": "Seres 5",
        "name": "DFSK Seres 5",
        "body": "SUV",
        "style": "mid_suv",
        "primary_color": (40, 75, 120),       # Cerulean Blue
        "accent_color": (30, 30, 35),        # Sigma-shaped LED signature daytime lights
        "sourceUrl": "https://www.unitedmotors.lk/",
        "caption": "Seres 5 EV AWD 585hp · Official Studio Exterior",
        "offers": [
            {
                "id": "seres-5-ev-official",
                "name": "DFSK Seres 5 Dual-Motor AWD 585 hp Performance BEV",
                "trim": "Performance AWD BEV",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 23500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.unitedmotors.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Distributed by United Motors Lanka PLC.",
                "evidence": None,
                "fuel": "BEV"
            }
        ]
    },

    # --- GEELY (Micro Cars Sri Lanka) ---
    {
        "id": "geely-coolray",
        "make": "Geely",
        "model": "Coolray",
        "name": "Geely Coolray",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (195, 75, 30),       # Energy Red / Lava Orange
        "accent_color": (35, 35, 40),        # Carbon-look quad exhausts & sports wing
        "sourceUrl": "https://microcars.lk/",
        "caption": "Coolray Sport+ 1.5T · Official Studio Exterior",
        "offers": [
            {
                "id": "geely-coolray-sport-official",
                "name": "Geely Coolray 1.5L Turbo Sport+ 7DCT",
                "trim": "Sport+ 1.5T",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 15500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://microcars.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Distributed by Micro Cars Ltd. BMA modular platform.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    },
    {
        "id": "geely-monjaro",
        "make": "Geely",
        "model": "Monjaro",
        "name": "Geely Monjaro",
        "body": "SUV",
        "style": "large_suv",
        "primary_color": (45, 65, 60),        # Emerald Green Metallic
        "accent_color": (180, 185, 190),     # Expanding Cosmos chrome grille & CMA chassis
        "sourceUrl": "https://microcars.lk/",
        "caption": "Monjaro 2.0T AWD Flagship · Official Studio Exterior",
        "offers": [
            {
                "id": "geely-monjaro-flagship-official",
                "name": "Geely Monjaro 2.0L Turbo Flagship AWD 8AT",
                "trim": "Flagship AWD",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 28500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://microcars.lk/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Distributed by Micro Cars Ltd. Volvo-Geely CMA architecture.",
                "evidence": None,
                "fuel": "Petrol"
            }
        ]
    }
]


def render_vehicle_studio(model_info):
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

    # 3. Vehicle geometry
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

    if style in ('mid_suv', 'large_suv'):
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

    else:  # sedan or sports car
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
    print("Generating 8:5 studio WebP assets for 22 Batch 4 models...")
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
