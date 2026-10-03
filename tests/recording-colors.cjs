const assert=require('node:assert/strict'),fs=require('node:fs');const {run,configure}=require('./helpers.cjs');
async function verifyColors(page){
  fs.mkdirSync('test-results',{recursive:true});await page.setViewportSize({width:640,height:480});await page.waitForFunction(()=>cssW===640);await configure(page);
  await page.evaluate(()=>{if(!document.getElementById('panel').classList.contains('open'))togglePanel();_centerPointer=null;_hoverJamo=null;});
  assert.equal(await page.locator('#recordMov').innerText(),'MOV');const results=[];
  for(const [index,label] of ['startup','manual-dark','manual-light','reset','random','smooth','border'].entries()){
    if(label==='random'){await page.evaluate(()=>randomizeAll());await configure(page);}
    const reference=await page.evaluate(label=>{
      if(label.startsWith('manual')){
        const [bg,fg]=label==='manual-dark'?[[18,36,74],[250,219,45]]:[[245,218,234],[12,71,42]];
        ['_bgR','_bgG','_bgB'].forEach((key,i)=>setParamValue(key,bg[i]));['_fgR','_fgG','_fgB'].forEach((key,i)=>setParamValue(key,fg[i]));
      }
      if(label==='reset')resetWorld();if(label==='smooth')PARAMS.cornerR=2;if(label==='border'){PARAMS.cornerR=0;PARAMS.borderWidth=2;}
      draw();updateHUD();window.colorReference=ctx.getImageData(0,0,640,480).data;
      return{bg:[bgR,bgG,bgB],fg:[fgR,fgG,fgB],png:canvas.toDataURL('image/png').split(',')[1]};
    },label);
    if(index===0)await page.locator('#recordMov').click();else await page.evaluate(index=>_captureRecordingFrame(_recording.started+index*100),index);
    await page.waitForFunction(index=>_recording?.frames.length===index+1&&!_recording.busy,index);
    const pixels=await page.evaluate(async index=>{
      const bitmap=await createImageBitmap(_recording.frames[index]),c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');x.drawImage(bitmap,0,0);bitmap.close();const data=x.getImageData(0,0,640,480).data;
      const raw=_recording.ctx.getImageData(0,0,640,480).data,bg=[bgR,bgG,bgB],fg=[fgR,fgG,fgB],axis=fg.map((v,i)=>Math.abs(v-bg[i])).indexOf(Math.max(...fg.map((v,i)=>Math.abs(v-bg[i]))));
      let encodingDiff=0,screenDiff=0,nonOpaque=0,background=0,foreground=0,invalidColors=0,maxBlendError=0;
      for(let i=0;i<data.length;i++){
        if(data[i]!==raw[i])encodingDiff++;if(data[i]!==colorReference[i])screenDiff++;
        if(i%4===0){
          if(data[i+3]!==255)nonOpaque++;
          if(bg.every((v,c)=>data[i+c]===v&&colorReference[i+c]===v))background++;
          if(fg.every((v,c)=>data[i+c]===v&&colorReference[i+c]===v))foreground++;
          const coverage=(data[i+axis]-bg[axis])/(fg[axis]-bg[axis]);
          const blendError=Math.max(...bg.map((v,c)=>Math.abs(data[i+c]-(v+coverage*(fg[c]-v)))));maxBlendError=Math.max(maxBlendError,blendError);
          // Repeated overlapping 8-bit strokes can round an endpoint by a few levels.
          const rounding=4/Math.abs(fg[axis]-bg[axis])+1e-9;
          if(coverage < -rounding || coverage > 1+rounding || blendError>2)invalidColors++;
        }
      }
      return{encodingDiff,screenDiff,nonOpaque,background,foreground,invalidColors,maxBlendError,png:_recording.canvas.toDataURL('image/png').split(',')[1]};
    },index);
    const rawPNG=pixels.png;delete pixels.png;
    assert.equal(pixels.encodingDiff,0,label);assert.equal(pixels.nonOpaque,0,label);assert.equal(pixels.invalidColors,0,JSON.stringify({label,pixels}));assert.ok(pixels.background>1000&&pixels.foreground>10,JSON.stringify({label,pixels}));
    // Screen and offscreen canvases may use different GPU/CPU edge antialiasing.
    // Both solid colors must agree exactly; edge colors must remain their blend.
    assert.ok(pixels.screenDiff<640*480*4*.03,JSON.stringify({label,pixels}));
    const file='color-reference-'+index+'.png';fs.writeFileSync('test-results/'+file,Buffer.from(rawPNG,'base64'));fs.writeFileSync('test-results/color-screen-'+index+'.png',Buffer.from(reference.png,'base64'));results.push({index,label,bg:reference.bg,fg:reference.fg,file,...pixels});
  }
  const download=page.waitForEvent('download');await page.locator('#recordMov').click();await(await download).saveAs('test-results/recording-colors.mov');await page.waitForFunction(()=>!_recording);assert.equal(await page.locator('#recordMov').innerText(),'MOV');
  // PNG transparency and SVG artwork export keep their existing behavior.
  await configure(page);const png=page.waitForEvent('download');await page.getByRole('button',{name:'PNG',exact:true}).click();await(await png).saveAs('test-results/color-artwork.png');
  const svg=page.waitForEvent('download');await page.getByRole('button',{name:'SVG',exact:true}).click();await(await svg).saveAs('test-results/color-artwork.svg');
  fs.writeFileSync('test-results/recording-colors.json',JSON.stringify({width:640,height:480,cases:results},null,2));
  console.log('PASS: MOV uppercase; 7 frames retain exact screen foreground/background RGB and valid edge blends (startup, two manual palettes, reset, random, smooth, border); PNG encoding loss=0, every pixel opaque');
}
exports.verifyColors=verifyColors;
if(require.main===module)run(verifyColors).catch(e=>{console.error(e);process.exitCode=1;});
