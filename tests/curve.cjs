const assert=require('node:assert/strict'),curve=require('../motion-curve.js');
const p=curve.defaults();assert.equal(curve.evaluate(p,0),0);assert.equal(curve.evaluate(p,1),1);assert.ok(Math.abs(curve.evaluate(p,.5)-.5)<1e-8);
const split=curve.insert(p,.4);assert.equal(split.length,3);
for(let i=0;i<=100;i++)assert.ok(Math.abs(curve.evaluate(p,i/100)-curve.evaluate(split,i/100))<1e-8);
let corner=curve.corner(curve.corner(p,0),1);
for(let i=0;i<=100;i++)assert.ok(Math.abs(curve.evaluate(corner,i/100)-i/100)<1e-8);
const restored=curve.pull(corner,0,.25,0);assert.ok(restored[0].out.x>0);assert.deepEqual(restored[1].in,{x:1,y:1});
let edited=curve.insert(p,.4,.8);edited=curve.movePoint(edited,1,2,-3);edited=curve.moveHandle(edited,1,'in',-9,NaN);edited=curve.moveHandle(edited,1,'out',99,99);
for(let i=0;i<edited.length-1;i++){const a=edited[i],b=edited[i+1];assert.ok(a.x<b.x&&a.out.x>=a.x&&a.out.x<=b.in.x&&b.in.x<=b.x);}
for(let i=0;i<=1000;i++){const v=curve.evaluate(edited,i/1000);assert.ok(Number.isFinite(v)&&v>=0&&v<=1);}
assert.deepEqual(curve.movePoint(edited,0,.5,.5),edited);assert.deepEqual(curve.movePoint(edited,edited.length-1,.5,.5),edited);
assert.equal(curve.remove(edited,1).length,2);assert.deepEqual(curve.remove(p,0),p);
assert.equal(curve.evaluate(p,NaN),0);assert.deepEqual(curve.normalize(null),p);
console.log('PASS: piecewise cubic split preserves path, monotone time, bounded progress, corner/restore, fixed endpoints and invalid input guards');
