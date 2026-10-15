'use strict';
(function (root) {
  const products = Object.freeze({clack:'33cm Clack Fan',bamboo:'21cm Bamboo Fan',led:'LED 33cm Fan',pvc:'23cm PVC Fan','stock-bamboo':'21cm Stock Bamboo Fan','stock-clack':'33cm Stock Clack Fan'});
  const whatsappNumber = '8613205010910';
  function contactMessage(data = {}, source = '') {
    const lines = ["Hello Fanique, I'd like to discuss a hand fan project."];
    if (Object.hasOwn(products, data.model)) lines.push('Product: ' + products[data.model]);
    const purpose = String(data.purpose || '').trim().slice(0,120);
    if (purpose) lines.push('Intended use: ' + purpose);
    const topic = String(data.topic || '').trim().slice(0,120);
    if (topic) lines.push('Question: ' + topic);
    if (source) lines.push('Page: ' + source);
    return lines.join('\n');
  }
  function whatsappUrl(message) {
    return 'https://wa.me/' + whatsappNumber + '?text=' + encodeURIComponent(message);
  }
  function briefError(message, field) {
    return Object.assign(new Error(message), {field});
  }
  function wholeNumber(value, name, field) {
    const s = String(value ?? '').trim();
    if (!s) return {text:'To confirm', value:null};
    if (!/^\d+$/.test(s) || !Number.isSafeInteger(Number(s)) || Number(s) < 1) throw briefError(name + ' must be a positive whole number.', field);
    return {text:String(Number(s)), value:Number(s)};
  }
  function buildBrief(data) {
    if (!Object.hasOwn(products,data.model)) throw briefError('Choose a product format first.', 'model');
    const qty=wholeNumber(data.quantity,'Total quantity', 'quantity');
    const designs=wholeNumber(data.designs,'Number of designs', 'designs');
    if (qty.value !== null && designs.value !== null && designs.value > qty.value) throw briefError('The number of designs cannot exceed the number of fans.', 'designs');
    const notes=String(data.notes || '').trim().slice(0,2000);
    return ['FANIQUE — PROJECT OUTLINE','Product format: '+products[data.model],'Total quantity: '+qty.text,'Number of designs: '+designs.text,'Quantity per design: To confirm separately','Intended use: '+(String(data.purpose || '').trim() || 'To confirm'),'Details and questions: '+(notes || 'To confirm'),'','Still to confirm: actual model/specifications; customisation area and sides; minimum per design; artwork/sample approval; packing; receiving point; included and separate costs; production and transport conditions.','','Prepared locally in a design preview. No enquiry has been sent and no order has been placed.'].join('\n');
  }
  const api={buildBrief,wholeNumber,products,contactMessage,whatsappUrl,whatsappNumber};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  if (!root.document) return;
  const d=root.document;
  const toggle=d.querySelector('.menu-toggle'),nav=d.getElementById('main-nav');
  const closeMenu=()=>{nav.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');};
  toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open);});
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  d.addEventListener('keydown',e=>{if(e.key==='Escape' && toggle.getAttribute('aria-expanded')==='true'){closeMenu();toggle.focus();}});
  nav.classList.add('menu-ready');
  toggle.classList.add('menu-ready');
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
  const source = new URL(root.location.href);
  source.search='';source.hash='';
  if (!['https:', 'http:'].includes(source.protocol)) {
    const page=source.pathname.split('/').pop();
    source.href='https://henwanla.github.io/AnnaWeb/'+(['night.html','atelier.html','pop.html','classic.html'].includes(page)?page:'');
  }
  function refreshContacts() {
    const purpose=d.getElementById('purpose').value;
    d.querySelectorAll('[data-whatsapp="contact"]').forEach(link=>{
      link.href=whatsappUrl(contactMessage({model:link.dataset.waProduct || model.value,purpose:link.dataset.waPurpose || purpose,topic:link.dataset.waTopic},source.href));
    });
  }
  function clearBriefErrors() {
    ['model','quantity','designs','purpose','notes'].forEach(id=>{
      const field=d.getElementById(id);
      field.removeAttribute('aria-invalid');
      const descriptions=(field.getAttribute('aria-describedby') || '').split(/\s+/).filter(id=>id && id!=='brief-status');
      if(descriptions.length) field.setAttribute('aria-describedby',descriptions.join(' '));
      else field.removeAttribute('aria-describedby');
    });
  }
  function readBriefData() {
    for (const [id, name] of [['quantity','Total quantity'],['designs','Number of designs']]) {
      const field=d.getElementById(id);
      if(field.validity.badInput) throw briefError(name + ' must be a positive whole number.',id);
    }
    return Object.fromEntries(new root.FormData(form).entries());
  }
  function invalidate(){output.hidden=true;text.value='';status.textContent='';clearBriefErrors();refreshContacts();}
  refreshContacts();
  form.addEventListener('input',invalidate);form.addEventListener('change',invalidate);
  form.addEventListener('submit',e=>{e.preventDefault();clearBriefErrors();try{text.value=buildBrief(readBriefData());d.getElementById('whatsapp-brief').href=whatsappUrl(text.value+'\nPage: '+source.href);output.hidden=false;status.textContent='Outline ready. Copy it or open it in WhatsApp to review and send.';}catch(err){output.hidden=true;text.value='';status.textContent=err.message;const field=err.field && d.getElementById(err.field);if(field){field.setAttribute('aria-invalid','true');const descriptions=(field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);field.setAttribute('aria-describedby',[...new Set([...descriptions,'brief-status'])].join(' '));field.focus();}}});
  d.getElementById('copy-brief').addEventListener('click',async()=>{if(output.hidden || !text.value)return;try{await root.navigator.clipboard.writeText(text.value);status.textContent='Outline copied. No enquiry has been sent.';}catch{ text.focus();text.select();status.textContent='Select the outline and copy it using your device’s copy command.'; }});
  // Enable local-only inputs only after submission prevention and all handlers exist.
  form.querySelectorAll('[data-brief-control]').forEach(control=>{control.disabled=false;});
  form.dataset.briefReady='true';
  form.removeAttribute('aria-describedby');
  d.getElementById('brief-readiness').hidden=true;
})(typeof window !== 'undefined' ? window : globalThis);
