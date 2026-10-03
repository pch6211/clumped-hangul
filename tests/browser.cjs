const assert=require('node:assert/strict'),fs=require('node:fs');
const {run,configure}=require('./helpers.cjs');
run(async page=>{
  await configure(page);
  await page.keyboard.press('Alt+ArrowLeft');assert.equal(await page.evaluate(()=>PARAMS.letterSpacing),15);
  await page.evaluate(()=>{PARAMS.letterSpacing=-150;resetWorld();ensureFits();togglePanel();});assert.equal(await page.evaluate(()=>PARAMS.letterSpacing),-150);
  const numeric=async(key,value)=>{await page.locator('[data-key="'+key+'"] .lbvVal').click();await page.locator('.sliderValuePrompt').fill(String(value));await page.locator('.sliderValuePrompt').press('Enter');};
  await numeric('letterSpacing',-999);assert.equal(await page.evaluate(()=>PARAMS.letterSpacing),-150);
  await numeric('letterSpacing',-80);assert.equal(await page.evaluate(()=>PARAMS.letterSpacing),-80);
  await numeric('nodeR',-5);assert.equal(await page.evaluate(()=>PARAMS.nodeR),0);await configure(page);
  const radius=await page.evaluate(()=>{PARAMS.nodeR=32;const large=_centerRadius();PARAMS.nodeR=20;const b=world.bodies[0],n=b.nodes[0];return{large,small:_centerRadius(),hover:_hoverCenterBody({x:(b.anchorX+n.x)/2,y:(b.anchorY+n.y)/2})===b};});
  assert.deepEqual(radius,{large:24,small:15,hover:true});assert.equal(await page.getByRole('button',{name:'배치 초기화',exact:true}).count(),0);
  const pos=i=>page.evaluate(i=>({x:world.bodies[i].anchorX,y:world.bodies[i].anchorY}),i);
  const near=(a,b)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.001,JSON.stringify({a,b}));
  const move=async(i,dx,dy)=>{const p=await pos(i);await page.mouse.move(p.x,p.y);await page.mouse.down();assert.equal(await page.evaluate(()=>!!_centerDrag&&!draggedNode),true);await page.mouse.move(p.x+dx,p.y+dy,{steps:6});await page.mouse.up();return{x:p.x+dx,y:p.y+dy};};
  const original=await pos(0),moved=await move(0,60,-60);assert.equal(await page.evaluate(()=>_bondUndo.length),1);
  await page.keyboard.press('Control+z');near(await pos(0),original);assert.deepEqual(await page.evaluate(()=>_centerLayout.points),{});
  await page.keyboard.press('Control+Shift+z');near(await pos(0),moved);
  await page.evaluate(()=>{for(let i=0;i<25;i++)resetWorld();PARAMS.choHoriz=2;world=buildWorld(currentText());});near(await pos(0),moved);
  await page.mouse.move(moved.x,moved.y);await page.mouse.down();await page.mouse.up();assert.equal(await page.evaluate(()=>_bondUndo.length),1);
  await page.mouse.down();await page.mouse.move(moved.x+30,moved.y);await page.evaluate(()=>canvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:_centerDrag.id})));await page.mouse.up();near(await pos(0),moved);assert.equal(await page.evaluate(()=>_bondUndo.length),1);
  // Exercise the existing bond snapshot/restore rebuild between two real drags.
  const bond=await page.evaluate(()=>{const ch='ㄱ',before=_bondSnapshot([ch]);PRIMITIVES[ch].nodes[0].x+=1;const after=_bondSnapshot([ch]);_bondUndo.push({before,after});_bondRedo.length=0;return{before,after};});
  const secondOriginal=await pos(1),secondMoved=await move(1,20,45);
  await page.keyboard.press('Control+z');near(await pos(1),secondOriginal);near(await pos(0),moved);
  await page.keyboard.press('Control+z');assert.deepEqual(await page.evaluate(()=>_bondSnapshot(['ㄱ'])),bond.before);near(await pos(0),moved);
  await page.keyboard.press('Control+z');near(await pos(0),original);
  for(let i=0;i<3;i++)await page.keyboard.press('Control+Shift+z');near(await pos(1),secondMoved);near(await pos(0),moved);
  await page.keyboard.press('Control+z');await move(0,10,0);assert.equal(await page.evaluate(()=>_bondRedo.length),0);
  const depth=await page.evaluate(()=>_bondUndo.length);
  await page.locator('#mainText').focus();await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>_bondUndo.length),depth);
  await page.evaluate(()=>{_viewFocused=true;document.body.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyZ',key:'z',ctrlKey:true,isComposing:true,bubbles:true}));});assert.equal(await page.evaluate(()=>_bondUndo.length),depth);
  await page.locator('#recordMov').focus();await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>_bondUndo.length),depth);await page.evaluate(()=>document.activeElement.blur());
  const node=await page.evaluate(()=>{const n=world.bodies.flatMap(b=>b.nodes.filter(n=>Math.abs(n.x-b.anchorX)+Math.abs(n.y-b.anchorY)>_centerRadius()+3)).find(n=>n.x>340&&n.x<cssW-20&&n.y>80&&n.y<cssH-80);return{x:n.x,y:n.y};});
  await page.mouse.move(node.x,node.y);await page.mouse.down();assert.equal(await page.evaluate(()=>!!draggedNode&&!_centerDrag),true);await page.mouse.move(node.x+20,node.y+20);await page.evaluate(()=>step(1));await page.mouse.up();assert.equal(await page.evaluate(()=>draggedNode),null);
  await page.evaluate(()=>{TEXT='AB';world=buildWorld(TEXT);});assert.equal(await page.evaluate(()=>_bondUndo.some(e=>e.kind==='center')||_bondRedo.some(e=>e.kind==='center')),false);
  console.log('PASS: negative spacing; 1.5x glyph hover; drag undo; 25 resets; cancel; mixed bond history; redo invalidation; focus/IME; stroke drag');
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

  const random=await page.evaluate(()=>{
    TEXT='AB';PARAMS.cornerR=0;const samples=[],rng=Math.random;let seed=479;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    for(let i=0;i<40;i++){randomizeAll();samples.push([PARAMS.jitter,PARAMS.jitterSpeed]);}
    for(let i=0;i<20;i++){_groupRandomizers.decor();samples.push([PARAMS.jitter,PARAMS.jitterSpeed]);}
    Math.random=()=>0;_randomizeJitter();const low=[PARAMS.jitter,PARAMS.jitterSpeed];Math.random=()=>.99999999;_randomizeJitter();const high=[PARAMS.jitter,PARAMS.jitterSpeed];Math.random=rng;
    const set=window.setInterval,clear=window.clearInterval;let callback;window.setInterval=fn=>{callback=fn;return 99999;};window.clearInterval=()=>{};
    toggleAuto();const initial=[PARAMS.jitter,PARAMS.jitterSpeed];callback();const next=[PARAMS.jitter,PARAMS.jitterSpeed];toggleAuto();window.setInterval=set;window.clearInterval=clear;return{samples,low,high,initial,next};
  });
  assert.deepEqual(random.low,[0,0]);assert.deepEqual(random.high,[30,100]);assert.ok([...random.samples,random.initial,random.next].every(([a,b])=>Number.isInteger(a)&&a>=0&&a<=30&&Number.isInteger(b)&&b>=0&&b<=100));assert.ok(new Set(random.samples.map(s=>s.join(','))).size>30);
  await numeric('jitter',100);await numeric('jitterSpeed',100);assert.deepEqual(await page.evaluate(()=>[PARAMS.jitter,PARAMS.jitterSpeed]),[100,100]);
  await page.evaluate(()=>{openEditor();localStorage.setItem('release-test-sentinel','yes');});page.once('dialog',d=>d.accept());await Promise.all([page.waitForEvent('load'),page.locator('#btnEditorReset').click()]);await page.waitForFunction(()=>typeof world!=='undefined'&&world?.bodies.length);
  const reset=await page.evaluate(()=>{cancelAnimationFrame(rafId);return{text:TEXT,strength:PARAMS.jitter,speed:PARAMS.jitterSpeed,sentinel:localStorage.getItem('release-test-sentinel')};});assert.equal(reset.text,'뭉친 한글');assert.equal(reset.sentinel,null);assert.ok(reset.strength<=30&&reset.strength>=0&&reset.speed<=100&&reset.speed>=0);
  assert.equal(await page.locator('#hudCenterPreview').count(),1);assert.ok(await page.getByText('글자 옮기기:',{exact:true}).isVisible());
  // The shipped main has removed the old intro DOM. Preserve that behavior.
  assert.equal(await page.locator('#introPanel').count(),0);
  await page.evaluate(()=>{cancelAnimationFrame(rafId);togglePanel();toggleGuide();});assert.equal(await page.locator('#panelGuide').isVisible(),false);assert.equal(await page.locator('#hudCenterPreview').isVisible(),false);await page.evaluate(()=>toggleGuide());assert.equal(await page.locator('#panelGuide').isVisible(),true);assert.equal(await page.locator('#hudCenterPreview').isVisible(),true);await page.screenshot({path:'test-results/release-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForFunction(()=>typeof world!=='undefined'&&world);await page.evaluate(()=>{cancelAnimationFrame(rafId);window._dismissIntro?.();togglePanel();});
  const overflow=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('#panel .btnRow button')].map(b=>({text:b.textContent,x:b.getBoundingClientRect().x,right:b.getBoundingClientRect().right}))}));assert.ok(overflow.scroll<=overflow.viewport+1,JSON.stringify(overflow));assert.ok(overflow.buttons.every(b=>b.x>=0&&b.right<=overflow.viewport+1));await page.screenshot({path:'test-results/release-mobile.png'});
  await page.evaluate(()=>{togglePanel();for(let i=0;i<120;i++)step(1);draw();updateHUD();});
  const guideBounds=await page.locator('#hudCenterPreview').evaluate(el=>{const r=el.parentElement.getBoundingClientRect();return{x:r.x,right:r.right,viewport:innerWidth};});assert.ok(guideBounds.x>=0&&guideBounds.right<=guideBounds.viewport);
  await page.screenshot({path:'test-results/release-mobile-guide.png'});
  fs.writeFileSync('test-results/release-ui.json',JSON.stringify({radius,jitter,speeds,random,reset,overflow,guideBounds},null,2));console.log('PASS: 60 random/decor samples, endpoints, autoplay, manual range, factory reset, intro/guide visibility, mobile button and closed-panel guide bounds');
}).catch(e=>{console.error(e);process.exitCode=1;});
