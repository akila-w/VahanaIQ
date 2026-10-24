/**
 * Sri Lanka Automotive Customs Valuation, Taxation & Price Estimation Engine (VahanaIQ)
 *
 * Implements Sri Lanka Customs Gazette & Ministry of Finance vehicle valuation schedules:
 *   - CIF Valuation (FOB in USD + sea freight / marine insurance * USD/LKR rate)
 *   - Port and Airport Development Levy (PAL): 7.5% - 10.0%
 *   - Excise (Special Provisions) Duty: Specific rate (Rs/cc or Rs/kW) vs Ad Valorem MAX
 *   - Luxury Tax: Tiered on CIF above fuel-specific statutory thresholds
 *   - Social Security Contribution Levy (SSCL): 2.5%
 *   - Value Added Tax (VAT): 18.0% statutory rate
 *   - Port Clearance & Terminal Handling (THC): LKR 350,000
 *   - Channel Margins: Authorized Distributor (14.5%) vs Parallel Import (10.5%)
 */

export const USD_LKR = 302.50;

export const CORRIDOR_FREIGHT_USD = {
  Japan: 1450.0,
  China: 1350.0,
  India: 650.0,
  Thailand: 1150.0,
  Europe: 2100.0,
  Default: 1400.0
};

export const LUXURY_TAX_THRESHOLDS_LKR = {
  petrol: 3500000.0,
  diesel: 4000000.0,
  hev: 4500000.0,
  phev: 4500000.0,
  bev: 6000000.0
};

export function computeExciseDuty(fuel, cc, kw, cifLkr, body = 'SUV') {
  fuel = (fuel || 'petrol').toLowerCase();
  let specificDuty = 0.0;
  let adValoremRate = 0.0;
  let method = '';

  if (fuel === 'bev') {
    const motorKw = kw || 100.0;
    let ratePerKw = 28000.0;
    if (motorKw <= 50) {
      ratePerKw = 28000.0;
      adValoremRate = 0.35;
    } else if (motorKw <= 100) {
      ratePerKw = 42000.0;
      adValoremRate = 0.45;
    } else if (motorKw <= 150) {
      ratePerKw = 55000.0;
      adValoremRate = 0.60;
    } else if (motorKw <= 200) {
      ratePerKw = 72000.0;
      adValoremRate = 0.75;
    } else {
      ratePerKw = 95000.0;
      adValoremRate = 0.95;
    }
    specificDuty = motorKw * ratePerKw;
    method = `BEV tier (${motorKw.toFixed(0)} kW @ LKR ${ratePerKw.toLocaleString()}/kW)`;
  } else if (fuel === 'hev') {
    const disp = cc || 1498;
    let ratePerCc = 2450.0;
    if (disp <= 1000) {
      ratePerCc = 1250.0;
      adValoremRate = 0.90;
    } else if (disp <= 1500) {
      ratePerCc = 2450.0;
      adValoremRate = 1.15;
    } else if (disp <= 1800) {
      ratePerCc = 3800.0;
      adValoremRate = 1.45;
    } else if (disp <= 2000) {
      ratePerCc = 4900.0;
      adValoremRate = 1.75;
    } else {
      ratePerCc = 6800.0;
      adValoremRate = 2.10;
    }
    specificDuty = disp * ratePerCc;
    method = `HEV tier (${disp} cc @ LKR ${ratePerCc.toLocaleString()}/cc)`;
  } else if (fuel === 'phev') {
    const disp = cc || 1498;
    let ratePerCc = 2800.0;
    if (disp <= 1500) {
      ratePerCc = 2800.0;
      adValoremRate = 1.25;
    } else if (disp <= 2000) {
      ratePerCc = 4500.0;
      adValoremRate = 1.60;
    } else {
      ratePerCc = 6200.0;
      adValoremRate = 1.95;
    }
    specificDuty = disp * ratePerCc;
    method = `PHEV tier (${disp} cc @ LKR ${ratePerCc.toLocaleString()}/cc)`;
  } else if (fuel === 'diesel') {
    const disp = cc || 2400;
    const isPickup = body.toLowerCase().includes('pickup');
    let ratePerCc = isPickup ? 3400.0 : 7500.0;
    adValoremRate = isPickup ? 0.85 : 2.15;
    if (!isPickup) {
      if (disp <= 2000) ratePerCc = 5800.0;
      else if (disp <= 2500) ratePerCc = 7500.0;
      else if (disp <= 3000) ratePerCc = 9800.0;
      else ratePerCc = 12500.0;
    }
    specificDuty = disp * ratePerCc;
    method = `Diesel tier (${disp} cc @ LKR ${ratePerCc.toLocaleString()}/cc)`;
  } else {
    // Petrol
    const disp = cc || 1198;
    let ratePerCc = 3150.0;
    if (disp <= 1000) {
      ratePerCc = 1650.0;
      adValoremRate = 1.10;
    } else if (disp <= 1300) {
      ratePerCc = 2450.0;
      adValoremRate = 1.30;
    } else if (disp <= 1500) {
      ratePerCc = 3150.0;
      adValoremRate = 1.50;
    } else if (disp <= 1600) {
      ratePerCc = 3750.0;
      adValoremRate = 1.65;
    } else if (disp <= 1800) {
      ratePerCc = 4800.0;
      adValoremRate = 1.90;
    } else if (disp <= 2000) {
      ratePerCc = 5900.0;
      adValoremRate = 2.15;
    } else if (disp <= 2500) {
      ratePerCc = 7400.0;
      adValoremRate = 2.45;
    } else if (disp <= 3000) {
      ratePerCc = 9200.0;
      adValoremRate = 2.80;
    } else {
      ratePerCc = 11800.0;
      adValoremRate = 3.25;
    }
    specificDuty = disp * ratePerCc;
    method = `Petrol ICE tier (${disp} cc @ LKR ${ratePerCc.toLocaleString()}/cc)`;
  }

  const adValoremDuty = cifLkr * adValoremRate;
  const finalDuty = Math.max(specificDuty, adValoremDuty);
  return {
    amount: finalDuty,
    specific: specificDuty,
    adValorem: adValoremDuty,
    applied: specificDuty >= adValoremDuty ? 'specific' : 'ad_valorem',
    method
  };
}

export function computeLuxuryTax(cifLkr, fuel) {
  fuel = (fuel || 'petrol').toLowerCase();
  const threshold = LUXURY_TAX_THRESHOLDS_LKR[fuel] || 3500000.0;
  if (cifLkr <= threshold) return 0.0;

  let excess = cifLkr - threshold;
  let tax = 0.0;

  const tier1 = Math.min(excess, 1000000.0);
  tax += tier1 * 0.60;
  excess -= tier1;

  if (excess > 0) {
    const tier2 = Math.min(excess, 2000000.0);
    tax += tier2 * 0.80;
    excess -= tier2;
  }

  if (excess > 0) {
    tax += excess * 1.00;
  }

  return tax;
}

export function estimateVehiclePrice({
  fobUsd,
  fuel = 'petrol',
  body = 'SUV',
  cc = null,
  kw = null,
  kwh = null,
  origin = 'Japan',
  route = 'Distributor'
}) {
  const freightUsd = CORRIDOR_FREIGHT_USD[origin] || CORRIDOR_FREIGHT_USD.Default;
  const cifUsd = fobUsd + freightUsd;
  const cifLkr = cifUsd * USD_LKR;

  const isPickup = body.toLowerCase().includes('pickup');
  const palRate = isPickup ? 0.075 : 0.10;
  const palLkr = cifLkr * palRate;

  const excise = computeExciseDuty(fuel, cc, kw, cifLkr, body);
  const exciseLkr = excise.amount;

  const luxuryTaxLkr = computeLuxuryTax(cifLkr, fuel);

  const taxableBaseBeforeVat = (cifLkr * 1.10) + palLkr + exciseLkr + luxuryTaxLkr;
  const ssclLkr = taxableBaseBeforeVat * 0.025;

  const vatBase = taxableBaseBeforeVat + ssclLkr;
  const vatLkr = vatBase * 0.18;

  const totalCustomsTaxesLkr = palLkr + exciseLkr + luxuryTaxLkr + ssclLkr + vatLkr;
  const landedCostLkr = cifLkr + totalCustomsTaxesLkr;

  const portHandlingLkr = 350000.0;
  const isDistributor = route.toLowerCase().includes('distributor') || route.toLowerCase().includes('official');
  const channelMarkup = isDistributor ? 0.145 : 0.105;

  const grossCost = landedCostLkr + portHandlingLkr;
  const estimatedRetailLkr = grossCost * (1.0 + channelMarkup);
  const finalRoundedLkr = Math.round(estimatedRetailLkr / 50000.0) * 50000;

  return {
    estimatedPriceLkr: finalRoundedLkr,
    fobUsd,
    freightUsd,
    cifUsd,
    cifLkr: Math.round(cifLkr),
    palLkr: Math.round(palLkr),
    exciseLkr: Math.round(exciseLkr),
    exciseMethod: excise.method,
    luxuryTaxLkr: Math.round(luxuryTaxLkr),
    ssclLkr: Math.round(ssclLkr),
    vatLkr: Math.round(vatLkr),
    totalTaxesLkr: Math.round(totalCustomsTaxesLkr),
    landedCostLkr: Math.round(landedCostLkr),
    channelMarkupPercent: channelMarkup * 100.0,
    effectiveTaxRatePercent: Math.round((totalCustomsTaxesLkr / cifLkr) * 1000) / 10
  };
}
