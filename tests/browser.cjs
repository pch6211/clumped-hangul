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
      return { medianDrawMs: samples[Math.floor(samples.length/2)], maskPixels: _smMask.width * _smMask.height, blurPixels: typeof _smBlurPixels === 'undefined' ? null : _smBlurPixels, bodies: world.bodies.length, userAgent: navigator.userAgent };
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
    const hover = await page.evaluate(() => {
      const b=world.bodies[0]; const n=b.nodes[0];
      const p={x:(b.anchorX+n.x)/2,y:(b.anchorY+n.y)/2};
      PARAMS.nodeR=32; const large=_centerRadius(); PARAMS.nodeR=20;
      return {wholeGlyph:_hoverCenterBody(p)===b,large,small:_centerRadius()};
    });
    assert.deepEqual(hover,{wholeGlyph:true,large:16,small:10});
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
    const node = await page.evaluate(() => {
      const n = world.bodies.flatMap(b => b.nodes.filter(n=>Math.abs(n.x-b.anchorX)+Math.abs(n.y-b.anchorY)>_centerRadius()+3)).find(n => n.x > 340 && n.x < cssW - 20 && n.y > 80 && n.y < cssH - 80);
      return n ? { x: n.x, y: n.y } : { missing: true, first: world.bodies[0].nodes[0] };
    });
    assert.ok(!node.missing, JSON.stringify(node));
    await page.mouse.move(node.x, node.y); await page.mouse.down();
    assert.equal(await page.evaluate(() => !!draggedNode && !_centerDrag), true);
    await page.mouse.move(node.x + 20, node.y + 30); await page.evaluate(() => step(1)); await page.mouse.up();
    assert.equal(await page.evaluate(() => draggedNode), null);
    console.log('PASS: negative spacing, center drag, 25 resets, regeneration, pointer cancellation, stroke drag');
    const motion = await page.evaluate(() => {
      const saved=world; const measure=(strength,direction)=>{
        world={bodies:[{anchorX:100,anchorY:100,nodes:Array.from({length:24},(_,i)=>({x:i*10,y:20,vx:0,vy:0})),edges:[]}]};
        PARAMS.wind=strength; PARAMS.windDirection=direction; _motionLast=null;
        const jitter=[];
        for(let i=0;i<240;i++) { _advanceMotion(i*1000/60);_stripNodeWind();_applyNodeWind();if(i>120)jitter.push(world.bodies[0].nodes[0].windState.y); }
        const nodes=world.bodies[0].nodes, mean=key=>nodes.reduce((v,n)=>v+n.windState[key],0)/nodes.length;
        const avgY=jitter.reduce((a,b)=>a+b,0)/jitter.length;
        const variance=jitter.reduce((a,b)=>a+(b-avgY)**2,0)/jitter.length;
        const result={x:mean('x'),y:mean('y'),variance,spread:Math.max(...nodes.map(n=>n.windState.x))-Math.min(...nodes.map(n=>n.windState.x)),anchor:world.bodies[0].anchorX};
        PARAMS.wind=0;
        for(let i=240;i<540;i++) {_advanceMotion(i*1000/60);_stripNodeWind();_applyNodeWind();}
        result.residual=Math.max(...nodes.map((n,i)=>Math.hypot(n.x-i*10,n.y-20)));
        return result;
      };
      const result={right:measure(40,0),left:measure(40,180),down:measure(40,90),up:measure(40,270),weak:measure(10,0),strong:measure(60,0)};
      world=saved;PARAMS.wind=0;PARAMS.windDirection=0; resetWorld(); return result;
    });
    assert.ok(motion.right.x>5 && motion.left.x<-5 && motion.down.y>5 && motion.up.y<-5);
    assert.ok(motion.strong.variance>motion.weak.variance*10 && motion.right.spread>1);
    assert.ok(Object.values(motion).every(m=>m.anchor===100 && m.residual<0.01));
    console.log('PASS: per-node directional spring forces, strength-linked jitter, return, stationary anchors',motion);
    const weld = await page.evaluate(()=>{
      const saved=world; world={bodies:[{nodes:[{x:20,y:20},{x:20,y:20},{x:20,y:20}],magnetPairs:[[0,1],[1,2]]}]};
      PARAMS.wind=60;
      for(let i=0;i<60;i++){_advanceMotion(i*16);_stripNodeWind();_applyNodeWind();}
      const ns=world.bodies[0].nodes, delta=Math.max(...ns.map(n=>Math.hypot(n.x-ns[0].x,n.y-ns[0].y)));
      world=saved;PARAMS.wind=0;return delta;
    });
    assert.ok(weld<0.0001);console.log('PASS: wind preserves welded junctions');

    const smoothing = await page.evaluate(() => {
      PARAMS.cornerR = 5; PARAMS.nodeR = 20; PARAMS.lineW = 12;
      const crop = _smoothViewport, comparisons = [];
      for (const [shape, border] of [[0,0],[50,0],[100,0],[0,8],[50,8],[100,8]]) {
        PARAMS.shape = shape;
        PARAMS.borderWidth = border;
        const a = document.createElement('canvas'), b = document.createElement('canvas');
        a.width = b.width = cssW; a.height = b.height = cssH;
        const ca = a.getContext('2d'), cb = b.getContext('2d');
        const render = context => border ? drawBorders(context, world.bodies, '#123456') : drawSmoothedBodies(context, world.bodies, '#123456', '#fff');
        render(ca);
        _smoothViewport = (_, viewport) => viewport || { x: 0, y: 0, w: cssW, h: cssH };
        render(cb); _smoothViewport = crop;
        const aa = ca.getImageData(0,0,cssW,cssH).data, bb = cb.getImageData(0,0,cssW,cssH).data;
        let different = 0, maxDelta = 0, alphaDifferent = 0;
        for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) { different++; if (i % 4 === 3) alphaDifferent++; maxDelta = Math.max(maxDelta, Math.abs(aa[i] - bb[i])); }
        comparisons.push({ shape, border, different, alphaDifferent, maxDelta });
      }
      PARAMS.borderWidth = 0;
      return comparisons;
    });
    console.log('Smoothing pixel comparisons', smoothing);
    // Native geometry uses the same full canvas grid; only blur readback is cropped.
    assert.ok(smoothing.every(x => x.different === 0));
    assert.equal(await page.locator('#motionPanel').isVisible(),false);
    assert.equal(await page.locator('#recordFormat').count(),0);
    await page.locator('#recordModeBtn').click();
    const chooseRange=async(key,from,to)=>{
      const limits=await page.evaluate(key=>PANEL_GROUPS.flatMap(g=>g.items).find(i=>i[0]===key).slice(2,4),key);
      const bar=page.locator('[data-key="'+key+'"] .bar'); await bar.scrollIntoViewIfNeeded(); const r=await bar.boundingBox();
      for(const v of [from,to]) await page.mouse.click(r.x+(v-limits[0])/(limits[1]-limits[0])*r.width,r.y+r.height/2);
    };
    await chooseRange('nodeR',20,4);
    assert.deepEqual(await page.evaluate(()=>[_rangeSelection.from,_rangeSelection.to]),[20,4]);
    assert.equal(await page.locator('[data-key="nodeR"] .sliderCurrent').evaluate(el=>getComputedStyle(el).width),'1px');
    assert.equal(await page.locator('[data-key="nodeR"] .sliderCurrent').evaluate(el=>el.style.background===(()=>{const e=document.createElement('i');e.style.background=_bondInvColor();return e.style.background;})()),true);
    await chooseRange('nodeR',4,20);
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
    await chooseRange('letterSpacing',-40,40);
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
    await chooseRange('nodeR',4,20);
    await page.locator('#modFrom').fill('4');
    await page.locator('#modTo').fill('20');
    const h = page.locator('.easeHandle').first(); await h.scrollIntoViewIfNeeded();
    await h.focus(); await page.keyboard.press('ArrowRight');
    assert.ok(Math.abs(await page.evaluate(()=>_easeCurve[0])-.43)<.0001);
    let curveBefore=await page.evaluate(()=>_easeCurve.slice()); let hb=await h.boundingBox();
    await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await page.mouse.down();await page.mouse.move(hb.x+40,hb.y-30);
    await page.evaluate(()=>document.getElementById('easeGraph').dispatchEvent(new PointerEvent('pointercancel',{pointerId:1})));
    await page.mouse.up(); assert.deepEqual(await page.evaluate(()=>_easeCurve),curveBefore);
    hb=await h.boundingBox(); await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await page.mouse.down();await page.mouse.move(hb.x+20,hb.y-20);await page.mouse.up();
    assert.notDeepEqual(await page.evaluate(()=>_easeCurve),curveBefore);
    await page.locator('#easeReset').click();
    await page.locator('#modFrom').fill('12');await page.locator('#modTo').fill('12');await page.locator('#modPeriod').fill('0');await page.locator('#modToggle').click();
    assert.equal(await page.evaluate(()=>_modulation.running),false);
    await page.locator('#modPeriod').fill('2');await page.locator('#modToggle').click();
    assert.equal(await page.evaluate(()=>{_advanceModulation(0);_advanceModulation(500);const v=PARAMS.nodeR;_stopModulation();return v;}),12);
    await chooseRange('nodeR',20,4);await page.locator('#modToggle').click();
    assert.deepEqual(await page.evaluate(()=>{_advanceModulation(0);const a=PARAMS.nodeR;_advanceModulation(1000);const b=PARAMS.nodeR;_stopModulation();return[a,b]}),[20,4]);
    await page.locator('#modToggle').click();
    await page.locator('[data-key="nodeR"] .lbvVal').click();await page.locator('.sliderValuePrompt').fill('18');await page.locator('.sliderValuePrompt').press('Enter');
    assert.deepEqual(await page.evaluate(()=>[_modulation.running,PARAMS.nodeR]),[false,18]);
    await page.locator('#recordModeBtn').click();assert.equal(await page.locator('#motionPanel').isVisible(),false);
    await page.locator('#recordModeBtn').click();
    await chooseRange('nodeR',4,20);
    console.log('PASS: recording mode, reverse ranges, 1px current marker, Bézier keyboard/drag/cancel, equal endpoints, invalid duration, numeric interruption');
    await page.locator('#recordDuration').fill('2'); await page.locator('#recordLinked').check();
    await page.evaluate(() => { PARAMS.cornerR = 0; PARAMS.flow = 2; PARAMS.wind = 10; resetWorld(); rafId = requestAnimationFrame(tick); });
    await page.evaluate(()=>document.getElementById('recordStart').addEventListener('click',()=>{
      const c=document.createElement('canvas');c.width=cssW;c.height=cssH;
      const x=c.getContext('2d');_renderArtwork(x,{x:0,y:0,w:cssW,h:cssH});window.recordSnapshot=x.getImageData(0,0,c.width,c.height).data;
    },{once:true}));
    const downloaded = page.waitForEvent('download');
    await page.locator('#recordStart').click();
    await page.waitForFunction(() => _recording?.frames.length >= 2);
    const alpha = await page.evaluate(async () => {
      const rec = _recording, bitmap = await createImageBitmap(rec.frames[0]);
      const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height;
      const x = c.getContext('2d'); x.drawImage(bitmap,0,0); bitmap.close();
      const d = x.getImageData(0,0,c.width,c.height).data; let transparent = 0, visible = 0;
      for (let i = 3; i < d.length; i += 4) { if (d[i] === 0) transparent++; if (d[i] > 0) visible++; }
      let mismatched=0;for(let i=0;i<d.length;i++)if(d[i]!==window.recordSnapshot[i])mismatched++;
      return { transparent, visible, mismatched };
    });
    assert.ok(alpha.transparent > 1000 && alpha.visible > 100);
    assert.equal(alpha.mismatched,0);
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
    const beforeModeCancel=extraDownloads;
    await page.locator('#recordDuration').fill('5');
    await page.locator('#recordStart').click();
    await page.setViewportSize({width:1024,height:768});
    assert.deepEqual(await page.evaluate(()=>[_recording.canvas.width,_recording.canvas.height]),[1280,720]);
    await page.locator('#recordModeBtn').click();
    await page.waitForFunction(()=>!_recording);assert.equal(extraDownloads,beforeModeCancel);
    assert.equal(await page.locator('#motionPanel').isVisible(),false);
    await page.locator('#recordModeBtn').click();
    await page.setViewportSize({width:1280,height:720});

    await page.evaluate(() => cancelAnimationFrame(rafId));
    console.log('PASS: MOV alpha, live effects/reset, linked modulation cleanup, cancellation, auto-stop, mode-off cleanup', alpha);
    await page.screenshot({ path: 'test-results/ui.png' });
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
