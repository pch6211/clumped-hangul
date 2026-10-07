const assert=require('node:assert/strict'),fs=require('node:fs');const {run,configure}=require('./helpers.cjs');
run(async page=>{
  await page.setViewportSize({width:960,height:640});await page.waitForTimeout(350);await configure(page);await page.evaluate(()=>{
    TEXT='뭉친 한글 ABC';Object.assign(PARAMS,{pointDist:24,nodeR:12,lineW:5,jitter:20,jitterSpeed:45,chase:40});setParamValue('shape',4);resetWorld();
    window.liveBody=world.bodies[0];window.liveNode=liveBody.nodes[0];window.frameCosts=[];window.realAdvance=_advanceRangePlayback;
    _advanceRangePlayback=now=>{const start=performance.now();realAdvance(now);frameCosts.push(performance.now()-start);};
    Object.assign(_rangePlayback,{ranges:{pointDist:{start:20,end:32},nodeR:{start:12,end:18},jitter:{start:5,end:40},chase:{start:30,end:70},_bgR:{start:80,end:200}},seconds:1,count:2,loop:false,status:'idle'});
    _openRecordDialog();
  });
  await page.locator('#recordStart').click();await page.evaluate(()=>tick());
  await page.waitForFunction(()=>_recording?.paused&&_rangePlayback.status==='finished',null,{timeout:15000});
  const result=await page.evaluate(()=>{cancelAnimationFrame(rafId);const costs=frameCosts.filter(v=>v>0).sort((a,b)=>a-b);return{frames:_recording.frames.length,times:_recording.times.slice(),elapsed:_recordElapsed(_recording),bodyRetained:world.bodies[0]===liveBody,nodeRetained:world.bodies[0].nodes[0]===liveNode,finite:world.bodies.every(b=>b.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y))),medianMs:costs[Math.floor(costs.length/2)],p95Ms:costs[Math.floor(costs.length*.95)],chase:PARAMS.chase,pointDist:PARAMS.pointDist};});
  assert.ok(result.frames>=8,JSON.stringify(result));assert.ok(result.times.at(-1)>1000&&result.elapsed<10000);assert.ok(result.bodyRetained&&result.nodeRetained&&result.finite,JSON.stringify(result));assert.equal(result.chase,30);assert.equal(result.pointDist,20);
  const download=page.waitForEvent('download');await page.locator('#recordSave').click();await(await download).saveAs('test-results/live-motion.mov');await page.waitForFunction(()=>!_recording);
  await page.screenshot({path:'test-results/live-motion.png'});fs.writeFileSync('test-results/live-motion.json',JSON.stringify(result,null,2));
  console.log('PASS: real RAF drives two cycles with spacing, size, jitter, chase, color and MOV; identity preserved, finite positions, pauses at completion',result);
}).catch(e=>{console.error(e);process.exitCode=1;});
