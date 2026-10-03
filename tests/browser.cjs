const fs = require('node:fs');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const server = http.createServer((req, res) => {
    const script = req.url === '/media-export.js';
    res.setHeader('Content-Type', script ? 'application/javascript' : 'text/html; charset=utf-8');
    res.end(fs.readFileSync(script ? 'media-export.js' : (process.env.TEST_HTML || 'index.html')));
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.TEST_BROWSER || undefined });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.addInitScript(() => { let seed = 12345; Math.random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296); });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:') ? route.continue() : route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => typeof world !== 'undefined' && world?.bodies.length);
    await page.evaluate(() => { cancelAnimationFrame(rafId); window._dismissIntro?.(); TEXT = '뭉친 한글'; Object.assign(PARAMS, { pointDist: 16, letterSpacing: 10, lineHeight: 60, choHoriz: 0, choVert: 0, jungHoriz: 0, jungVert: 0, jongHoriz: 0, jongVert: 0, randomExtra: 0, nodeR: 20, lineW: 12, flow: 0, cornerR: 5, borderWidth: 0, shape: 0, smoothScale: 2, blurFactor: 0.4, alphaThreshold: 128 }); world = buildWorld(TEXT); });
    const metrics = await page.evaluate(() => {
      const samples = [];
      for (let i = 0; i < 15; i++) { const t = performance.now(); draw(); if (i > 2) samples.push(performance.now() - t); }
      samples.sort((a,b) => a-b);
      return { medianDrawMs: samples[Math.floor(samples.length/2)], maskPixels: _smMask.width * _smMask.height, bodies: world.bodies.length, userAgent: navigator.userAgent };
    });
    console.log(JSON.stringify({ metrics, errors }, null, 2));
    if (process.env.BASELINE) { assert.deepEqual(errors, []); return; }
    await page.evaluate(() => { PARAMS.cornerR = 0; PARAMS.letterSpacing = 0; });
    await page.keyboard.press('Alt+ArrowLeft');
    assert.equal(await page.evaluate(() => PARAMS.letterSpacing), -5);
    const spacing = await page.evaluate(() => {
      PARAMS.letterSpacing = -150; resetWorld(); ensureFits();
      return { value: PARAMS.letterSpacing, finite: world.bodies.every(b => b.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))) };
    });
    assert.equal(spacing.value, -150); assert.ok(spacing.finite);
    await page.evaluate(() => { PARAMS.letterSpacing = 50; resetWorld(); togglePanel(); draw(); });
    await page.locator('[data-key="letterSpacing"] .lbvVal').click();
    await page.locator('.sliderValuePrompt').fill('-80'); await page.locator('.sliderValuePrompt').press('Enter');
    assert.equal(await page.evaluate(() => PARAMS.letterSpacing), -80);
    await page.evaluate(() => { PARAMS.letterSpacing = 50; resetWorld(); });
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
    // Translating Canvas paths can change raster rounding at a few threshold-edge pixels.
    // Allow at most 16 pixels' channels out of 921,600 pixels; never a shifted/clipped contour.
    assert.ok(smoothing.every(x => x.different <= 64));
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
    await page.locator('#modKey').selectOption('letterSpacing');
    await page.locator('#modFrom').fill('-40'); await page.locator('#modTo').fill('40');
    await page.locator('#modToggle').click();
    const structural = await page.evaluate(() => {
      const b = world.bodies[0], position = [b.anchorX, b.anchorY];
      for (let i = 0; i <= 20; i++) _advanceModulation(i * 100);
      return { position, after: [world.bodies[0].anchorX, world.bodies[0].anchorY] };
    });
    assert.ok(Math.hypot(structural.position[0] - structural.after[0], structural.position[1] - structural.after[1]) < 0.001);
    await page.keyboard.press('Alt+ArrowLeft');
    assert.equal(await page.evaluate(() => _modulation.running), false);
    const settingsDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'SAVE', exact: true }).click();
    fs.mkdirSync('test-results', { recursive: true }); await (await settingsDownload).saveAs('test-results/settings.json');
    await page.getByRole('button', { name: '배치 초기화', exact: true }).click();
    const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'LOAD', exact: true }).click();
    await (await chooser).setFiles('test-results/settings.json');
    await page.waitForFunction(() => Object.keys(_centerLayout.points).length > 0);
    assert.ok(await page.evaluate(() => Object.values(_centerLayout.points).every(p => Number.isFinite(p.x) && Number.isFinite(p.y))));
    await page.locator('#modKey').selectOption('nodeR');
    await page.locator('#modFrom').fill('4');
    await page.locator('#modTo').fill('20');
    await page.locator('#recordingPanel summary').click();
    await page.locator('#recordDuration').fill('2'); await page.locator('#recordLinked').check();
    await page.evaluate(() => { PARAMS.cornerR = 0; PARAMS.flow = 2; PARAMS.wind = 10; resetWorld(); rafId = requestAnimationFrame(tick); });
    const downloaded = page.waitForEvent('download');
    await page.locator('#recordStart').click();
    await page.waitForFunction(() => _recording?.frames.length >= 2);
    const alpha = await page.evaluate(async () => {
      const rec = _recording, bitmap = await createImageBitmap(rec.frames[0]);
      const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height;
      const x = c.getContext('2d'); x.drawImage(bitmap,0,0); bitmap.close();
      const d = x.getImageData(0,0,c.width,c.height).data; let transparent = 0, visible = 0;
      for (let i = 3; i < d.length; i += 4) { if (d[i] === 0) transparent++; if (d[i] > 0) visible++; }
      return { transparent, visible };
    });
    assert.ok(alpha.transparent > 1000 && alpha.visible > 100);
    await page.evaluate(() => { PARAMS.cornerR = 5; PARAMS.borderWidth = 2; bgR = 255; for (let i = 0; i < 10; i++) resetWorld(); });
    await page.locator('#recordStop').click();
    const mov = await downloaded;
    fs.mkdirSync('test-results', { recursive: true }); await mov.saveAs('test-results/transparent.mov');
    await page.waitForFunction(() => !_recording);
    assert.equal(await page.evaluate(() => _modulation.running), false);
    let extraDownloads = 0; page.on('download', () => extraDownloads++);
    await page.locator('#recordStart').click(); await page.locator('#recordCancel').click();
    await page.waitForFunction(() => !_recording);
    assert.equal(extraDownloads, 0);
    await page.locator('#recordLinked').uncheck(); await page.locator('#recordDuration').fill('1');
    const autoDownload = page.waitForEvent('download'); await page.locator('#recordStart').click(); await autoDownload;
    await page.waitForFunction(() => !_recording);
    if (await page.locator('#recordFormat option[value="opaque"]').count()) {
      await page.locator('#recordFormat').selectOption('opaque');
      const opaqueDownload = page.waitForEvent('download'); await page.locator('#recordStart').click();
      const opaque = await opaqueDownload; await opaque.saveAs('test-results/' + (opaque.suggestedFilename().endsWith('.mp4') ? 'opaque.mp4' : 'opaque.webm'));
      await page.waitForFunction(() => !_recording);
    }
    await page.evaluate(() => cancelAnimationFrame(rafId));
    console.log('PASS: MOV alpha, live effects/reset, linked modulation cleanup, cancellation, auto-stop, opaque video', alpha);
    await page.screenshot({ path: 'test-results/ui.png' });
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
