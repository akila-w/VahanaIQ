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
  const price = condition === "seller_price" ? sellerPrice : trim?.condition_prices?.[condition];
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
