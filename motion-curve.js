/* Bounded, piecewise cubic time -> progress curves. No DOM dependency. */
(function(root){
  'use strict';
  const copy=p=>JSON.parse(JSON.stringify(p));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
  const defaults=()=>[{x:0,y:0,in:null,out:{x:.42,y:0}},{x:1,y:1,in:{x:.58,y:1},out:null}];
  const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  function normalize(points){
    if(!Array.isArray(points)||points.length<2||points.length>64)return defaults();
    const p=copy(points),gap=.001;
    p.forEach((a,i)=>{a.x=i===0?0:i===p.length-1?1:clamp(a.x,p[i-1].x+gap,1-(p.length-1-i)*gap);a.y=i===0?0:i===p.length-1?1:clamp(a.y,0,1);});
    p[0].in=null;p[p.length-1].out=null;
    for(let i=0;i<p.length-1;i++){
      const a=p[i],b=p[i+1];a.out=a.out||{x:a.x,y:a.y};b.in=b.in||{x:b.x,y:b.y};
      a.out={x:clamp(a.out.x,a.x,b.x),y:clamp(a.out.y,0,1)};
      b.in={x:clamp(b.in.x,a.x,b.x),y:clamp(b.in.y,0,1)};
      if(a.out.x>b.in.x)a.out.x=b.in.x=(a.out.x+b.in.x)/2;
    }
    return p;
  }
  function at(a,b,u){const v=1-u;return{x:v*v*v*a.x+3*v*v*u*a.out.x+3*v*u*u*b.in.x+u*u*u*b.x,y:v*v*v*a.y+3*v*v*u*a.out.y+3*v*u*u*b.in.y+u*u*u*b.y};}
  function solve(a,b,x){let lo=0,hi=1;for(let i=0;i<32;i++){const m=(lo+hi)/2;if(at(a,b,m).x<x)lo=m;else hi=m;}return(lo+hi)/2;}
  function evaluate(points,t){
    if(!Number.isFinite(t)||t<=1e-9)return 0;if(t>=1-1e-9)return 1;
    let i=0;while(i<points.length-2&&points[i+1].x<t)i++;
    return clamp(at(points[i],points[i+1],solve(points[i],points[i+1],t)).y,0,1);
  }
  function insert(points,x,y){
    const p=copy(points);x=clamp(x,0,1);
    if(p.length>=64||p.some(a=>Math.abs(a.x-x)<.015))return p;
    let i=0;while(i<p.length-2&&p[i+1].x<x)i++;
    const a=p[i],b=p[i+1],u=solve(a,b,x),q0=mix(a,a.out,u),q1=mix(a.out,b.in,u),q2=mix(b.in,b,u),r0=mix(q0,q1,u),r1=mix(q1,q2,u),s=mix(r0,r1,u);
    a.out=q0;b.in=q2;
    const dy=Number.isFinite(y)?clamp(y,0,1)-s.y:0;
    p.splice(i+1,0,{x:s.x,y:s.y+dy,in:{x:r0.x,y:r0.y+dy},out:{x:r1.x,y:r1.y+dy}});
    return normalize(p);
  }
  function movePoint(points,i,x,y){
    if(i<=0||i>=points.length-1)return copy(points);
    const p=copy(points),a=p[i];x=clamp(x,p[i-1].x+.015,p[i+1].x-.015);y=clamp(y,0,1);
    for(const side of ['in','out'])if(a[side]){a[side].x+=x-a.x;a[side].y+=y-a.y;}a.x=x;a.y=y;return normalize(p);
  }
  function moveHandle(points,i,side,x,y){
    const p=copy(points),a=p[i];if(!a?.[side])return p;
    const lo=side==='in'?p[i-1].out.x:a.x,hi=side==='out'?p[i+1].in.x:a.x;
    a[side]={x:clamp(x,lo,hi),y:clamp(y,0,1)};return normalize(p);
  }
  function pull(points,i,dx,dy){
    const p=copy(points),a=p[i],sides=['in','out'].filter(s=>a[s]);
    const folded=sides.filter(s=>Math.hypot(a[s].x-a.x,a[s].y-a.y)<1e-6),chosen=folded.length?folded:sides;
    const sign=dx<0?-1:1;dx=Math.abs(dx);dy*=sign;
    for(const side of chosen){const s=side==='in'?-1:1;a[side]={x:a.x+s*dx,y:a.y+s*dy};}return normalize(p);
  }
  function corner(points,i){const p=copy(points),a=p[i];for(const side of ['in','out'])if(a[side])a[side]={x:a.x,y:a.y};return p;}
  function remove(points,i){const p=copy(points);if(i>0&&i<p.length-1)p.splice(i,1);return normalize(p);}
  const api={defaults,copy,normalize,evaluate,insert,movePoint,moveHandle,pull,corner,remove};
  if(typeof module!=='undefined')module.exports=api;else root.MHCurve=api;
})(typeof window==='undefined'?this:window);
