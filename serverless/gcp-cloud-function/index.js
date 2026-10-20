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
