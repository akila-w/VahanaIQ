// Source-backed additions to the 21/10/2026 review, preserving the inherited snapshot.
import fs from 'node:fs';
import { baseVehicles } from '../js/market-catalogue.js';
const rows=[
 ['Toyota','Alphard','MPV',null,'https://www.toyota.lk/vehicle-model/alphard/'],
 ['Toyota','Hiace','Passenger van',null,'https://www.toyota.lk/vehicle-model/hiace/'],
 ['Toyota','Coaster','Minibus',null,'https://www.toyota.lk/vehicle-model/coaster/'],
 ['Toyota','Hilux 2026','Pickup',null,'https://www.toyota.lk/vehicle-model/hilux-2026/'],
 ['Suzuki','Ertiga','MPV',null,'https://www.suzuki.lk/vehicles/'],
 ['Suzuki','XL6','MPV',null,'https://www.suzuki.lk/vehicles/'],
 ['Kia','Carnival','MPV',null,'https://www.kia.lk/carnival/'],
 ['Kia','Carens Clavis EV','MPV',null,'https://www.kia.lk/clavis/'],
 ['Kia','Tasman','Pickup',null,'https://www.kia.lk/tasman/'],
 ['BYD','M6','MPV',null,'https://www.johnkeellscgauto.com/product/byd-m6-standard-captain/','Standard Captain'],
 ['BYD','Shark 6','Pickup',28350000,'https://www.johnkeellscgauto.com/product/byd-shark-6-premium/','Premium'],
 ['BYD','Racco','Passenger car',null,'https://www.johnkeellscgauto.com/product/byd-racco/'],
 ['Perodua','Alza','MPV',19950000,'https://www.peroduasl.lk/','Introductory offer'],
 ['Perodua','Traz','SUV',19200000,'https://www.peroduasl.lk/','Without body kit · introductory'],
 ['Renault','Triber','MPV',8190000,'https://www.renault.lk/news/renault-returns-to-sri-lanka-with-amw-unveiling-a-new-era-of-french-automotive-excellence/','Evolution MT'],
 ['Renault','Triber','MPV',9190000,'https://www.renault.lk/news/renault-returns-to-sri-lanka-with-amw-unveiling-a-new-era-of-french-automotive-excellence/','Emotion AMT'],
 ['Isuzu','D-Max','Pickup',null,'https://sathosamotorsplc.com/d-max.php']
];
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const added=rows.map(([make,model,body,price,sourceUrl,trim=null])=>({id:slug(`${make}-${model}-${trim||'range'}-official`),make,model,name:`${make} ${model}${trim?' '+trim:''}`,body,trim,year:null,market:null,fuel:make==='BYD'?(model==='Shark 6'?'PHEV':'BEV'):model==='Carens Clavis EV'?'BEV':null,pt:model==='Shark 6'?'Plug-in hybrid · dual cab':null,km:'',w:'Official',cond:'New',price,priceBasis:price?'published':'unpublished',priceCheckedMonth:'2026-10',pricePublishedMonth:null,priceSourceUrl:sourceUrl,sourceUrl,checkedOn:'2026-10-21',availability:'marketed',img:'',custom:false,priceVerification:price?'confirmed':'unverified',priceScope:trim||'Quote required',...(price?{priceVerifiedOn:'2026-10-21'}:{}),...(model==='Coaster'?{financeClass:'commercial'}:{}),...(['Pickup','Passenger van','Minibus'].includes(body)?{financeNote:body==='Minibus'?'Commercial D-class planning basis; confirm registration class and lender valuation.':'Passenger/B-class planning basis; confirm the registration class with your lender.'}:{})}));
const combined=[...baseVehicles,...added.filter(v=>!baseVehicles.some(x=>x.id===v.id))];
fs.writeFileSync('js/market-catalogue.js',`// Source-backed passenger vehicle and pickup catalogue. Unknown prices require a seller quote.\nexport const catalogMeta = { priceUpdated: "2026-10" };\nexport const baseVehicles = [\n${combined.map(v=>'  '+JSON.stringify(v).replace(/"([a-zA-Z_$][\w$]*)":/g,'$1: ')).join(',\n')}\n];\n`);
const file='docs/catalogue-review/input.json',input=JSON.parse(fs.readFileSync(file));
for(const v of added){if(!input.vehicles.some(x=>x.id===v.id))input.vehicles.push(v);if(!input.models.some(x=>x.make===v.make&&x.model===v.model))input.models.push({make:v.make,model:v.model,name:`${v.make} ${v.model}`,category:v.body,distributor:v.make+' Sri Lanka',distributorUrl:v.model==='Alza'?'https://www.peroduasl.lk/alza':v.model==='Traz'?'https://www.peroduasl.lk/traz':v.model==='Triber'?'https://www.renault.lk/renault-triber/':v.sourceUrl,localSlug:slug(v.make+' '+v.model)+'.webp',description:'Official source gallery pending visual review.'});}
fs.writeFileSync(file,JSON.stringify(input,null,2));
const pf='docs/catalogue-review/prices.json',prices=JSON.parse(fs.readFileSync(pf));for(const v of added)if(!prices.entries.some(x=>x.id===v.id))prices.entries.push({id:v.id,name:v.name,status:v.price?'confirmed':'unverified',inheritedPrice:null,inheritedSourceUrl:v.sourceUrl,verifiedPrice:v.price,verifiedSourceUrl:v.price?v.sourceUrl:null,checkedOn:'2026-10-21',scope:v.priceScope,note:v.price?(v.model==='Shark 6'?'Official Premium price, valid until 31/12/2026.':v.make==='Perodua'?'Advertised introductory offer; confirm eligibility and remaining offer allocation.':'Official launch price inclusive of VAT, published 19/10/2026.'):'Official range or brochure establishes the model; a current vehicle price was not substantiated. Request a quote.',checkedSources:[v.sourceUrl]});
prices.counts=Object.fromEntries([...new Set(prices.entries.map(x=>x.status))].map(k=>[k,prices.entries.filter(x=>x.status===k).length]));fs.writeFileSync(pf,JSON.stringify(prices,null,2));
fs.writeFileSync('data/passenger-expansion.json',JSON.stringify(added,null,2));
console.log('Catalogue:',combined.length,'entries;',added.length,'additions');
