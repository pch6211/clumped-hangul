const fs = require('node:fs');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync('index.html'));
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.TEST_BROWSER || undefined });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:') ? route.continue() : route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => typeof world !== 'undefined' && world?.bodies.length);
    await page.evaluate(() => { cancelAnimationFrame(rafId); window._dismissIntro?.(); TEXT = '뭉친 한글'; PARAMS.flow = 0; PARAMS.cornerR = 5; world = buildWorld(TEXT); });
    const metrics = await page.evaluate(() => {
      const samples = [];
      for (let i = 0; i < 15; i++) { const t = performance.now(); draw(); if (i > 2) samples.push(performance.now() - t); }
      samples.sort((a,b) => a-b);
      return { medianDrawMs: samples[Math.floor(samples.length/2)], maskPixels: _smMask.width * _smMask.height, bodies: world.bodies.length, userAgent: navigator.userAgent };
    });
    console.log(JSON.stringify({ metrics, errors }, null, 2));
    await page.evaluate(() => { PARAMS.cornerR = 0; PARAMS.letterSpacing = 0; });
    await page.keyboard.press('Alt+ArrowLeft');
    assert.equal(await page.evaluate(() => PARAMS.letterSpacing), -5);
    const spacing = await page.evaluate(() => {
      PARAMS.letterSpacing = -150; resetWorld(); ensureFits();
      return { value: PARAMS.letterSpacing, finite: world.bodies.every(b => b.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))) };
    });
    assert.equal(spacing.value, -150); assert.ok(spacing.finite);
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
