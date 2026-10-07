const assert=require('node:assert/strict'),fs=require('node:fs');const {run,configure}=require('./helpers.cjs');
run(async page=>{
  await configure(page);await page.evaluate(()=>togglePanel());
  assert.deepEqual(await page.evaluate(()=>PANEL_GROUPS.find(g=>g.id==='motion').items.map(i=>[i[0],i[1],i[3]])),[['jitter','떨림 강도',40],['jitterSpeed','떨림 속도',90],['chase','쫒기',100]]);
  assert.doesNotMatch(await page.locator('#panelGuide').innerText(),/SVG|PNG|MOV/);
  const center=await page.evaluate(()=>({x:world.bodies[0].anchorX,y:world.bodies[0].anchorY}));
  await page.mouse.move(center.x,center.y);assert.equal(await page.locator('#universe').evaluate(el=>getComputedStyle(el).cursor),'grab');
  await page.waitForTimeout(300);assert.equal(await page.locator('#viewTooltipEl.show').count(),0);
  await page.waitForFunction(()=>document.getElementById('viewTooltipEl')?.classList.contains('show'));assert.equal(await page.locator('#viewTooltipEl').innerText(),'글자의 위치를 옮길 수 있어요');
  const tooltip=await page.locator('#viewTooltipEl').evaluate(el=>({class:el.className,font:getComputedStyle(el).fontSize,delay:_VIEW_TIP_DELAY}));assert.equal(tooltip.font,'10px');assert.equal(tooltip.delay,1000);
  await page.mouse.down();assert.equal(await page.locator('#viewTooltipEl.show').count(),0);await page.mouse.up();
  await page.mouse.move(center.x+1,center.y);await page.mouse.move(1100,650);await page.waitForTimeout(1100);assert.equal(await page.locator('#viewTooltipEl.show').count(),0);
  await page.locator('#recordMov').click();const dialog=page.locator('#recordDialog');assert.equal(await page.evaluate(()=>_recording),null);
  assert.equal(await dialog.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');assert.equal(await dialog.locator('[data-record-group="form"],h1,h2,#easeGraph').count(),0);
  assert.equal(await dialog.locator('[data-record-group]').count(),7);assert.equal(await dialog.locator('[aria-expanded="false"]').count(),7);
  assert.equal(await page.locator('.recordOptions').isVisible(),false);assert.equal(await page.locator('#recordPause').isDisabled(),true);assert.equal(await page.locator('#recordSave').isDisabled(),true);
  await dialog.getByRole('button',{name:'움직임 펼치기',exact:true}).click();
  const row=dialog.locator('[data-range-key="chase"]'),bar=await row.locator('.bar').boundingBox();
  await page.mouse.click(bar.x+bar.width*.8,bar.y+4);await page.mouse.click(bar.x+bar.width*.2,bar.y+4);
  assert.deepEqual(await page.evaluate(()=>_rangePlayback.ranges.chase),{start:80,end:20});assert.equal(await page.locator('.recordOptions').isVisible(),true);
  await page.locator('#rangeSeconds').fill('2');await page.locator('#rangeSeconds').press('Tab');await page.locator('#rangeCount').fill('2');await page.locator('#rangeCount').press('Tab');
  await dialog.focus();await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>_rangePlayback.status),'playing');
  const frames=await page.evaluate(()=>{_rangePlayback.last=0;const samples=[];for(let i=1;i<=40;i++){_advanceRangePlayback(i*100);if(i%5===0)samples.push(PARAMS.chase);}return{samples,status:_rangePlayback.status,main:document.querySelector('#panel [data-key="chase"] .lbvVal').textContent};});
  assert.deepEqual(frames.samples,[50,20,50,80,50,20,50,80]);assert.equal(frames.status,'finished');assert.equal(frames.main,'80');
  await dialog.focus();await page.keyboard.press('e');assert.equal(await page.evaluate(()=>_recordPopupActive),false);await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>_rangePlayback.status),'finished');await page.evaluate(()=>closeEditor());
  // Space belongs to inputs, native buttons and the active popup only.
  await page.locator('#rangeSeconds').focus();await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>_rangePlayback.status),'finished');
  await page.locator('#mainText').focus();await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>_rangePlayback.status),'finished');
  await page.evaluate(()=>{TEXT='뭉친 한글';document.getElementById('mainText').value=TEXT;world=buildWorld(TEXT);});await dialog.click({position:{x:4,y:4}});await dialog.focus();await page.keyboard.press('Space');await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>_rangePlayback.status),'paused');
  await page.locator('#rangeLoop').click();await dialog.focus();await page.keyboard.press('Space');await page.evaluate(()=>{_rangePlayback.last=0;for(let i=1;i<=100;i++)_advanceRangePlayback(i*100);});assert.equal(await page.evaluate(()=>_rangePlayback.status),'playing');
  await page.locator('#recordPause').click();
  // Spacing sweeps preserve existing bodies, nodes, deformation and absolute user pins.
  const spacing=await page.evaluate(()=>{
    _rangePlayback.ranges={pointDist:{start:16,end:32},letterSpacing:{start:20,end:-30}};
    PARAMS.chase=0;PARAMS.pointDist=16;resetWorld();const b=world.bodies[0],n=b.nodes[0];n.x+=11;
    _centerLayout.points[b.centerKey]={x:b.anchorX,y:b.anchorY};const pin={..._centerLayout.points[b.centerKey]},dx=n.x-b.anchorX;
    _applyRangePosition(1);return{body:world.bodies[0]===b,node:world.bodies[0].nodes[0]===n,scale:(n.x-b.anchorX)/dx,pin:_centerLayout.points[b.centerKey],before:pin};
  });assert.ok(spacing.body&&spacing.node);assert.equal(spacing.scale,2);assert.deepEqual(spacing.pin,spacing.before);
  await page.evaluate(()=>{_rangePlayback.ranges={chase:{start:20,end:80},jitter:{start:0,end:40}};_rangePlayback.loop=true;_updateRecordDialog();});
  let downloads=0;page.on('download',()=>downloads++);await page.locator('#recordStart').click();await page.waitForFunction(()=>_recording?.frames.length&&!_recording.busy);
  await page.evaluate(()=>{for(let i=0;i<60;i++){_advanceChase(1/60);step(1);_applyNodeJitter();}});
  await page.locator('#recordPause').click();const paused=await page.evaluate(()=>({elapsed:_recordElapsed(_recording),frames:_recording.frames.length,anchors:world.bodies.map(b=>[b.anchorX,b.anchorY])}));
  await page.waitForTimeout(250);await page.evaluate(()=>{tick(performance.now()+1000);cancelAnimationFrame(rafId);});
  assert.deepEqual(await page.evaluate(()=>world.bodies.map(b=>[b.anchorX,b.anchorY])),paused.anchors);assert.equal(await page.evaluate(()=>_recording.frames.length),paused.frames);assert.equal(await page.evaluate(()=>_recordElapsed(_recording)),paused.elapsed);
  await page.locator('#recordStart').click();await page.evaluate(()=>_captureRecordingFrame(performance.now()+100));await page.waitForFunction(()=>!_recording.busy);
  const times=await page.evaluate(()=>_recording.times.slice());assert.ok(times.at(-1)-times[0]<1000);
  await dialog.focus();await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert.equal(await page.evaluate(()=>_recording.paused),true);assert.equal(downloads,0);
  await page.locator('#recordMov').click();const download=page.waitForEvent('download');await page.locator('#recordSave').click();await(await download).saveAs('test-results/popup-chase.mov');await page.waitForFunction(()=>!_recording);assert.equal(downloads,1);
  const geometries=[];
  const savedEvent=page.waitForEvent('download');await page.evaluate(()=>saveSettings());await(await savedEvent).saveAs('test-results/range-settings.json');
  const saved=JSON.parse(fs.readFileSync('test-results/range-settings.json','utf8'));assert.equal(saved.motion.ranges.chase.start,20);assert.equal(saved.motion.ranges.chase.end,80);
  await page.evaluate(()=>{_rangePlayback.ranges={};PARAMS.jitter=0;PARAMS.chase=0;});const choose=page.waitForEvent('filechooser');await page.evaluate(()=>triggerSettingsLoad());await(await choose).setFiles('test-results/range-settings.json');await page.waitForFunction(()=>_fileLoads.main===null);assert.deepEqual(await page.evaluate(()=>_rangePlayback.ranges),saved.motion.ranges);assert.equal(await page.evaluate(()=>_rangePlayback.status),'idle');
  for(const width of [1280,768,390]){await page.setViewportSize({width,height:844});await page.waitForTimeout(200);await page.evaluate(()=>_recordPopup.clamp());const rect=await dialog.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width+1&&rect.y>=0&&rect.y+rect.height<=844,JSON.stringify(rect));geometries.push({width,...rect});}
  await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>{_recordPopup.clamp();draw();updateHUD();});await dialog.screenshot({path:'test-results/motion-popup.png'});
  fs.writeFileSync('test-results/motion-popup.json',JSON.stringify({tooltip,frames,spacing,times,geometries},null,2));console.log('PASS: groups and guides, center cursor/tooltip cleanup, transparent collapsed popup, descending click order, cycles/loop, live values, structural identity, input/Space/Escape isolation, recording pause/resume/save, chase combination, responsive geometry');
}).catch(e=>{console.error(e);process.exitCode=1;});
