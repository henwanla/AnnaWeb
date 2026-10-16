'use strict';
(function(root){
  if(!root.document)return;
  const d=root.document,rooms=[...d.querySelectorAll('[data-gallery-room]')],slides=[...d.querySelectorAll('[data-fan-slide]')],thumbs=[...d.querySelectorAll('[data-fan-link]')];
  const dialog=d.getElementById('gallery-dialog'),slot=dialog.querySelector('.dialog-content'),close=dialog.querySelector('.dialog-close');
  if(typeof dialog.showModal!=='function')return;
  const page=new URL(root.location.href);page.hash='';page.search='';
  let active=0,room='fans',story=null,opener=null,viewed='Fanique visual gallery',viewedURL=page.href;
  function isAvailable(node){return node && node.isConnected && !node.closest('[hidden]');}
  function updateContact(){
    d.querySelectorAll('[data-gallery-contact="live"]').forEach(link=>{link.href='https://wa.me/8613205010910?'+new URLSearchParams({text:'Hello Fanique, I have a question.\nViewing: '+viewed+'\nPage: '+viewedURL});});
  }
  function setViewed(label,key){
    viewed=label;const url=new URL(page.href);url.hash=key;viewedURL=url.href;updateContact();
  }
  function setHash(hash,replace=true){const url=new URL(root.location.href);url.hash=hash;if(url.href!==root.location.href)root.history[replace?'replaceState':'pushState'](null,'',url);}
  function showRoom(id,update=false){
    room=rooms.some(n=>n.id===id)?id:'fans';rooms.forEach(n=>{n.hidden=n.id!==room;});
    d.querySelectorAll('[data-room-link]').forEach(a=>{if(a.dataset.roomLink===room)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    setViewed(room==='fans'?slides[active].dataset.context:room==='occasions'?'Occasion images':'Published making images',room==='fans'?slides[active].id:room);if(update)setHash(room,false);
  }
  function showFan(index,update=true,animate=true){
    active=(index+slides.length)%slides.length;
    slides.forEach((n,i)=>{n.hidden=i!==active;n.classList.remove('is-turning');});
    thumbs.forEach((a,i)=>{if(i===active)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});
    if(animate)slides[active].classList.add('is-turning');
    d.getElementById('fan-position').textContent=(active+1)+' / '+slides.length;
    if(room==='fans')setViewed(slides[active].dataset.context,slides[active].id);
    if(update)setHash('fan-'+slides[active].dataset.fanSlide);
  }
  function closeStory(){if(dialog.open)dialog.close();}
  function restoreContent(){
    if(dialog.open)return;
    if(story){const content=slot.firstElementChild;if(content)story.appendChild(content);story=null;}
    d.body.classList.remove('modal-open');
    const target=isAvailable(opener)?opener:d.querySelector('[data-room-link="'+room+'"]');if(target)target.focus({preventScroll:true});opener=null;
  }
  dialog.addEventListener('close',restoreContent);
  close.addEventListener('click',closeStory);
  dialog.addEventListener('click',e=>{if(e.target===dialog)closeStory();});
  function openStory(details,trigger){
    // Without native dialogs keep the original disclosure path working.
    if(typeof dialog.showModal!=='function'){details.open=true;details.scrollIntoView({block:'start'});return;}
    // Swap the live content without closing/reopening the modal. A native close
    // event is queued, so reopening before it arrives can restore the wrong node.
    if(story){const previous=slot.firstElementChild;if(previous)story.appendChild(previous);story=null;}
    story=details;opener=trigger;const content=details.querySelector(':scope > .story-content');
    if(details.id==='email'){
      content.querySelector('[name="viewed_item"]').value=viewed;
      content.querySelector('[name="source_page"]').value=viewedURL;
      content.querySelector('.enquiry-context').textContent='Viewing: '+viewed+'. You can ask a question without choosing a format or quantity.';
    }else{
      const slide=details.closest('[data-fan-slide]');
      const context=details.dataset.context || (slide && slide.dataset.context);
      if(context)setViewed(context,slide?slide.id:details.id);
    }
    slot.appendChild(content);d.getElementById('gallery-dialog-title').textContent=details.id==='email'?'Email a question':'Image details';
    d.body.classList.add('modal-open');if(!dialog.open)dialog.showModal();
    const heading=content.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  }
  d.querySelectorAll('.exhibit').forEach(details=>{
    details.querySelector(':scope > summary').addEventListener('click',e=>{
      if(typeof dialog.showModal!=='function')return;e.preventDefault();openStory(details,e.currentTarget);
    });
  });
  d.addEventListener('click',e=>{
    const email=e.target.closest('[data-open-email]');if(!email)return;
    if(typeof dialog.showModal!=='function')return;
    e.preventDefault();
    // A story's email action replaces the story; keep a visible opener for return.
    const trigger=dialog.contains(email)?d.querySelector('.dock-email'):email;
    openStory(d.getElementById('email'),trigger);
  });
  thumbs.forEach((a,i)=>a.addEventListener('click',e=>{e.preventDefault();showRoom('fans');showFan(i);}));
  d.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>showFan(active+Number(b.dataset.step))));
  const stage=d.querySelector('.fan-stage');let pointer=null,suppressClickUntil=0;
  stage.addEventListener('pointerdown',e=>{if(e.isPrimary!==false && e.button===0)pointer={x:e.clientX,y:e.clientY,id:e.pointerId};});
  stage.addEventListener('pointercancel',()=>{pointer=null;});
  stage.addEventListener('pointerup',e=>{
    if(!pointer || e.pointerId!==pointer.id)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer=null;
    if(Math.abs(dx)>60 && Math.abs(dx)>1.3*Math.abs(dy)){showFan(active+(dx<0?1:-1));suppressClickUntil=Date.now()+450;}
  });
  stage.addEventListener('click',e=>{if(Date.now()<suppressClickUntil){e.preventDefault();e.stopPropagation();}},true);
  stage.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();showFan(e.key==='Home'?0:e.key==='End'?slides.length-1:active+(e.key==='ArrowRight'?1:-1));slides[active].querySelector('summary').focus({preventScroll:true});});
  d.querySelectorAll('[data-room-link]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();showRoom(a.dataset.roomLink,true);}));
  function restore(){
    const key=root.location.hash.slice(1),fan=slides.findIndex(n=>n.id===key);
    if(key==='email' || key==='gallery-email'){
      showRoom('fans');openStory(d.getElementById('email'),d.querySelector('.dock-email'));return;
    }
    const details=d.getElementById(key);
    if(details && details.matches('.exhibit') && details.id!=='email'){
      const parentRoom=details.closest('[data-gallery-room]'),slide=details.closest('[data-fan-slide]');
      showRoom(parentRoom?parentRoom.id:'fans');
      if(slide)showFan(slides.indexOf(slide),false,false);
      openStory(details,details.querySelector(':scope > summary'));return;
    }
    // A history navigation must not leave an unrelated explanation above its room.
    closeStory();
    if(fan>=0){showRoom('fans');showFan(fan,false,false);}
    else if(['fans','occasions','making'].includes(key))showRoom(key);
    else showRoom('fans');
  }
  d.querySelector('.fan-controls').hidden=false;d.body.classList.add('gallery-ready');showFan(0,false,false);restore();
  root.addEventListener('hashchange',restore);root.addEventListener('popstate',restore);
})(typeof window!=='undefined'?window:globalThis);
