// Investigation only: reports current layout; deliberately does not change it.
const fs=require('node:fs');
const http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
  const server=http.createServer((req,res)=>{
    const script=req.url==='/media-export.js';res.setHeader('Content-Type',script?'application/javascript':'text/html; charset=utf-8');
    res.end(fs.readFileSync(script?'media-export.js':'index.html'));
  }).listen(0,'127.0.0.1');
  await new Promise(r=>server.once('listening',r));let browser;
  try {
    browser=await chromium.launch({headless:true,channel:process.env.TEST_BROWSER||undefined});
    const page=await browser.newPage({viewport:{width:1600,height:900}});
    await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(()=>typeof world!=='undefined'&&world);
    const report=await page.evaluate(()=>{
      cancelAnimationFrame(rafId);let seed=42;Math.random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
      Object.assign(PARAMS,{pointDist:16,gravity:8,letterSpacing:10,lineHeight:100,choHoriz:0,choVert:0,jungHoriz:0,jungVert:0,jongHoriz:0,jongVert:0,randomExtra:0,nodeR:10,lineW:6,cornerR:0,borderWidth:0,flow:0,wind:0});
      const samples=[];
      for(const text of ['한글 ABC 한글','ABC한글','abc123., 한글','AV To OO','한글\nABC','한글  ABC','한글 ABC 한글','가','가','é','é','العربية','漢字','🙂']) {
        if(samples.length===6)PARAMS.letterSpacing=-30;
        else PARAMS.letterSpacing=10;
        TEXT=text;world=buildWorld(text);
        const glyphs=world.bodies.map(b=>{
          const token=buildToken(b.ch,0,0,null), bb=bbox(token.glyph.nodes);
          return{ch:b.ch,anchorX:b.anchorX,anchorY:b.anchorY,designWidth:bb.w*8,known:!!resolveJamo(b.ch)||!!decomposeSyllable(b.ch)||!!PUNCT[b.ch]};
        });
        for(let i=0;i<360;i++)step(1);
        world.bodies.forEach((b,i)=>{
          const bb=bbox(b.nodes.filter(n=>!n.inv));Object.assign(glyphs[i],{settledLeft:bb.minX-5,settledRight:bb.maxX+5,settledWidth:bb.w+10});
          if(i>0)glyphs[i].gapFromPrevious=bb.minX-5-glyphs[i-1].settledRight;
        });
        samples.push({text,letterSpacing:PARAMS.letterSpacing,glyphs});
      }
      return{params:PARAMS,samples,note:'360 base-physics steps; visual bounds include node radius. Not an exact convergence guarantee.'};
    });
    fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/spacing-inspection.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report.samples.map(s=>({text:s.text,spacing:s.letterSpacing,chars:s.glyphs.map(g=>g.ch),design:s.glyphs.map(g=>+g.designWidth.toFixed(1)),advance:s.glyphs.slice(1).map((g,i)=>+(g.anchorX-s.glyphs[i].anchorX).toFixed(1)),settled:s.glyphs.map(g=>+g.settledWidth.toFixed(1)),known:s.glyphs.map(g=>g.known)})),null,2));
  }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
