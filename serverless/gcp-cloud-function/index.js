const functions = require('@google-cloud/functions-framework');

// The one place the Gemini model is chosen. Override with the GEMINI_MODEL env var.
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

// Maps an upstream Gemini HTTP status to a short code the front end can act on.
const errorCode = status => status === 429 ? 'quota' : status === 400 ? 'bad_request' : 'upstream_unavailable';

const VEHICLE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    is_available_in_sri_lanka: { type: 'BOOLEAN' },
    is_multi_vehicle: {
      type: 'BOOLEAN',
      description: 'Set to true if user asked to compare multiple vehicles or find best vehicles in a budget'
    },
    discovered_vehicles: {
      type: 'ARRAY',
      description: 'List of discovered or compared vehicles when is_multi_vehicle is true',
      items: {
        type: 'OBJECT',
        properties: {
          model_name: { type: 'STRING' },
          year: { type: 'INTEGER' },
          trim_name: { type: 'STRING' },
          powertrain: { type: 'STRING' },
          fuel_economy_kml: { type: 'STRING' },
          condition: { type: 'STRING', enum: ['New', 'Recond', 'Used'] },
          warranty_type: { type: 'STRING', enum: ['Official', 'Grey'] },
          price_lkr: { type: 'INTEGER' },
          wikipedia_slug: { type: 'STRING' }
        },
        required: ['model_name', 'year', 'trim_name', 'powertrain', 'condition', 'warranty_type', 'price_lkr']
      }
    },
    model_name: {
      type: 'STRING',
      description: 'Canonical make + model without year, e.g. Toyota Yaris Cross'
    },
    wikipedia_slug: {
      type: 'STRING',
      description: 'Canonical English Wikipedia page title for image lookup, e.g. Toyota_Yaris_Cross'
    },
    availability_notes: { type: 'STRING' },
    import_route: {
      type: 'STRING',
      enum: ['Official Agent', 'Grey Import', 'Registered Fleet']
    },
    seller_price_lkr: {
      type: 'INTEGER',
      description: 'Seller asking price in LKR if extracted from classified ad text, listing, or auction sheet, else 0'
    },
    detected_condition: {
      type: 'STRING',
      enum: ['New', 'Recond', 'Used']
    },
    reason: {
      type: 'STRING',
      description: 'Reason if vehicle is unavailable or not road-legal in Sri Lanka'
    },
    alternatives: {
      type: 'ARRAY',
      items: { type: 'STRING' }
    },
    model_years: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          year: { type: 'INTEGER' },
          trims: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                trim_name: { type: 'STRING' },
                powertrain: { type: 'STRING' },
                fuel_economy_kml: { type: 'STRING' },
                warranty_type: {
                  type: 'STRING',
                  enum: ['Official', 'Grey']
                },
                condition_prices: {
                  type: 'OBJECT',
                  properties: {
                    brand_new: { type: 'INTEGER' },
                    recond: { type: 'INTEGER' },
                    used_low: { type: 'INTEGER' },
                    used_med: { type: 'INTEGER' }
                  },
                  required: ['brand_new', 'recond', 'used_low', 'used_med']
                }
              },
              required: ['trim_name', 'powertrain', 'fuel_economy_kml', 'warranty_type', 'condition_prices']
            }
          }
        },
        required: ['year', 'trims']
      }
    }
  },
  required: [
    'is_available_in_sri_lanka',
    'model_name',
    'wikipedia_slug',
    'availability_notes',
    'import_route',
    'model_years'
  ]
};

// Price mode: a grounded lookup used only by the monthly catalogue refresh
// (scripts/refresh-prices.mjs), requested with POST { mode: 'price', query }.
// It searches Google so prices come from current Sri Lankan sources rather than the
// model's training data, and returns the web sources it used. The app's search is unchanged.
const PRICE_BASES = ['dealer price list', 'dealer listing', 'news report', 'estimate'];

const PRICE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    model_name: { type: 'STRING', description: 'Canonical make + model without year' },
    available_new_in_sri_lanka: { type: 'BOOLEAN' },
    trims: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          trim_name: { type: 'STRING' },
          model_year: { type: 'INTEGER' },
          brand_new_price_lkr: { type: 'INTEGER', description: 'Whole rupees, 0 if no current price was found' },
          price_basis: { type: 'STRING', enum: PRICE_BASES },
          as_of: { type: 'STRING', description: 'Month the price was published, YYYY-MM' }
        },
        required: ['trim_name', 'model_year', 'brand_new_price_lkr', 'price_basis', 'as_of']
      }
    }
  },
  required: ['model_name', 'available_new_in_sri_lanka', 'trims']
};

const callGemini = async (apiKey, body) => {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data, detail: data.error?.message || `HTTP ${r.status}` };
};

// Reads JSON from a reply that may be wrapped in a ```json fence or surrounded by prose
const parseJsonText = text => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('No JSON object in the model reply');
  return JSON.parse(text.slice(start, end + 1));
};

async function priceLookup(apiKey, query) {
  const today = new Date().toISOString().slice(0, 10);
  const prompt = `You are a Sri Lankan vehicle pricing researcher. Today is ${today}.
Use Google Search to find the current brand-new price in Sri Lanka, in LKR, of: "${query.trim().slice(0, 300)}".
Prefer official agent price lists, then dealer or importer listings (for example Riyasewana, ikman, Patpat), then recent news reports.
Instructions:
1. Return every trim of this model you found a current brand-new price for, with its model year.
2. Give brand_new_price_lkr as whole rupees. If a price is given in millions or lakhs, convert it. Use 0 if you found no current price.
3. Set price_basis to where the price came from: ${PRICE_BASES.map(b => `"${b}"`).join(', ')}. Use "estimate" if it is not taken from a source published in the last 6 months.
4. Set as_of to the month the source was published, as YYYY-MM.
5. Do not use prices for reconditioned or used vehicles.
Return only JSON with model_name, available_new_in_sri_lanka and trims (trim_name, model_year, brand_new_price_lkr, price_basis, as_of).`;

  const base = { contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }] };
  let r = await callGemini(apiKey, {
    ...base,
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: PRICE_RESPONSE_SCHEMA }
  });
  let structured = true;
  if (r.status === 400) {
    // A model that refuses a response schema alongside tools: ask for JSON in the prompt instead
    console.warn(`Gemini ${MODEL} refused schema with search (${r.detail}); retrying without schema`);
    r = await callGemini(apiKey, { ...base, generationConfig: { temperature: 0 } });
    structured = false;
  }
  if (!r.ok) {
    const err = new Error(r.detail);
    err.status = r.status;
    throw err;
  }
  const candidate = r.data.candidates?.[0];
  const text = (candidate?.content?.parts || []).map(p => p.text || '').join('');
  const answer = parseJsonText(text);
  const meta = candidate?.groundingMetadata || {};
  answer.sources = (meta.groundingChunks || [])
    .map(c => c.web)
    .filter(w => w && w.uri)
    .map(w => ({ title: w.title || w.uri, uri: w.uri }));
  answer.search_queries = meta.webSearchQueries || [];
  answer.structured = structured;
  return answer;
}

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
    res.status(405).json({ error: 'bad_request', detail: 'Method not allowed' });
    return;
  }

  const { query, image } = req.body || {};
  if (!query && !image) {
    res.status(400).json({ error: 'bad_request', detail: 'Missing query or image parameter' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not configured');
    res.status(500).json({ error: 'internal', detail: 'Server GEMINI_API_KEY is not configured' });
    return;
  }

  if (req.body?.mode === 'price') {
    if (!query) {
      res.status(400).json({ error: 'bad_request', detail: 'Price mode needs a query' });
      return;
    }
    try {
      res.json(await priceLookup(apiKey, query));
    } catch (e) {
      if (e.status) {
        console.error(`Gemini ${MODEL} price lookup failed: HTTP ${e.status}: ${e.message}`);
        res.status(502).json({ error: errorCode(e.status), detail: e.message });
      } else {
        console.error('Price lookup internal error:', e);
        res.status(500).json({ error: 'internal', detail: e.message || 'Internal error' });
      }
    }
    return;
  }

  const systemPrompt = `You are an expert Sri Lankan automotive market analyst and finance assessor. Evaluate vehicles based on actual Sri Lankan road regulations and active market availability (official franchise dealers like AMW, DIMO, John Keells CG, Stafford; Japanese auction grey market imports; or registered local fleet). Return strictly valid JSON conforming to the requested schema.`;
  
  const promptText = `Vehicle query / input: "${(query || '').trim().slice(0, 500)}".
Instructions:
1. If the input or attached image is a classified advertisement (e.g. from Ikman, Riyasewana, Patpat, Facebook Marketplace) or Japanese auction sheet:
   - Extract exact make, model, year, and trim.
   - Extract the seller's asking price in LKR as seller_price_lkr.
   - Detect condition as detected_condition ("New", "Recond", or "Used").
2. If the user asks for a comparative query or budget discovery:
   - Set is_multi_vehicle: true
   - Populate discovered_vehicles with an array of distinct vehicles matching the query.
3. Availability check:
   - Determine is_available_in_sri_lanka. If false, provide reason and 2-3 popular Sri Lankan alternatives.
4. If available:
   - Return model_name (canonical Make + Model without year).
   - Return wikipedia_slug (canonical English Wikipedia article title for image lookup).
   - Return import_route ("Official Agent", "Grey Import", or "Registered Fleet").
   - Return model_years array with available trims, powertrains, real-world fuel economy in km/l, warranty type, and condition prices in LKR.`;

  const parts = [{ text: `${systemPrompt}\n\n${promptText}` }];
  if (image && image.data) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType || 'image/jpeg',
        data: image.data
      }
    });
  }

  try {
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: VEHICLE_RESPONSE_SCHEMA
        }
      })
    });

    if (!geminiRes.ok) {
      const errJson = await geminiRes.json().catch(() => ({}));
      const detail = errJson.error?.message || `HTTP ${geminiRes.status}`;
      console.error(`Gemini ${MODEL} failed: HTTP ${geminiRes.status}: ${detail}`);
      res.status(502).json({ error: errorCode(geminiRes.status), detail });
      return;
    }

    const data = await geminiRes.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    res.json(JSON.parse(raw));
  } catch (e) {
    console.error('Proxy internal error:', e);
    res.status(500).json({ error: 'internal', detail: e.message || 'Internal error' });
  }
});
