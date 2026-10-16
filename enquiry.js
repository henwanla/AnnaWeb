'use strict';
(function (root) {
  function responseState(status, data) {
    if(status>=200 && status<300 && data && data.ok===true)return {kind:'accepted',message:'Thank you. Your enquiry has been submitted. Your details remain on this page.'};
    if(status===429)return {kind:'error',message:'The enquiry service is busy. Wait before trying again, or use WhatsApp. Your details remain on this page.'};
    const errors=data && Array.isArray(data.errors)?data.errors:[];
    return {kind:'error',message:errors.length?'Please check the enquiry details below. Your input remains on this page.':'We could not confirm receipt. Your details remain on this page. If you use WhatsApp, mention that you tried this form.',errors};
  }
  if(typeof module!=='undefined' && module.exports)module.exports={responseState};
  if(!root.document)return;
  const d=root.document;
  d.querySelectorAll('[data-enquiry-form]').forEach(form=>{
    const button=form.querySelector('[type="submit"]'),status=form.querySelector('.enquiry-status'),label=button.textContent;
    let pending=false;
    function clearErrors(){
      form.querySelectorAll('.enquiry-field-error').forEach(n=>n.remove());
      form.querySelectorAll('[aria-invalid]').forEach(n=>{n.removeAttribute('aria-invalid');n.removeAttribute('aria-describedby');});
    }
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(pending)return;
      clearErrors();if(!form.reportValidity())return;
      const data=new root.FormData(form),submittedVersion=JSON.stringify([...data.entries()]),url=new URL(root.location.href);url.search='';
      data.set('source_page',url.href);
      const controller=new root.AbortController();
      pending=true;button.disabled=true;button.textContent='Sending enquiry…';form.setAttribute('aria-busy','true');status.textContent='Submitting your enquiry…';
      const timeout=root.setTimeout(()=>controller.abort(),20000);
      try{
        const response=await root.fetch(form.action,{method:'POST',body:data,headers:{Accept:'application/json'},signal:controller.signal});
        const json=await response.json().catch(()=>null);const result=responseState(response.status,json);
        const changed=result.kind==='accepted' && JSON.stringify([...new root.FormData(form).entries()])!==submittedVersion;
        status.textContent=changed?'Your earlier enquiry was submitted. Changes made while it was sending have not been sent.':result.message;
        let first=null;
        for(const error of result.errors || []){
          const field=typeof error.field==='string'?form.elements.namedItem(error.field):null;
          if(!field || !field.id || typeof field.setAttribute!=='function')continue;
          const hint=d.createElement('p');hint.className='enquiry-field-error field-hint';hint.id=field.id+'-error';hint.textContent=String(error.message || 'Check this field.');field.after(hint);field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby',hint.id);if(!first)first=field;
        }
        if(first)first.focus();else if(result.kind!=='accepted')status.focus();
      }catch{
        status.textContent='We could not confirm receipt. Your details remain on this page. If you use WhatsApp, mention that you tried this form.';status.focus();
      }finally{
        root.clearTimeout(timeout);pending=false;button.disabled=false;button.textContent=label;form.removeAttribute('aria-busy');
      }
    });
  });
})(typeof window!=='undefined'?window:globalThis);
