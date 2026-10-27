// Usage: node scripts/import-price-history.mjs reviewed-observations.json
// Accepts a reviewed observation array. Never derives history from today's catalogue.
import fs from 'node:fs';
import { observationError } from '../js/price-history.js';
const input=process.argv[2];
if(!input)throw Error('Provide a reviewed observation JSON file.');
const additions=JSON.parse(fs.readFileSync(input,'utf8'));
if(!Array.isArray(additions)||!additions.length)throw Error('Expected a non-empty observation array.');
const target=new URL('../data/price-history.json',import.meta.url);
const data=JSON.parse(fs.readFileSync(target,'utf8'));
const combined=[...data.observations];
const key=o=>JSON.stringify([o.modelId,o.seriesId,o.year,o.trim,o.condition,o.route,o.kind,o.sourceUrl,o.observedOn]);
for(const item of additions){const error=observationError(item);if(error)throw Error(error);const prior=combined.find(o=>key(o)===key(item));if(prior&&prior.amount!==item.amount)throw Error('Conflicting observation; review the correction explicitly.');if(!prior)combined.push(item);}
fs.writeFileSync(target,JSON.stringify({...data,observations:combined},null,2)+'\n');
console.log(`Stored ${combined.length} reviewed observations. Review the diff before publishing.`);
