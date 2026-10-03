const assert=require('node:assert/strict'),fs=require('node:fs');const {run,configure}=require('./helpers.cjs');
run(async page=>{
  await configure(page);const cases=[];
  for(const width of [1280,768,390]){
    await page.setViewportSize({width,height:844});
    const result=await page.evaluate(()=>{
      const icon=document.getElementById('hudCenterPreview'),row=icon.parentElement,hud=document.getElementById('hudMain');
      const geometry=()=>({rowHeight:row.getBoundingClientRect().height,rowTop:row.getBoundingClientRect().top,nextTop:row.nextElementSibling.getBoundingClientRect().top,hudHeight:hud.getBoundingClientRect().height,iconWidth:icon.getBoundingClientRect().width,iconTop:icon.getBoundingClientRect().top,iconBottom:icon.getBoundingClientRect().bottom,layoutWidth:icon.offsetWidth});
      const enlarged=geometry();icon.style.transform='none';const before=geometry();icon.style.removeProperty('transform');
      return{width:innerWidth,before,enlarged,aria:icon.getAttribute('aria-hidden'),centerRadius:_centerRadius()};
    });
    for(const key of ['rowHeight','rowTop','nextTop','hudHeight','layoutWidth'])assert.equal(result.before[key],result.enlarged[key],key);
    assert.equal(result.enlarged.iconWidth/result.before.iconWidth,1.5);assert.ok(result.enlarged.iconTop>=result.enlarged.rowTop&&result.enlarged.iconBottom<=result.enlarged.nextTop,JSON.stringify(result));assert.equal(result.aria,'true');assert.equal(result.centerRadius,15);cases.push(result);
  }
  await page.locator('#hudMain').screenshot({path:'test-results/release-guide.png'});
  fs.writeFileSync('test-results/guide-scale.json',JSON.stringify(cases,null,2));console.log('PASS: 1.5x guide diamond at 1280/768/390px, identical row/next-row/HUD geometry, no icon overlap, unchanged artwork handle');
}).catch(e=>{console.error(e);process.exitCode=1;});
