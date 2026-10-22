// Apply only individually substantiated corrections. Keep inherited amounts
// only in the review history. Unsupported numbers never drive public calculations.
import fs from 'node:fs';
import { baseVehicles, catalogMeta } from '../js/market-catalogue.js';
const checks=JSON.parse(fs.readFileSync('docs/catalogue-review/prices.json'));
const rows=baseVehicles.map(v=>{
 const p=checks.entries.find(p=>p.id===v.id);if(!p)throw Error('Missing price check '+v.id);
 const next={...v,priceVerification:p.status,priceScope:p.scope||'unverified'};
 if(['confirmed','correction'].includes(p.status)){
   next.price=p.verifiedPrice;next.priceSourceUrl=p.verifiedSourceUrl;
   next.priceBasis=/starting|range/.test(p.scope||'')?'starting':'published';
   next.priceCheckedMonth='2026-10';next.priceVerifiedOn='2026-10-21';
 }else { next.price=null; next.priceBasis=['conflict','specification-mismatch'].includes(p.status)?'conflicting':'unpublished'; delete next.priceVerifiedOn; next.priceCheckedMonth='2026-10'; }
 return next;
});
const obj=o=>JSON.stringify(o).replace(/"([a-zA-Z_$][\w$]*)":/g,'$1: ').replace(/,(?=[a-zA-Z_$])/g,', ');
fs.writeFileSync('js/market-catalogue.js','// Sri Lankan passenger-vehicle and pickup catalogue. Online price evidence reviewed 21/10/2026.\n// Unsubstantiated amounts are omitted; enter a quote to calculate. Listings do not guarantee stock.\nexport const catalogMeta = { priceUpdated: "2026-10" };\nexport const baseVehicles = [\n'+rows.map(v=>'  '+obj(v)).join(',\n')+'\n];\n');
console.log('Applied source evidence to',rows.length,'entries; substantiated',rows.filter(v=>v.priceVerifiedOn).length);
