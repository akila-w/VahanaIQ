import fs from 'node:fs';
import path from 'node:path';
const dir='docs/catalogue-review';
const input=JSON.parse(fs.readFileSync(`${dir}/input.json`));
const photos=JSON.parse(fs.readFileSync(`${dir}/photo-candidates.json`));
const prices=JSON.parse(fs.readFileSync(`${dir}/prices.json`));
const identity=fs.existsSync(`${dir}/identity.json`)?JSON.parse(fs.readFileSync(`${dir}/identity.json`)):{brands:{},models:{}};
const overrides=fs.existsSync('data/photo-cover-overrides.json')?JSON.parse(fs.readFileSync('data/photo-cover-overrides.json')):{};
const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const variants=input.vehicles.map(v=>({...v,verification:prices.entries.find(p=>p.id===v.id)}));
const models=input.models.map((m,i)=>{
  const p=photos.find(p=>p.name===m.name);
  const seen=new Map();
  for(const photo of p?.photos||[]){
    // Responsive variants represent one photo; retain the largest real asset.
    const key=photo.url.replace(/-\d+px(?=\.jpg)/,'').replace(/-\d+x\d+(?=\.)/,'');
    if(!seen.has(key)||seen.get(key).width<photo.width||photo.isHero)seen.set(key,photo);
  }
  const clean=[...seen.values()].map(p=>({...p,id:m.localSlug.replace(/\.[^.]+$/,'')+'-'+p.id,group:/\/car_body\//.test(p.url)?'Colour views':'Catalogue photos'}));
  clean.sort((a,b)=>Number(b.sha256===overrides[m.name])-Number(a.sha256===overrides[m.name])||Number(Boolean(b.isHero))-Number(Boolean(a.isHero))||Number(a.group==='Colour views')-Number(b.group==='Colour views')||score(b)-score(a));
  return {...m,id:m.localSlug.replace(/\.[^.]+$/,''),photos:clean,variants:variants.filter(v=>v.make===m.make&&v.model===m.model),pageStatus:p?.pageStatus||'unavailable',currentCredit:input.credits[m.name]||null};
});
function score(p){return (p.isHero?25:0)+(/thumbnail|front|quarter|overview|masthead|hero|banner/i.test(p.url)?5:0)+(/interior|wheel|lamp|safety|logo|movie|poster/i.test(p.url)?-3:0)+Math.min(p.width/1000,2);}
const data={checkedOn:'21 Oct 2026',models,priceCounts:prices.counts,identity};
fs.writeFileSync(`${dir}/catalogue.json`,JSON.stringify(data,null,2));
fs.writeFileSync('docs/catalogue-review.html',`<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VahanaIQ · Catalogue Review</title><link rel="icon" href="../assets/icons/favicon.svg"><link rel="stylesheet" href="../css/tokens.css"><link rel="stylesheet" href="catalogue-review/review.css"></head>
<body><header class="review-header"><a class="brand" href="../"><img src="../assets/icons/logo-option-1-apex.svg" width="38" height="38" alt=""><strong>VahanaIQ</strong><span>Catalogue studio</span></a><div class="header-tools"><a href="review-findings.md">Review notes</a><button id="exportReview">Export my review</button></div></header>
<main><section class="intro"><p class="eyebrow">YOUR REVIEW COPY · 21 Oct 2026</p><h1>Explore the catalogue.</h1><p>Official galleries · Web listing hero covers · Trim pricing &amp; detailed specifications</p><div class="numbers" id="numbers"></div></section>
<section class="toolbar" aria-label="Find vehicles"><label class="search">Find a vehicle<input id="search" type="search" placeholder="Search make, model, trim or specification…"></label><label>Make<select id="make"><option value="">All makes</option></select></label><label>Review<select id="filter"><option value="">All vehicles</option><option value="correction">Price corrections</option><option value="unverified">Prices needing confirmation</option><option value="gallery">With official photo candidates</option><option value="missing">Missing official gallery</option><option value="chosen">My chosen covers</option></select></label><button id="clear">Clear</button></section>
<div class="results-heading"><p id="count" role="status"></p><p id="reviewProgress">No photos approved yet</p></div><div id="cards" class="cards"></div><nav class="pagination" aria-label="Catalogue pages"><button id="prev">Previous</button><span id="page"></span><button id="next">Next</button></nav>
<p class="footnote">Images are candidates for visual review, with source links. Official web listing hero images are set as the default card covers. Exact generation, trim and market still need checking. Your choices stay in this browser; export them to hand over your review.</p></main>
<dialog id="detail" aria-labelledby="detailTitle"><header class="dialog-header"><div><p class="eyebrow" id="detailMake"></p><h2 id="detailTitle"></h2></div><button id="closeDetail" aria-label="Close vehicle review">Close</button></header><div id="detailBody"></div></dialog><p id="notice" class="notice" role="status" hidden></p>
<script id="catalogue-data" type="application/json">${JSON.stringify(data).replace(/</g,'\\u003c')}</script><script src="catalogue-review/review.js"></script></body></html>`);
console.log(`${models.length} models, ${variants.length} variants, ${models.reduce((n,m)=>n+m.photos.length,0)} image candidates`);
