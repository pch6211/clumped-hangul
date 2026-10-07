const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const source=fs.readFileSync('index.html','utf8').replaceAll('\r\n','\n');
const section=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
const functions=['drawSmoothedBodies','drawBorders'];
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
// New polygon branches are independently tested; legacy rendering remains byte-identical.
const legacy=s=>s.replace(/^\s*if\(_pointShapeMode==='sides'\)\{_paintPointShape\([^\n]+return;\}\r?\n/gm,'');
const snapshot=s=>({functions:Object.fromEntries(functions.map(name=>[name,hash(legacy(s.match(new RegExp('^function '+name+'\\([\\s\\S]*?^\\}','m'))[0]))])),autoSpacing:hash(section(s,'  // 6) 자간 / 행간','  // 7) 각도/회전')),pngBody:hash(section(s,'  const fg = currentFgColor();\n  drawBorders(octx','  off.toBlob(blob => {').trim())});
if(process.env.UPDATE_SCOPE_FIXTURE){const old=cp.execFileSync('git',['show','512753b:index.html'],{maxBuffer:2e6,encoding:'utf8'}).replaceAll('\r\n','\n');fs.writeFileSync('tests/fixtures/scope.json',JSON.stringify({source:'512753b',...snapshot(old)},null,2));}
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/scope.json','utf8'));
const current=snapshot(source);assert.deepEqual(current.functions,fixture.functions);assert.equal(current.autoSpacing,fixture.autoSpacing);
const png=legacy(section(source,'function _renderArtwork(octx, bbox) {','function savePNG()').replace('function _renderArtwork(octx, bbox) {','').trim().replace(/\}\s*$/,'').trim());assert.equal(hash(png),fixture.pngBody);
for(const absent of ['_modulation','_recordMode','_easePoints','MHCurve','_smoothViewport','_smBlurPixels','배치 초기화'])assert.ok(!source.includes(absent),absent);
assert.ok(!fs.existsSync('motion-curve.js'));assert.match(source,/시작 시 R[\s\S]{0,150}randomizeAll\(\)/);
console.log('PASS: original smoothing/border code, PNG rendering pixels source, recommended auto-spacing formula, startup flow; no advanced recorder/curves');
