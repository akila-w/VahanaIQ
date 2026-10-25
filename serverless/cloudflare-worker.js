/**
 * VahanaIQ Secure Proxy - Cloudflare Worker
 * 
 * Provides a secure backend proxy for VahanaIQ so the Gemini API key is never
 * exposed in client-side JavaScript or public GitHub repositories.
 * 
 * Free tier: 100,000 requests/day at $0/month.
 */

import {
  DEFAULT_MODEL,
  DEFAULT_ORIGINS,
  DEFAULT_RATE_LIMIT,
  VEHICLE_RESPONSE_SCHEMA,
  errorCode,
  safeDetail,
  parseAllowedOrigins,
  createRateLimiter,
  validateSearchRequest,
  isComparisonQuery,
  buildVehicleSearchRequestBody,
  callGemini,
  parseVehicleResponse
} from "./shared/proxy-logic.js";

// Best-effort limit per client IP on each isolate: RATE_LIMIT requests per 10 minutes
const rateLimited = createRateLimiter();

const corsHeaders = origin => origin ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : { "Vary": "Origin" };

const json = (body, status = 200, origin = "") => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
});

export default {
  async fetch(request, env) {
    const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS);
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

    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > 6000000) {
      return json({ error: "image_too_large", detail: "Payload too large; keep requests under 6 MB" }, 413, origin);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (rateLimited(ip, Number(env.RATE_LIMIT) || DEFAULT_RATE_LIMIT)) {
      return json({ error: "rate_limited", detail: "Too many searches. Try again in a few minutes." }, 429, origin);
    }

    try {
      const body = await request.json();
      const validation = validateSearchRequest(body);
      if (!validation.valid) {
        return json({ error: validation.error, detail: validation.detail }, validation.status, origin);
      }

      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("GEMINI_API_KEY secret is not configured");
        return json({ error: "internal", detail: "Platform GEMINI_API_KEY secret not configured on proxy" }, 500, origin);
      }

      const { query, image } = body || {};
      const comparison = isComparisonQuery(query, body?.comparison);
      const reqBody = buildVehicleSearchRequestBody(query, image, comparison, VEHICLE_RESPONSE_SCHEMA);

      const model = env.GEMINI_MODEL || DEFAULT_MODEL;
      const geminiRes = await callGemini(apiKey, model, reqBody);

      if (!geminiRes.ok) {
        console.error(`Gemini ${model} failed: HTTP ${geminiRes.status}: ${geminiRes.detail}`);
        return json({ error: errorCode(geminiRes.status), detail: safeDetail(geminiRes.detail), upstream_status: geminiRes.status }, 502, origin);
      }

      const parsed = parseVehicleResponse(geminiRes.data);
      return json(parsed, 200, origin);
    } catch (err) {
      console.error("Proxy internal error:", err);
      return json({ error: "internal", detail: "Internal server error" }, 500, origin);
    }
  }
};
