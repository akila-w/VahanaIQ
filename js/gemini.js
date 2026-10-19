// Google AI Studio API: Model Discovery and Sri Lanka Automotive Analysis

export async function discoverActiveModel(apiKey) {
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

  // Pick fastest active Flash model in priority order
  let picked = null;
  const priorities = ["2.5-flash", "2.0-flash", "1.5-flash-latest", "1.5-flash", "flash", "pro"];
  for (const p of priorities) {
    const found = models.find(m => m.name.toLowerCase().includes(p));
    if (found) { picked = found.name; break; }
  }
  if (!picked) picked = models[0].name;
  const modelName = picked.startsWith("models/") ? picked : `models/${picked}`;
  localStorage.setItem("sl_lease_gemini_model", modelName);
  return modelName;
}

export async function searchVehicleWithGemini(query, apiKey) {
  let activeModel = localStorage.getItem("sl_lease_gemini_model");
  if (!activeModel) {
    activeModel = await discoverActiveModel(apiKey);
  }

  const systemPrompt = `You are an expert Sri Lankan automotive market analyst and finance assessor. Evaluate vehicles based on actual Sri Lankan road regulations and active market availability (official franchise dealers like AMW, DIMO, John Keells CG, Stafford; Japanese auction grey market imports; or registered local fleet). Return strictly valid JSON conforming to the requested schema.`;
  
  const promptText = `Vehicle query: "${query}".
Determine:
1. Is this vehicle actively available or road-legal in Sri Lanka (is_available_in_sri_lanka: true/false)? If false, provide reason (e.g. LHD, banned class, never imported) and suggest 2-3 popular Sri Lankan market alternatives.
2. If available, return available model_years (array of years e.g. 2024, 2022, 2020), and for each year the available trim levels in Sri Lanka.
3. For each trim: trim_name, powertrain (e.g. 1.5L Strong HEV, 1.0L Turbo), real-world Sri Lankan fuel_economy_kml (e.g. 24-28 km/l), warranty_type ("Official" or "Grey"), and condition_prices (object with keys: "brand_new", "recond", "used_low", "used_med" containing price in Sri Lankan Rupees LKR).
4. Suggested studio_photo_url: A clean official studio press photograph URL of the vehicle (front-left 3/4 view on white background).`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${activeModel}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${promptText}` }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "HTTP " + res.status);
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(raw);
}