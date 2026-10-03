const assert=require('node:assert/strict'),fs=require('node:fs');const {run,configure}=require('./helpers.cjs');
run(async(page,errors)=>{
  const cases=[];
  for(const dpr of [1,1.25,2]){
    const context=await page.context().browser().newContext({viewport:{width:1280,height:800},deviceScaleFactor:dpr}),p=await context.newPage();
    try{
      p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
      await p.goto(page.url());await p.waitForFunction(()=>typeof world!=='undefined'&&world);await configure(p);await p.evaluate(()=>window._dismissIntro?.());
      const cdp=await context.newCDPSession(p);
      for(const scale of [1,1.25,2]){
        await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:scale});
        for(const bg of [[255,255,255],[0,0,0],[15,156,136]]){
          await p.setViewportSize({width:scale===1?1280:800,height:800});await p.waitForTimeout(230);
          await p.evaluate(bg=>{[bgR,bgG,bgB]=bg;fgR=fgG=fgB=128;for(let i=0;i<3;i++)resetWorld();draw();updateHUD();},bg);
          const screenshot=await p.screenshot({clip:{x:0,y:0,width:8,height:8},animations:'disabled'});
          const scan=await p.evaluate(async base64=>{const image=await createImageBitmap(new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],{type:'image/png'})),c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d');x.drawImage(image,0,0);image.close();return{size:[c.width,c.height],pixels:[...x.getImageData(0,0,c.width,c.height).data]};},screenshot.toString('base64'));
          for(let i=0;i<scan.pixels.length;i+=4)assert.deepEqual(scan.pixels.slice(i,i+4),[...bg,255],JSON.stringify({dpr,scale,bg,pixel:i/4}));
          cases.push({dpr,scale,bg,size:scan.size,pixels:scan.pixels.length/4});
          if(dpr===2&&scale===1)fs.writeFileSync('test-results/corner-'+bg[0]+'.png',screenshot);
        }
      }
    }finally{await context.close();}
  }
  await configure(page);const dl=page.waitForEvent('download');await page.evaluate(()=>savePNG());const path='test-results/corner-export.png';await(await dl).saveAs(path);
  const png=await page.evaluate(async base64=>{const bitmap=await createImageBitmap(new Blob([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],{type:'image/png'})),c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const x=c.getContext('2d');x.drawImage(bitmap,0,0);bitmap.close();return[...x.getImageData(0,0,8,8).data].filter((_,i)=>i%4===3);},fs.readFileSync(path).toString('base64'));assert.ok(png.every(alpha=>alpha===0));
  fs.writeFileSync('test-results/corner-pixels.json',JSON.stringify({cases,pngCornerAlpha:png},null,2));console.log('PASS: top-left pixels uniform for 3 DPI x 3 page scales x 3 backgrounds after resize/reset; actual PNG corner fully transparent');
}).catch(e=>{console.error(e);process.exitCode=1;});
