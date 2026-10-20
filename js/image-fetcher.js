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

// Shown wherever a vehicle has no photo, on the same white plate
export const NO_PHOTO = '<div class="ph"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="3"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M14 21v-4a2 2 0 0 0-4 0v4"/></svg><span>No photo</span></div>';

// The bundled studio photo for a model, or "" when there is none
export function localStudioPhoto(modelName) {
  const normModel = (modelName || "").toLowerCase().trim();
  const item = LOCAL_STUDIO_MAP.find(i => i.match.some(m => normModel.includes(m)));
  return item ? item.img : "";
}

export async function fetchVehicleStudioImage(modelName, wikipediaSlug) {
  // 1. Check local studio assets first
  const local = localStudioPhoto(modelName);
  if (local) return local;

  // 2. Query Wikipedia REST API if slug or model is provided
  const slug = (wikipediaSlug || modelName || "").trim().replace(/\s+/g, "_");
  if (slug) {
    try {
      const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
      const res = await fetch(wikiUrl, {
        headers: { "User-Agent": "VahanaIQ/2.8.1 (https://akila-w.github.io/vahanaiq; vehicle-calculator)" }
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
