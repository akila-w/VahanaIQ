// Google AI Studio API: Model Discovery and Sri Lanka Automotive Analysis
import { getProxyUrl } from "./storage.js?v=2.5.1";

const PREFERRED_MODEL_VERSION = "2.5";

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
  // 3. Prefer non-experimental / stable
  // 4. Alphabetical
  const candidates = [...models].sort((a, b) => {
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

  // Actively probe candidate models to ensure the chosen one is currently active and reachable
  let workingModel = null;
  let lastErrorMsg = "";

  for (const candidate of candidates) {
    const modelName = candidate.name.startsWith("models/") ? candidate.name : `models/${candidate.name}`;
    // Skip retired legacy models
    if (modelName.includes("gemini-1.0")) {
      continue;
    }
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

export async function searchVehicleWithGemini(query, apiKey) {
  const proxy = getProxyUrl();
  if (proxy && !apiKey) {
    const res = await fetch(proxy, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Proxy error HTTP ${res.status}`);
    }
    return await res.json();
  }

  let activeModel = localStorage.getItem("sl_lease_gemini_model");
  const cachedVersion = localStorage.getItem("sl_lease_gemini_model_v");
  if (!activeModel || cachedVersion !== PREFERRED_MODEL_VERSION || activeModel.includes("gemini-3.8-flash")) {
    activeModel = await discoverActiveModel(apiKey);
  }

  const systemPrompt = `You are an expert Sri Lankan automotive market analyst and finance assessor. Evaluate vehicles based on actual Sri Lankan road regulations and active market availability (official franchise dealers like AMW, DIMO, John Keells CG, Stafford; Japanese auction grey market imports; or registered local fleet). Return strictly valid JSON conforming to the requested schema.`;
  
  const promptText = `Vehicle query: "${query}".
Determine:
1. Is this vehicle actively available or road-legal in Sri Lanka (is_available_in_sri_lanka: true/false)? If false, provide reason (e.g. LHD, banned class, never imported) and suggest 2-3 popular Sri Lankan market alternatives.
2. If available, return available model_years (array of years e.g. 2024, 2022, 2020), and for each year the available trim levels in Sri Lanka.
3. For each trim: trim_name, powertrain (e.g. 1.5L Strong HEV, 1.0L Turbo), real-world Sri Lankan fuel_economy_kml (e.g. 24-28 km/l), warranty_type ("Official" or "Grey"), and condition_prices (object with keys: "brand_new", "recond", "used_low", "used_med" containing price in Sri Lankan Rupees LKR).
4. Suggested studio_photo_url: A clean official studio press photograph URL of the vehicle (front-left 3/4 view on white background).`;

  let res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${activeModel}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${promptText}` }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errMsg = err.error?.message || "";
    if (errMsg.includes("no longer available") || res.status === 404 || res.status === 400 || res.status === 429) {
      activeModel = await discoverActiveModel(apiKey, true);
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${activeModel}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${promptText}` }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
        })
      });
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