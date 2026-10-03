const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
  const server=http.createServer((req,res)=>{
    if(req.url==='/motion-curve.js'){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync('motion-curve.js'));return;}const js=req.url==='/media-export.js';res.setHeader('Content-Type',js?'application/javascript':'text/html; charset=utf-8');res.end(fs.readFileSync(js?'media-export.js':'index.html'));}).listen(0,'127.0.0.1');
  await new Promise(r=>server.once('listening',r));let browser;
  try{
    browser=await chromium.launch({headless:true,channel:process.env.TEST_BROWSER||undefined});const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>typeof world!=='undefined'&&world);
    await page.evaluate(()=>{cancelAnimationFrame(rafId);window._dismissIntro?.();TEXT='한글 AB';Object.assign(PARAMS,{nodeR:15,lineW:10,flow:0,cornerR:0,borderWidth:0,jitter:0});world=buildWorld(TEXT);togglePanel();draw();});
    await page.locator('#recordModeBtn').click();
    const initial=await page.locator('#recordDialog').boundingBox(),grab=await page.locator('#recordDialog .dragHandle').boundingBox();
    await page.mouse.move(grab.x+grab.width/2,grab.y+grab.height/2);await page.mouse.down();await page.mouse.move(grab.x+grab.width/2+20,grab.y+grab.height/2-10);await page.mouse.up();
    const shifted=await page.locator('#recordDialog').boundingBox();assert.ok(Math.abs(shifted.x-initial.x-20)<1);
    assert.equal(await page.locator('#recordDialog').isVisible(),true);assert.equal(await page.locator('#recordDuration').count(),0);assert.equal(await page.locator('#panel .sliderCurrent').count(),0);
    assert.equal(await page.locator('#modulationPanel').isVisible(),false);
    const smallHeight=await page.locator('#recordDialog').evaluate(el=>el.offsetHeight);
    const group=id=>page.locator('[data-record-group="'+id+'"]');
    assert.equal(await page.locator('#recordDialog .mhDialogTitle').innerText(),'MOV');assert.equal(await page.locator('#recordLinked').count(),0);
    assert.equal(await page.locator('#panel [role=checkbox]').count(),0);
    await group('decor').check();
    assert.equal(await page.locator('.recordRangeRow').count(),8);assert.ok(await page.locator('#recordDialog').evaluate(el=>el.offsetHeight)>smallHeight);
    assert.equal(await page.locator('.rangeHandle:visible').count(),0);
    const choose=async(key,from,to)=>{const bar=page.locator('[data-record-key="'+key+'"] .recordBar');await bar.scrollIntoViewIfNeeded();const box=await bar.boundingBox(),limits=await page.evaluate(key=>PANEL_GROUPS.flatMap(g=>g.items).find(i=>i[0]===key).slice(2,4),key);for(const v of [from,to])await page.mouse.click(box.x+(v-limits[0])/(limits[1]-limits[0])*box.width,box.y+box.height/2);};
    await choose('nodeR',25,5);await choose('lineW',2,18);
    assert.deepEqual(await page.evaluate(()=>[..._recordRanges.values()].filter(r=>r.count===2).map(r=>[r.from,r.to])),[[25,5],[2,18]]);
    // Original slider is still a regular slider while the dialog is open.
    await page.locator('[data-key="nodeR"] .bar').click({position:{x:30,y:4}});
    assert.notEqual(await page.evaluate(()=>PARAMS.nodeR),15);assert.deepEqual(await page.evaluate(()=>[_recordRanges.get('nodeR').from,_recordRanges.get('nodeR').to]),[25,5]);
    await page.locator('#modPeriod').fill('0.4');await page.locator('#modRepeats').fill('3');await page.locator('#modToggle').click();
    const cycles=await page.evaluate(()=>{const values=[];for(const t of [0,200,400,600,800,1000,1200]){_advanceModulation(t);values.push([PARAMS.nodeR,PARAMS.lineW]);}const finished=_modulation.complete;_finishPlayback();return{values,finished,running:_modulation.running};});
    assert.deepEqual(cycles.values,[[25,2],[5,18],[25,2],[5,18],[25,2],[5,18],[25,2]]);assert.equal(cycles.finished,true);assert.equal(cycles.running,false);
    await page.locator('#recordDialog').focus();await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>_modulation.running),true);
    await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>_previewPaused),true);await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>_previewPaused),false);
    await page.locator('#recordStop').click();
    await page.locator('#modPeriod').focus();await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>_modulation.running),false);
    await page.locator('#recordDialog').focus();await page.evaluate(()=>document.getElementById('recordDialog').dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true,isComposing:true})));assert.equal(await page.evaluate(()=>_modulation.running),false);
    // Numeric field validation and zero duration.
    await page.locator('#modPeriod').fill('0');await page.locator('#modToggle').click();assert.equal(await page.evaluate(()=>_modulation.running),false);
    await page.locator('#modPeriod').fill('1');await page.locator('#modRepeats').fill('2');
    const handle=page.locator('.easeHandle').first();await handle.scrollIntoViewIfNeeded();await handle.focus();await page.keyboard.press('ArrowRight');assert.ok(Math.abs(await page.evaluate(()=>_easePoints[0].out.x)-.43)<.00001);
    const before=await page.evaluate(()=>_easeSnapshot()),hb=await handle.boundingBox();await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await page.mouse.down();await page.mouse.move(hb.x+30,hb.y-20);await page.evaluate(()=>document.getElementById('easeGraph').dispatchEvent(new PointerEvent('pointercancel',{pointerId:1})));await page.mouse.up();assert.deepEqual(await page.evaluate(()=>_easePoints),before);
    await page.locator('#easeReset').click();
    const rangeHandle=page.locator('[data-record-key="nodeR"] [data-side="from"]');await rangeHandle.focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.evaluate(()=>_recordRanges.get('nodeR').from),24);
    const rh=await rangeHandle.boundingBox();await page.mouse.move(rh.x+rh.width/2,rh.y+rh.height/2);await page.mouse.down();await page.mouse.move(rh.x-20,rh.y+rh.height/2);
    await page.evaluate(()=>document.querySelector('[data-record-key="nodeR"] .recordBar').dispatchEvent(new PointerEvent('pointercancel',{pointerId:1})));await page.mouse.up();assert.equal(await page.evaluate(()=>_recordRanges.get('nodeR').from),24);
    // A close cancels recording and returns focus; reopen retains selected tracks.
    let downloads=0;page.on('download',()=>downloads++);
    await page.setViewportSize({width:640,height:480});await page.waitForFunction(()=>cssW===640&&cssH===480);
    await page.evaluate(()=>{_previewPaused=false;rafId=requestAnimationFrame(tick);});await page.locator('#recordStart').click();await page.waitForFunction(()=>_recording?.frames.length>=1);
    await page.evaluate(()=>setParamValue('nodeR',17));assert.equal(await page.evaluate(()=>_modulation.running),false);assert.equal(await page.evaluate(()=>_recording.linked),false);
    await page.locator('#modToggle').click();assert.equal(await page.evaluate(()=>_recording.linked&&_modulation.running),true);
    await page.locator('#recordDialog').focus();await page.keyboard.press('Escape');await page.waitForFunction(()=>!_recording);assert.equal(downloads,0);assert.equal(await page.locator('#recordDialog').count(),0);assert.equal(await page.locator('#recordModeBtn').evaluate(el=>document.activeElement===el),true);
    await page.locator('#recordModeBtn').click();assert.equal(await page.locator('.recordRangeRow').count(),8);
    // Record exact finite cycles; first frame must equal the artwork preview.
    await page.locator('#modPeriod').fill('0.4');await page.locator('#modRepeats').fill('2');
    await page.evaluate(()=>document.getElementById('recordStart').addEventListener('click',()=>{const c=document.createElement('canvas');c.width=cssW;c.height=cssH;const x=c.getContext('2d');_renderArtwork(x,{x:0,y:0,w:cssW,h:cssH});window.snapshot=x.getImageData(0,0,c.width,c.height).data;},{once:true}));
    const moviePromise=page.waitForEvent('download');await page.locator('#recordStart').click();await page.waitForFunction(()=>_recording?.frames.length>=1);
    const alpha=await page.evaluate(async()=>{const bitmap=await createImageBitmap(_recording.frames[0]),c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const x=c.getContext('2d');x.drawImage(bitmap,0,0);bitmap.close();const d=x.getImageData(0,0,c.width,c.height).data;let transparent=0,visible=0,diff=0;for(let i=0;i<d.length;i++){if(d[i]!==window.snapshot[i])diff++;if(i%4===3){if(d[i]===0)transparent++;else visible++;}}return{transparent,visible,diff};});
    assert.equal(alpha.diff,0);assert.ok(alpha.transparent>1000&&alpha.visible>100);
    const movie=await moviePromise;fs.mkdirSync('test-results',{recursive:true});await movie.saveAs('test-results/transparent.mov');await page.waitForFunction(()=>!_recording);assert.equal(await page.evaluate(()=>_modulation.running),false);
    // Deselect all: recorder transport only, manual stop/save and resize work.
    await page.setViewportSize({width:1280,height:720});await page.waitForFunction(()=>cssW===1280&&cssH===720);
    await group('decor').uncheck();assert.equal(await page.locator('#modulationPanel').isVisible(),false);
    await page.setViewportSize({width:640,height:480});await page.waitForFunction(()=>cssW===640&&cssH===480);
    const manual=page.waitForEvent('download');await page.locator('#recordStart').click();await page.waitForFunction(()=>_recording?.frames.length>=2);
    await page.evaluate(()=>{PARAMS.cornerR=5;PARAMS.borderWidth=2;PARAMS.jitter=70;for(let i=0;i<10;i++)resetWorld();});
    await page.setViewportSize({width:800,height:600});assert.deepEqual(await page.evaluate(()=>[_recording.canvas.width,_recording.canvas.height]),[640,480]);await page.locator('#recordStop').click();await manual;await page.waitForFunction(()=>!_recording);
    const count=downloads;await page.locator('#recordStart').click();await page.locator('.closeX[aria-label="MOV 창 닫기"]').click();await page.waitForFunction(()=>!_recording);assert.equal(downloads,count);
    await page.setViewportSize({width:1280,height:720});await page.locator('#recordModeBtn').click();await group('decor').check();await choose('nodeR',8,24);await page.locator('#recordDialog').screenshot({path:'test-results/recorder-popup.png'});
    await page.evaluate(()=>cancelAnimationFrame(rafId));assert.deepEqual(errors,[]);console.log('PASS: independent recorder popup, multiple tracks, 3 exact cycles, reverse values, unchanged main sliders, keyboard/IME/focus, curve cancel, MOV alpha snapshot, finite and manual recording, resize/reset/cancel',alpha);
  }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
