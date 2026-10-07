const assert=require('node:assert/strict'),fs=require('node:fs');
const {run,configure}=require('./helpers.cjs');

async function checkDiamonds(page){
  await configure(page);
  const results=[];
  for(const [bg,fg] of [[[18,36,74],[250,219,45]],[[245,218,234],[12,71,42]]]){
    const result=await page.evaluate(({bg,fg})=>{
      ['_bgR','_bgG','_bgB'].forEach((key,i)=>setParamValue(key,bg[i]));
      ['_fgR','_fgG','_fgB'].forEach((key,i)=>setParamValue(key,fg[i]));
      const body=world.bodies[0];
      _centerPointer={x:body.anchorX,y:body.anchorY};
      _hoverJamo={body,idxs:body.nodes.map((_,i)=>i)};
      const dpr=devicePixelRatio,frames=[];
      // Record the final paints: both geometry modes and hover feedback must stay below the diamond.
      const fill=ctx.fill,stroke=ctx.stroke,paints=[];
      ctx.fill=function(...args){paints.push({kind:'fill',color:this.fillStyle});return fill.apply(this,args);};
      ctx.stroke=function(...args){paints.push({kind:'stroke',color:this.strokeStyle,width:this.lineWidth,scale:this.getTransform().a});return stroke.apply(this,args);};
      try{
        for(const [cornerR,borderWidth] of [[0,0],[2,0],[0,2]]){
          Object.assign(PARAMS,{cornerR,borderWidth});paints.length=0;draw();
          frames.push({cornerR,borderWidth,last:paints.slice(-2),pixel:[...ctx.getImageData(Math.floor(body.anchorX*dpr),Math.floor(body.anchorY*dpr),1,1).data]});
        }
      }finally{ctx.fill=fill;ctx.stroke=stroke;PARAMS.cornerR=PARAMS.borderWidth=0;}
      const guide=document.getElementById('hudCenterPreview'),cc=guide.getContext('2d'),guideCases=[];
      const move=cc.moveTo;
      let top;
      cc.moveTo=function(x,y){top=y;return move.call(this,x,y);};
      try{
        for(const nodeR of [0,20,32,200]){
          PARAMS.nodeR=nodeR;updateHUD();
          guideCases.push({nodeR,actualRadius:_centerRadius(),guideRadius:6-top,fill:cc.fillStyle,stroke:cc.strokeStyle,visibleStroke:cc.lineWidth*1.5,pixel:[...cc.getImageData(Math.floor(7.5*dpr),Math.floor(6*dpr),1,1).data]});
        }
      }finally{cc.moveTo=move;PARAMS.nodeR=20;}
      // Independently sample an edge over a solid foreground glyph: a background outline must be visible.
      ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=currentFgColor();ctx.fillRect(body.anchorX-20,body.anchorY-20,40,40);
      // An inherited transform/filter/dash/alpha must not alter handle appearance.
      ctx.translate(100,100);ctx.filter='blur(3px)';ctx.globalAlpha=.25;ctx.setLineDash([2,2]);
      _drawCenterHandles();ctx.restore();
      const edge=ctx.getImageData(Math.floor((body.anchorX+7.5)*dpr),Math.floor((body.anchorY-7.5)*dpr),1,1).data;
      draw();updateHUD();sliderUpdaters.forEach(update=>update());
      return{dpr,bg,fg,frames,guideCases,edge:[...edge]};
    },{bg,fg});
    for(const frame of result.frames){
      assert.equal(frame.last[0].kind,'fill');assert.equal(frame.last[1].kind,'stroke');
      assert.deepEqual(frame.pixel,[...fg,255]);assert.equal(frame.last[1].width,1);assert.equal(frame.last[1].scale,result.dpr);
      const color=rgb=>'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');
      assert.equal(frame.last[0].color,color(fg));assert.equal(frame.last[1].color,color(bg));
    }
    for(const guide of result.guideCases){
      assert.equal(guide.actualRadius,1.5*Math.max(guide.nodeR/2,3));
      assert.equal(guide.guideRadius,guide.nodeR===0?3:4.5);
      assert.ok(Math.abs(guide.visibleStroke-1)<1e-6);assert.deepEqual(guide.pixel,[...fg,255]);
      assert.equal(guide.fill,result.frames[0].last[0].color);assert.equal(guide.stroke,result.frames[0].last[1].color);
    }
    assert.ok(result.edge.slice(0,3).some((v,i)=>Math.abs(v-fg[i])>20),'visible background-colored edge');
    results.push(result);
  }
  await page.screenshot({path:`test-results/diamond-dpr${results[0].dpr}.png`});
  return results;
}

run(async page=>{
  await configure(page);await page.evaluate(()=>togglePanel());
  const row=page.locator('[data-key="pointDist"]');
  const numeric=async value=>{await row.locator('.lbvVal').click();await page.locator('.sliderValuePrompt').fill(String(value));await page.locator('.sliderValuePrompt').press('Enter');};
  const bar=await row.locator('.bar').boundingBox();
  for(const [x,value] of [[bar.x,0],[bar.x+bar.width/2,60],[bar.x+bar.width-1,119]]){
    await page.mouse.click(x,bar.y+bar.height/2);assert.ok(Math.abs(await page.evaluate(()=>PARAMS.pointDist)-value)<=1);
  }
  await page.mouse.move(bar.x+bar.width/2,bar.y+bar.height/2);await page.mouse.down();await page.mouse.move(bar.x+bar.width+20,bar.y+bar.height/2);await page.mouse.up();
  assert.equal(await page.evaluate(()=>PARAMS.pointDist),120);
  for(const value of [0,120,240,1200]){
    await numeric(value);assert.equal(await page.evaluate(()=>PARAMS.pointDist),value);assert.equal(await row.locator('.lbvVal').innerText(),String(value));
    await page.evaluate(()=>{for(let i=0;i<5;i++)resetWorld();buildPanel();sliderUpdaters.forEach(u=>u());});
    assert.equal(await page.evaluate(()=>PARAMS.pointDist),value);
  }
  assert.equal(await row.locator('.fill').evaluate(el=>el.style.width),'100%');
  for(const value of ['Infinity','NaN','1e309']){await numeric(value);assert.equal(await page.evaluate(()=>PARAMS.pointDist),1200);}
  await row.locator('.lbvVal').click();await page.locator('.sliderValuePrompt').fill('42');await page.locator('.sliderValuePrompt').press('Escape');assert.equal(await page.evaluate(()=>PARAMS.pointDist),1200);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'SAVE',exact:true}).click();
  const filename='test-results/point-dist-large.json';await(await download).saveAs(filename);
  const saved=JSON.parse(fs.readFileSync(filename,'utf8'));assert.equal(saved.params.pointDist,1200);
  await numeric(16);
  for(const legacy of [false,true]){
    const data=structuredClone(saved);if(legacy){delete data.layout;data.schema='mungchin-hangul-settings-v1';}
    const choice=page.waitForEvent('filechooser');await page.getByRole('button',{name:'LOAD',exact:true}).click();
    await(await choice).setFiles({name:'large.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
    await page.waitForFunction(()=>_fileLoads.main===null);assert.equal(await page.evaluate(()=>PARAMS.pointDist),1200);assert.equal(await row.locator('.lbvVal').innerText(),'1200');
  }
  // A live recording may rebuild geometry without clamping the manual value or losing cancel behavior.
  await configure(page);await page.evaluate(()=>{_startRecording();});await page.waitForFunction(()=>_recording?.frames.length);
  await numeric(240);assert.equal(await page.evaluate(()=>PARAMS.pointDist),240);
  await page.evaluate(()=>_stopRecording(true));await page.waitForFunction(()=>!_recording);
  const results=await checkDiamonds(page);
  const retina=await page.context().browser().newPage({viewport:{width:1280,height:720},deviceScaleFactor:2}),errors=[];
  try{
    retina.on('pageerror',e=>errors.push(e.message));await retina.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
    await retina.goto(page.url());await retina.waitForFunction(()=>typeof world!=='undefined'&&world?.bodies.length);results.push(...await checkDiamonds(retina));assert.deepEqual(errors,[]);
  }finally{await retina.close();}
  fs.writeFileSync('test-results/point-diamond.json',JSON.stringify(results,null,2));
  console.log('PASS: point spacing slider 0–120; manual 1200, resets, save/load v1/v2, invalid/cancel; recording changes; diamond palettes, 1px outlines, foreground layer, guide cap 4.5, original handle sizes at DPR 1/2');
}).catch(e=>{console.error(e);process.exitCode=1;});
