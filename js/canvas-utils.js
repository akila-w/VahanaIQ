// HTML5 Canvas Normalisation Engine: 8:5 Studio Plate on Pure White (#FFFFFF)
export function normalizeImageToStudio(src, callback) {
  if (!src || typeof src !== "string" || !src.trim()) {
    callback("");
    return;
  }
  const cleanSrc = src.trim();
  if (typeof window !== "undefined" && (cleanSrc === window.location.href || cleanSrc === window.location.origin + window.location.pathname)) {
    callback("");
    return;
  }

  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 250;
      const ctx = canvas.getContext("2d");

      // Solid white background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 400, 250);

      // Scale to fit within 360 x 210 with 20px padding
      const maxW = 360, maxH = 210;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      const dx = (400 - dw) / 2, dy = (250 - dh) / 2;

      // Soft ground contact shadow beneath tyres
      const sy = dy + dh - 4;
      const grad = ctx.createRadialGradient(200, sy, dw * 0.15, 200, sy, dw * 0.5);
      grad.addColorStop(0, "rgba(0, 0, 0, 0.18)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(200, sy, dw * 0.45, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw vehicle
      ctx.drawImage(img, dx, dy, dw, dh);
      callback(canvas.toDataURL("image/jpeg", 0.88));
    } catch (err) {
      // Tainted canvas due to CORS or local origin - pass raw src through
      callback(cleanSrc);
    }
  };

  img.onerror = () => {
    // If CORS-enabled load failed, try loading without crossOrigin to verify if image exists
    const fallbackImg = new Image();
    fallbackImg.onload = () => {
      // Image exists but doesn't allow CORS for canvas manipulation; pass through valid URL
      callback(cleanSrc);
    };
    fallbackImg.onerror = () => {
      // Image truly failed (404, broken URL, etc.); return empty string so broken URL is never saved
      callback("");
    };
    fallbackImg.src = cleanSrc;
  };

  img.src = cleanSrc;
}