// Focused negative controls: distinguish offline emulation, interception and
// application cache behaviour. No application or cache implementation changes.
import { test, expect } from '@playwright/test';
import { offlineServer } from './offline-server.mjs';
for (const routed of [false, true]) for (const disruption of ['emulated', 'origin-down']) {
  test(`offline diagnostic: routed=${routed} disruption=${disruption}`, async ({ page, context }, testInfo) => {
    const site = await offlineServer();
    try {
      if (routed) await context.route(/https:\/\//, route => route.abort());
      await page.goto(site.origin + '/__blank.html');
      await page.evaluate(() => navigator.serviceWorker.register('sw.js'));
      await page.evaluate(() => navigator.serviceWorker.ready);
      await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
      // Prove the document is in Cache Storage before disrupting the origin.
      expect(await page.evaluate(async () => !!await caches.match(new URL('index.html', location.href)))).toBe(true);
      if (disruption === 'emulated') await context.setOffline(true);
      else site.state.disconnected = true;
      let result;
      try {
        const response = await page.goto(site.origin + '/index.html');
        result = { fromWorker: response.fromServiceWorker(), title: await page.title() };
      } catch (error) { result = { error: error.message }; }
      console.log(JSON.stringify({ browser: testInfo.project.use.browserName, routed, disruption, result }));
      await testInfo.attach('offline-transport.json', { body: JSON.stringify(result), contentType: 'application/json' });
      // Explicit offline mode is diagnostic; the real origin-outage control must pass.
      if (disruption === 'origin-down') {
        expect(result.error).toBeUndefined();
        expect(result.fromWorker).toBe(true);
        expect(result.title).toMatch(/Lease Calculator/);
        await expect(page.evaluate(async () => {
          try { await fetch('/__uncached-network-probe', { cache: 'no-store' }); return false; } catch { return true; }
        })).resolves.toBe(true);
      }
    } finally { await site.close(); }
  });
}
