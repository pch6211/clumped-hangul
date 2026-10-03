const assert=require('node:assert/strict'),fs=require('node:fs');const {run,configure}=require('./helpers.cjs');
run(async page=>{
  await configure(page);await page.evaluate(()=>togglePanel());page.on('dialog',d=>d.accept());
  const status=scope=>page.locator(scope==='design'?'#designStatus':'#recordStatus').textContent();
  const download=async(fn,path)=>{const event=page.waitForEvent('download');await page.evaluate(fn);const file=await event;await file.saveAs(path);return file;};
  for(const [fn,label,file] of [[()=>saveSVG(),'SVG','files.svg'],[()=>savePNG(),'PNG','files.png'],[()=>saveSettings(),'설정값','files-settings.json']]){
    await download(fn,'test-results/'+file);await page.waitForFunction(label=>document.getElementById('recordStatus').textContent===label+'을 저장했습니다.'||document.getElementById('recordStatus').textContent===label+'를 저장했습니다.',label);
  }
  await page.evaluate(()=>openEditor());await download(()=>exportPrimitivesJSON(),'test-results/files-design.json');assert.equal(await status('design'),'문자 디자인을 저장했습니다.');
  for(const scope of ['main','design']){
    const choose=async()=>{const event=page.waitForEvent('filechooser');await page.evaluate(scope=>scope==='main'?triggerSettingsLoad():triggerJamoLoad(),scope);return event;};
    const prefix=scope==='main'?'설정값':'문자 디자인';
    // Cancellation clears the loading notice and releases the pending chooser.
    await choose();assert.equal(await status(scope),prefix+'을 불러옵니다.');
    await page.evaluate(scope=>_fileLoads[scope].dispatchEvent(new Event('cancel')),scope);assert.equal(await status(scope),'');assert.equal(await page.evaluate(scope=>_fileLoads[scope]===null,scope),true);
    for(let i=0;i<2;i++){
      const chooser=await choose();await chooser.setFiles('test-results/files-'+(scope==='main'?'settings':'design')+'.json');
      await page.waitForFunction(scope=>_fileLoads[scope]===null,scope);assert.equal(await status(scope),prefix+'을 불러옵니다.');
    }
    for(const content of ['{broken','{}']){
      const chooser=await choose();await chooser.setFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(content)});
      await page.waitForFunction(scope=>_fileLoads[scope]===null,scope);assert.match(await status(scope),/불러오지 못했습니다/);
    }
    // Read errors and superseding actions cannot leave a loading/success notice behind.
    await page.evaluate(()=>{window.OriginalReader=FileReader;window.pendingReaders=[];window.FileReader=class{readyState=0;readAsText(){this.readyState=1;pendingReaders.push(this);}abort(){this.readyState=2;this.onabort?.();}};});
    const fail=await choose();await fail.setFiles({name:'read.json',mimeType:'application/json',buffer:Buffer.from('{}')});
    await page.evaluate(()=>pendingReaders.at(-1).onerror());assert.match(await status(scope),/파일 읽기에 실패/);
    const first=await choose();await first.setFiles({name:'pending.json',mimeType:'application/json',buffer:Buffer.from('{}')});
    const old=await page.evaluate(()=>pendingReaders.length-1);await choose();
    await page.evaluate(old=>pendingReaders[old].onabort?.(),old);assert.equal(await page.evaluate(scope=>!!_fileLoads[scope],scope),true);
    await page.evaluate(scope=>_fileLoads[scope].dispatchEvent(new Event('cancel')),scope);assert.equal(await status(scope),'');
    await page.evaluate(()=>{window.FileReader=window.OriginalReader;});
  }
  // A late PNG callback must not overwrite the latest settings-save result.
  await page.evaluate(()=>{window.originalToBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(cb){window.pendingPNG=cb;};savePNG();});
  await download(()=>saveSettings(),'test-results/files-latest.json');await page.evaluate(()=>pendingPNG(null));assert.equal(await status('main'),'설정값을 저장했습니다.');
  await page.evaluate(()=>savePNG());await page.evaluate(()=>pendingPNG(null));assert.match(await status('main'),/PNG를 저장하지 못했습니다/);
  await page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=window.originalToBlob;window.originalDownload=_downloadBlob;_downloadBlob=()=>{throw Error('download blocked');};});
  for(const [fn,scope] of [[()=>saveSVG(),'main'],[()=>saveSettings(),'main'],[()=>exportPrimitivesJSON(),'design']]){await page.evaluate(fn);assert.match(await status(scope),/저장하지 못했습니다/);}
  await page.evaluate(()=>{_downloadBlob=window.originalDownload;_startRecording();});await page.waitForFunction(()=>_recording?.frames.length);
  await download(()=>savePNG(),'test-results/files-recording.png');assert.equal(await status('main'),'녹화 중 · PNG를 저장했습니다.');
  await download(()=>exportPrimitivesJSON(),'test-results/files-recording-design.json');assert.equal(await status('main'),'녹화 중 · PNG를 저장했습니다.');
  await page.evaluate(()=>buildPanel());assert.equal(await status('main'),'녹화 중 · PNG를 저장했습니다.');
  await download(()=>_stopRecording(),'test-results/files.mov');await page.waitForFunction(()=>!_recording);assert.match(await status('main'),/MOV.*저장/);
  const style=await page.evaluate(()=>['recordStatus','designStatus'].map(id=>{const el=document.getElementById(id),s=getComputedStyle(el);return{font:s.fontSize,line:s.lineHeight,margin:s.marginTop,role:el.getAttribute('role')};}));assert.deepEqual(style[0],style[1]);
  fs.writeFileSync('test-results/file-notices.json',JSON.stringify({status:await status('main'),style},null,2));
  console.log('PASS: six file notices, real downloads, same-file reload, cancel, invalid JSON/schema, read/encode/download errors, stale callbacks, MOV priority and panel rebuild');
}).catch(e=>{console.error(e);process.exitCode=1;});
