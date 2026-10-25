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
  priceLookup
} = proxyLogic;

// The one place the Gemini model is chosen. Override with the GEMINI_MODEL env var.
const MODEL = process.env.GEMINI_MODEL || DEFAULT_MODEL;

// Browsers on other sites may not use this proxy: ALLOWED_ORIGINS is a comma-separated list
// (default: the GitHub Pages site). Requests without an Origin header (servers, the monthly
// price script) are allowed but still rate limited.
const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);

// Rate limiting configuration
// Quota per client IP on each instance: RATE_LIMIT requests per 10 minutes.
// Forwarded headers (X-Forwarded-For) can be spoofed by callers to bypass rate limits
// unless the function runs behind a trusted reverse proxy (e.g. Google Cloud Load Balancing
// or Cloud Run) that normalises or manages headers.
// Set environment variable TRUSTED_PROXY=true when deployed behind such a proxy.
// When TRUSTED_PROXY is false or unset, the proxy falls back strictly to req.socket.remoteAddress
// (or 'shared-proxy') to prevent spoofed header rate-limit rotation.
const RATE_LIMIT = Number(process.env.RATE_LIMIT) || DEFAULT_RATE_LIMIT;
const rateLimited = createRateLimiter({ defaultLimit: RATE_LIMIT });

/**
 * Resolves the client IP for per-client rate limiting.
 *
 * Behind Cloud Load Balancer / Cloud Run, req.socket.remoteAddress represents the internal
 * proxy or load-balancer IP rather than the true client.
 *
 * To extract the client IP safely without opening spoofing vulnerabilities:
 * 1. Only trust X-Forwarded-For if TRUSTED_PROXY=true is set in the environment.
 * 2. When TRUSTED_PROXY is enabled and X-Forwarded-For exists, take the first IP.
 * 3. Log extraction details for debugging and auditability.
 * 4. Fall back to socket IP (req.socket.remoteAddress) or 'shared-proxy' if untrusted or missing.
 */
function extractClientIp(req) {
  const socketIp = req?.socket?.remoteAddress;
  const isTrusted = process.env.TRUSTED_PROXY === 'true';

  if (isTrusted) {
    let rawForwarded = '';
    if (typeof req?.get === 'function') {
      rawForwarded = req.get('x-forwarded-for') || '';
    }
    if (!rawForwarded && req?.headers) {
      rawForwarded = req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'] || '';
    }
    const forwarded = Array.isArray(rawForwarded) ? rawForwarded.join(',') : String(rawForwarded || '');
    if (forwarded) {
      const firstIp = forwarded.split(',')[0].trim();
      if (firstIp) {
        console.log(`[RateLimit] Extracted client IP ${firstIp} from X-Forwarded-For (socket: ${socketIp || 'unknown'})`);
        return firstIp;
      }
    }
    console.log(`[RateLimit] TRUSTED_PROXY enabled but X-Forwarded-For missing; falling back to socket IP: ${socketIp || 'shared-proxy'}`);
  }

  const fallbackIp = socketIp || 'shared-proxy';
  return fallbackIp;
}

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

  const ip = extractClientIp(req);
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
    // Price mode is for the monthly refresh only: when PRICE_TOKEN is set, callers must send it
    if (process.env.PRICE_TOKEN && !safeCompareTokens(header('x-price-token'), process.env.PRICE_TOKEN)) {
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
