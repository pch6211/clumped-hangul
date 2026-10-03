const assert=require('node:assert/strict'),fs=require('node:fs');const {run,configure}=require('./helpers.cjs');
run(async page=>{
  await page.setViewportSize({width:640,height:480});await page.waitForFunction(()=>cssW===640);await configure(page);await page.evaluate(()=>togglePanel());
  const button=page.locator('#recordMov');assert.equal(await button.innerText(),'mov');assert.equal(await page.locator('#recordDialog,#easeGraph,[data-record-group]').count(),0);
  let downloads=0;page.on('download',()=>downloads++);
  const start=async()=>{await button.click();await page.waitForFunction(()=>_recording?.frames.length>0&&!_recording.busy);assert.equal(await button.innerText(),'정지');};
  await page.evaluate(()=>document.getElementById('recordMov').addEventListener('click',()=>{
    if(!_recording || _recording.stopping)return;
    const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');_renderArtwork(x,{x:0,y:0,w:640,h:480});window.reference=x.getImageData(0,0,640,480).data;
  }));
  await start();
  const alpha=await page.evaluate(async()=>{const bitmap=await createImageBitmap(_recording.frames[0]),c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');x.drawImage(bitmap,0,0);bitmap.close();const d=x.getImageData(0,0,640,480).data;let transparent=0,visible=0,diff=0;for(let i=0;i<d.length;i++){if(d[i]!==reference[i])diff++;if(i%4===3){if(d[i]===0)transparent++;else visible++;}}return{transparent,visible,diff};});assert.equal(alpha.diff,0);assert.ok(alpha.transparent>1000&&alpha.visible>100);
  // Capture another frame after real artwork changes. Resolution stays locked.
  await page.evaluate(()=>{PARAMS.jitter=70;PARAMS.jitterSpeed=30;PARAMS.nodeR=18;_advanceMotion(performance.now());step(1);_applyNodeJitter();_captureRecordingFrame(performance.now()+70);});await page.waitForFunction(()=>_recording.frames.length>=2);
  const mov=page.waitForEvent('download');await button.click();await(await mov).saveAs('test-results/transparent.mov');await page.waitForFunction(()=>!_recording);assert.equal(await button.innerText(),'mov');
  // Pending encoding + duplicate stops finalize one file; cancellation wins.
  const pending=await page.evaluate(()=>{const original=HTMLCanvasElement.prototype.toBlob;window.realToBlob=original;HTMLCanvasElement.prototype.toBlob=function(cb,type){setTimeout(()=>original.call(this,cb,type),120);};_startRecording();const first=_recording;_startRecording();return first===_recording;});assert.ok(pending);
  const count=downloads,quick=page.waitForEvent('download');await page.evaluate(()=>{void _stopRecording();void _stopRecording();});await quick;await page.waitForFunction(()=>!_recording);assert.equal(downloads,count+1);
  await page.evaluate(()=>{_startRecording();void _stopRecording();void _stopRecording(true);});await page.waitForFunction(()=>!_recording);assert.equal(downloads,count+1);await page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=window.realToBlob;});
  await start();const oldSize=await page.evaluate(()=>[_recording.canvas.width,_recording.canvas.height]);await page.evaluate(()=>{for(let i=0;i<12;i++)resetWorld();TEXT='새 글자';world=buildWorld(TEXT);PARAMS.cornerR=3;PARAMS.borderWidth=2;});
  await page.setViewportSize({width:800,height:600});await page.waitForFunction(()=>cssW===800);assert.deepEqual(await page.evaluate(()=>[_recording.canvas.width,_recording.canvas.height]),oldSize);
  await page.evaluate(()=>_captureRecordingFrame(performance.now()+80));await page.waitForFunction(()=>!_recording.busy);const resize=page.waitForEvent('download');await button.click();await resize;await page.waitForFunction(()=>!_recording);
  await start();const beforeEscape=downloads;await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>!!_recording&&!_recording.stopping),true);assert.equal(await button.innerText(),'정지');assert.equal(downloads,beforeEscape);
  // Existing Escape closes the settings panel; reopening must retain recording state.
  assert.equal(await page.locator('#panel').isVisible(),false);await page.evaluate(()=>togglePanel());assert.equal(await button.innerText(),'정지');
  await page.locator('[data-key="nodeR"] .lbvVal').click();await page.locator('.sliderValuePrompt').press('Escape');assert.equal(await page.locator('.sliderValuePrompt').count(),0);assert.equal(await page.evaluate(()=>!!_recording&&!_recording.stopping),true);
  const escaped=page.waitForEvent('download');await button.click();await escaped;await page.waitForFunction(()=>!_recording);const cancelled=downloads;
  const statusStyle=await page.locator('#recordStatus').evaluate(el=>({font:getComputedStyle(el).fontSize,panel:getComputedStyle(document.getElementById('panel')).fontSize,text:el.textContent}));assert.equal(statusStyle.font,statusStyle.panel);assert.ok(!statusStyle.text.includes('투명'));assert.equal(await page.getByText('녹화 취소',{exact:true}).count(),0);
  // Null encoder result, thrown rendering error and finalizer error all recover.
  for(const failure of ['encode','render','mux']){
    await page.evaluate(failure=>{window._savedRender=_renderArtwork;window._savedMux=MHMedia.makePngMov;if(failure==='encode')HTMLCanvasElement.prototype.toBlob=cb=>cb(null);if(failure==='render')_renderArtwork=()=>{throw Error('test-render');};if(failure==='mux')MHMedia.makePngMov=()=>{throw Error('test-mux');};_startRecording();},failure);
    if(failure==='mux'){await page.waitForFunction(()=>_recording?.frames.length);await page.evaluate(()=>_stopRecording());}
    await page.waitForFunction(()=>!_recording);assert.equal(await button.isEnabled(),true);assert.equal(await button.innerText(),'mov');assert.equal(downloads,cancelled);
    await page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=window.realToBlob;_renderArtwork=window._savedRender;MHMedia.makePngMov=window._savedMux;});
  }
  // Inject accounting boundaries without producing large files or waiting 30s.
  await start();const limited=page.waitForEvent('download');await page.evaluate(()=>{_recording.bytes=64*1024*1024;_captureRecordingFrame(performance.now()+100);});await limited;await page.waitForFunction(()=>!_recording);assert.match(await page.locator('#recordStatus').innerText(),/64MiB/);
  await start();const timed=page.waitForEvent('download');await page.evaluate(()=>_captureRecordingFrame(_recording.started+30000));await timed;await page.waitForFunction(()=>!_recording);assert.match(await page.locator('#recordStatus').innerText(),/30초/);
  await start();const hidden=page.waitForEvent('download');await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});await hidden;await page.waitForFunction(()=>!_recording);assert.match(await page.locator('#recordStatus').innerText(),/탭/);
  await start();const beforeClose=downloads;await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await page.waitForFunction(()=>!_recording);assert.equal(downloads,beforeClose);
  // PNG still saves with its original tight crop, using identical drawing code.
  const png=page.waitForEvent('download');await page.getByRole('button',{name:'PNG',exact:true}).click();await(await png).saveAs('test-results/artwork.png');
  fs.writeFileSync('test-results/recording.json',JSON.stringify({alpha,downloads,fixedSize:oldSize},null,2));console.log('PASS: mov/stop UI, exact artwork/alpha, pending and duplicate stop, cancel, resize/reset/change, encoder/render/mux errors, memory/time guards, visibility/close, PNG',alpha);
}).catch(e=>{console.error(e);process.exitCode=1;});
