// Vehicle search through the VahanaIQ proxy, which holds the Gemini key and model choice
import { getProxyUrl } from "./storage.js?v=2.11.3";
import { expectsComparison, validateSearchResponse } from "./vehicle-validation.js?v=2.11.3";

export const VEHICLE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_available_in_sri_lanka: { type: "BOOLEAN" },
    is_multi_vehicle: {
      type: "BOOLEAN",
      description: "Set to true if user asked to compare multiple vehicles or find best vehicles in a budget"
    },
    discovered_vehicles: {
      type: "ARRAY",
      description: "List of discovered or compared vehicles when is_multi_vehicle is true",
      items: {
        type: "OBJECT",
        properties: {
          model_name: { type: "STRING" },
          year: { type: "INTEGER" },
          trim_name: { type: "STRING" },
          powertrain: { type: "STRING" },
          fuel_economy_kml: { type: "STRING" },
          condition: { type: "STRING", enum: ["New", "Recond", "Used"] },
          warranty_type: { type: "STRING", enum: ["Official", "Grey"] },
          price_lkr: { type: "INTEGER" },
          wikipedia_slug: { type: "STRING" }
        },
        required: ["model_name", "year", "trim_name", "powertrain", "condition", "warranty_type", "price_lkr"]
      }
    },
    model_name: {
      type: "STRING",
      description: "Canonical make + model without year, e.g. Toyota Yaris Cross"
    },
    wikipedia_slug: {
      type: "STRING",
      description: "Canonical English Wikipedia page title for image lookup, e.g. Toyota_Yaris_Cross"
    },
    availability_notes: { type: "STRING" },
    import_route: {
      type: "STRING",
      enum: ["Official Agent", "Grey Import", "Registered Fleet"]
    },
    seller_price_lkr: {
      type: "INTEGER",
      description: "Seller asking price in LKR if extracted from classified ad text, listing, or auction sheet, else 0"
    },
    detected_condition: {
      type: "STRING",
      enum: ["New", "Recond", "Used"]
    },
    reason: {
      type: "STRING",
      description: "Reason if vehicle is unavailable or not road-legal in Sri Lanka"
    },
    alternatives: {
      type: "ARRAY",
      items: { type: "STRING" }
    },
    model_years: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          year: { type: "INTEGER" },
          trims: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                trim_name: { type: "STRING" },
                powertrain: { type: "STRING" },
                fuel_economy_kml: { type: "STRING" },
                warranty_type: {
                  type: "STRING",
                  enum: ["Official", "Grey"]
                },
                condition_prices: {
                  type: "OBJECT",
                  properties: {
                    brand_new: { type: "INTEGER" },
                    recond: { type: "INTEGER" },
                    used_low: { type: "INTEGER" },
                    used_med: { type: "INTEGER" }
                  },
                  required: ["brand_new", "recond", "used_low", "used_med"]
                }
              },
              required: ["trim_name", "powertrain", "fuel_economy_kml", "warranty_type", "condition_prices"]
            }
          }
        },
        required: ["year", "trims"]
      }
    }
  },
  required: [
    "is_available_in_sri_lanka",
    "is_multi_vehicle",
    "discovered_vehicles",
    "model_name",
    "wikipedia_slug",
    "availability_notes",
    "import_route",
    "model_years"
  ]
};

export async function searchVehicle(query, imageObj = null) {
  const proxy = getProxyUrl();
  if (!proxy) throw new Error("No search proxy configured");
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(proxy, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, image: imageObj, comparison: expectsComparison(query) }),
        signal: controller.signal
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const busy = err.error === "upstream_unavailable" &&
          ([503, 504].includes(err.upstream_status) || /high demand/i.test(err.detail || ""));
        if (attempt === 0 && busy) continue; // One retry on the same model; never retry a quota error.
        const error = new Error(`${err.error || "http_error"}: ${err.detail || "HTTP " + res.status}`);
        error.code = err.error;
        throw error;
      }
      return validateSearchResponse(await res.json(), query);
    } finally {
      clearTimeout(timer);
    }
  }
}
