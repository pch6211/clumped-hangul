const assert=require('node:assert/strict'),fs=require('node:fs');const {run,configure}=require('./helpers.cjs');
run(async(page,errors)=>{
  await configure(page);await page.evaluate(()=>{togglePanel();openEditor();});const geometry=[];
  const audit=()=>page.evaluate(()=>{
    updateHUD();_reapplyGuideLocalizer();_syncJamoGridWidth();
    const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};
    const grids=[...document.querySelectorAll('#editorJamoList .jamoGrid')];
    const headings=grids.map(g=>{const label=g.previousElementSibling,r=document.createRange();r.selectNodeContents(label.firstElementChild||label);return{text:label.textContent.trim(),grid:rect(g),left:r.getBoundingClientRect().left};});
    const guide=document.querySelector('#editorCommonGuide b');const r=document.createRange();r.selectNodeContents(guide);
    const die=document.querySelector('.guideDie'),functional=document.querySelector('.groupTitle .die');
    const textRange=document.createRange();textRange.selectNodeContents(die.parentElement.lastChild);const text=textRange.getBoundingClientRect(),dr=die.getBoundingClientRect();
    const style=el=>{const s=getComputedStyle(el);return{font:s.fontSize,family:s.fontFamily,height:s.height,line:s.lineHeight,padding:s.padding,transform:s.transform};};
    const colons=[...document.querySelectorAll('.guideLine,.hudItem')].filter(el=>el.querySelector('b')).map(el=>{
      const b=el.querySelector('b'),node=b.firstChild,r=document.createRange();r.setStart(node,node.length-1);r.setEnd(node,node.length);
      const copy=el.cloneNode(true);copy.querySelectorAll('canvas').forEach(icon=>icon.replaceWith('[아이콘]'));
      return{text:copy.textContent,space:r.getBoundingClientRect().width,visible:!!el.getClientRects().length,pseudo:getComputedStyle(b,'::after').content};
    });
    return{width:innerWidth,headings,commonLeft:r.getBoundingClientRect().left,die:rect(die),functional:rect(functional),style:style(die),otherStyle:style(functional),centerDifference:(dr.top+dr.bottom-text.top-text.bottom)/2,lineHeight:die.closest('.guideLine').getBoundingClientRect().height,colons};
  });
  for(const width of [1280,768,390]){
    await page.setViewportSize({width,height:900});await page.waitForTimeout(250);const state=await audit();
    for(const heading of state.headings)assert.ok(Math.abs(heading.left-heading.grid.x)<1,JSON.stringify(heading));
    assert.ok(Math.abs(state.commonLeft-state.headings[0].grid.x)<1,JSON.stringify(state));
    assert.equal(state.die.w,state.functional.w);assert.equal(state.die.h,state.functional.h);assert.deepEqual(state.style,state.otherStyle);assert.ok(Math.abs(state.centerDifference)<2,JSON.stringify(state));assert.equal(state.lineHeight,20);
    for(const row of state.colons){assert.match(row.text,/: [^\s]/);assert.doesNotMatch(row.text,/:\s{2,}|:[^\s]/);if(row.visible)assert.ok(row.space>1);assert.ok(['none','normal'].includes(row.pseudo));}
    // Indentation must not move or resize any existing table.
    const comparison=await page.evaluate(()=>{const grids=[...document.querySelectorAll('#editorJamoList .jamoGrid')],bounds=()=>grids.map(g=>{const r=g.getBoundingClientRect();return[r.x,r.width];});const after=bounds();document.querySelectorAll('.groupLabel,#editorCommonGuide').forEach(el=>el.style.paddingLeft='12.5px');const before=bounds();_syncJamoGridWidth();return{before,after};});assert.deepEqual(comparison.before,comparison.after);geometry.push(state);
  }
  await page.setViewportSize({width:1280,height:1000});await page.waitForTimeout(250);
  await page.evaluate(()=>{_syncJamoGridWidth();document.getElementById('panel').scrollTop=1e6;});
  const snapshot=()=>page.evaluate(()=>JSON.stringify({PARAMS,TEXT,centers:_centerLayout,world:world.bodies.map(b=>[b.anchorX,b.anchorY])}));const before=await snapshot();
  await page.locator('.guideDie').click();await page.locator('.guideDie').dispatchEvent('keydown',{key:'Enter'});assert.equal(await snapshot(),before);
  const accessibility=await page.locator('.guideDie').evaluate(el=>({tab:el.tabIndex,onclick:el.onclick,role:el.getAttribute('role'),label:el.getAttribute('aria-label'),cursor:getComputedStyle(el).cursor}));assert.equal(accessibility.tab,-1);assert.equal(accessibility.onclick,null);assert.equal(accessibility.role,'img');assert.equal(accessibility.label,'주사위');assert.notEqual(accessibility.cursor,'pointer');
  await page.locator('#panel').screenshot({path:'test-results/file-guide-panel.png'});await page.locator('.editor .sidebar').screenshot({path:'test-results/design-alignment.png'});
  // Actual group dice still invoke their own randomizer.
  await page.evaluate(()=>{window.groupCalls=0;Object.keys(_groupRandomizers).forEach(key=>_groupRandomizers[key]=()=>groupCalls++);});await page.locator('#panel .groupTitle .die').first().click();await page.waitForFunction(()=>groupCalls===1);
  const contexts=[];
  for(const device of [
    {name:'desktop',mobile:false,context:{viewport:{width:1280,height:800}}},
    {name:'narrow-desktop',mobile:false,context:{viewport:{width:390,height:844}}},
    {name:'windows-touchscreen',mobile:false,points:10,context:{viewport:{width:1280,height:800},userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36'}},
    {name:'mobile',mobile:true,context:{viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2,userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36'}}
  ]){
    const context=await page.context().browser().newContext(device.context),p=await context.newPage();
    try{
      p.on('pageerror',e=>errors.push(e.message));if(device.points)await p.addInitScript(points=>Object.defineProperty(navigator,'maxTouchPoints',{value:points}),device.points);
      await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());await p.goto(page.url());await p.waitForFunction(()=>typeof world!=='undefined'&&world);
      await p.evaluate(()=>{cancelAnimationFrame(rafId);window._dismissIntro?.();togglePanel();openEditor();});
      const inspect=()=>p.evaluate(()=>{_reapplyGuideLocalizer();return{mobile:_usesMobileGuides(),right:[...document.querySelectorAll('.guideList,.hudItem,[title]')].map(el=>(el.getAttribute('title')||'')+' '+el.textContent).filter(text=>/오른쪽 클릭|길게 탭|우클릭/.test(text))};});
      for(const width of [device.context.viewport.width,760]){
        await p.setViewportSize({width,height:844});await p.evaluate(()=>{resetWorld();buildPanel();});const result=await inspect();assert.equal(result.mobile,device.mobile);assert.ok(result.right.length>2);
        for(const text of result.right){assert.ok(text.includes(device.mobile?'길게 탭':'오른쪽 클릭'),text);assert.ok(!text.includes(device.mobile?'오른쪽 클릭':'길게 탭'),text);assert.ok(!text.includes('우클릭'),text);}
      }
      // Newly opened help is localized without resize or manual refresh.
      await p.evaluate(()=>{const help=document.createElement('div');help.id='freshGuide';help.className='guideList';help.textContent='메뉴: 오른쪽 클릭';document.body.append(help);});
      await p.waitForFunction(mobile=>document.getElementById('freshGuide').textContent==='메뉴: '+(mobile?'길게 탭':'오른쪽 클릭'),device.mobile);
      await p.evaluate(()=>{window.contextActions=0;const el=document.getElementById('freshGuide');Object.assign(el.style,{position:'fixed',top:'10px',left:'10px',zIndex:99999});el.addEventListener('contextmenu',e=>{e.preventDefault();contextActions++;});});
      if(device.mobile){
        const box=await p.locator('#freshGuide').boundingBox(),cdp=await context.newCDPSession(p);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+10,y:box.y+5}]});await p.waitForFunction(()=>contextActions===1);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      }else{await p.locator('#freshGuide').click({button:'right'});assert.equal(await p.evaluate(()=>contextActions),1);}
      // Simulate a real primary input capability change, then restore it.
      if(device.name==='windows-touchscreen'){
        await p.evaluate(()=>{window.originalMatchMedia=matchMedia;window.matchMedia=query=>['(pointer: coarse)','(hover: none)'].includes(query)?{matches:true}:originalMatchMedia(query);dispatchEvent(new Event('resize'));});
        await p.waitForFunction(()=>document.getElementById('freshGuide').textContent==='메뉴: 길게 탭');
        await p.evaluate(()=>{window.matchMedia=originalMatchMedia;dispatchEvent(new Event('resize'));});await p.waitForFunction(()=>document.getElementById('freshGuide').textContent==='메뉴: 오른쪽 클릭');
      }
      contexts.push({name:device.name,...await inspect()});
    }finally{await context.close();}
  }
  fs.writeFileSync('test-results/guides.json',JSON.stringify({geometry,accessibility,contexts},null,2));
  console.log('PASS: all sidebar headings/common guide align without table movement; one literal colon-space; static same-size dice without randomization; real group dice preserved; desktop/mobile/touchscreen guide copy, resize and dynamic help');
}).catch(e=>{console.error(e);process.exitCode=1;});
