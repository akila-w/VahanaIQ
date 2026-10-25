const functions = require('@google-cloud/functions-framework');
const crypto = require('crypto');
const path = require('path');

// Resolve shared proxy logic supporting local development, containerized builds, and testing harnesses
let proxyLogic;
try {
  proxyLogic = require('../shared/proxy-logic.js');
} catch (e) {
  try {
    proxyLogic = require('./shared/proxy-logic.js');
  } catch (e2) {
    try {
      proxyLogic = require('./proxy-logic.js');
    } catch (e3) {
      proxyLogic = require(path.resolve(process.cwd(), 'serverless/shared/proxy-logic.js'));
    }
  }
}

const {
  DEFAULT_MODEL,
  PRICE_MODEL,
  DEFAULT_RATE_LIMIT,
  VEHICLE_RESPONSE_SCHEMA,
  errorCode,
  safeDetail,
  parseAllowedOrigins,
  createRateLimiter,
  validateSearchRequest,
  validatePriceRequest,
  isComparisonQuery,
  buildVehicleSearchRequestBody,
  callGemini,
  parseVehicleResponse,
  priceLookup,
  resolveClientIp
} = proxyLogic;

// The one place the Gemini model is chosen. Override with the GEMINI_MODEL env var.
const MODEL = process.env.GEMINI_MODEL || DEFAULT_MODEL;

// Browsers on other sites may not use this proxy: ALLOWED_ORIGINS is a comma-separated list
// (default: the GitHub Pages site). Requests without an Origin header (servers, the monthly
// price script) are allowed but still rate limited.
const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);

// Rate limiting configuration
// Quota per client IP on each instance: RATE_LIMIT requests per 10 minutes.
// Cloud Run appends one entry per hop to X-Forwarded-For, meaning earlier entries
// are attacker-controlled and untrusted. Client IP resolution counts trusted proxy
// hops from the right when TRUSTED_PROXY=true (TRUSTED_PROXY_HOPS, default 1).
// When TRUSTED_PROXY is false or unset, the proxy falls back strictly to req.socket.remoteAddress
// (or 'shared-proxy') to prevent spoofed header rate-limit rotation.
const RATE_LIMIT = Number(process.env.RATE_LIMIT) || DEFAULT_RATE_LIMIT;
const rateLimited = createRateLimiter({ defaultLimit: RATE_LIMIT });

/**
 * Constant-time comparison for authentication tokens to prevent timing side-channel attacks.
 */
function safeCompareTokens(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  const hashProvided = crypto.createHash('sha256').update(provided).digest();
  const hashExpected = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(hashProvided, hashExpected);
}

functions.http('vehicleSearch', async (req, res) => {
  const header = name => (req.headers && (req.headers[name] || (req.get && req.get(name)))) || '';
  const origin = header('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    res.status(403).json({ error: 'forbidden', detail: 'This origin may not use the VahanaIQ search proxy' });
    return;
  }
  // CORS configuration
  res.set('Vary', 'Origin');
  if (origin) res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Price-Token');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'bad_request', detail: 'Method not allowed' });
    return;
  }

  const contentLength = Number(header('content-length') || 0);
  if (contentLength > 6000000) {
    res.status(413).json({ error: 'image_too_large', detail: 'Payload too large; keep requests under 6 MB' });
    return;
  }

  // Rate limiting: Cloud Run appends one entry per hop to X-Forwarded-For,
  // meaning earlier entries are untrusted. Count trusted hops from the right
  // when TRUSTED_PROXY=true; fall back to socket IP if untrusted.
  const ip = resolveClientIp({
    forwardedFor: req.headers && (req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For']),
    socketIp: req.socket?.remoteAddress,
    trusted: process.env.TRUSTED_PROXY === 'true',
    hops: Number(process.env.TRUSTED_PROXY_HOPS) || 1
  });
  if (rateLimited(ip)) {
    res.status(429).json({ error: 'rate_limited', detail: 'Too many searches. Try again in a few minutes.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not configured');
    res.status(500).json({ error: 'internal', detail: 'Server GEMINI_API_KEY is not configured' });
    return;
  }

  if (req.body?.mode === 'price') {
    // Price mode is closed unless PRICE_TOKEN is configured on this deployment
    if (!process.env.PRICE_TOKEN || !process.env.PRICE_TOKEN.trim()) {
      res.status(503).json({ error: 'price_mode_disabled', detail: 'Price mode is disabled on this deployment' });
      return;
    }
    if (!safeCompareTokens(header('x-price-token'), process.env.PRICE_TOKEN)) {
      res.status(401).json({ error: 'unauthorised', detail: 'Price mode needs the X-Price-Token header' });
      return;
    }
    const val = validatePriceRequest(req.body);
    if (!val.valid) {
      res.status(val.status).json({ error: val.error, detail: val.detail });
      return;
    }
    const queries = req.body.queries;
    const priceModel = process.env.PRICE_MODEL || PRICE_MODEL;
    try {
      res.json(await priceLookup(apiKey, queries, priceModel));
    } catch (e) {
      if (e.status) {
        console.error(`Gemini ${priceModel} price lookup failed: HTTP ${e.status}: ${e.message}`);
        res.status(502).json({ error: errorCode(e.status), detail: safeDetail(e.message), upstream_status: e.status, ...(e.quota ? { quota: e.quota } : {}) });
      } else {
        console.error('Price lookup internal error:', e);
        res.status(500).json({ error: 'internal', detail: 'Internal error' });
      }
    }
    return;
  }

  const val = validateSearchRequest(req.body);
  if (!val.valid) {
    res.status(val.status).json({ error: val.error, detail: val.detail });
    return;
  }

  const { query, image } = req.body || {};
  const comparison = isComparisonQuery(query, req.body?.comparison);
  const reqBody = buildVehicleSearchRequestBody(query, image, comparison, VEHICLE_RESPONSE_SCHEMA);

  try {
    const geminiRes = await callGemini(apiKey, MODEL, reqBody);

    if (!geminiRes.ok) {
      console.error(`Gemini ${MODEL} failed: HTTP ${geminiRes.status}: ${geminiRes.detail}`);
      res.status(502).json({ error: errorCode(geminiRes.status), detail: safeDetail(geminiRes.detail), upstream_status: geminiRes.status });
      return;
    }

    res.json(parseVehicleResponse(geminiRes.data));
  } catch (e) {
    console.error('Proxy internal error:', e);
    res.status(500).json({ error: 'internal', detail: 'Internal error' });
  }
});
