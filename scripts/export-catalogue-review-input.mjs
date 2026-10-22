import fs from 'node:fs';
import { OFFICIAL_PHOTO_REGISTRY } from './build-official-photos.mjs';
import { baseVehicles } from '../js/market-catalogue.js';
import { PHOTO_CREDITS } from '../js/photo-credits.js';
fs.mkdirSync('docs/catalogue-review', { recursive: true });
fs.writeFileSync('docs/catalogue-review/input.json', JSON.stringify({
  models: OFFICIAL_PHOTO_REGISTRY, vehicles: baseVehicles, credits: PHOTO_CREDITS
}, null, 2));
