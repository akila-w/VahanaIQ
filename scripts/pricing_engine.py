#!/usr/bin/env python3
"""Sri Lanka Automotive Customs Valuation, Taxation & Price Estimation Engine (VahanaIQ)

Grounded in Sri Lanka Customs Gazette, HS Codes (8703 Passenger Vehicles & 8704 Pickups),
and Ministry of Finance taxation schedules:
  - CIF Valuation (FOB + Sea Freight & Marine Insurance by Trade Corridor)
  - Port and Airport Development Levy (PAL): 7.5% - 10.0%
  - Excise (Special Provisions) Duty: Specific Rate (Rs/cc or Rs/kW) vs Ad Valorem MAX
    (General Customs Duty & CESS are zero-rated under HS 8703/8704 when Excise is levied)
  - Luxury Tax: Tiered surcharge on CIF exceeding fuel-specific statutory thresholds
  - Social Security Contribution Levy (SSCL): 2.5%
  - Value Added Tax (VAT): 18.0% statutory rate
  - Port Clearance, Terminal Handling (THC) & Demurrage Buffer: LKR 350,000
  - Channel Margins:
      - Authorized Distributor: 14.5% (8.5% margin + 4.5% 3-5yr warranty/EV battery fund + 1.5% PDI)
      - Parallel Import: 10.5% (8.0% trade margin + 2.5% warranty reserve)
"""

from typing import Dict, Any, Optional

USD_LKR = 302.50

CORRIDOR_FREIGHT_USD = {
    "Japan": 1450.0,      # Yokohama / Nagoya / Kobe to Colombo RoRo
    "China": 1350.0,      # Shanghai / Nansha to Colombo RoRo
    "India": 650.0,       # Chennai / Mumbai to Colombo container/RoRo
    "Thailand": 1150.0,   # Laem Chabang to Colombo
    "Europe": 2100.0,     # Bremerhaven / Southampton to Colombo
    "Default": 1400.0,
}

LUXURY_TAX_THRESHOLDS_LKR = {
    "petrol": 3500000.0,
    "diesel": 4000000.0,
    "hev": 4500000.0,
    "phev": 4500000.0,
    "bev": 6000000.0,
}


def compute_excise_duty(
    fuel: str,
    cc: Optional[int],
    kw: Optional[float],
    cif_lkr: float,
    body: str
) -> Dict[str, Any]:
    """Calculates Excise Duty under Sri Lanka Customs Specific vs Ad Valorem rules."""
    fuel = fuel.lower()
    specific_duty = 0.0
    ad_valorem_rate = 0.0

    if fuel == "bev":
        # Battery Electric Vehicle: Tiered by Motor Power (kW)
        motor_kw = kw or 100.0
        if motor_kw <= 50:
            rate_per_kw = 28000.0
            ad_valorem_rate = 0.35
        elif motor_kw <= 100:
            rate_per_kw = 42000.0
            ad_valorem_rate = 0.45
        elif motor_kw <= 150:
            rate_per_kw = 55000.0
            ad_valorem_rate = 0.60
        elif motor_kw <= 200:
            rate_per_kw = 72000.0
            ad_valorem_rate = 0.75
        else:
            rate_per_kw = 95000.0
            ad_valorem_rate = 0.95
        specific_duty = motor_kw * rate_per_kw
        ad_valorem_duty = cif_lkr * ad_valorem_rate
        method = f"BEV tier ({motor_kw:.0f} kW @ Rs. {rate_per_kw:,.0f}/kW vs {ad_valorem_rate*100:.0f}% Ad Valorem)"

    elif fuel == "hev":
        # Hybrid Electric Vehicle (HEV): Tiered by Displacement (cc)
        disp = cc or 1498
        if disp <= 1000:
            rate_per_cc = 1250.0
            ad_valorem_rate = 0.90
        elif disp <= 1500:
            rate_per_cc = 2450.0
            ad_valorem_rate = 1.15
        elif disp <= 1800:
            rate_per_cc = 3800.0
            ad_valorem_rate = 1.45
        elif disp <= 2000:
            rate_per_cc = 4900.0
            ad_valorem_rate = 1.75
        else:
            rate_per_cc = 6800.0
            ad_valorem_rate = 2.10
        specific_duty = disp * rate_per_cc
        ad_valorem_duty = cif_lkr * ad_valorem_rate
        method = f"HEV tier ({disp} cc @ Rs. {rate_per_cc:,.0f}/cc vs {ad_valorem_rate*100:.0f}% Ad Valorem)"

    elif fuel == "phev":
        # Plug-in Hybrid: Preferential hybrid bracket
        disp = cc or 1498
        if disp <= 1500:
            rate_per_cc = 2800.0
            ad_valorem_rate = 1.25
        elif disp <= 2000:
            rate_per_cc = 4500.0
            ad_valorem_rate = 1.60
        else:
            rate_per_cc = 6200.0
            ad_valorem_rate = 1.95
        specific_duty = disp * rate_per_cc
        ad_valorem_duty = cif_lkr * ad_valorem_rate
        method = f"PHEV tier ({disp} cc @ Rs. {rate_per_cc:,.0f}/cc vs {ad_valorem_rate*100:.0f}% Ad Valorem)"

    elif fuel == "diesel":
        disp = cc or 2400
        if "pickup" in body.lower():
            # HS 8704 Double Cab Pickup commercial concession
            rate_per_cc = 3400.0
            ad_valorem_rate = 0.85
        else:
            # Passenger Diesel SUV / Car
            if disp <= 2000:
                rate_per_cc = 5800.0
                ad_valorem_rate = 1.80
            elif disp <= 2500:
                rate_per_cc = 7500.0
                ad_valorem_rate = 2.15
            elif disp <= 3000:
                rate_per_cc = 9800.0
                ad_valorem_rate = 2.55
            else:
                rate_per_cc = 12500.0
                ad_valorem_rate = 3.00
        specific_duty = disp * rate_per_cc
        ad_valorem_duty = cif_lkr * ad_valorem_rate
        method = f"Diesel tier ({disp} cc @ Rs. {rate_per_cc:,.0f}/cc vs {ad_valorem_rate*100:.0f}% Ad Valorem)"

    else:
        # Pure Petrol (ICE)
        disp = cc or 1198
        if disp <= 1000:
            rate_per_cc = 1650.0
            ad_valorem_rate = 1.10
        elif disp <= 1300:
            rate_per_cc = 2450.0
            ad_valorem_rate = 1.30
        elif disp <= 1500:
            rate_per_cc = 3150.0
            ad_valorem_rate = 1.50
        elif disp <= 1600:
            rate_per_cc = 3750.0
            ad_valorem_rate = 1.65
        elif disp <= 1800:
            rate_per_cc = 4800.0
            ad_valorem_rate = 1.90
        elif disp <= 2000:
            rate_per_cc = 5900.0
            ad_valorem_rate = 2.15
        elif disp <= 2500:
            rate_per_cc = 7400.0
            ad_valorem_rate = 2.45
        elif disp <= 3000:
            rate_per_cc = 9200.0
            ad_valorem_rate = 2.80
        else:
            rate_per_cc = 11800.0
            ad_valorem_rate = 3.25
        specific_duty = disp * rate_per_cc
        ad_valorem_duty = cif_lkr * ad_valorem_rate
        method = f"Petrol ICE tier ({disp} cc @ Rs. {rate_per_cc:,.0f}/cc vs {ad_valorem_rate*100:.0f}% Ad Valorem)"

    final_duty = max(specific_duty, ad_valorem_duty)
    return {
        "amount": final_duty,
        "specific": specific_duty,
        "ad_valorem": ad_valorem_duty,
        "applied": "specific" if specific_duty >= ad_valorem_duty else "ad_valorem",
        "method": method
    }


def compute_luxury_tax(cif_lkr: float, fuel: str) -> float:
    """Computes tiered Sri Lanka Luxury Tax on excess CIF value."""
    fuel = fuel.lower()
    threshold = LUXURY_TAX_THRESHOLDS_LKR.get(fuel, 3500000.0)
    if cif_lkr <= threshold:
        return 0.0

    excess = cif_lkr - threshold
    tax = 0.0

    # Tier 1: First 1M excess @ 60%
    tier1 = min(excess, 1000000.0)
    tax += tier1 * 0.60
    excess -= tier1

    # Tier 2: Next 2M excess @ 80%
    if excess > 0:
        tier2 = min(excess, 2000000.0)
        tax += tier2 * 0.80
        excess -= tier2

    # Tier 3: Remaining excess above 3M @ 100%
    if excess > 0:
        tax += excess * 1.00

    return tax


def estimate_vehicle_price(
    fob_usd: float,
    fuel: str,
    body: str = "SUV",
    cc: Optional[int] = None,
    kw: Optional[float] = None,
    kwh: Optional[float] = None,
    origin: str = "Japan",
    route: str = "Distributor"
) -> Dict[str, Any]:
    """Computes complete Sri Lankan landed cost, duties, taxes and retail estimate."""
    freight_usd = CORRIDOR_FREIGHT_USD.get(origin, CORRIDOR_FREIGHT_USD["Default"])
    cif_usd = fob_usd + freight_usd
    cif_lkr = cif_usd * USD_LKR

    # 1. Customs Import Duty (CID) & CESS
    # In Sri Lanka, when Excise (Special Provisions) Duty is levied on motor vehicles (HS 8703/8704),
    # CID and CESS are zero-rated / exempt to avoid double taxation.
    cid_lkr = 0.0
    cess_lkr = 0.0

    # 2. Port and Airport Development Levy (PAL)
    # Standard PAL on motor vehicle imports: 10.0% (7.5% for commercial/pickup)
    is_pickup = "pickup" in body.lower()
    pal_rate = 0.075 if is_pickup else 0.10
    pal_lkr = cif_lkr * pal_rate

    # 3. Excise (Special Provisions) Duty
    excise = compute_excise_duty(fuel, cc, kw, cif_lkr, body)
    excise_lkr = excise["amount"]

    # 4. Luxury Tax
    luxury_tax_lkr = compute_luxury_tax(cif_lkr, fuel)

    # 5. Social Security Contribution Levy (SSCL - 2.5%)
    # Under Sri Lankan inland revenue rules: 2.5% on (CIF * 1.10) + duties
    taxable_base_before_vat = (cif_lkr * 1.10) + pal_lkr + excise_lkr + luxury_tax_lkr
    sscl_lkr = taxable_base_before_vat * 0.025

    # 6. Value Added Tax (VAT - 18.0%)
    vat_base = taxable_base_before_vat + sscl_lkr
    vat_lkr = vat_base * 0.18

    # 7. Total Government Duties & Taxes
    total_customs_taxes_lkr = pal_lkr + excise_lkr + luxury_tax_lkr + sscl_lkr + vat_lkr
    landed_cost_lkr = cif_lkr + total_customs_taxes_lkr

    # 8. Port handling, clearing, terminal handling (THC) & transport
    port_handling_lkr = 350000.0

    # 9. Channel Margins & Warranty Provisioning
    if route.lower() in ("distributor", "official"):
        # Authorized Distributor: 14.5%
        # (8.5% showroom/distribution margin + 4.5% 3-5yr warranty / EV battery fund + 1.5% PDI/service vouchers)
        channel_markup = 0.145
        warranty_note = "Official 3-5 Year Distributor Warranty & Pre-Delivery Inspection (PDI) Included"
    else:
        # Parallel / Grey Importer: 10.5%
        # (8.0% trade margin + 2.5% third-party warranty reserve)
        channel_markup = 0.105
        warranty_note = "Parallel Import Dealer pricing with third-party warranty reserve"

    gross_cost = landed_cost_lkr + port_handling_lkr
    estimated_retail_lkr = gross_cost * (1.0 + channel_markup)

    # Round to nearest 50,000 LKR
    final_rounded_lkr = round(estimated_retail_lkr / 50000.0) * 50000

    return {
        "estimated_price_lkr": int(final_rounded_lkr),
        "fob_usd": fob_usd,
        "freight_usd": freight_usd,
        "cif_usd": cif_usd,
        "cif_lkr": round(cif_lkr),
        "pal_lkr": round(pal_lkr),
        "excise_lkr": round(excise_lkr),
        "excise_method": excise["method"],
        "luxury_tax_lkr": round(luxury_tax_lkr),
        "sscl_lkr": round(sscl_lkr),
        "vat_lkr": round(vat_lkr),
        "total_taxes_lkr": round(total_customs_taxes_lkr),
        "landed_cost_lkr": round(landed_cost_lkr),
        "channel_markup_percent": channel_markup * 100.0,
        "warranty_note": warranty_note,
        "effective_tax_rate_percent": round((total_customs_taxes_lkr / cif_lkr) * 100.0, 1),
    }


if __name__ == "__main__":
    test_cases = [
        ("Kia Sonet 1.5 Petrol", 13500, "petrol", "SUV", 1497, None, None, "India", "Distributor"),
        ("Nissan Magnite 1.0T", 11500, "petrol", "SUV", 999, None, None, "India", "Distributor"),
        ("Renault Kwid 1.0L", 8500, "petrol", "Passenger Car", 999, None, None, "India", "Distributor"),
        ("BYD Shark 6 PHEV", 38000, "phev", "Pickup", 1498, 321, 29.58, "China", "Distributor"),
        ("BYD Racco Kei BEV", 11500, "bev", "Passenger Car", None, 35, 20.0, "China", "Distributor"),
        ("Deepal S07 BEV", 22500, "bev", "SUV", None, 160, 66.8, "China", "Parallel Import"),
        ("Deepal L07 BEV", 22000, "bev", "Passenger Car", None, 160, 66.8, "China", "Parallel Import"),
    ]
    print(f"=== Sri Lanka Automotive Pricing Engine Benchmark (USD/LKR = {USD_LKR}) ===")
    for name, fob, fuel, body, cc, kw, kwh, origin, route in test_cases:
        res = estimate_vehicle_price(fob, fuel, body, cc, kw, kwh, origin, route)
        print(f"\n{name} ({route}):")
        print(f"  FOB: ${res['fob_usd']:,} -> CIF: LKR {res['cif_lkr']:,}")
        print(f"  Taxes (Excise + Luxury + VAT 18% + PAL + SSCL): LKR {res['total_taxes_lkr']:,} ({res['effective_tax_rate_percent']}%)")
        print(f"  Final Estimated Price: LKR {res['estimated_price_lkr']:,} (Rs. {res['estimated_price_lkr']/1e6:.2f}M)")
