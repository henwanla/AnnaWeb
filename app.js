'use strict';
(function (root) {
  const products = Object.freeze({clack:'Clack fan',bamboo:'Bamboo fan',led:'LED fan',pvc:'PVC fan','stock-bamboo':'Stock bamboo fan','stock-clack':'Stock clack fan'});
  function wholeNumber(value, name) {
    const s = String(value ?? '').trim();
    if (!s) return {text:'To confirm', value:null};
    if (!/^\d+$/.test(s) || !Number.isSafeInteger(Number(s)) || Number(s) < 1) throw new Error(name + ' must be a positive whole number.');
    return {text:String(Number(s)), value:Number(s)};
  }
  function buildBrief(data) {
    if (!Object.hasOwn(products,data.model)) throw new Error('Choose a product format first.');
    const qty=wholeNumber(data.quantity,'Total quantity');
    const designs=wholeNumber(data.designs,'Number of designs');
    if (qty.value !== null && designs.value !== null && designs.value > qty.value) throw new Error('The number of designs cannot exceed the number of fans.');
    const date=String(data.usable || '').trim();
    if (date) {
      const parsed=new Date(date+'T00:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10)!==date) throw new Error('Use a valid usable-by date.');
    }
    const notes=String(data.notes || '').trim().slice(0,2000);
    return ['FANIQUE — PROJECT OUTLINE','Product format: '+products[data.model],'Total quantity: '+qty.text,'Number of designs: '+designs.text,'Quantity per design: To confirm separately','Intended use: '+(String(data.purpose || '').trim() || 'To confirm'),'Usable-by date: '+(date || 'To confirm'),'Details and questions: '+(notes || 'To confirm'),'','Still to confirm: actual model/specifications; customisation area and sides; minimum per design; artwork/sample approval; packing; receiving point; included and separate costs; production and transport conditions.','','Prepared locally in a design preview. No enquiry has been sent and no order has been placed.'].join('\n');
  }
  const api={buildBrief,wholeNumber,products};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  if (!root.document) return;
  const d=root.document;
  const toggle=d.querySelector('.menu-toggle'),nav=d.getElementById('main-nav');
  const closeMenu=()=>{nav.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');};
  toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open);});
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  d.addEventListener('keydown',e=>{if(e.key==='Escape' && toggle.getAttribute('aria-expanded')==='true'){closeMenu();toggle.focus();}});
  const cards=[...d.querySelectorAll('.product-card')];
  d.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
    d.querySelectorAll('[data-filter]').forEach(b=>{const on=b===button;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
    let count=0;cards.forEach(card=>{const shown=button.dataset.filter==='all'||card.dataset.group===button.dataset.filter;card.hidden=!shown;if(shown)count++;});
    d.getElementById('catalog-status').textContent='Showing '+count+' product formats';
  }));
  const model=d.getElementById('model');
  function highlight(){cards.forEach(card=>{const b=card.querySelector('[data-product]');const on=b.dataset.product===model.value;card.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});}
  d.querySelectorAll('[data-product]').forEach(button=>{button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{model.value=button.dataset.product;invalidate();highlight();d.getElementById('project').scrollIntoView({behavior:root.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});model.focus({preventScroll:true});});});
  model.addEventListener('change',highlight);
  const form=d.getElementById('brief-form'),status=d.getElementById('brief-status'),output=d.getElementById('brief-output'),text=d.getElementById('brief-text');
  function invalidate(){output.hidden=true;text.value='';status.textContent='';}
  form.addEventListener('input',invalidate);form.addEventListener('change',invalidate);
  form.addEventListener('submit',e=>{e.preventDefault();try{const data=Object.fromEntries(new root.FormData(form).entries());text.value=buildBrief(data);output.hidden=false;status.textContent='Outline prepared on this device. Nothing has been sent.';}catch(err){output.hidden=true;text.value='';status.textContent=err.message;}});
  d.getElementById('copy-brief').addEventListener('click',async()=>{if(output.hidden || !text.value)return;try{await root.navigator.clipboard.writeText(text.value);status.textContent='Outline copied. No enquiry has been sent.';}catch{ text.focus();text.select();status.textContent='Select the outline and copy it using your device’s copy command.'; }});
})(typeof window !== 'undefined' ? window : globalThis);
