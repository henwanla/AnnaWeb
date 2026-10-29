
(function(){'use strict';
 const form=document.getElementById('fit-form'),unit=document.getElementById('unit'),result=document.getElementById('result');
 const item=['item-l','item-w','item-h'].map(id=>document.getElementById(id));
 const box=['box-l','box-w','box-h'].map(id=>document.getElementById(id));
 const gap=document.getElementById('clearance'),copyArea=document.getElementById('copy-area'),summary=document.getElementById('summary'),copyStatus=document.getElementById('copy-status');let previous=unit.value;
 const round=n=>{const value=Number(n.toFixed(6));return n!==0&&value===0?n.toExponential(6):String(value);};
 function message(title,text){result.replaceChildren();const h=document.createElement('h2'),p=document.createElement('p');h.textContent=title;p.textContent=text;result.append(h,p);result.hidden=false;}
 function invalidate(){result.hidden=true;copyArea.hidden=true;summary.value='';copyStatus.textContent='';}
 for(const field of [...item,...box,gap])field.addEventListener('input',invalidate);
 document.getElementById('copy-summary').addEventListener('click',async()=>{try{if(!navigator.clipboard||typeof navigator.clipboard.writeText!=='function')throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(summary.value);copyStatus.textContent='Copied. Paste it into your message when ready.';}catch(_){summary.focus();summary.select();copyStatus.textContent='Copy is unavailable here. Select the summary above and copy it manually.';}});
 unit.addEventListener('change',()=>{const factor=previous==='mm'?1/25.4:25.4;for(const field of [...item,...box,gap]){if(field.value!==''){const n=Number(field.value);if(Number.isFinite(n))field.value=round(n*factor);}}previous=unit.value;invalidate();});
 form.addEventListener('reset',()=>{invalidate();previous='mm';});
 document.getElementById('example').addEventListener('click',()=>{unit.value='mm';previous='mm';[72,50,28].forEach((v,i)=>item[i].value=v);[100,80,40].forEach((v,i)=>box[i].value=v);gap.value=2;calculate();});
 function calculate(){
  const values=[...item,...box].map(x=>x.value===''?NaN:Number(x.value));const clearance=gap.value===''?0:Number(gap.value);
  if(values.some(v=>!Number.isFinite(v)||v<=0)||!Number.isFinite(clearance)||clearance<0){invalidate();message('Check your measurements','Enter a positive number for each item and box dimension, and zero or more for clearance.');return;}
  const a=values.slice(0,3),b=values.slice(3),perms=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  const required=a.map(n=>n+2*clearance);
  if(required.some(n=>!Number.isFinite(n))){invalidate();message('Check your measurements','The measurements are too large to calculate. Enter smaller, realistic dimensions.');return;}
  const tolerance=(x,y)=>Number.EPSILON*Math.max(Number.MIN_VALUE,Math.abs(x),Math.abs(y))*4;
  const matches=perms.filter(p=>p.every((n,i)=>required[n]<=b[i]+tolerance(required[n],b[i])));
  const labels=['item length','item width','item height'];
  let shortfall='';
  if(matches.length){const p=matches[0];message('A dimension match is possible',`At least one axis alignment fits with ${round(clearance)} ${unit.value} clearance on each side. One alignment: ${labels[p[0]]} along box length, ${labels[p[1]]} along box width, and ${labels[p[2]]} along box height. Check the real item, insert, opening and closure on a sample.`);}
  else {
   const candidates=perms.map(p=>({p,missing:p.map((n,i)=>Math.max(0,required[n]-b[i]))}));
   const best=candidates.reduce((x,y)=>y.missing.reduce((s,v)=>s+v/3,0)<x.missing.reduce((s,v)=>s+v/3,0)?y:x);
   const show=round;
   shortfall=`One alignment with the smallest total shortfall: ${labels[best.p[0]]} along box length, ${labels[best.p[1]]} along box width, and ${labels[best.p[2]]} along box height. Extra usable space needed: length ${show(best.missing[0])}, width ${show(best.missing[1])}, height ${show(best.missing[2])} ${unit.value}.`;
   message('No axis alignment fits',shortfall+' This is a rectangular comparison, not a recommended box size. Check the sample, opening and protection.');
  }
  const dimensions=v=>v.map(round).join(' × ')+' '+unit.value;
  summary.value='Item overall: '+dimensions(a)+'\nUsable inner space: '+dimensions(b)+'\nClearance per side: '+round(clearance)+' '+unit.value+'\nResult: '+(matches.length?'dimension match possible':'no axis alignment fits')+(shortfall?'\n'+shortfall:'')+'\nPlease confirm the insert, opening and sample.';
  copyStatus.textContent='';copyArea.hidden=false;return true;
 }
 form.addEventListener('submit',e=>{e.preventDefault();if(calculate())document.dispatchEvent(new Event('luvypack:fit-calculated'));});
}());

