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
    await page.evaluate(() => { PARAMS.letterSpacing = 50; resetWorld(); togglePanel(); draw(); });
    await page.locator('#centerHandles').click();
    const anchor = await page.evaluate(() => ({ x: world.bodies[0].anchorX, y: world.bodies[0].anchorY }));
    await page.mouse.move(anchor.x, anchor.y); await page.mouse.down();
    assert.equal(await page.evaluate(() => !!_centerDrag && !draggedNode), true);
    await page.mouse.move(anchor.x + 60, anchor.y - 90, { steps: 5 }); await page.mouse.up();
    const moved = await page.evaluate(() => {
      for (let i = 0; i < 25; i++) resetWorld();
      PARAMS.choHoriz = 2; world = buildWorld(currentText());
      return { x: world.bodies[0].anchorX, y: world.bodies[0].anchorY };
    });
    assert.ok(Math.abs(moved.x - anchor.x - 60) < 0.001 && Math.abs(moved.y - anchor.y + 90) < 0.001);
    await page.mouse.move(moved.x, moved.y); await page.mouse.down(); await page.mouse.move(moved.x + 40, moved.y);
    await page.evaluate(() => canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: _centerDrag.id })));
    await page.mouse.up();
    const cancelled = await page.evaluate(() => ({ x: world.bodies[0].anchorX, y: world.bodies[0].anchorY }));
    assert.ok(Math.hypot(cancelled.x - moved.x, cancelled.y - moved.y) < 0.001);
    await page.locator('#centerHandles').click();
    const node = await page.evaluate(() => {
      const n = world.bodies.flatMap(b => b.nodes).find(n => n.x > 340 && n.x < cssW - 20 && n.y > 80 && n.y < cssH - 80);
      return n ? { x: n.x, y: n.y } : { missing: true, first: world.bodies[0].nodes[0] };
    });
    assert.ok(!node.missing, JSON.stringify(node));
    await page.mouse.move(node.x, node.y); await page.mouse.down();
    assert.equal(await page.evaluate(() => !!draggedNode && !_centerDrag), true);
    await page.mouse.move(node.x + 20, node.y + 30); await page.evaluate(() => step(1)); await page.mouse.up();
    assert.equal(await page.evaluate(() => draggedNode), null);
    console.log('PASS: negative spacing, center drag, 25 resets, regeneration, pointer cancellation, stroke drag');
    const motion = await page.evaluate(() => {
      resetWorld(); const b = world.bodies[0], x = b.anchorX, y = b.anchorY;
      PARAMS.wind = 50; PARAMS.jitter = 10;
      for (let i = 0; i < 100; i++) _advanceMotion(i * 16);
      const excursion = Math.hypot(b.anchorX - x, b.anchorY - y);
      PARAMS.wind = PARAMS.jitter = 0;
      for (let i = 100; i < 300; i++) _advanceMotion(i * 16);
      return { excursion, residual: Math.hypot(b.anchorX - x, b.anchorY - y) };
    });
    assert.ok(motion.excursion > 1 && motion.excursion < 100); assert.ok(motion.residual < 0.001);
    console.log('PASS: bounded wind/jitter returns to the saved center', motion);
    const smoothing = await page.evaluate(() => {
      PARAMS.cornerR = 5; PARAMS.nodeR = 20; PARAMS.lineW = 12;
      const crop = _smoothViewport, comparisons = [];
      for (const shape of [0, 50, 100]) {
        PARAMS.shape = shape;
        const a = document.createElement('canvas'), b = document.createElement('canvas');
        a.width = b.width = cssW; a.height = b.height = cssH;
        const ca = a.getContext('2d'), cb = b.getContext('2d');
        drawSmoothedBodies(ca, world.bodies, '#123456', '#fff');
        _smoothViewport = (_, viewport) => viewport || { x: 0, y: 0, w: cssW, h: cssH };
        drawSmoothedBodies(cb, world.bodies, '#123456', '#fff'); _smoothViewport = crop;
        const aa = ca.getImageData(0,0,cssW,cssH).data, bb = cb.getImageData(0,0,cssW,cssH).data;
        let different = 0, maxDelta = 0; for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) { different++; maxDelta = Math.max(maxDelta, Math.abs(aa[i] - bb[i])); }
        comparisons.push({ shape, different, maxDelta });
      }
      return comparisons;
    });
    console.log('Smoothing pixel comparisons', smoothing);
    // GPU canvas compositing can round a few edge channels differently after translation.
    assert.ok(smoothing.every(x => x.different <= 64 && x.maxDelta <= 3));
    await page.locator('#modulationPanel summary').click();
    await page.locator('#modKey').selectOption('nodeR');
    await page.locator('#modFrom').fill('4'); await page.locator('#modTo').fill('20');
    await page.locator('#modPeriod').fill('2'); await page.locator('#modToggle').click();
    const modulation = await page.evaluate(() => {
      _advanceModulation(0); const start = PARAMS.nodeR;
      for (let i = 1; i <= 10; i++) _advanceModulation(i * 100);
      const middle = PARAMS.nodeR;
      for (let i = 11; i <= 20; i++) _advanceModulation(i * 100);
      const end = PARAMS.nodeR; _stopModulation();
      return { start, middle, end, restored: PARAMS.nodeR };
    });
    assert.equal(modulation.start, 4); assert.ok(Math.abs(modulation.middle - 20) < 0.001);
    assert.ok(Math.abs(modulation.end - 4) < 0.001); assert.equal(modulation.restored, 20);
    await page.locator('#modToggle').click();
    await page.evaluate(() => setParamValue('nodeR', 11));
    assert.deepEqual(await page.evaluate(() => [_modulation.running, PARAMS.nodeR]), [false, 11]);
    await page.locator('#modFrom').fill('999'); await page.locator('#modToggle').click();
    assert.equal(await page.evaluate(() => _modulation.running), false);
    console.log('PASS: modulation endpoints, cycle, restoration, manual interruption, input validation');
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
