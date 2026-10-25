/**
 * VahanaIQ Serverless Proxy - Shared Domain & Business Logic
 *
 * Shared between Cloudflare Worker (ES modules) and Google Cloud Run /
 * Cloud Functions (CommonJS) to eliminate duplication and prevent prompt/schema drift.
 */

// Default Gemini models
const DEFAULT_MODEL = "gemini-3.6-flash";
const PRICE_MODEL = "gemini-2.5-flash-lite";

// Access control & network defaults
const DEFAULT_ORIGINS = "https://akila-w.github.io";

// Rate limiting configuration: 30 requests per 10 minutes per IP
const RATE_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_RATE_LIMIT = 30;
const MAX_RATE_LIMIT_ENTRIES = 5000;

// Screenshots: supported MIME types and max 4 MB raw payload
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// Raw request-body ceiling. MAX_IMAGE_BYTES is the *decoded* image limit enforced by
// validateImage(); a 4 MiB screenshot is ~5.6 MB once base64 encoded, so the JSON body
// limit must be larger than the image limit or a valid screenshot is refused first.
const MAX_BODY_BYTES = 6000000;

// Price mode constants
const PRICE_BASES = ["dealer price list", "dealer listing", "news report", "estimate"];
const MAX_PRICE_QUERIES = 12;

// Maps upstream Gemini HTTP status to a client-facing error code
const errorCode = status => status === 429 ? "quota" : status === 400 ? "bad_request" : "upstream_unavailable";

// Sanitizes upstream error messages to prevent credential leakage
const safeDetail = text => String(text || "")
  .replace(/key=[^&\s]+/gi, "key=[removed]")
  .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, "Bearer [removed]")
  .replace(/projects\/[a-zA-Z0-9_-]+/gi, "projects/[removed]")
  .slice(0, 200);

// Parses comma-separated origin strings into a normalized array
function parseAllowedOrigins(origins) {
  return (origins || DEFAULT_ORIGINS).split(",").map(o => o.trim()).filter(Boolean);
}

// Checks if an origin is permitted under CORS allowlist
function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return true;
  const list = Array.isArray(allowedOrigins) ? allowedOrigins : parseAllowedOrigins(allowedOrigins);
  return list.includes(origin);
}

// In-memory rate limiting check on a Map instance
function checkRateLimit(hitsMap, ip, limit = DEFAULT_RATE_LIMIT, windowMs = RATE_WINDOW_MS, maxEntries = MAX_RATE_LIMIT_ENTRIES) {
  const now = Date.now();
  const recent = (hitsMap.get(ip) || []).filter(t => now - t < windowMs);
  recent.push(now);
  hitsMap.set(ip, recent);
  if (hitsMap.size > maxEntries) hitsMap.delete(hitsMap.keys().next().value);
  return recent.length > limit;
}

// Creates an isolated rate limiter instance with its own tracking Map
function createRateLimiter({ windowMs = RATE_WINDOW_MS, defaultLimit = DEFAULT_RATE_LIMIT, maxEntries = MAX_RATE_LIMIT_ENTRIES } = {}) {
  const hits = new Map();
  const rateLimiter = (ip, limit = defaultLimit) => {
    return checkRateLimit(hits, ip, limit, windowMs, maxEntries);
  };
  rateLimiter.hits = hits;
  return rateLimiter;
}

// Decodes up to maxBytes from the beginning of a base64 string
function decodeFirstBytes(data, maxBytes = 12) {
  try {
    const charsNeeded = Math.ceil((maxBytes * 4) / 3);
    let chunk = data.slice(0, Math.min(data.length, charsNeeded));
    while (chunk.length % 4 !== 0) {
      chunk += "=";
    }
    const raw = typeof atob === "function" ? atob(chunk) : Buffer.from(chunk, "base64").toString("binary");
    const bytes = [];
    for (let i = 0; i < raw.length; i++) {
      bytes.push(raw.charCodeAt(i));
    }
    return bytes;
  } catch {
    return [];
  }
}

// Detects image MIME type from magic bytes:
// FF D8 FF = jpeg, 89 50 4E 47 = png, 52 49 46 46 ... 57 45 42 50 = webp, 47 49 46 38 = gif
function detectImageMimeType(data) {
  const b = decodeFirstBytes(data, 12);
  if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return "image/jpeg";
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return "image/png";
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

// Validates attached screenshot image
function validateImage(image) {
  if (!image) return { valid: true };
  if (
    typeof image.data !== "string" ||
    !image.data ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data) ||
    !IMAGE_TYPES.includes(image.mimeType || "image/jpeg")
  ) {
    return { valid: false, error: "bad_request", detail: "Attach a JPEG, PNG, WebP or GIF screenshot", status: 400 };
  }
  const len = image.data.length;
  const padding = image.data.endsWith("==") ? 2 : image.data.endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor((len * 3) / 4) - padding;
  if (decodedBytes > MAX_IMAGE_BYTES) {
    return { valid: false, error: "image_too_large", detail: "The screenshot is too large; attach one under 4 MB", status: 413 };
  }
  const realType = detectImageMimeType(image.data);
  const declaredMime = image.mimeType || "image/jpeg";
  if (!realType || realType !== declaredMime) {
    return { valid: false, error: "bad_request", detail: "Attach a JPEG, PNG, WebP or GIF screenshot", status: 400 };
  }
  return { valid: true };
}

// Validates vehicle search request body
function validateSearchRequest(body) {
  const { query, image } = body || {};
  if (!query && !image) {
    return { valid: false, error: "bad_request", detail: "Missing query or image parameter", status: 400 };
  }
  return validateImage(image);
}

// Validates price lookup request body
function validatePriceRequest(body) {
  const queries = body?.queries;
  if (!Array.isArray(queries) || !queries.length || queries.length > MAX_PRICE_QUERIES ||
      !queries.every(q => typeof q === "string" && q.trim())) {
    return { valid: false, error: "bad_request", detail: `Price mode needs queries: 1 to ${MAX_PRICE_QUERIES} vehicle names`, status: 400 };
  }
  return { valid: true };
}

// System prompt for Gemini vehicle market analysis
const SYSTEM_PROMPT = "You are an expert Sri Lankan automotive market analyst and finance assessor. Evaluate vehicles based on actual Sri Lankan road regulations and active market availability (official franchise dealers like AMW, DIMO, John Keells CG, Stafford; Japanese auction grey market imports; or registered local fleet). Return strictly valid JSON conforming to the requested schema.";

// Determines whether query indicates a multi-vehicle comparison
function isComparisonQuery(query, explicitComparison = false) {
  return explicitComparison === true || /\b(?:compar(?:e|ing|ison)|versus|vs\.?|alternatives)\b/i.test(query || "");
}

// Builds the full text prompt for vehicle search
function buildVehicleSearchPrompt(query, comparison = false) {
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

  const comparisonPrompt = comparison ? '\nThis is a comparison request. You must set is_multi_vehicle to true and return every requested model in discovered_vehicles. Do not substitute a single-model result.' : '';
  return `${SYSTEM_PROMPT}\n\n${promptText}${comparisonPrompt}`;
}

// Builds content parts for vehicle search (text prompt + optional image)
function buildVehicleSearchParts(query, image, comparison = false) {
  const parts = [{ text: buildVehicleSearchPrompt(query, comparison) }];
  if (image && image.data) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType || "image/jpeg",
        data: image.data
      }
    });
  }
  return parts;
}

// Full OpenAPI schema for vehicle search structured responses
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

// Builds Gemini generateContent request body for vehicle search
function buildVehicleSearchRequestBody(query, image, comparison = false, schema = VEHICLE_RESPONSE_SCHEMA) {
  return {
    contents: [{ parts: buildVehicleSearchParts(query, image, comparison) }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: schema
    }
  };
}

// Builds prompt for Google Search-grounded price lookups
function buildPricePrompt(queries, today = new Date().toISOString().slice(0, 10)) {
  const list = queries.map((q, i) => `${i + 1}. "${q.trim().slice(0, 300)}"`).join("\n");
  return `You are a Sri Lankan vehicle pricing researcher. Today is ${today}.
Use Google Search to find the current brand-new price in Sri Lanka, in LKR, of each of these vehicles:
${list}
Prefer official agent price lists, then dealer or importer listings (for example Riyasewana, ikman, Patpat), then recent news reports.
For each vehicle:
1. List every trim of that model you found a current brand-new price for, with its model year.
2. Give brand_new_price_lkr as whole rupees. If a price is given in millions or lakhs, convert it. Use 0 if you found no current price.
3. Set price_basis to where the price came from: ${PRICE_BASES.map(b => `"${b}"`).join(", ")}. Use "estimate" if it is not taken from a source published in the last 6 months.
4. Set as_of to the month the source was published, as YYYY-MM.
5. Set source_site to the website the price was taken from, as a domain such as riyasewana.com.
6. Do not use prices for reconditioned or used vehicles.
Reply with only a JSON object, no other text, in this shape:
{"vehicles": [{"query_index": 1, "model_name": "Make Model", "available_new_in_sri_lanka": true, "trims": [{"trim_name": "Grade", "model_year": 2026, "brand_new_price_lkr": 0, "price_basis": "dealer listing", "as_of": "YYYY-MM", "source_site": "example.lk"}]}]}`;
}

// Builds Gemini generateContent request body for price lookup
function buildPriceRequestBody(queries, today) {
  return {
    contents: [{ parts: [{ text: buildPricePrompt(queries, today) }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0 }
  };
}

// Calls upstream Google Generative Language API
async function callGemini(apiKey, model, body) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data, detail: data.error?.message || `HTTP ${r.status}` };
}

// Determines quota duration scope ('daily' vs 'minute') from QuotaFailure metadata
function quotaScope(data) {
  const ids = (data?.error?.details || []).flatMap(d => d.violations || []).map(v => v.quotaId || "").join(" ");
  return /PerDay/i.test(ids) ? "daily" : /PerMinute/i.test(ids) ? "minute" : undefined;
}

// Robust JSON parser extracting JSON payload from markdown fences or prose
function parseJsonText(text) {
  const str = String(text || "");
  const start = str.indexOf("{");
  const end = str.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No JSON object in the model reply");
  return JSON.parse(str.slice(start, end + 1));
}

// Parses vehicle search candidate JSON
function parseVehicleResponse(geminiData) {
  const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Missing content parts in Gemini response");
  return JSON.parse(raw);
}

// Normalizes grounded price lookup results and web citations
function formatPriceResponse(candidate, model = PRICE_MODEL) {
  const text = (candidate?.content?.parts || []).map(p => p.text || "").join("");
  const answer = parseJsonText(text);
  const meta = candidate?.groundingMetadata || {};
  return {
    vehicles: Array.isArray(answer.vehicles) ? answer.vehicles : [],
    sources: (meta.groundingChunks || [])
      .map(c => c.web)
      .filter(w => w && w.uri)
      .map(w => ({ title: w.title || w.uri, uri: w.uri })),
    search_queries: meta.webSearchQueries || [],
    model
  };
}

// Performs end-to-end grounded price lookup
async function priceLookup(apiKey, queries, model = PRICE_MODEL) {
  const r = await callGemini(apiKey, model, buildPriceRequestBody(queries));
  if (!r.ok) {
    const err = new Error(r.detail);
    err.status = r.status;
    err.quota = quotaScope(r.data);
    throw err;
  }
  return formatPriceResponse(r.data.candidates?.[0], model);
}

/**
 * Resolves the client IP for per-client rate limiting behind reverse proxies.
 *
 * Cloud Run and Google Cloud Load Balancing append one entry per hop to the
 * X-Forwarded-For header, which means earlier entries are caller-supplied and
 * untrusted. Taking the first IP (leftmost entry) allows callers to spoof
 * headers and rotate rate-limit quotas at will.
 *
 * To safely resolve the client IP:
 * - If trusted !== true, ignore X-Forwarded-For and fall back to socketIp || 'shared-proxy'.
 * - When trusted === true, count `hops` from the right (list[list.length - hops])
 *   so only the entry appended by the trusted proxy hop is considered.
 * - If the header chain has fewer entries than expected hops, fall back to socketIp || 'shared-proxy'.
 * - Normalise the candidate (strip brackets, strip IPv4 :port suffix, leave IPv6 intact).
 * - Reject candidates containing characters outside valid IPv4/IPv6 literals.
 *
 * Dependency-free (no node:net) to ensure compatibility with Cloudflare Workers.
 *
 * @param {Object} options
 * @param {string|string[]} [options.forwardedFor] X-Forwarded-For header value
 * @param {string} [options.socketIp] Underlying socket remote address
 * @param {boolean} [options.trusted] Whether the reverse proxy is trusted
 * @param {number} [options.hops=1] Number of trusted proxy hops from the right
 * @returns {string} The resolved client IP address or fallback
 */
function resolveClientIp({ forwardedFor, socketIp, trusted, hops = 1 } = {}) {
  const fallback = socketIp || "shared-proxy";
  if (trusted !== true) return fallback;

  const hopCount = Number(hops) >= 1 ? Math.floor(Number(hops)) : 1;
  const raw = Array.isArray(forwardedFor) ? forwardedFor.join(",") : (typeof forwardedFor === "string" ? forwardedFor : "");
  const entries = raw.split(",").map(s => s.trim()).filter(Boolean);

  if (entries.length < hopCount) return fallback;

  let candidate = entries[entries.length - hopCount];

  // Normalise: strip surrounding brackets (e.g. [2001:db8::1] -> 2001:db8::1)
  if (candidate.startsWith("[") && candidate.endsWith("]")) {
    candidate = candidate.slice(1, -1);
  } else if (/^\[[^\]]+\]:\d+$/.test(candidate)) {
    candidate = candidate.replace(/^\[([^\]]+)\]:\d+$/, "$1");
  }

  // Normalise: strip IPv4 :port suffix (e.g. 203.0.113.7:8080 -> 203.0.113.7), leaving IPv6 intact
  if (/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.test(candidate)) {
    candidate = candidate.replace(/:\d+$/, "");
  }

  // Accept only characters valid in an IPv4/IPv6 literal (digits, a-f, A-F, ":", ".")
  if (!candidate || !/^[0-9a-fA-F:.]+$/.test(candidate)) {
    return fallback;
  }

  return candidate;
}

// Export object with literal properties so Node.js static CJS module lexer exposes named exports in ESM
module.exports = {
  DEFAULT_MODEL,
  PRICE_MODEL,
  DEFAULT_ORIGINS,
  RATE_WINDOW_MS,
  DEFAULT_RATE_LIMIT,
  MAX_RATE_LIMIT_ENTRIES,
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_BODY_BYTES,
  PRICE_BASES,
  MAX_PRICE_QUERIES,
  SYSTEM_PROMPT,
  VEHICLE_RESPONSE_SCHEMA,
  errorCode,
  safeDetail,
  parseAllowedOrigins,
  isOriginAllowed,
  checkRateLimit,
  createRateLimiter,
  validateImage,
  validateSearchRequest,
  validatePriceRequest,
  isComparisonQuery,
  buildVehicleSearchPrompt,
  buildVehicleSearchParts,
  buildVehicleSearchRequestBody,
  buildPricePrompt,
  buildPriceRequestBody,
  callGemini,
  quotaScope,
  parseJsonText,
  parseVehicleResponse,
  formatPriceResponse,
  priceLookup,
  resolveClientIp
};
