const fs = require('node:fs');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const server = http.createServer((req, res) => {
    if(req.url==='/motion-curve.js'){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync('motion-curve.js'));return;}
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
    // Compare the blur benchmark on the same layout as the pre-feature baseline.
    await page.evaluate(() => { if (typeof _layoutState !== 'undefined') _layoutState.mode = 'legacy-uniform'; });
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
    assert.deepEqual(hover,{wholeGlyph:true,large:24,small:15});
    const anchor = await page.evaluate(() => ({ x: world.bodies[0].anchorX, y: world.bodies[0].anchorY }));
    await page.mouse.move(anchor.x, anchor.y); await page.mouse.down();
    assert.equal(await page.evaluate(() => !!_centerDrag && !draggedNode), true);
    await page.mouse.move(anchor.x + 60, anchor.y - 90, { steps: 5 }); await page.mouse.up();
    assert.equal(await page.evaluate(()=>_bondUndo.filter(e=>e.kind==='center').length),1);
    await page.keyboard.press('Control+z');
    assert.ok(await page.evaluate(({x,y})=>Math.hypot(world.bodies[0].anchorX-x,world.bodies[0].anchorY-y)<.001,anchor));
    await page.keyboard.press('Control+Shift+z');
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
    const jitter = await page.evaluate(() => {
      const saved=world;const measure=strength=>{
        world={bodies:[{anchorX:100,anchorY:100,nodes:Array.from({length:16},(_,i)=>({x:i*10,y:20})),edges:[]}]};
        PARAMS.jitter=strength;PARAMS.jitterSpeed=100;_jitterPhase=0;_motionTime=0;_motionLast=null;const samples=[];
        for(let i=0;i<240;i++){_advanceMotion(i*1000/60);_stripNodeJitter();_applyNodeJitter();if(i>120)samples.push(world.bodies[0].nodes[0].jitterState.x);}
        let crossings=0;for(let i=1;i<samples.length;i++)if(samples[i]*samples[i-1]<0)crossings++;
        const rms=Math.sqrt(samples.reduce((s,v)=>s+v*v,0)/samples.length),mean=samples.reduce((s,v)=>s+v,0)/samples.length;
        const nodes=world.bodies[0].nodes,spread=Math.max(...nodes.map(n=>n.jitterState.x))-Math.min(...nodes.map(n=>n.jitterState.x));PARAMS.jitter=0;
        for(let i=240;i<360;i++){_advanceMotion(i*1000/60);_stripNodeJitter();_applyNodeJitter();}
        return{rms,mean,crossings,spread,anchor:world.bodies[0].anchorX,residual:Math.max(...nodes.map((n,i)=>Math.hypot(n.x-i*10,n.y-20)))};
      };
      const result={weak:measure(15),strong:measure(100)};world=saved;PARAMS.jitter=0;resetWorld();return result;
    });
    assert.ok(jitter.strong.rms>jitter.weak.rms*5 && jitter.strong.rms>5);
    assert.ok(jitter.strong.crossings>25 && Math.abs(jitter.strong.mean)<1 && jitter.strong.spread>3);
    assert.ok(Object.values(jitter).every(j=>j.anchor===100 && j.residual<.001));
    console.log('PASS: fast zero-mean per-node jitter, intensity, stationary anchors, restoration',jitter);
    const speeds=await page.evaluate(()=>{
      const saved=world,results=[];
      for(const speed of [1,30,100]){
        world={bodies:[{anchorX:100,anchorY:100,nodes:[{x:10,y:20}],edges:[]}]};PARAMS.jitter=100;PARAMS.jitterSpeed=speed;_jitterPhase=0;_motionLast=null;let square=0,count=0,crossings=0,prev=0;
        for(let i=0;i<7200;i++){_advanceMotion(i*1000/60);_stripNodeJitter();_applyNodeJitter();const x=world.bodies[0].nodes[0].jitterState.x;if(i>120){square+=x*x;count++;if(x*prev<0)crossings++;}prev=x;}
        const n=world.bodies[0].nodes[0];PARAMS.jitterSpeed=0;for(let i=7200;i<7320;i++){_advanceMotion(i*1000/60);_stripNodeJitter();_applyNodeJitter();}const held=n.x;
        for(let i=7320;i<7440;i++){_advanceMotion(i*1000/60);_stripNodeJitter();_applyNodeJitter();}const stopped=Math.abs(n.x-held);
        PARAMS.jitter=0;for(let i=7440;i<7560;i++){_advanceMotion(i*1000/60);_stripNodeJitter();_applyNodeJitter();}
        results.push({speed,hz:_jitterFrequency(speed),rms:Math.sqrt(square/count),crossings,stopped,residual:Math.hypot(n.x-10,n.y-20),anchor:world.bodies[0].anchorX});
      }
      world=saved;PARAMS.jitter=0;PARAMS.jitterSpeed=30;return results;
    });
    assert.ok(speeds[0].hz<.04&&speeds[1].hz<.2&&speeds[2].hz===12);
    assert.ok(speeds[0].crossings<10&&speeds[1].crossings>30&&speeds[2].crossings>2000);
    assert.ok(Math.max(...speeds.map(s=>s.rms))/Math.min(...speeds.map(s=>s.rms))<1.3);
    assert.ok(speeds.every(s=>s.stopped<.001&&s.residual<.001&&s.anchor===100));
    console.log('PASS: slow-to-fast independent jitter speed, stable amplitude, zero-speed hold and zero-strength restoration',speeds);
    const weld=await page.evaluate(()=>{const saved=world;world={bodies:[{nodes:[{x:20,y:20},{x:20,y:20},{x:20,y:20}],magnetPairs:[[0,1],[1,2]]}]};PARAMS.jitter=100;for(let i=0;i<60;i++){_advanceMotion(i*16);_stripNodeJitter();_applyNodeJitter();}const ns=world.bodies[0].nodes,delta=Math.max(...ns.map(n=>Math.hypot(n.x-ns[0].x,n.y-ns[0].y)));world=saved;PARAMS.jitter=0;return delta;});
    assert.ok(weld<.0001);
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
    const settingsDownload=page.waitForEvent('download');await page.getByRole('button',{name:'SAVE',exact:true}).click();
    fs.mkdirSync('test-results',{recursive:true});await(await settingsDownload).saveAs('test-results/settings.json');
    assert.equal(await page.getByRole('button',{name:'배치 초기화',exact:true}).count(),0);
    await page.evaluate(()=>_bondUndoApply());
    const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'LOAD',exact:true}).click();await(await chooser).setFiles('test-results/settings.json');
    await page.waitForFunction(()=>Object.keys(_centerLayout.points).length>0);
    assert.ok(await page.evaluate(()=>Object.values(_centerLayout.points).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));
    await page.screenshot({path:'test-results/ui.png'});assert.deepEqual(errors,[]);
  } finally { await browser?.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
