/**
 * VahanaIQ Secure Proxy - Cloudflare Worker
 * 
 * Provides a secure backend proxy for VahanaIQ so the Gemini API key is never
 * exposed in client-side JavaScript or public GitHub repositories.
 * 
 * Free tier: 100,000 requests/day at $0/month.
 */

// Default Gemini model. Override with the GEMINI_MODEL variable on the Worker.
const DEFAULT_MODEL = "gemini-3.6-flash";

// Maps an upstream Gemini HTTP status to a short code the front end can act on.
const errorCode = status => status === 429 ? "quota" : status === 400 ? "bad_request" : "upstream_unavailable";

// Browsers on other sites may not use this proxy: ALLOWED_ORIGINS (a Worker variable) is a
// comma-separated list, defaulting to the GitHub Pages site. Requests without an Origin header
// are allowed but still rate limited.
const DEFAULT_ORIGINS = "https://akila-w.github.io";
// Best-effort limit per client IP on each isolate: RATE_LIMIT requests per 10 minutes
const RATE_WINDOW_MS = 10 * 60 * 1000;
const hits = new Map();
// Screenshots: these types only, and at most about 4 MB of image data
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BASE64 = 5600000;
// Upstream messages are passed on for the client's retry logic, short and without key-like text
const safeDetail = text => String(text || "").replace(/key=[^&\s]+/gi, "key=[removed]").slice(0, 200);

function rateLimited(ip, limit) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  return recent.length > limit;
}

const corsHeaders = origin => origin ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : { "Vary": "Origin" };

const json = (body, status = 200, origin = "") => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
});

const VEHICLE_RESPONSE_SCHEMA = {
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

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(",").map(o => o.trim()).filter(Boolean);
    const origin = request.headers.get("Origin") || "";
    if (origin && !allowed.includes(origin)) {
      return json({ error: "forbidden", detail: "This origin may not use the VahanaIQ search proxy" }, 403);
    }

    // CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          ...corsHeaders(origin),
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    if (request.method !== "POST") {
      return json({ error: "bad_request", detail: "Method not allowed" }, 405, origin);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (rateLimited(ip, Number(env.RATE_LIMIT) || 30)) {
      return json({ error: "rate_limited", detail: "Too many searches. Try again in a few minutes." }, 429, origin);
    }

    try {
      const body = await request.json();
      const { query, image } = body || {};
      if (!query && !image) {
        return json({ error: "bad_request", detail: "Missing query or image parameter" }, 400, origin);
      }
      if (image && (typeof image.data !== "string" || !IMAGE_TYPES.includes(image.mimeType || "image/jpeg"))) {
        return json({ error: "bad_request", detail: "Attach a JPEG, PNG, WebP or GIF screenshot" }, 400, origin);
      }
      if (image && image.data.length > MAX_IMAGE_BASE64) {
        return json({ error: "image_too_large", detail: "The screenshot is too large; attach one under 4 MB" }, 413, origin);
      }

      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("GEMINI_API_KEY secret is not configured");
        return json({ error: "internal", detail: "Platform GEMINI_API_KEY secret not configured on proxy" }, 500, origin);
      }

      const systemPrompt = "You are an expert Sri Lankan automotive market analyst and finance assessor. Evaluate vehicles based on actual Sri Lankan road regulations and active market availability (official franchise dealers like AMW, DIMO, John Keells CG, Stafford; Japanese auction grey market imports; or registered local fleet). Return strictly valid JSON conforming to the requested schema.";
      
      const promptText = `Vehicle query / input: "${(query || "").trim().slice(0, 500)}".
Instructions:
1. If the input or attached image is a classified advertisement (e.g. from Ikman, Riyasewana, Patpat, Facebook Marketplace) or Japanese auction sheet:
   - Extract exact make, model, year, and trim.
   - Extract the seller's asking price in LKR as seller_price_lkr.
   - Detect condition as detected_condition ("New", "Recond", or "Used").
2. If the user asks for a comparative query or budget discovery:
   - Set is_multi_vehicle: true
   - Populate discovered_vehicles with an array of at least two distinct vehicles matching the query. Include every requested model; multiple trims of one model must not replace another requested model.
   - For a single-vehicle query set is_multi_vehicle to false and discovered_vehicles to [].
3. Availability check:
   - Determine is_available_in_sri_lanka. If false, provide reason and 2-3 popular Sri Lankan alternatives.
4. If available:
   - Return model_name (canonical Make + Model without year).
   - Return wikipedia_slug (canonical English Wikipedia article title for image lookup).
   - Return import_route ("Official Agent", "Grey Import", or "Registered Fleet").
   - Return model_years array with available trims, powertrains, real-world fuel economy in km/l, warranty type, and condition prices in LKR.`;

      const comparison = body.comparison === true || /\b(?:compar(?:e|ing|ison)|versus|vs\.?|alternatives)\b/i.test(query || "");
      const comparisonPrompt = comparison ? '\nThis is a comparison request. You must set is_multi_vehicle to true and return every requested model in discovered_vehicles. Do not substitute a single-model result.' : '';
      const parts = [{ text: `${systemPrompt}\n\n${promptText}${comparisonPrompt}` }];
      if (image && image.data) {
        parts.push({
          inlineData: {
            mimeType: image.mimeType || "image/jpeg",
            data: image.data
          }
        });
      }

      const model = env.GEMINI_MODEL || DEFAULT_MODEL;
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
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

      if (!geminiRes.ok) {
        const errJson = await geminiRes.json().catch(() => ({}));
        const detail = errJson.error?.message || `HTTP ${geminiRes.status}`;
        console.error(`Gemini ${model} failed: HTTP ${geminiRes.status}: ${detail}`);
        return json({ error: errorCode(geminiRes.status), detail: safeDetail(detail), upstream_status: geminiRes.status }, 502, origin);
      }

      const data = await geminiRes.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(rawText);

      return json(parsed, 200, origin);
    } catch (err) {
      console.error("Proxy internal error:", err);
      return json({ error: "internal", detail: "Internal server error" }, 500, origin);
    }
  }
};
