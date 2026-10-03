const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {chromium}=require('playwright');
const cases=['한글 ABC 한글','ABC한글','abc123., 한글','AV To OO','한글\nABC','한글  ABC'];
async function configure(page){await page.evaluate(()=>{cancelAnimationFrame(rafId);window._dismissIntro?.();Object.assign(PARAMS,{pointDist:16,gravity:8,repulse:20,shapeBoost:100,damping:85,speed:1,letterSpacing:10,lineHeight:100,choHoriz:0,choVert:0,jungHoriz:0,jungVert:0,jongHoriz:0,jongVert:0,randomExtra:0,shape:0,nodeR:10,lineW:6,cornerR:0,borderWidth:0,flow:0,jitter:0,wind:0,wallOn:false});K_SPRING=100;K_ANGLE=100;K_ROT=100;_footerOffset=()=>40;panelOffsetX=0;editorRightOffset=0;_centerLayout={text:'',points:{}};});}
async function snapshot(page,text){return page.evaluate(text=>{let seed=42;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);TEXT=text;world=buildWorld(text);return world.bodies.map(b=>({ch:b.ch,x:b.anchorX,y:b.anchorY,first:[b.nodes[0].x,b.nodes[0].y],count:b.nodes.length}));},text);}
(async()=>{
  const old=process.env.UPDATE_LAYOUT_FIXTURE?cp.execFileSync('git',['show','512753b:index.html'],{maxBuffer:2e6}):null;
  const server=http.createServer((req,res)=>{
    if(req.url==='/motion-curve.js'){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync('motion-curve.js'));return;}const js=req.url==='/media-export.js';res.setHeader('Content-Type',js?'application/javascript':'text/html; charset=utf-8');res.end(req.url==='/legacy'?old:fs.readFileSync(js?'media-export.js':'index.html'));}).listen(0,'127.0.0.1');
  await new Promise(r=>server.once('listening',r));let browser;
  try{
    browser=await chromium.launch({headless:true,channel:process.env.TEST_BROWSER||undefined});const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
    const url=`http://127.0.0.1:${server.address().port}`;
    if(old){await page.goto(url+'/legacy');await page.waitForFunction(()=>typeof world!=='undefined'&&world);await configure(page);const fixtures=[];for(const text of cases)fixtures.push({text,positions:await snapshot(page,text)});fs.mkdirSync('tests/fixtures',{recursive:true});fs.writeFileSync('tests/fixtures/legacy-layout.json',JSON.stringify({source:'512753b',fixtures},null,2));await page.evaluate(()=>localStorage.clear());}
    await page.goto(url);await page.waitForFunction(()=>typeof world!=='undefined'&&world);assert.equal(await page.evaluate(()=>_layoutState.mode),'optical-v2');await configure(page);
    const fixture=JSON.parse(fs.readFileSync('tests/fixtures/legacy-layout.json','utf8'));
    await page.evaluate(()=>_layoutState.mode='legacy-uniform');for(const entry of fixture.fixtures)assert.deepEqual(await snapshot(page,entry.text),entry.positions);
    console.log('PASS: legacy anchors and initial geometry exactly match pre-optical commit 512753b for six mixed-text fixtures');
    await page.evaluate(()=>{_layoutState.mode='optical-v2';_persistLayoutState();});
    const optical=[];for(const text of cases)optical.push({text,positions:await snapshot(page,text)});
    const mixed=optical[0].positions;const latin=await snapshot(page,'ABC');
    const pair=(list,a,b)=>{const i=list.findIndex(x=>x.ch===a);return list[i+1].ch===b?list[i+1].x-list[i].x:null;};
    assert.ok(Math.abs(pair(mixed,'A','B')-pair(latin,'A','B'))<.001);assert.ok(pair(mixed,'A','B')<67);
    const stable=await page.evaluate(()=>{
      TEXT='한글 ABC 한글';PARAMS.randomExtra=2;world=buildWorld(TEXT);const before=world.bodies.map(b=>[b.anchorX,b.anchorY,b.nodes.length]);
      for(let i=0;i<25;i++)resetWorld();const after=world.bodies.map(b=>[b.anchorX,b.anchorY,b.nodes.length]);
      const current=JSON.stringify(world),random=Math.random;_opticalCache.clear();_predictOpticalProfile(buildToken('V',0,0,null),16);const untouched=current===JSON.stringify(world);buildWorld(TEXT,{measureOnly:true});
      const rngRestored=random===Math.random;PARAMS.randomExtra=0;
      const initial=world.bodies.map(b=>[b.anchorX,b.anchorY]);PARAMS.jitter=100;
      for(let i=0;i<60;i++){_advanceMotion(i*16);step(1);_applyNodeJitter();}
      const anchors=world.bodies.map(b=>[b.anchorX,b.anchorY]);PARAMS.jitter=0;
      return{before,after,untouched,rngRestored,initial,anchors};
    });
    assert.deepEqual(stable.before,stable.after);assert.ok(stable.untouched&&stable.rngRestored);assert.deepEqual(stable.initial,stable.anchors);
    const gaps=await page.evaluate(()=>['AV','To','OO','A.'].map(pair=>{const a=_predictOpticalProfile(buildToken(pair[0],0,0,null),16),b=_predictOpticalProfile(buildToken(pair[1],0,0,null),16);return{pair,gap:_opticalGap(a,b,16),bboxGap:4};}));
    assert.ok(gaps.some(g=>g.gap<g.bboxGap));assert.ok(gaps.every(g=>Number.isFinite(g.gap)));
    const negative=await page.evaluate(()=>{PARAMS.letterSpacing=-150;resetWorld();ensureFits();return{value:PARAMS.letterSpacing,finite:world.bodies.every(b=>Number.isFinite(b.anchorX)&&Number.isFinite(b.anchorY))};});assert.equal(negative.value,-150);assert.ok(negative.finite);
    // Pins remain absolute under optical reflow, reset and versioned JSON roundtrip.
    await page.evaluate(()=>{PARAMS.letterSpacing=10;TEXT='한글 ABC 한글';world=buildWorld(TEXT);const b=world.bodies[0];_translateBody(b,77,-45);_centerLayout.points[b.centerKey]={x:b.anchorX,y:b.anchorY};_persistCenters();togglePanel();});
    const pinned=await page.evaluate(()=>({..._centerLayout.points}));
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'SAVE',exact:true}).click();fs.mkdirSync('test-results',{recursive:true});await(await download).saveAs('test-results/layout-v2.json');
    const saved=JSON.parse(fs.readFileSync('test-results/layout-v2.json','utf8'));assert.equal(saved.schema,'mungchin-hangul-settings-v2');assert.equal(saved.layout.anchorSpace,'absolute-css-px');assert.equal(saved.layout.anchorKeyVersion,1);
    const load=async(path)=>{const fc=page.waitForEvent('filechooser');await page.getByRole('button',{name:'LOAD',exact:true}).click();await(await fc).setFiles(path);};
    const untouched=await page.evaluate(()=>JSON.stringify({TEXT,PARAMS,layout:_layoutState,centers:_centerLayout}));
    fs.writeFileSync('test-results/layout-future.json',JSON.stringify({...saved,text:'must not replace',layout:{...saved.layout,version:99}}));
    const warning=page.waitForEvent('dialog');await load('test-results/layout-future.json');await(await warning).accept();
    assert.equal(await page.evaluate(()=>JSON.stringify({TEXT,PARAMS,layout:_layoutState,centers:_centerLayout})),untouched);
    await page.evaluate(()=>{_setLayoutMode('legacy-uniform');_centerLayout.points={};resetWorld();});await load('test-results/layout-v2.json');await page.waitForFunction(()=>_layoutState.mode==='optical-v2');assert.deepEqual(await page.evaluate(()=>_centerLayout.points),pinned);
    const legacy={...saved,schema:'mungchin-hangul-settings-v1',recording:{period:2,curve:[0,1]},motion:{tracks:['nodeR']},params:{...saved.params,jitter:70,recordDuration:9999,motionPeriod:2}};delete legacy.layout;delete legacy.params.jitterSpeed;fs.writeFileSync('test-results/layout-v1.json',JSON.stringify(legacy));await page.evaluate(()=>_bondUndo.push({kind:'center',text:TEXT}));await load('test-results/layout-v1.json');await page.waitForFunction(()=>_layoutState.mode==='legacy-uniform');assert.deepEqual(await page.evaluate(()=>_centerLayout.points),pinned);
    assert.deepEqual(await page.evaluate(()=>({strength:PARAMS.jitter,history:_bondUndo.some(e=>e.kind==='center'),unknown:Object.hasOwn(PARAMS,'recordDuration')||Object.hasOwn(PARAMS,'motionPeriod'),popup:typeof _recordMode})),{strength:70,history:false,unknown:false,popup:'undefined'});
    assert.equal(await page.evaluate(()=>PARAMS.jitterSpeed),100);await page.evaluate(()=>{PARAMS.jitter=0;PARAMS.jitterSpeed=30;});
    const legacyGap=await page.evaluate(()=>world.bodies[3].anchorX-world.bodies[2].anchorX);assert.equal(legacyGap,67);
    assert.equal(await page.locator('[data-layout-mode]').count(),0);await page.evaluate(()=>_setLayoutMode('optical-v2'));assert.equal(await page.evaluate(()=>_layoutState.mode),'optical-v2');assert.deepEqual(await page.evaluate(()=>_centerLayout.points),pinned);
    const shaping=await page.evaluate(()=>['가','가','é','العربية','漢字'].map(text=>({text,count:buildWorld(text).bodies.length})));assert.deepEqual(shaping.map(x=>x.count),[1,2,2,7,2]);
    await page.reload();await page.waitForFunction(()=>typeof world!=='undefined'&&world);assert.equal(await page.evaluate(()=>_layoutState.mode),'optical-v2');
    await configure(page);
    const timings=await page.evaluate(()=>{TEXT='한글 ABC abc123';_opticalCache.clear();const t=performance.now();world=buildWorld(TEXT);const cold=performance.now()-t,values=[];for(let i=0;i<7;i++){const t=performance.now();world=buildWorld(TEXT);values.push(performance.now()-t);}values.sort((a,b)=>a-b);return{coldMs:cold,warmMedianMs:values[3],glyphs:world.bodies.length,cacheEntries:_opticalCache.size};});
    await page.evaluate(()=>{
      const wrap=document.createElement('div');wrap.id='opticalComparison';Object.assign(wrap.style,{position:'absolute',inset:'0 auto auto 0',zIndex:'999999',display:'grid',gridTemplateColumns:'800px 800px',background:'white',color:'black',font:'14px sans-serif'});document.body.append(wrap);
      cssW=800;cssH=220;_footerOffset=()=>0;panelOffsetX=0;editorRightOffset=0;bgR=bgG=bgB=255;fgR=fgG=fgB=0;PARAMS.jitter=0;
      for(const text of ['한글 ABC 한글','AV To OO'])for(const mode of ['legacy-uniform','optical-v2']){
        _layoutState.mode=mode;TEXT=text;world=buildWorld(text);for(let i=0;i<240;i++)step(1);
        const box=document.createElement('div'),label=document.createElement('div'),c=document.createElement('canvas');label.textContent=(mode==='optical-v2'?'시각적':'기존')+' · '+text;label.style.padding='12px 20px';c.width=800;c.height=220;
        const x=c.getContext('2d');_renderArtwork(x,{x:0,y:0,w:800,h:220});box.append(label,c);wrap.append(box);
      }
    });
    await page.locator('#opticalComparison').screenshot({path:'test-results/optical-comparison.png'});
    await page.evaluate(()=>{localStorage.removeItem('mh_layout_v2');localStorage.removeItem('mh_centers');localStorage.removeItem('jeomgureum_text_v1');localStorage.setItem('mh_admin_defaults','{}');});
    await page.reload();await page.waitForFunction(()=>typeof world!=='undefined'&&world);assert.equal(await page.evaluate(()=>_layoutState.mode),'legacy-uniform');
    fs.writeFileSync('test-results/optical-layout.json',JSON.stringify({optical,gaps,negative,shaping,timings},null,2));assert.deepEqual(errors,[]);
    console.log('PASS: optical pair spacing, consistent mixed/Latin advances, deterministic resets, no live-world mutation, negative tracking, legacy/v2 LOAD, absolute pins, persisted mode, explicit shaping limits',gaps,timings);
  }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
