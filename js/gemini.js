// Google AI Studio API: Model Discovery, OpenAPI Schema Enforcement, and Sri Lankan Automotive Analysis
import { getProxyUrl, getApiKey } from "./storage.js?v=2.6.1";

const PREFERRED_MODEL_VERSION = "2.5";

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
    "model_name",
    "wikipedia_slug",
    "availability_notes",
    "import_route",
    "model_years"
  ]
};

function parseModelVersion(name) {
  const match = name.match(/gemini-(\d+(?:\.\d+)?)/i);
  return match ? parseFloat(match[1]) : 0;
}

export async function discoverActiveModel(apiKey, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = localStorage.getItem("sl_lease_gemini_model");
    const cachedVersion = localStorage.getItem("sl_lease_gemini_model_v");
    if (cached && cachedVersion === PREFERRED_MODEL_VERSION && !cached.includes("gemini-3.8-flash")) {
      return cached;
    }
  }

  let res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  if (!res.ok) {
    res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  const models = (data.models || []).filter(m => m.supportedGenerationMethods?.includes("generateContent"));
  if (!models.length) throw new Error("No models with generateContent support found for this key.");

  // Sort candidate models:
  // 1. Prioritise Flash models (flash > non-flash)
  // 2. Highest version number first (2.5 > 2.0 > 1.5)
  // 3. Skip 3.8 (non-existent) and legacy 1.0
  const candidates = [...models]
    .filter(m => !m.name.includes("gemini-3.8-flash") && !m.name.includes("gemini-1.0"))
    .sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aFlash = aName.includes("flash") ? 1 : 0;
      const bFlash = bName.includes("flash") ? 1 : 0;
      if (aFlash !== bFlash) return bFlash - aFlash;

      const aVer = parseModelVersion(aName);
      const bVer = parseModelVersion(bName);
      if (aVer !== bVer) return bVer - aVer;

      return aName.localeCompare(bName);
    });

  // Ensure gemini-2.5-flash is probed first
  if (!candidates.some(c => c.name.includes("gemini-2.5-flash"))) {
    candidates.unshift({ name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] });
  }

  let workingModel = null;
  let lastErrorMsg = "";

  for (const candidate of candidates) {
    const modelName = candidate.name.startsWith("models/") ? candidate.name : `models/${candidate.name}`;
    try {
      const probeRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
      });
      if (probeRes.ok) {
        workingModel = modelName;
        break;
      } else {
        const errJson = await probeRes.json().catch(() => ({}));
        lastErrorMsg = errJson.error?.message || `HTTP ${probeRes.status}`;
        console.warn(`Model ${modelName} probe rejected:`, lastErrorMsg);
      }
    } catch (probeErr) {
      lastErrorMsg = probeErr.message;
      console.warn(`Model ${modelName} probe network failure:`, probeErr);
    }
  }

  if (!workingModel) {
    if (forceRefresh) {
      throw new Error(lastErrorMsg || "All Gemini models failed verification.");
    }
    const viable = candidates.find(c => !c.name.includes("gemini-1.0")) || candidates[0];
    if (viable) {
      const fallback = viable.name.startsWith("models/") ? viable.name : `models/${viable.name}`;
      localStorage.setItem("sl_lease_gemini_model", fallback);
      localStorage.setItem("sl_lease_gemini_model_v", PREFERRED_MODEL_VERSION);
      return fallback;
    }
    throw new Error(lastErrorMsg || "No active Gemini model available.");
  }

  localStorage.setItem("sl_lease_gemini_model", workingModel);
  localStorage.setItem("sl_lease_gemini_model_v", PREFERRED_MODEL_VERSION);
  return workingModel;
}

async function callDirectGemini(query, apiKey, imageObj = null) {
  let activeModel = localStorage.getItem("sl_lease_gemini_model");
  const cachedVersion = localStorage.getItem("sl_lease_gemini_model_v");
  if (!activeModel || cachedVersion !== PREFERRED_MODEL_VERSION || activeModel.includes("gemini-3.8-flash")) {
    activeModel = await discoverActiveModel(apiKey);
  }

  const systemPrompt = `You are an expert Sri Lankan automotive market analyst and finance assessor. Evaluate vehicles based on actual Sri Lankan road regulations and active market availability (official franchise dealers like AMW, DIMO, John Keells CG, Stafford; Japanese auction grey market imports; or registered local fleet). Return strictly valid JSON conforming to the requested schema.`;

  const promptText = `Vehicle query / input: "${query}".
Instructions:
1. If the input or attached image is a classified advertisement (e.g. from Ikman, Riyasewana, Patpat, Facebook Marketplace) or Japanese auction sheet:
   - Extract exact make, model, year, and trim.
   - Extract the seller's asking price in LKR as seller_price_lkr (convert from millions e.g. 16.8M -> 16800000).
   - Detect vehicle condition as detected_condition ("New", "Recond", or "Used" based on registration / mileage).
2. If the user asks for a comparative query (e.g. "Compare Toyota Raize, Honda Vezel, and Suzuki Fronx") or budget discovery ("Best hybrids under 18M"):
   - Set is_multi_vehicle: true
   - Populate discovered_vehicles with an array of each distinct vehicle (make + model, year, trim, powertrain, fuel economy, condition, warranty type, price in LKR, wikipedia_slug).
   - Also provide the primary vehicle details in model_years and model_name.
3. Availability check:
   - Is this vehicle actively available or road-legal in Sri Lanka (is_available_in_sri_lanka: true/false)? If false, provide reason (e.g. LHD, banned class, never imported) and suggest 2-3 popular Sri Lankan market alternatives.
4. If available:
   - Return model_name (canonical Make + Model without year, e.g. "Toyota Yaris Cross").
   - Return wikipedia_slug (canonical English Wikipedia article title for image lookup, e.g. "Toyota_Yaris_Cross").
   - Return import_route ("Official Agent", "Grey Import", or "Registered Fleet").
   - Return model_years array (e.g. [2024, 2022, 2020]), and for each year the available trim levels in Sri Lanka.
   - For each trim: trim_name, powertrain, real-world Sri Lankan fuel_economy_kml, warranty_type ("Official" or "Grey"), and condition_prices (object with keys: "brand_new", "recond", "used_low", "used_med" containing price in Sri Lankan Rupees LKR).`;

  const parts = [{ text: `${systemPrompt}\n\n${promptText}` }];
  if (imageObj && imageObj.data) {
    parts.push({
      inlineData: {
        mimeType: imageObj.mimeType || "image/jpeg",
        data: imageObj.data
      }
    });
  }

  const makeRequest = async (model) => {
    return await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: VEHICLE_RESPONSE_SCHEMA
        }
      })
    });
  };

  let res = await makeRequest(activeModel);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errMsg = err.error?.message || "";
    if (errMsg.includes("no longer available") || res.status === 404 || res.status === 400 || res.status === 429) {
      activeModel = await discoverActiveModel(apiKey, true);
      res = await makeRequest(activeModel);
    }
    if (!res.ok) {
      const retryErr = await res.json().catch(() => ({}));
      throw new Error(retryErr.error?.message || errMsg || "HTTP " + res.status);
    }
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(raw);
}

export async function searchVehicleWithGemini(query, apiKey, imageObj = null) {
  const proxy = getProxyUrl();
  const directKey = apiKey || getApiKey();

  const tryProxy = async () => {
    if (!proxy) throw new Error("No proxy configured");
    const res = await fetch(proxy, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, image: imageObj })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Proxy error HTTP ${res.status}`);
    }
    return await res.json();
  };

  const tryDirect = async () => {
    if (!directKey) throw new Error("No Gemini API key configured");
    return await callDirectGemini(query, directKey, imageObj);
  };

  // If user has direct key, prefer direct key, falling back to proxy if it fails
  if (directKey) {
    try {
      return await tryDirect();
    } catch (directErr) {
      if (proxy) {
        console.warn("Direct key call failed, falling back to proxy:", directErr.message);
        return await tryProxy();
      }
      throw directErr;
    }
  } else if (proxy) {
    // If no direct key, use proxy; if proxy fails and directKey somehow exists, fallback to directKey
    try {
      return await tryProxy();
    } catch (proxyErr) {
      if (directKey) {
        console.warn("Proxy call failed, falling back to direct key:", proxyErr.message);
        return await tryDirect();
      }
      throw proxyErr;
    }
  } else {
    throw new Error("Neither Gemini API key nor cloud proxy configured.");
  }
}