const functions = require('@google-cloud/functions-framework');
const crypto = require('crypto');

const proxyLogic = require('./shared/proxy-logic.js');

const {
  DEFAULT_MODEL,
  PRICE_MODEL,
  DEFAULT_RATE_LIMIT,
  MAX_BODY_BYTES,
  VEHICLE_RESPONSE_SCHEMA,
  errorCode,
  safeDetail,
  parseAllowedOrigins,
  isOriginAllowed,
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
  res.set('Vary', 'Origin');
  const header = name => (req.headers && (req.headers[name] || (req.get && req.get(name)))) || '';
  const origin = header('origin');
  if (!isOriginAllowed(origin, ALLOWED_ORIGINS)) {
    res.status(403).json({ error: 'forbidden', detail: 'This origin may not use the VahanaIQ search proxy' });
    return;
  }
  // CORS configuration
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

  const contentType = header('content-type');
  if (contentType && !contentType.toLowerCase().includes('application/json')) {
    res.status(415).json({ error: 'unsupported_media_type', detail: 'Content-Type must be application/json' });
    return;
  }

  const contentLength = Number(header('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    res.status(413).json({ error: 'image_too_large', detail: 'The screenshot is too large; attach one under 4 MB' });
    return;
  }

  // Rate limiting runs before validation and re-serialisation, so a client that has
  // spent its quota is rejected without that work. It cannot run before parsing:
  // @google-cloud/functions-framework parses the JSON body (and answers malformed
  // syntax with its own plain 400) before this handler is invoked.
  // Cloud Run appends one entry per hop to X-Forwarded-For, meaning earlier entries
  // are untrusted. Count trusted hops from the right when TRUSTED_PROXY=true;
  // fall back to socket IP if untrusted.
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

  let body = req.body;
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    try {
      body = JSON.parse(body.toString('utf8'));
    } catch {
      res.status(400).json({ error: 'bad_request', detail: 'Malformed JSON body' });
      return;
    }
  }

  // In Cloud Run the functions framework parses the body first and answers invalid
  // JSON syntax with its own plain 400, so in production this branch covers
  // valid-but-non-object JSON such as `[]`, `123` or `"text"`.
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json({ error: 'bad_request', detail: 'Malformed JSON body' });
    return;
  }

  // Body ceiling, measured in UTF-8 bytes after parsing. The Content-Length guard above
  // rejects honest callers early; this catches chunked requests that omit the header.
  // MAX_BODY_BYTES is larger than MAX_IMAGE_BYTES because base64 inflates an image by
  // 4/3: a 4 MiB screenshot arrives as ~5.6 MB of JSON and must not be refused here.
  const serializedBody = JSON.stringify(body);
  if (Buffer.byteLength(serializedBody, 'utf8') > MAX_BODY_BYTES) {
    res.status(413).json({ error: 'image_too_large', detail: 'The screenshot is too large; attach one under 4 MB' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not configured');
    res.status(500).json({ error: 'internal', detail: 'Server GEMINI_API_KEY is not configured' });
    return;
  }

  if (body.mode === 'price') {
    // Price mode is closed unless PRICE_TOKEN is configured on this deployment
    if (!process.env.PRICE_TOKEN || !process.env.PRICE_TOKEN.trim()) {
      res.status(503).json({ error: 'price_mode_disabled', detail: 'Price mode is disabled on this deployment' });
      return;
    }
    if (!safeCompareTokens(header('x-price-token'), process.env.PRICE_TOKEN)) {
      res.status(401).json({ error: 'unauthorised', detail: 'Price mode needs the X-Price-Token header' });
      return;
    }
    const val = validatePriceRequest(body);
    if (!val.valid) {
      res.status(val.status).json({ error: val.error, detail: val.detail });
      return;
    }
    const queries = body.queries;
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

  // Search mode requires a valid allowlisted Origin header (non-browser clients must not relay through search)
  if (!origin) {
    res.status(403).json({ error: 'forbidden', detail: 'Search requests must come from the VahanaIQ site' });
    return;
  }

  const val = validateSearchRequest(body);
  if (!val.valid) {
    res.status(val.status).json({ error: val.error, detail: val.detail });
    return;
  }

  const { query, image } = body;
  const comparison = isComparisonQuery(query, body.comparison);
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
