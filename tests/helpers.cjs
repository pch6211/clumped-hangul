const fs=require('node:fs'),http=require('node:http');
const {chromium}=require('playwright');
exports.run=async test=>{
  const server=http.createServer((req,res)=>{
    const file=req.url==='/media-export.js'?'media-export.js':'index.html';
    res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html; charset=utf-8');res.end(fs.readFileSync(file));
  }).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser;
  try{
    browser=await chromium.launch({headless:true,channel:process.env.TEST_BROWSER||undefined});
    const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
    await page.addInitScript(()=>{let seed=12345;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);});
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>typeof world!=='undefined'&&world?.bodies.length);
    await page.evaluate(()=>{cancelAnimationFrame(rafId);window._dismissIntro?.();});
    fs.mkdirSync('test-results',{recursive:true});await test(page,errors);
    require('node:assert/strict').deepEqual(errors,[]);
  }finally{await browser?.close();server.close();}
};
exports.configure=page=>page.evaluate(()=>{
  cancelAnimationFrame(rafId);TEXT='뭉친 한글';Object.assign(PARAMS,{pointDist:16,letterSpacing:20,lineHeight:80,choHoriz:0,choVert:0,jungHoriz:0,jungVert:0,jongHoriz:0,jongVert:0,randomExtra:0,nodeR:20,lineW:12,flow:0,cornerR:0,borderWidth:0,shape:0,jitter:0,wallOn:false});
  _centerLayout={text:TEXT,points:{}};world=buildWorld(TEXT);_bondUndo.length=_bondRedo.length=0;draw();
});
