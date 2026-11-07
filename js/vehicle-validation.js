// All vehicle-entry paths use the same price boundary, including saved records.
export const validPrice = price => typeof price === "number" && Number.isFinite(price) && price > 0 && price < 1e15;

export function vehicleBatchError(vehicles) {
  if (!Array.isArray(vehicles) || !vehicles.length) return "Select at least one vehicle to add.";
  for (const vehicle of vehicles) {
    if (!vehicle || typeof vehicle.name !== "string" || !vehicle.name.trim()) return "Enter a vehicle name.";
    if (vehicle.name.trim().length > 200) return "Keep vehicle names to 200 characters or fewer.";
    if (!validPrice(vehicle.price)) return `Enter a valid price greater than zero for ${vehicle.name}. No vehicles were added.`;
  }
  return "";
}

export function conditionPrice(trim, condition, sellerPrice) {
  if (condition === "seller_price") return validPrice(sellerPrice) ? sellerPrice : NaN;
  if (condition !== "brand_new") return NaN;
  const price = trim?.condition_prices?.brand_new;
  return validPrice(price) ? price : NaN;
}

export const expectsComparison = query => /\b(?:compar(?:e|ing|ison)|versus|vs\.?|alternatives)\b/i.test(query);

export function validateSearchResponse(data, query) {
  if (!data || typeof data !== "object" || typeof data.is_available_in_sri_lanka !== "boolean") {
    throw new Error("AI returned an incomplete vehicle result. Please search again.");
  }
  const vehicles = Array.isArray(data.discovered_vehicles) ? data.discovered_vehicles : [];
  if (expectsComparison(query) || data.is_multi_vehicle) {
    const variants = new Set(String(query).match(/\b(?:19|20)\d{2}\b/g) || []).size > 1 || /\b(?:trims?|grades?|variants?)\b/i.test(query);
    const models = new Set(vehicles.filter(v => typeof v.model_name === "string" && v.model_name.trim())
      .map(v => (v.model_name.trim() + (variants ? `|${v.year}|${v.trim_name}` : "")).toLowerCase()));
    if (models.size < 2) {
      const error = new Error("AI did not return a complete comparison. Please search again or add each vehicle separately.");
      error.code = "incomplete_comparison";
      throw error;
    }
    const error = vehicleBatchError(vehicles.map(v => ({ name: v.model_name, price: v.price_lkr })));
    if (error) throw new Error(error);
    return { ...data, is_multi_vehicle: true };
  }
  if (data.is_available_in_sri_lanka && (typeof data.model_name !== "string" || !data.model_name.trim() ||
      !Array.isArray(data.model_years) || !data.model_years.length ||
      !data.model_years.every(y => y && Number.isInteger(Number(y.year)) && Array.isArray(y.trims) && y.trims.length))) {
    throw new Error("AI returned no model years or trims. Please search again or enter the vehicle manually.");
  }
  return data;
}


// Provenance of a catalogue offer is independent of whether its price is numeric.
// An unchecked source, an estimated tariff bracket or a contradictory review note
// must never be treated as a verified seller asking/starting amount.
const CONTRADICTED_PRICE = /\b(?:another model|different model|wrong model|mismatch(?:ed)?|conflict(?:ing)?|not verified|unverified|could not be retrieved|cannot be verified|does not verif(?:y|ied)|not substantiated|unsupported (?:price|amount|source))\b/i;
const AMOUNT_IN_EXCERPT = /\b(\d[\d,]*(?:\.\d+)?)\s*(million|mn|m)?\b/gi;

export function offerEvidenceStatus(offer) {
  if (!validPrice(offer?.amount)) return "unavailable";
  const note = typeof offer.note === "string" ? offer.note : "";
  if (CONTRADICTED_PRICE.test(note)) return "disputed";
  if (offer.kind === "estimated" || /estim/i.test(String(offer.sourceStatus || ""))) return "estimated";
  if (offer.sourceStatus !== "ok" || !["official", "dealer", "launch"].includes(offer.kind)) return "unverified";
  if (typeof offer.sourceUrl !== "string" || !/^https:\/\//i.test(offer.sourceUrl)) return "unverified";
  if (typeof offer.checkedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(offer.checkedOn)) return "unverified";
  // Source excerpts are retained in the curated data. Match the *amount* to the
  // excerpt, not just a generic source domain, status label or vehicle name.
  const excerpt = typeof offer.evidence === "string" ? offer.evidence : "";
  const numbers = excerpt.matchAll(AMOUNT_IN_EXCERPT);
  for (const match of numbers) {
    const n = Number(match[1].replaceAll(",", ""));
    const amount = n * (match[2] ? 1_000_000 : 1);
    if (Number.isFinite(amount) && Math.abs(amount - offer.amount) < 0.01) return "confirmed";
  }
  return "unverified";
}

export function representativePriceOffer(offers) {
  const confidence = { confirmed: 0, unverified: 1, estimated: 2, disputed: 3 };
  return (Array.isArray(offers) ? offers : [])
    .filter(offer => validPrice(offer?.amount))
    .map((offer, index) => ({ offer, index, rank: confidence[offerEvidenceStatus(offer)] ?? 4 }))
    .sort((a, b) => a.rank - b.rank || a.offer.amount - b.offer.amount || a.index - b.index)[0]?.offer || null;
}
