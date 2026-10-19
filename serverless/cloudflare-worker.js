/**
 * VahanaIQ Secure Proxy - Cloudflare Worker
 * 
 * Provides a secure backend proxy for VahanaIQ so the Gemini API key is never
 * exposed in client-side JavaScript or public GitHub repositories.
 * 
 * Free tier: 100,000 requests/day at $0/month.
 * 
 * Deployment:
 * 1. Go to https://dash.cloudflare.com -> Workers & Pages -> Create Worker.
 * 2. Paste this code into the Worker editor and click Deploy.
 * 3. In Worker Settings -> Variables & Secrets -> add secret "GEMINI_API_KEY".
 * 4. Paste your Worker URL into js/config.js: proxyUrl: "https://<your-worker>.workers.dev"
 */

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";
    
    // CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    try {
      const { query } = await request.json();
      if (!query || typeof query !== "string" || query.trim().length === 0) {
        return new Response(JSON.stringify({ error: "Missing or invalid query parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "Platform GEMINI_API_KEY secret not configured on proxy" }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      const systemPrompt = "You are an expert Sri Lankan automotive market analyst and finance assessor. Evaluate vehicles based on actual Sri Lankan road regulations and active market availability (official franchise dealers like AMW, DIMO, John Keells CG, Stafford; Japanese auction grey market imports; or registered local fleet). Return strictly valid JSON conforming to the requested schema.";
      
      const promptText = `Vehicle query: "${query.trim().slice(0, 120)}".
Determine:
1. Is this vehicle actively available or road-legal in Sri Lanka (is_available_in_sri_lanka: true/false)? If false, provide reason (e.g. LHD, banned class, never imported) and suggest 2-3 popular Sri Lankan market alternatives.
2. If available, return available model_years (array of years e.g. 2024, 2022, 2020), and for each year the available trim levels in Sri Lanka.
3. For each trim: trim_name, powertrain (e.g. 1.5L Strong HEV, 1.0L Turbo), real-world Sri Lankan fuel_economy_kml (e.g. 24-28 km/l), warranty_type ("Official" or "Grey"), and condition_prices (object with keys: "brand_new", "recond", "used_low", "used_med" containing price in Sri Lankan Rupees LKR).
4. Suggested studio_photo_url: A clean official studio press photograph URL of the vehicle (front-left 3/4 view on white background).`;

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
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${systemPrompt}\n\n${promptText}` }] }],
              generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
            })
          });

          if (attempt.ok) {
            geminiRes = attempt;
            break;
          } else {
            const errJson = await attempt.json().catch(() => ({}));
            lastErr = errJson.error?.message || `Gemini API error ${attempt.status}`;
            if (lastErr.includes("no longer available") || attempt.status === 404 || attempt.status === 400) {
              continue;
            }
            geminiRes = attempt;
            break;
          }
        } catch (err) {
          lastErr = err.message;
        }
      }

      if (!geminiRes || !geminiRes.ok) {
        return new Response(JSON.stringify({ error: lastErr || "Failed to reach Gemini API" }), {
          status: geminiRes ? geminiRes.status : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      const data = await geminiRes.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(rawText);

      return new Response(JSON.stringify(parsed), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  }
};
