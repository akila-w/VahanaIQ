// Font conversion checks and host-font fallback checks have different controls.
// Only these first two samples are fully covered by BOTH bundled fonts. Inter
// also covers U+20A8; Manrope's U+20A8 is tested as fallback instead.
export const PRIMARY_SAMPLES = [
  'LKR 1,234,567.89 — − + % £ € ₹',
  'Café Škoda Ελληνικά Україна'
];
export const FALLBACK_SAMPLES = ['සිංහල', 'தமிழ்', '🚗'];
export const MIXED_SAMPLE = 'සිංහල தமிழ் 🚗';
export const WEIGHTS = [200, 400, 650, 750, 800];

// Exercise the exact text/weights in real layout before canvas measurement.
// fonts.ready alone resolves for text used by the application, not for every
// future canvas probe or the platform's cold fallback selection.
export async function exerciseFontText(page, families) {
  await page.evaluate(async ({ families, weights, samples }) => {
    const host = document.createElement('section');
    host.id = 'fontMetricsProbe';
    host.style.cssText = 'position:fixed;inset:0;z-index:9999;background:white;color:black;overflow:auto;padding:12px';
    for (const family of families) for (const weight of weights) {
      const row = document.createElement('div');
      row.style.font = `${weight} 24px "${family}", sans-serif`;
      row.textContent = samples.join(' | ');
      host.append(row);
    }
    document.body.append(host);
    host.getBoundingClientRect();
    await Promise.all(families.flatMap(family => weights.map(weight =>
      document.fonts.load(`${weight} 24px "${family}"`, samples.join(' ')))));
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, { families, weights: WEIGHTS, samples: [...PRIMARY_SAMPLES, ...FALLBACK_SAMPLES, MIXED_SAMPLE, '₨'] });
}

export async function primaryMetrics(page) {
  return page.evaluate(({ samples, weights }) => {
    const c = document.createElement('canvas').getContext('2d'), rows = [];
    for (const family of ['Inter', 'Manrope']) for (const weight of weights) {
      c.font = `${weight} 24px "${family}", sans-serif`;
      for (const text of [...samples, ...(family === 'Inter' ? ['₨'] : [])]) {
        const m = c.measureText(text);
        rows.push({ family, weight, text, width: m.width,
          ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent });
      }
    }
    return rows;
  }, { samples: PRIMARY_SAMPLES, weights: WEIGHTS });
}

// The source cmap contains none of these script/emoji characters. Compare each
// against the SAME page's generic fallback, rather than another fresh context's
// possibly different platform selection. Check raster output as well as metrics.
export async function fallbackMetrics(page) {
  return page.evaluate(({ samples, weights }) => {
    const canvas = document.createElement('canvas'); canvas.width = 300; canvas.height = 80;
    const c = canvas.getContext('2d'), rows = [];
    function render(font, text) {
      c.clearRect(0, 0, canvas.width, canvas.height); c.font = font; c.fillText(text, 8, 48);
      const m = c.measureText(text), pixels = c.getImageData(0, 0, canvas.width, canvas.height).data;
      return { metrics: { width: m.width, ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent },
        pixels: [...pixels], hasInk: pixels.some((value, i) => i % 4 === 3 && value > 0) };
    }
    for (const family of ['Inter', 'Manrope']) for (const weight of weights) {
      for (const text of [...samples, ...(family === 'Manrope' ? ['₨'] : [])]) {
        const actual = render(`${weight} 24px "${family}", sans-serif`, text);
        const system = render(`${weight} 24px sans-serif`, text);
        rows.push({ family, weight, text, actual: actual.metrics, system: system.metrics,
          hasInk: actual.hasInk && system.hasInk,
          identicalPixels: actual.pixels.every((value, i) => value === system.pixels[i]) });
      }
    }
    return rows;
  }, { samples: FALLBACK_SAMPLES, weights: WEIGHTS });
}

export async function mixedFormatMetrics(page) {
  return page.evaluate(({ weights, text }) => {
    const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 80;
    const c = canvas.getContext('2d'), rows = [];
    function render(family, weight) {
      c.clearRect(0, 0, canvas.width, canvas.height); c.font = `${weight} 24px "${family}", sans-serif`;
      c.fillText(text, 8, 48); const m = c.measureText(text);
      return { metrics: { width: m.width, ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent },
        pixels: [...c.getImageData(0, 0, canvas.width, canvas.height).data] };
    }
    for (const family of ['Inter', 'Manrope']) for (const weight of weights) {
      const a = render(`${family} source`, weight), b = render(`${family} web`, weight);
      rows.push({ family, weight, text, source: a.metrics, web: b.metrics,
        identicalPixels: a.pixels.every((value, i) => value === b.pixels[i]) });
    }
    return rows;
  }, { weights: WEIGHTS, text: MIXED_SAMPLE });
}
