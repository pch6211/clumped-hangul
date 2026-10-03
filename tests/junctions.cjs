const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');const {run,configure}=require('./helpers.cjs');
run(async page=>{
  await configure(page);
  const baseline=JSON.parse(fs.readFileSync('tests/fixtures/junction-before.json','utf8'));
  if(process.env.UPDATE_JUNCTION_BASELINE){
    const old=cp.execFileSync('git',['show',baseline.source+':index.html'],{encoding:'utf8',maxBuffer:2e6}).replaceAll('\r\n','\n');
    await page.evaluate(code=>{window.beforeStep=(0,eval)('('+code.step+')');window.beforeJitter=(0,eval)('('+code.jitter+')');}, {step:old.match(/^function step\([\s\S]*?^\}/m)[0],jitter:old.match(/^function _applyNodeJitter\([\s\S]*?^\}/m)[0]});
  }
  const result=await page.evaluate(baseline=>{
    Object.assign(PARAMS,{gravity:10,magnetForce:100,repulse:20,damping:85,speed:2,nodeR:20,lineW:12,jitter:80,jitterSpeed:60});
    const fixture=()=>{
      const b=buildWorld('각').bodies[0];b.magnetPairs=[[0,1],[1,2]];
      b.nodes.slice(0,3).forEach((n,i)=>{n.x=b.anchorX;n.y=b.anchorY;n.vx=i*2-2;n.vy=i-1;delete n.jitterState;});
      return{bodies:[b]};
    };
    const measure=(old,strength,speed)=>{
      world=fixture();PARAMS.jitter=strength;PARAMS.jitterSpeed=speed;_motionLast=null;_jitterPhase=0;
      const b=world.bodies[0],identity=b.nodes.slice(),topology=JSON.stringify(b.nodes.map(n=>[n.designX,n.designY,n.tags,n.tagFilters]));let maxGap=0,maxStateGap=0;
      for(let i=0;i<240;i++){
        _advanceMotion(i*1000/60);(old?beforeStep:step)(1);(old?beforeJitter:_applyNodeJitter)();
        const [a,...rest]=b.nodes.slice(0,3);for(const n of rest){maxGap=Math.max(maxGap,Math.hypot(a.x-n.x,a.y-n.y));maxStateGap=Math.max(maxStateGap,Math.hypot((a.jitterState?.x||0)-(n.jitterState?.x||0),(a.jitterState?.y||0)-(n.jitterState?.y||0)));}
      }
      const intact=identity.every((n,i)=>n===b.nodes[i])&&topology===JSON.stringify(b.nodes.map(n=>[n.designX,n.designY,n.tags,n.tagFilters]));
      return{strength,speed,maxGap,maxStateGap,intact};
    };
    const before=baseline||measure(true,80,60),cases=[];
    for(const strength of [0,15,80,100])for(const speed of [0,5,60,100])cases.push(measure(false,strength,speed));
    // Removing one attachment releases only that member; unrelated coincident points never weld.
    world=fixture();PARAMS.jitter=100;PARAMS.jitterSpeed=60;step(1);_applyNodeJitter();_stripNodeJitter();world.bodies[0].magnetPairs=[[0,1]];
    for(let i=0;i<90;i++){_advanceMotion(i*16);step(1);_applyNodeJitter();}
    const ns=world.bodies[0].nodes,detached=Math.hypot(ns[2].jitterState.x-ns[0].jitterState.x,ns[2].jitterState.y-ns[0].jitterState.y);
    world={bodies:[{nodes:[{x:10,y:20},{x:10,y:20}],magnetPairs:[]}]};_applyNodeJitter();const unrelated=Math.hypot(world.bodies[0].nodes[0].x-world.bodies[0].nodes[1].x,world.bodies[0].nodes[0].y-world.bodies[0].nodes[1].y);
    return{before,cases,detached,unrelated};
  },process.env.UPDATE_JUNCTION_BASELINE?null:baseline.before);
  assert.ok(result.before.maxGap>1&&result.before.maxStateGap>1,JSON.stringify(result.before));
  for(const test of result.cases){assert.equal(test.maxGap,0);assert.equal(test.maxStateGap,0);assert.ok(test.intact);}assert.ok(result.detached>.01&&result.unrelated>.01);
  await configure(page);
  const topology=await page.evaluate(()=>{
    TEXT='각';world=buildWorld(TEXT);const b=world.bodies[0],mapped=b.nodes.map((_,i)=>({i,map:_bondMapNode(b,i)})).filter(x=>x.map);
    const a=mapped.find(x=>x.map.part?.startsWith('cho')),c=mapped.find(x=>x.map.part?.startsWith('jung'));if(!a||!c)throw Error('attachment fixture unavailable: '+JSON.stringify(mapped));
    _bondUndo.length=_bondRedo.length=0;_bond={body:b,src:a.map,partner:c.map};_bondCommit();_bond=null;
    const count=()=>world.bodies[0].magnetPairs?.length||0,attached=count();_bondUndoApply();const undone=count();_bondRedoApply();const redone=count();
    const pair=world.bodies[0].magnetPairs[0];_detachAllForJamo(world.bodies[0],pair[0]);const detached=count();_bondUndoApply();const restored=count();_bondRedoApply();const removedAgain=count();_bondUndoApply();
    for(let i=0;i<12;i++)resetWorld();const reset=count();
    const body=world.bodies[0];_translateBody(body,73,-21);_centerLayout.points[body.centerKey]={x:body.anchorX,y:body.anchorY};_persistCenters();PARAMS.letterSpacing=-80;resetWorld();
    return{attached,undone,redone,detached,restored,removedAgain,reset,pins:_centerLayout.points,design:JSON.stringify(_editorDefs)};
  });
  assert.ok(topology.attached>topology.undone);assert.equal(topology.redone,topology.attached);assert.ok(topology.detached<topology.attached);assert.equal(topology.restored,topology.attached);assert.equal(topology.removedAgain,topology.detached);assert.equal(topology.reset,topology.attached);
  const save=async(fn,path)=>{const dl=page.waitForEvent('download');await page.evaluate(fn);await(await dl).saveAs(path);};
  await save(()=>saveSettings(),'test-results/junction-settings.json');await save(()=>exportPrimitivesJSON(),'test-results/junction-design.json');
  for(const [scope,path] of [['design','test-results/junction-design.json'],['main','test-results/junction-settings.json']]){
    const choose=page.waitForEvent('filechooser');await page.evaluate(scope=>scope==='main'?triggerSettingsLoad():triggerJamoLoad(),scope);await(await choose).setFiles(path);await page.waitForFunction(scope=>_fileLoads[scope]===null,scope);
  }
  assert.deepEqual(await page.evaluate(()=>_centerLayout.points),topology.pins);assert.equal(await page.evaluate(()=>world.bodies[0].magnetPairs.length),topology.attached);
  const rendered=await page.evaluate(()=>{
    PARAMS.jitter=100;PARAMS.jitterSpeed=100;const b=world.bodies[0],pair=b.magnetPairs[0];const a=b.nodes[pair[0]],c=b.nodes[pair[1]];c.x=a.x;c.y=a.y;let max=0;
    for(let i=0;i<120;i++){_advanceMotion(i*16);step(1);_applyNodeJitter();draw();max=Math.max(max,Math.hypot(a.x-c.x,a.y-c.y));}
    return{gap:max,count:b.nodes.length,pair,anchor:[b.anchorX,b.anchorY]};
  });assert.equal(rendered.gap,0);await page.screenshot({path:'test-results/junction-artwork.png'});
  fs.writeFileSync('test-results/junctions.json',JSON.stringify({result,topology:{...topology,design:undefined},rendered},null,2));console.log('PASS: real solver reproduction',result.before,'; 16 strength/speed cases gap=0, transitive triples, detached/overlapping independence, source vertices, attach/detach undo/redo, resets, placement and SAVE/LOAD');
}).catch(e=>{console.error(e);process.exitCode=1;});
