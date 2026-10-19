// Automated Zero-Touch Vehicle Studio Photos
// Resolves local studio assets, Wikipedia REST API, or Wikimedia Commons API

const LOCAL_STUDIO_MAP = [
  { match: ["corolla cross"], img: "assets/images/toyota-corolla-cross.jpg" },
  { match: ["sealion 6", "sea lion 6"], img: "assets/images/byd-sealion-6.jpg" },
  { match: ["vezel", "hr-v", "hrv"], img: "assets/images/honda-vezel.jpg" },
  { match: ["sealion 5", "sea lion 5"], img: "assets/images/byd-sealion-5.jpg" },
  { match: ["yaris cross"], img: "assets/images/toyota-yaris-cross.jpg" },
  { match: ["hyryder", "urban cruiser hyryder"], img: "assets/images/toyota-hyryder.jpg" },
  { match: ["raize"], img: "assets/images/toyota-raize.jpg" },
  { match: ["swift"], img: "assets/images/suzuki-swift.jpg" },
  { match: ["fronx"], img: "assets/images/suzuki-fronx.jpg" },
  { match: ["taisor", "urban cruiser taisor"], img: "assets/images/toyota-taisor.jpg" },
  { match: ["magnite"], img: "assets/images/nissan-magnite.jpg" },
  { match: ["wagon r", "wagonr"], img: "assets/images/suzuki-wagon-r.jpg" }
];

export async function fetchVehicleStudioImage(modelName, wikipediaSlug) {
  const normModel = (modelName || "").toLowerCase().trim();

  // 1. Check local studio assets first
  for (const item of LOCAL_STUDIO_MAP) {
    if (item.match.some(m => normModel.includes(m))) {
      return item.img;
    }
  }

  // 2. Query Wikipedia REST API if slug or model is provided
  const slug = (wikipediaSlug || modelName || "").trim().replace(/\s+/g, "_");
  if (slug) {
    try {
      const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
      const res = await fetch(wikiUrl, {
        headers: { "User-Agent": "VahanaIQ/2.6.1 (https://akila-w.github.io/vahanaiq; vehicle-calculator)" }
      });
      if (res.ok) {
        const data = await res.json();
        // Prefer thumbnail (fast, clean resolution) or originalimage
        const candidate = data.thumbnail?.source || data.originalimage?.source;
        if (candidate && !candidate.endsWith(".svg")) {
          return candidate;
        }
      }
    } catch (e) {
      console.warn("Wikipedia REST API lookup failed:", e);
    }
  }

  // 3. Query Wikimedia Commons API with origin=* (CORS enabled)
  if (modelName) {
    try {
      const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(modelName + " car")}&prop=imageinfo&iiprop=url&format=json&origin=*`;
      const res = await fetch(commonsUrl);
      if (res.ok) {
        const data = await res.json();
        const pages = data.query?.pages ? Object.values(data.query.pages) : [];
        for (const p of pages) {
          const url = p.imageinfo?.[0]?.url;
          if (url && /\.(jpe?g|png|webp)$/i.test(url)) {
            return url;
          }
        }
      }
    } catch (e) {
      console.warn("Wikimedia Commons API lookup failed:", e);
    }
  }

  return "";
}
