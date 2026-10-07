const assert=require('node:assert/strict'),fs=require('node:fs');const {run,configure}=require('./helpers.cjs');
run(async page=>{
  await configure(page);
  const results=await page.evaluate(()=>{
    const results=[];
    for(const text of ['', '한', '가나', '뭉친 한글', 'AB 한글\n日本 🙂!?']){
      TEXT=text;world=buildWorld(TEXT);PARAMS.chase=0;
      const origin=world.bodies.map(b=>[b.anchorX,b.anchorY]),pins=JSON.stringify(_centerLayout);
      _advanceChase(1/60);
      const zero=world.bodies.every((b,i)=>b.anchorX===origin[i][0]&&b.anchorY===origin[i][1]);
      PARAMS.chase=100;PARAMS.jitter=100;
      let finite=true,weldGap=0;
      for(let i=0;i<240;i++){
        _advanceMotion(i*1000/60);_advanceChase();step(1);_applyNodeJitter();
        for(const b of world.bodies){
          finite&&=[b.anchorX,b.anchorY,...b.nodes.flatMap(n=>[n.x,n.y,n.vx,n.vy])].every(Number.isFinite);
          for(const pair of b._weldedPairs||[]){const [a,c]=pair.map(j=>b.nodes[j]);weldGap=Math.max(weldGap,Math.hypot(a.x-c.x,a.y-c.y));}
        }
      }
      const n=world.bodies.length,centroid=world.bodies.reduce((p,b)=>[p[0]+b.anchorX/(n||1),p[1]+b.anchorY/(n||1)],[0,0]);
      const radius=n?Math.min(...world.bodies.map(b=>Math.hypot(b.anchorX-centroid[0],b.anchorY-centroid[1]))):0;
      const baseError=Math.max(0,...world.bodies.map((b,i)=>Math.hypot(b.anchorX-(b._chaseOffset?.x||0)-origin[i][0],b.anchorY-(b._chaseOffset?.y||0)-origin[i][1])));
      const unchanged=JSON.stringify(_centerLayout)===pins;
      PARAMS.chase=0;for(let i=0;i<150;i++)_advanceChase(1/60);
      const returnError=Math.max(0,...world.bodies.map((b,i)=>Math.hypot(b.anchorX-origin[i][0],b.anchorY-origin[i][1])));
      results.push({text,n,zero,finite,weldGap,radius,baseError,unchanged,returnError});
    }
    TEXT='가나다라';world=buildWorld(TEXT);PARAMS.chase=100;_advanceChase(1/60);
    world._chasePhases[0]+=.4;
    const phaseError=()=>{const p=world._chasePhases,n=p.length;return p.reduce((s,v,i)=>s+Math.abs(Math.sin(p[(i+n-1)%n]-v-2*Math.PI/n)),0);};
    const before=phaseError();for(let i=0;i<300;i++)_advanceChase(1/60);const after=phaseError();
    const speed=[];
    for(const strength of [1,50,100]){
      PARAMS.chase=strength;world=buildWorld(TEXT);for(let i=0;i<600;i++)_advanceChase(1/60);
      let distance=0;for(let i=0;i<120;i++){const b=world.bodies[0],x=b.anchorX,y=b.anchorY;_advanceChase(1/60);distance+=Math.hypot(b.anchorX-x,b.anchorY-y);}speed.push(distance/2);
    }
    return{cases:results,phase:{before,after},speed};
  });
  for(const result of results.cases){assert.ok(result.zero&&result.finite&&result.unchanged,JSON.stringify(result));assert.ok(result.baseError<1e-7&&result.returnError<.002,JSON.stringify(result));assert.ok(result.weldGap<1e-6);if(result.n>1)assert.ok(result.radius>35,JSON.stringify(result));}
  assert.ok(results.phase.after<results.phase.before*.1);assert.ok(results.speed[2]>results.speed[1]&&results.speed[1]>results.speed[0]*3);
  await configure(page);await page.evaluate(()=>{PARAMS.chase=70;for(let i=0;i<180;i++)_advanceChase(1/60);draw();});
  const original=await page.evaluate(()=>{const b=world.bodies[0];return{x:b.anchorX,y:b.anchorY,baseX:b.anchorX-b._chaseOffset.x,baseY:b.anchorY-b._chaseOffset.y};});
  await page.mouse.move(original.x,original.y);await page.mouse.down();assert.equal(await page.evaluate(()=>!!_centerDrag),true);
  const phase=await page.evaluate(()=>world._chasePhases.slice());await page.evaluate(()=>{for(let i=0;i<60;i++)_advanceChase(1/60);});assert.deepEqual(await page.evaluate(()=>world._chasePhases),phase);
  await page.mouse.move(original.x+40,original.y+20,{steps:4});await page.mouse.up();
  const pin=await page.evaluate(()=>_centerLayout.points[world.bodies[0].centerKey]);assert.ok(Math.abs(pin.x-original.baseX-40)<1e-6&&Math.abs(pin.y-original.baseY-20)<1e-6);
  await page.keyboard.press('Control+z');assert.deepEqual(await page.evaluate(()=>_centerLayout.points),{});await page.keyboard.press('Control+Shift+z');
  const save=page.waitForEvent('download');await page.evaluate(()=>saveSettings());await(await save).saveAs('test-results/chase-settings.json');const settings=JSON.parse(fs.readFileSync('test-results/chase-settings.json','utf8'));
  assert.equal(settings.params.chase,70);assert.deepEqual(Object.values(settings.centers.points),[pin]);
  await page.evaluate(()=>{PARAMS.chase=0;for(let i=0;i<10;i++)resetWorld();});
  const chooser=page.waitForEvent('filechooser');await page.evaluate(()=>triggerSettingsLoad());await(await chooser).setFiles('test-results/chase-settings.json');await page.waitForFunction(()=>_fileLoads.main===null);
  assert.equal(await page.evaluate(()=>PARAMS.chase),70);assert.deepEqual(await page.evaluate(()=>_centerLayout.points),settings.centers.points);
  await page.evaluate(()=>{for(let i=0;i<180;i++)_advanceChase(1/60);draw();});
  const node=await page.evaluate(()=>{const n=world.bodies.flatMap(b=>b.nodes.filter(n=>Math.abs(n.x-b.anchorX)+Math.abs(n.y-b.anchorY)>_centerRadius()+5)).find(n=>n.x>20&&n.x<cssW-20&&n.y>80&&n.y<cssH-80);return{x:n.x,y:n.y};});
  await page.mouse.move(node.x,node.y);await page.mouse.down();assert.equal(await page.evaluate(()=>!!draggedNode&&!_centerDrag),true);await page.mouse.move(node.x+15,node.y+15);await page.evaluate(()=>{_advanceChase(1/60);step(1);});await page.mouse.up();
  await page.screenshot({path:'test-results/chase-preview.png'});fs.writeFileSync('test-results/chase.json',JSON.stringify(results,null,2));
  console.log('PASS: chase 0/1/50/100, empty/single/pair/mixed Unicode/newlines, non-collapsing radius, predecessor coupling, speed, finite solver, welded jitter, rest anchors, drag/undo/redo/reset/SAVE/LOAD');
}).catch(e=>{console.error(e);process.exitCode=1;});
