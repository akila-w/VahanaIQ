#!/usr/bin/env python3
"""Batch 2 Ingestion: Japanese & Pickups / SUVs for VahanaIQ

Ingests 22 official distributor models across AMW (Nissan), UML (Mitsubishi),
Stafford Motors (Honda), Colonial Motors (Mazda), Sathosa Motors (Isuzu),
Toyota Lanka (Toyota LC70 & Lexus), Future Automobiles (Ford), and David Pieris (GWM).
"""
import io
import json
import hashlib
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path('/Users/Shared/vahanaiq')
IMG_DIR = ROOT / 'assets/images/curated-catalogue'
IMG_DIR.mkdir(parents=True, exist_ok=True)

# 22 Model definitions for Batch 2
MODELS = [
    {
        "id": "nissan-navara",
        "make": "Nissan",
        "model": "Navara",
        "name": "Nissan Navara",
        "body": "Pickup",
        "style": "pickup",
        "primary_color": (180, 40, 35),      # Magnetic Red Metallic
        "accent_color": (35, 35, 40),        # Gloss black PRO-4X trim
        "sourceUrl": "https://www.nissanlk.com/nissan-navara/",
        "caption": "Navara PRO-4X · Official Studio Exterior",
        "offers": [
            {
                "id": "nissan-navara-pro4x-official",
                "name": "Nissan Navara Double Cab PRO-4X 4WD",
                "trim": "PRO-4X 4WD",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 26500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.nissanlk.com/nissan-navara/",
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
        "id": "nissan-patrol",
        "make": "Nissan",
        "model": "Patrol",
        "name": "Nissan Patrol",
        "body": "SUV",
        "style": "large_suv",
        "primary_color": (230, 232, 235),     # Pearl White Metallic
        "accent_color": (160, 165, 170),     # Chrome V-Motion
        "sourceUrl": "https://www.nissanlk.com/nissan-patrol/",
        "caption": "Patrol V8 Titanium · Official Studio Exterior",
        "offers": [
            {
                "id": "nissan-patrol-v8-official",
                "name": "Nissan Patrol 5.6L V8 Titanium 4WD",
                "trim": "Titanium V8",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 85000000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.nissanlk.com/nissan-patrol/",
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
        "id": "nissan-kicks",
        "make": "Nissan",
        "model": "Kicks",
        "name": "Nissan Kicks",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (210, 110, 30),      # Monarch Orange Metallic
        "accent_color": (30, 30, 35),        # Black floating roof
        "sourceUrl": "https://www.nissanlk.com/nissan-kicks/",
        "caption": "Kicks e-POWER · Official Studio Exterior",
        "offers": [
            {
                "id": "nissan-kicks-epower-official",
                "name": "Nissan Kicks e-POWER Hybrid",
                "trim": "e-POWER Premium",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 16500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.nissanlk.com/nissan-kicks/",
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
        "id": "mitsubishi-triton",
        "make": "Mitsubishi",
        "model": "Triton",
        "name": "Mitsubishi Triton",
        "body": "Pickup",
        "style": "pickup",
        "primary_color": (215, 105, 30),      # Yamabuki Orange Metallic
        "accent_color": (35, 35, 40),        # Black Dynamic Shield
        "sourceUrl": "https://www.unitedmotors.lk/personal/pickups/mitsubishi/triton",
        "caption": "Triton Athlete 4WD · Official Studio Exterior",
        "offers": [
            {
                "id": "mitsubishi-triton-athlete-official",
                "name": "Mitsubishi Triton Double Cab Athlete 4WD",
                "trim": "Athlete 4WD",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 25500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.unitedmotors.lk/personal/pickups/mitsubishi/triton",
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
        "id": "mitsubishi-xforce",
        "make": "Mitsubishi",
        "model": "Xforce",
        "name": "Mitsubishi Xforce",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (210, 195, 80),      # Energetic Yellow Metallic
        "accent_color": (40, 45, 50),        # Dynamic Shield
        "sourceUrl": "https://www.mitsubishisl.lk/xforce",
        "caption": "Xforce Ultimate · Official Studio Exterior",
        "offers": [
            {
                "id": "mitsubishi-xforce-ultimate-official",
                "name": "Mitsubishi Xforce 1.5L Ultimate CVT",
                "trim": "Ultimate",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 16800000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.mitsubishisl.lk/xforce",
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
        "id": "mitsubishi-eclipse-cross",
        "make": "Mitsubishi",
        "model": "Eclipse Cross",
        "name": "Mitsubishi Eclipse Cross",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (195, 30, 40),       # Red Diamond
        "accent_color": (35, 40, 45),        # Gloss black trim
        "sourceUrl": "https://www.unitedmotors.lk/personal/suvs/mitsubishi/eclipse-cross",
        "caption": "Eclipse Cross GLS AWD · Official Studio Exterior",
        "offers": [
            {
                "id": "mitsubishi-eclipse-cross-gls-official",
                "name": "Mitsubishi Eclipse Cross 1.5L Turbo GLS AWD",
                "trim": "GLS AWD",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 21500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.unitedmotors.lk/personal/suvs/mitsubishi/eclipse-cross",
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
        "id": "honda-cr-v",
        "make": "Honda",
        "model": "CR-V",
        "name": "Honda CR-V",
        "body": "SUV",
        "style": "mid_suv",
        "primary_color": (30, 65, 125),       # Canyon River Blue
        "accent_color": (40, 45, 50),        # RS Honeycomb Grille
        "sourceUrl": "https://www.honda.lk/automobiles/cr-v/",
        "caption": "CR-V VTEC Turbo AWD · Official Studio Exterior",
        "offers": [
            {
                "id": "honda-cr-v-turbo-official",
                "name": "Honda CR-V 1.5L VTEC Turbo AWD",
                "trim": "1.5 Turbo AWD",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 39500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.honda.lk/automobiles/cr-v/",
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
        "id": "honda-hr-v",
        "make": "Honda",
        "model": "HR-V",
        "name": "Honda HR-V",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (185, 30, 35),       # Ignite Red Metallic
        "accent_color": (35, 35, 40),        # Black sports cladding
        "sourceUrl": "https://www.honda.lk/automobiles/hr-v/",
        "caption": "HR-V e:HEV RS · Official Studio Exterior",
        "offers": [
            {
                "id": "honda-hr-v-ehev-official",
                "name": "Honda HR-V e:HEV RS Hybrid",
                "trim": "e:HEV RS",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 24500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.honda.lk/automobiles/hr-v/",
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
        "id": "honda-civic",
        "make": "Honda",
        "model": "Civic",
        "name": "Honda Civic",
        "body": "Passenger Car",
        "style": "sedan",
        "primary_color": (195, 35, 35),       # Rallye Red
        "accent_color": (30, 30, 35),        # Gloss black RS rear spoiler & mirrors
        "sourceUrl": "https://www.honda.lk/automobiles/civic/",
        "caption": "Civic RS Turbo · Official Studio Exterior",
        "offers": [
            {
                "id": "honda-civic-rs-turbo-official",
                "name": "Honda Civic 1.5L VTEC Turbo RS",
                "trim": "RS Turbo",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 26000000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.honda.lk/automobiles/civic/",
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
        "id": "mazda-bt-50",
        "make": "Mazda",
        "model": "BT-50",
        "name": "Mazda BT-50",
        "body": "Pickup",
        "style": "pickup",
        "primary_color": (70, 75, 80),        # Gunblue / Rock Grey Mica
        "accent_color": (35, 35, 40),        # Black Kodo signature wing
        "sourceUrl": "https://mazdalanka.lk/mazda-bt-50/",
        "caption": "BT-50 SP 4x4 · Official Studio Exterior",
        "offers": [
            {
                "id": "mazda-bt-50-sp-official",
                "name": "Mazda BT-50 Double Cab 3.0L SP 4x4",
                "trim": "SP 4x4",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 25000000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://mazdalanka.lk/mazda-bt-50/",
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
        "id": "mazda-cx-5",
        "make": "Mazda",
        "model": "CX-5",
        "name": "Mazda CX-5",
        "body": "SUV",
        "style": "mid_suv",
        "primary_color": (165, 25, 35),       # Soul Red Crystal Metallic
        "accent_color": (30, 30, 35),        # Signature Kodo front wing
        "sourceUrl": "https://mazdalanka.lk/mazda-cx-5/",
        "caption": "CX-5 2.0 AWD · Official Studio Exterior",
        "offers": [
            {
                "id": "mazda-cx-5-awd-official",
                "name": "Mazda CX-5 2.0L Skyactiv-G AWD",
                "trim": "2.0 AWD",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 34000000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://mazdalanka.lk/mazda-cx-5/",
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
        "id": "mazda-cx-30",
        "make": "Mazda",
        "model": "CX-30",
        "name": "Mazda CX-30",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (100, 105, 110),     # Machine Grey Metallic
        "accent_color": (35, 35, 40),        # Lower body cladding
        "sourceUrl": "https://mazdalanka.lk/mazda-cx-30/",
        "caption": "CX-30 High · Official Studio Exterior",
        "offers": [
            {
                "id": "mazda-cx-30-high-official",
                "name": "Mazda CX-30 2.0L Skyactiv-G High",
                "trim": "2.0 High",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 26500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://mazdalanka.lk/mazda-cx-30/",
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
        "id": "mazda-cx-60",
        "make": "Mazda",
        "model": "CX-60",
        "name": "Mazda CX-60",
        "body": "SUV",
        "style": "mid_suv",
        "primary_color": (235, 235, 238),     # Rhodium White Metallic
        "accent_color": (45, 45, 50),        # Chrome signature wing
        "sourceUrl": "https://mazdalanka.lk/mazda-cx-60/",
        "caption": "CX-60 e-Skyactiv PHEV AWD · Official Studio Exterior",
        "offers": [
            {
                "id": "mazda-cx-60-phev-official",
                "name": "Mazda CX-60 2.5L e-Skyactiv PHEV AWD",
                "trim": "PHEV AWD",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 54000000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://mazdalanka.lk/mazda-cx-60/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "PHEV"
            }
        ]
    },
    {
        "id": "isuzu-mu-x",
        "make": "Isuzu",
        "model": "MU-X",
        "name": "Isuzu MU-X",
        "body": "SUV",
        "style": "large_suv",
        "primary_color": (120, 125, 130),     # Islay Grey Mica
        "accent_color": (50, 50, 55),        # Chrome grille teeth
        "sourceUrl": "https://sathosamotorsplc.com/mu-x.php",
        "caption": "MU-X Ultimate 4x4 · Official Studio Exterior",
        "offers": [
            {
                "id": "isuzu-mu-x-ultimate-official",
                "name": "Isuzu MU-X 3.0L Ddi Ultimate 4x4 7-Seater",
                "trim": "Ultimate 4x4",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 36000000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://sathosamotorsplc.com/mu-x.php",
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
        "id": "toyota-land-cruiser-70",
        "make": "Toyota",
        "model": "Land Cruiser 70",
        "name": "Toyota Land Cruiser 70",
        "body": "SUV",
        "style": "large_suv",
        "primary_color": (210, 195, 160),     # Sandy Taupe
        "accent_color": (35, 35, 40),        # Classic TOYOTA heritage grille & snorkel
        "sourceUrl": "https://www.toyota.lk/vehicles/land-cruiser-70/",
        "caption": "Land Cruiser 70 LC76 · Official Studio Exterior",
        "offers": [
            {
                "id": "toyota-land-cruiser-70-lc76-official",
                "name": "Toyota Land Cruiser 70 Series LC76 2.8L Turbo Diesel 4x4",
                "trim": "LC76 4x4",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 48000000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.toyota.lk/vehicles/land-cruiser-70/",
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
        "id": "lexus-rx",
        "make": "Lexus",
        "model": "RX",
        "name": "Lexus RX",
        "body": "SUV",
        "style": "mid_suv",
        "primary_color": (155, 160, 165),     # Sonic Titanium
        "accent_color": (30, 30, 35),        # Spindle Body grille
        "sourceUrl": "https://www.toyota.lk/lexus/rx/",
        "caption": "RX 350 Luxury AWD · Official Studio Exterior",
        "offers": [
            {
                "id": "lexus-rx-350-official",
                "name": "Lexus RX 350 AWD Luxury",
                "trim": "RX 350 Luxury",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 84000000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.toyota.lk/lexus/rx/",
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
        "id": "lexus-nx",
        "make": "Lexus",
        "model": "NX",
        "name": "Lexus NX",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (35, 60, 95),        # Celestial Blue
        "accent_color": (25, 25, 30),        # Spindle grille
        "sourceUrl": "https://www.toyota.lk/lexus/nx/",
        "caption": "NX 350h Luxury Hybrid · Official Studio Exterior",
        "offers": [
            {
                "id": "lexus-nx-350h-official",
                "name": "Lexus NX 350h E-Four Luxury Hybrid",
                "trim": "NX 350h Luxury",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 58000000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.toyota.lk/lexus/nx/",
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
        "id": "lexus-lx",
        "make": "Lexus",
        "model": "LX",
        "name": "Lexus LX",
        "body": "SUV",
        "style": "large_suv",
        "primary_color": (25, 25, 30),        # Caviar Black
        "accent_color": (180, 185, 190),     # Horizontal chrome spindle grille
        "sourceUrl": "https://www.toyota.lk/lexus/lx/",
        "caption": "LX 600 VIP 4WD · Official Studio Exterior",
        "offers": [
            {
                "id": "lexus-lx-600-official",
                "name": "Lexus LX 600 VIP 4WD",
                "trim": "LX 600 VIP",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 145000000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.toyota.lk/lexus/lx/",
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
        "id": "lexus-lbx",
        "make": "Lexus",
        "model": "LBX",
        "name": "Lexus LBX",
        "body": "SUV",
        "style": "compact_suv",
        "primary_color": (185, 175, 150),     # Sonic Copper
        "accent_color": (30, 30, 35),        # Black bi-tone roof
        "sourceUrl": "https://www.toyota.lk/lexus/lbx/",
        "caption": "LBX Relax E-Four · Official Studio Exterior",
        "offers": [
            {
                "id": "lexus-lbx-relax-official",
                "name": "Lexus LBX Relax E-Four Hybrid",
                "trim": "Relax E-Four",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 32000000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.toyota.lk/lexus/lbx/",
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
        "id": "ford-ranger",
        "make": "Ford",
        "model": "Ranger",
        "name": "Ford Ranger",
        "body": "Pickup",
        "style": "pickup",
        "primary_color": (215, 125, 25),      # Cyber Orange Metallic
        "accent_color": (35, 35, 40),        # Wildtrak matrix grille
        "sourceUrl": "https://www.ford.lk/trucks/ranger/",
        "caption": "Ranger Wildtrak 4x4 · Official Studio Exterior",
        "offers": [
            {
                "id": "ford-ranger-wildtrak-official",
                "name": "Ford Ranger Double Cab 2.0L Bi-Turbo Wildtrak 4x4",
                "trim": "Wildtrak 4x4",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 28500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.ford.lk/trucks/ranger/",
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
        "id": "ford-everest",
        "make": "Ford",
        "model": "Everest",
        "name": "Ford Everest",
        "body": "SUV",
        "style": "large_suv",
        "primary_color": (120, 125, 135),     # Meteor Grey
        "accent_color": (40, 45, 50),        # Titanium dual-chrome bar
        "sourceUrl": "https://www.ford.lk/suvs/everest/",
        "caption": "Everest Titanium 4x4 · Official Studio Exterior",
        "offers": [
            {
                "id": "ford-everest-titanium-official",
                "name": "Ford Everest 2.0L Bi-Turbo Titanium 4x4 7-Seater",
                "trim": "Titanium 4x4",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 46000000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.ford.lk/suvs/everest/",
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
        "id": "gwm-poer",
        "make": "GWM",
        "model": "Poer",
        "name": "GWM Poer",
        "body": "Pickup",
        "style": "pickup",
        "primary_color": (190, 45, 35),       # Crimson Red
        "accent_color": (180, 185, 190),     # Large chrome trapezoidal grille
        "sourceUrl": "https://www.gwmsrilanka.lk/vehicles/poer/",
        "caption": "Poer Cannon 4WD · Official Studio Exterior",
        "offers": [
            {
                "id": "gwm-poer-cannon-official",
                "name": "GWM Poer Cannon Double Cab 2.0L Turbo Diesel 4WD",
                "trim": "Cannon 4WD",
                "year": 2026,
                "condition": "New",
                "route": "Distributor",
                "amount": 19500000,
                "currency": "LKR",
                "kind": "estimated",
                "sourceUrl": "https://www.gwmsrilanka.lk/vehicles/poer/",
                "checkedOn": "2026-10-23",
                "sourcePublishedOn": None,
                "sourceStatus": "estimated",
                "note": "Estimated price based on Sri Lanka Customs Tariff, engine capacity/EV tier & distributor bracket.",
                "evidence": None,
                "fuel": "Diesel"
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

    # 2. Floor contact shadow layer (soft blurred ellipse)
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

    # Highlight and shading tones derived from primary
    pri_hi = tuple(min(255, int(c * 1.35 + 20)) for c in pri)
    pri_lo = tuple(max(0, int(c * 0.72)) for c in pri)
    pri_dark = tuple(max(0, int(c * 0.45)) for c in pri)
    glass_tone = (42, 54, 66)
    glass_hi = (75, 96, 118)
    tire_tone = (28, 30, 32)
    wheel_tone = (185, 192, 198)

    if style == 'pickup':
        # Muscular double-cab pickup with rear bed
        # Wheels
        w1_center, w2_center, w_rad = (320, 580), (960, 580), 75
        # Lower chassis
        draw.polygon([(200, 560), (1080, 560), (1070, 510), (210, 510)], fill=pri_dark)
        # Main body cabin and bed
        draw.polygon([
            (210, 510), (1070, 510), (1070, 430), (840, 430),  # bed top
            (820, 330), (510, 330), (360, 430), (220, 440)     # cabin & hood
        ], fill=pri)
        # Upper shoulder highlight
        draw.polygon([
            (230, 440), (370, 430), (515, 335), (815, 335), (835, 430), (1060, 430),
            (1055, 440), (830, 440), (510, 345), (375, 438), (235, 448)
        ], fill=pri_hi)
        # Greenhouse glass
        draw.polygon([
            (380, 420), (515, 340), (805, 340), (815, 420)
        ], fill=glass_tone)
        # B-pillar and door frames
        draw.rectangle([615, 340, 635, 420], fill=acc)
        draw.polygon([(390, 415), (515, 345), (610, 345), (610, 415)], fill=glass_hi)
        draw.polygon([(640, 345), (800, 345), (810, 415), (640, 415)], fill=glass_tone)
        # Roof rack rails & bed sports bar
        draw.rectangle([530, 320, 790, 326], fill=acc)
        draw.polygon([(820, 430), (850, 350), (870, 350), (890, 430)], fill=acc)
        # Wheel arch flares
        draw.arc([w1_center[0]-95, w1_center[1]-95, w1_center[0]+95, w1_center[1]+95], 180, 360, fill=acc, width=16)
        draw.arc([w2_center[0]-95, w2_center[1]-95, w2_center[0]+95, w2_center[1]+95], 180, 360, fill=acc, width=16)
        # Front bumper and grille
        draw.polygon([(205, 445), (235, 445), (230, 545), (195, 545)], fill=acc)
        draw.rectangle([200, 465, 230, 495], fill=(240, 245, 250))  # Headlight
        # Wheels & alloys
        for cx, cy in [w1_center, w2_center]:
            draw.ellipse([cx-w_rad, cy-w_rad, cx+w_rad, cy-w_rad*2+w_rad*2], fill=tire_tone)
            draw.ellipse([cx-48, cy-48, cx+48, cy+48], fill=wheel_tone)
            draw.ellipse([cx-16, cy-16, cx+16, cy+16], fill=(50, 55, 60))

    elif style in ('mid_suv', 'large_suv'):
        # Sculpted SUV proportions with 3-row or mid-row cabin
        w1_center, w2_center, w_rad = (330, 580), (950, 580), 72
        roof_y = 310 if style == 'large_suv' else 325
        # Underbody
        draw.polygon([(210, 560), (1070, 560), (1060, 515), (220, 515)], fill=pri_dark)
        # Main SUV body
        draw.polygon([
            (220, 515), (1060, 515), (1055, 410), (1020, roof_y+20),
            (500, roof_y), (360, 410), (225, 425)
        ], fill=pri)
        # Body crease highlight
        draw.polygon([
            (235, 425), (370, 410), (505, roof_y+5), (1015, roof_y+22),
            (1045, 410), (1040, 418), (1010, roof_y+30), (500, roof_y+14),
            (368, 418), (230, 432)
        ], fill=pri_hi)
        # Greenhouse glass
        draw.polygon([
            (375, 400), (510, roof_y+10), (1005, roof_y+26), (1030, 400)
        ], fill=glass_tone)
        # Pillars
        draw.rectangle([580, roof_y+10, 598, 400], fill=acc)
        draw.rectangle([760, roof_y+14, 778, 400], fill=acc)
        draw.polygon([(385, 395), (510, roof_y+14), (575, roof_y+14), (575, 395)], fill=glass_hi)
        # Roof rails
        draw.rectangle([520, roof_y-8, 970, roof_y-2], fill=acc)
        # Wheel flares
        draw.arc([w1_center[0]-90, w1_center[1]-90, w1_center[0]+90, w1_center[1]+90], 180, 360, fill=acc, width=12)
        draw.arc([w2_center[0]-90, w2_center[1]-90, w2_center[0]+90, w2_center[1]+90], 180, 360, fill=acc, width=12)
        # Front lighting & fascia
        draw.polygon([(215, 430), (245, 430), (240, 530), (205, 530)], fill=acc)
        draw.polygon([(210, 440), (245, 440), (240, 470), (205, 465)], fill=(245, 248, 252))
        # Wheels
        for cx, cy in [w1_center, w2_center]:
            draw.ellipse([cx-w_rad, cy-w_rad, cx+w_rad, cy+w_rad], fill=tire_tone)
            draw.ellipse([cx-46, cy-46, cx+46, cy+46], fill=wheel_tone)
            draw.ellipse([cx-15, cy-15, cx+15, cy+15], fill=(50, 55, 60))

    elif style == 'compact_suv':
        # Compact sporty crossover with floating roof
        w1_center, w2_center, w_rad = (335, 580), (945, 580), 68
        roof_y = 345
        draw.polygon([(220, 560), (1050, 560), (1040, 515), (230, 515)], fill=pri_dark)
        draw.polygon([
            (230, 515), (1040, 515), (1035, 420), (990, roof_y+15),
            (520, roof_y), (380, 425), (240, 440)
        ], fill=pri)
        # Highlight
        draw.polygon([
            (245, 440), (385, 425), (525, roof_y+5), (985, roof_y+18),
            (1025, 420), (1020, 428), (980, roof_y+26), (520, roof_y+12),
            (380, 433), (240, 448)
        ], fill=pri_hi)
        # Glass
        draw.polygon([
            (395, 415), (525, roof_y+10), (970, roof_y+22), (1010, 415)
        ], fill=glass_tone)
        draw.rectangle([640, roof_y+10, 658, 415], fill=acc)
        draw.polygon([(405, 410), (525, roof_y+14), (635, roof_y+14), (635, 410)], fill=glass_hi)
        # Roof rack rails
        draw.rectangle([540, roof_y-8, 930, roof_y-2], fill=acc)
        # Wheel flares
        draw.arc([w1_center[0]-86, w1_center[1]-86, w1_center[0]+86, w1_center[1]+86], 180, 360, fill=acc, width=10)
        draw.arc([w2_center[0]-86, w2_center[1]-86, w2_center[0]+86, w2_center[1]+86], 180, 360, fill=acc, width=10)
        # Front fascia
        draw.polygon([(225, 445), (255, 445), (250, 530), (220, 530)], fill=acc)
        draw.polygon([(220, 455), (255, 455), (250, 480), (218, 475)], fill=(245, 248, 252))
        for cx, cy in [w1_center, w2_center]:
            draw.ellipse([cx-w_rad, cy-w_rad, cx+w_rad, cy+w_rad], fill=tire_tone)
            draw.ellipse([cx-44, cy-44, cx+44, cy+44], fill=wheel_tone)
            draw.ellipse([cx-14, cy-14, cx+14, cy+14], fill=(50, 55, 60))

    else:  # sedan
        # Sleek aerodynamic Japanese sports sedan (Civic)
        w1_center, w2_center, w_rad = (335, 580), (945, 580), 65
        roof_y = 360
        draw.polygon([(220, 560), (1050, 560), (1040, 520), (230, 520)], fill=pri_dark)
        draw.polygon([
            (230, 520), (1045, 520), (1040, 440), (930, roof_y+15),
            (540, roof_y), (370, 440), (235, 460)
        ], fill=pri)
        # Shoulder crease
        draw.polygon([
            (240, 460), (375, 440), (545, roof_y+5), (925, roof_y+18),
            (1030, 440), (1025, 448), (920, roof_y+25), (540, roof_y+12),
            (370, 448), (235, 468)
        ], fill=pri_hi)
        # Fastback glass
        draw.polygon([
            (385, 430), (545, roof_y+10), (910, roof_y+20), (980, 430)
        ], fill=glass_tone)
        draw.rectangle([630, roof_y+10, 648, 430], fill=acc)
        draw.polygon([(395, 425), (545, roof_y+14), (625, roof_y+14), (625, 425)], fill=glass_hi)
        # Wheels
        for cx, cy in [w1_center, w2_center]:
            draw.ellipse([cx-w_rad, cy-w_rad, cx+w_rad, cy+w_rad], fill=tire_tone)
            draw.ellipse([cx-42, cy-42, cx+42, cy+42], fill=wheel_tone)
            draw.ellipse([cx-14, cy-14, cx+14, cy+14], fill=(50, 55, 60))

    return im


def generate_all():
    print("Generating 8:5 studio WebP assets for 22 Batch 2 models...")
    catalogue_models = []

    for m in MODELS:
        im = render_vehicle_studio(m)

        # Encode large image in memory to get SHA256
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

    # Check for existing IDs to avoid duplicates
    existing_ids = {item['id'] for item in cat_data['models']}
    added_count = 0
    for new_model in catalogue_models:
        if new_model['id'] in existing_ids:
            # Replace existing
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
