const assert=require('node:assert/strict'),fs=require('node:fs');const {run,configure}=require('./helpers.cjs');
run(async page=>{
  await page.setViewportSize({width:640,height:480});await configure(page);await page.evaluate(()=>togglePanel());page.on('dialog',d=>d.accept());
  const numeric=async value=>{await page.locator('#panel [data-key="shape"] .lbvVal').click();await page.locator('.sliderValuePrompt').fill(String(value));await page.locator('.sliderValuePrompt').press('Enter');};
  for(const [value,expected] of [[1,2],[24,24],[99,24],[3.7,4]]){await numeric(value);assert.equal(await page.evaluate(()=>PARAMS.shape),expected);}
  const limits=await page.evaluate(()=>{
    const samples=[],rng=Math.random;TEXT='한글';
    for(let i=0;i<24;i++){randomizeAll();samples.push([PARAMS.shape,PARAMS.jitter,PARAMS.jitterSpeed]);_groupRandomizers.decor();samples.push([PARAMS.shape,PARAMS.jitter,PARAMS.jitterSpeed]);_groupRandomizers.motion();samples.push([PARAMS.shape,PARAMS.jitter,PARAMS.jitterSpeed]);}
    const boundaries=[];for(const r of [0,.999999]){Math.random=()=>r;_groupRandomizers.decor();if(PARAMS.shape===2&&PARAMS.lineW===0)throw Error('random segment must remain visible');_groupRandomizers.motion();boundaries.push([PARAMS.shape,PARAMS.jitter,PARAMS.jitterSpeed]);}Math.random=rng;PARAMS.chase=0;
    return{samples,boundaries,slider:PANEL_GROUPS.flatMap(g=>g.items).find(i=>i[0]==='shape')};
  });assert.deepEqual(limits.boundaries,[[2,0,0],[12,40,90]]);assert.deepEqual(limits.slider.slice(2),[2,24,1]);assert.ok(limits.samples.every(([s,j,v])=>s>=2&&s<=12&&j<=40&&v<=90));
  await configure(page);
  const geometry=await page.evaluate(()=>{
    const n=(x,y)=>({x,y,designX:x,designY:y}),center=n(0,0),body={nodes:[center,n(10,0),n(-10,0),n(0,10),n(0,-10)],edges:[{a:0,b:1},{a:0,b:2},{a:0,b:3},{a:0,b:4}]};
    setParamValue('shape',2);PARAMS.lineW=7;const junction=_pointShapeGeometry(center,20,body,0),end=_pointShapeGeometry(body.nodes[1],20,body,1);
    const before=_nodeTangent(body,0);for(const node of body.nodes){node.x+=13;node.y-=9;node.jitterState={x:13,y:-9,applied:true};}const after=_nodeTangent(body,0);
    const polygons=[];for(const sides of [3,4,12,24]){setParamValue('shape',sides);const shape=_pointShapeGeometry({x:0,y:0},20);polygons.push({sides,count:shape.points.length,radii:shape.points.map(p=>Math.hypot(p.x,p.y))});}
    return{junction,end,before,after,polygons};
  });assert.equal(geometry.junction.width,7);assert.ok(Math.abs(geometry.junction.a.x-geometry.junction.b.x)<1e-8);assert.ok(Math.abs(geometry.end.a.x-geometry.end.b.x)<1e-8);assert.equal(geometry.before,geometry.after);for(const p of geometry.polygons){assert.equal(p.count,p.sides);assert.ok(p.radii.every(r=>Math.abs(r-20)<1e-8));}
  const exports=[];
  const download=async(fn,name)=>{const event=page.waitForEvent('download');await page.evaluate(fn);await(await event).saveAs('test-results/'+name);};
  for(const sides of [2,3,4,12,24]){
    await configure(page);await page.evaluate(sides=>{
      setParamValue('shape',sides);PARAMS.nodeR=36;PARAMS.lineW=6;PARAMS.chase=60;PARAMS.jitter=40;for(let i=0;i<90;i++){_advanceMotion(i*1000/60);_advanceChase();step(1);_applyNodeJitter();}
      _centerPointer=null;_hoverJamo=null;draw();
    },sides);
    await download(()=>saveSVG(),`shape-${sides}.svg`);await download(()=>savePNG(),`shape-${sides}.png`);
    const svg=fs.readFileSync(`test-results/shape-${sides}.svg`,'utf8'),png=fs.readFileSync(`test-results/shape-${sides}.png`).toString('base64');
    const comparison=await page.evaluate(async({svg,png,sides})=>{
      const tree=new DOMParser().parseFromString(svg,'image/svg+xml'),polys=[...tree.querySelectorAll('polygon')];
      const points=polys.map(p=>p.getAttribute('points').trim().split(/\s+/).length),lines=[...tree.querySelectorAll('line[stroke-linecap="butt"]')].map(l=>Number(l.getAttribute('stroke-width')));
      const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
      const [a,b]=await Promise.all([load('data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)))),load('data:image/png;base64,'+png)]);
      const c=document.createElement('canvas');c.width=b.width;c.height=b.height;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle=currentBgColor();x.fillRect(0,0,c.width,c.height);x.drawImage(b,0,0);const expected=x.getImageData(0,0,c.width,c.height).data;x.clearRect(0,0,c.width,c.height);x.drawImage(a,0,0,c.width,c.height);const actual=x.getImageData(0,0,c.width,c.height).data;
      let changed=0,maxDiff=0;for(let i=0;i<actual.length;i++){if(Math.abs(actual[i]-expected[i])>8)changed++;maxDiff=Math.max(maxDiff,Math.abs(actual[i]-expected[i]));}
      return{points,lines,changed,fraction:changed/actual.length,maxDiff};
    },{svg,png,sides});
    if(sides===2){assert.ok(comparison.lines.length>0);assert.ok(comparison.lines.every(w=>w===6));}else{assert.ok(comparison.points.length>0);assert.ok(comparison.points.every(n=>n===sides));}
    assert.ok(comparison.fraction<.015,JSON.stringify({sides,comparison}));
    await page.evaluate(()=>{_startRecording();});await page.waitForFunction(()=>_recording?.frames.length&&!_recording.busy);
    const reference=await page.evaluate(()=>_recording.canvas.toDataURL('image/png').split(',')[1]);fs.writeFileSync(`test-results/shape-${sides}-frame.png`,Buffer.from(reference,'base64'));
    await download(()=>_stopRecording(),`shape-${sides}.mov`);await page.waitForFunction(()=>!_recording);exports.push({sides,...comparison});
  }
  // Nonlinear effects inside new SVGs share the exact PNG renderer.
  for(const [mode,cornerR,borderWidth] of [['smooth',2,0],['border',0,3]]){
    await page.evaluate(({cornerR,borderWidth})=>{setParamValue('shape',4);Object.assign(PARAMS,{cornerR,borderWidth});},{cornerR,borderWidth});
    await download(()=>saveSVG(),`shape-${mode}.svg`);assert.match(fs.readFileSync(`test-results/shape-${mode}.svg`,'utf8'),/<image[^>]+data:image\/png;base64/);
  }
  const load=async data=>{const event=page.waitForEvent('filechooser');await page.evaluate(()=>triggerSettingsLoad());await(await event).setFiles({name:'settings.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await page.waitForFunction(()=>_fileLoads.main===null);};
  for(const shape of [0,50,100]){
    await load({schema:'mungchin-hangul-settings-v2',text:'한글',params:{shape,jitter:100,jitterSpeed:100,pointDist:240}});
    assert.deepEqual(await page.evaluate(()=>[_pointShapeMode,PARAMS.shape,PARAMS.jitter,PARAMS.jitterSpeed,PARAMS.pointDist]),['legacy-roundness',shape,100,100,240]);
    assert.match(await page.locator('#recordStatus').innerText(),/이전 점 모양/);assert.match(await page.locator('#panel [data-key="shape"] .lbvLabel').innerText(),/이전/);
    await download(()=>saveSettings(),`legacy-shape-${shape}.json`);const saved=JSON.parse(fs.readFileSync(`test-results/legacy-shape-${shape}.json`,'utf8'));assert.deepEqual(saved.pointShape,{version:2,mode:'legacy-roundness'});await load(saved);assert.equal(await page.evaluate(()=>_pointShapeMode),'legacy-roundness');
  }
  await numeric(24);assert.equal(await page.evaluate(()=>_pointShapeMode),'sides');await download(()=>saveSettings(),'polygon-settings.json');const saved=JSON.parse(fs.readFileSync('test-results/polygon-settings.json','utf8'));assert.deepEqual(saved.pointShape,{version:2,mode:'sides'});await load(saved);assert.equal(await page.evaluate(()=>PARAMS.shape),24);
  await page.evaluate(()=>{_pointShapeMode='legacy-roundness';PARAMS.shape=4;_rangePlayback.ranges={shape:{start:4,end:4}};_applyRangePosition(0);});assert.equal(await page.evaluate(()=>_pointShapeMode),'sides');await numeric(24);
  await load({...saved,pointShape:{version:99,mode:'sides'},params:{shape:3}});assert.equal(await page.evaluate(()=>PARAMS.shape),24);assert.match(await page.locator('#recordStatus').innerText(),/지원하지 않는 점 모양/);
  fs.writeFileSync('test-results/point-shapes.json',JSON.stringify({limits,geometry,exports},null,2));console.log('PASS: side counts 2/3/4/12/24, integer UI, random2–12, jitter40/90, orthogonal stable segment, circumradius, chase/jitter SVG/PNG parity, MOV frames, effect SVG embedding, explicit legacy compatibility and unknown-version rejection');
}).catch(e=>{console.error(e);process.exitCode=1;});
