const functions = require('@google-cloud/functions-framework');

functions.http('vehicleSearch', async (req, res) => {
  // CORS configuration
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { query } = req.body || {};
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    res.status(400).json({ error: 'Missing query parameter' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server GEMINI_API_KEY is not configured' });
    return;
  }

  const systemPrompt = `You are an expert Sri Lankan automotive market analyst and finance assessor. Evaluate vehicles based on actual Sri Lankan road regulations and active market availability (official franchise dealers like AMW, DIMO, John Keells CG, Stafford; Japanese auction grey market imports; or registered local fleet). Return strictly valid JSON conforming to the requested schema.`;
  
  const promptText = `Vehicle query: "${query.trim().slice(0, 120)}".
Determine:
1. Is this vehicle actively available or road-legal in Sri Lanka (is_available_in_sri_lanka: true/false)? If false, provide reason (e.g. LHD, banned class, never imported) and suggest 2-3 popular Sri Lankan market alternatives.
2. If available, return available model_years (array of years e.g. 2024, 2022, 2020), and for each year the available trim levels in Sri Lanka.
3. For each trim: trim_name, powertrain (e.g. 1.5L Strong HEV, 1.0L Turbo), real-world Sri Lankan fuel_economy_kml (e.g. 24-28 km/l), warranty_type ("Official" or "Grey"), and condition_prices (object with keys: "brand_new", "recond", "used_low", "used_med" containing price in Sri Lankan Rupees LKR).
4. Suggested studio_photo_url: A clean official studio press photograph URL of the vehicle (front-left 3/4 view on white background).`;

  try {
    const candidateModels = [
      "models/gemini-3.8-flash",
      "models/gemini-2.5-flash",
      "models/gemini-2.0-flash",
      "models/gemini-1.5-flash"
    ];

    let geminiRes = null;
    let lastErr = "";

    for (const model of candidateModels) {
      try {
        const attempt = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${promptText}` }] }],
            generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
          })
        });

        if (attempt.ok) {
          geminiRes = attempt;
          break;
        } else {
          const errJson = await attempt.json().catch(() => ({}));
          lastErr = errJson.error?.message || `HTTP ${attempt.status}`;
          // If model is sunset or invalid for this key, continue to next candidate
          if (lastErr.includes("no longer available") || attempt.status === 404 || attempt.status === 400) {
            continue;
          }
          // If rate limited or other error, break and return
          geminiRes = attempt;
          break;
        }
      } catch (err) {
        lastErr = err.message;
      }
    }

    if (!geminiRes || !geminiRes.ok) {
      res.status(geminiRes ? geminiRes.status : 500).json({ error: lastErr || "Failed to reach Gemini API" });
      return;
    }

    const data = await geminiRes.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    res.json(JSON.parse(raw));
  } catch (e) {
    res.status(500).json({ error: e.message || 'Internal error' });
  }
});
