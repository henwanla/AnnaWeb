'use strict';
(function (root) {
  const models = ['clack','bamboo','led','pvc','stock-bamboo','stock-clack'];
  const scenes = ['weddings','gameday','corporate','party','charities','schools'];
  function viewForHash(kind, hash) {
    const key = String(hash || '').replace(/^#/, '');
    const views = kind === 'chapters' ? ['cover','collection','occasions','factory','project'] : ['collection','occasions','factory','project'];
    if (views.includes(key)) return key;
    if (key === 'formats' || key.startsWith('format-')) return 'collection';
    return kind === 'chapters' ? 'cover' : 'collection';
  }
  function moveIndex(index, length, key) {
    if (key === 'Home') return 0;
    if (key === 'End') return length - 1;
    return (index + (key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1) + length) % length;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {viewForHash,moveIndex,models,scenes};
  if (!root.document) return;
  const d=root.document, kind=d.body.dataset.navigation;
  const reduced=()=>root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const source=d.querySelector('#model');
  function selectTabs(buttons, selected, keyName) {
    buttons.forEach(button=>{
      const active=button.dataset[keyName]===selected;
      button.setAttribute('aria-selected',String(active));
      button.tabIndex=active?0:-1;
    });
  }
  function bindKeys(buttons, activate) {
    buttons.forEach(button=>button.addEventListener('keydown',e=>{
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) return;
      e.preventDefault();
      const visible=buttons.filter(b=>!b.hidden);
      const next=visible[moveIndex(visible.indexOf(button),visible.length,e.key)];
      if(next){activate(next);next.focus();}
    }));
  }
  function replaceHash(hash) {
    const url=new URL(root.location.href);url.hash=hash;
    root.history.replaceState(null,'',url);
  }
  const rooms=[...d.querySelectorAll('[data-room], [data-workspace]')];
  function showRoom(id, focus=false) {
    rooms.forEach(room=>{room.hidden=room.id!==id;});
    d.querySelectorAll('[data-room-link], [data-workspace-link]').forEach(a=>{
      if(a.hash==='#'+id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
    });
    const room=d.getElementById(id);
    if(focus && room){
      const heading=room.querySelector('h1,h2') || room;
      heading.tabIndex=-1;heading.focus({preventScroll:true});
      room.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});
    }
  }
  if(rooms.length) {
    showRoom(viewForHash(kind,root.location.hash));
    d.body.classList.add('views-ready');
    root.addEventListener('hashchange',()=>showRoom(viewForHash(kind,root.location.hash),true));
    root.addEventListener('popstate',()=>showRoom(viewForHash(kind,root.location.hash)));
    // The existing product handler scrolls to the outline. Make its destination
    // visible before that handler runs, without treating a preview as a choice.
    d.addEventListener('click',e=>{
      if(!e.target.closest('[data-product]'))return;
      showRoom('project');
      if(root.location.hash!=='#project')root.history.pushState(null,'','#project');
    },true);
  }
  const sceneButtons=[...d.querySelectorAll('[data-scene-tab]')];
  if(sceneButtons.length) {
    const tablist=d.querySelector('.scene-tabs');tablist.hidden=false;tablist.setAttribute('role','tablist');
    const panels=[...d.querySelectorAll('[data-scene-panel]')];
    function activate(button, update=true) {
      const key=button.dataset.sceneTab;selectTabs(sceneButtons,key,'sceneTab');
      panels.forEach(panel=>{panel.hidden=panel.dataset.scenePanel!==key;});
      if(update)replaceHash('scene-'+key);
    }
    sceneButtons.forEach(button=>{
      const key=button.dataset.sceneTab;button.setAttribute('role','tab');button.setAttribute('aria-controls','scene-'+key);
      const panel=d.getElementById('scene-'+key);panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.tabIndex=0;
      button.addEventListener('click',()=>activate(button));
    });
    bindKeys(sceneButtons,activate);
    const fromHash=()=>sceneButtons.find(b=>'#scene-'+b.dataset.sceneTab===root.location.hash);
    activate(fromHash() || sceneButtons.find(b=>b.dataset.sceneTab==='party'),false);
    root.addEventListener('hashchange',()=>{const b=fromHash();if(b)activate(b,false);});
  }
  const inspect=[...d.querySelectorAll('[data-inspect]')];
  if(inspect.length) {
    const list=d.querySelector('.format-selector');list.hidden=false;list.setAttribute('role','tablist');list.setAttribute('aria-orientation','vertical');
    const panels=[...d.querySelectorAll('[data-format-panel]')];
    let active='clack',group='all',restoring=false;
    function activate(button, update=true) {
      if(!button || button.hidden)return;
      active=button.dataset.inspect;selectTabs(inspect,active,'inspect');
      panels.forEach(panel=>{panel.hidden=panel.dataset.formatPanel!==active;});
      if(update)replaceHash('format-'+active);
    }
    inspect.forEach(button=>{
      const key=button.dataset.inspect;button.id='inspect-'+key;button.setAttribute('role','tab');
      const panel=d.getElementById('format-'+key);panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.tabIndex=0;
      button.addEventListener('click',()=>activate(button));
    });
    bindKeys(inspect,activate);
    function restore() {
      const match=inspect.find(b=>'#format-'+b.dataset.inspect===root.location.hash);
      if(match){
        if(group!=='all' && match.dataset.group!==group){
          restoring=true;
          try{d.querySelector('[data-filter="all"]').click();}finally{restoring=false;}
        }
        activate(match,false);
      }
    }
    d.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
      group=button.dataset.filter;
      inspect.forEach(b=>{b.hidden=group!=='all' && b.dataset.group!==group;});
      const chosen=inspect.find(b=>b.dataset.inspect===active && !b.hidden) || inspect.find(b=>!b.hidden);
      activate(chosen,!restoring);
      const count=inspect.filter(b=>!b.hidden).length;
      d.getElementById('catalog-status').textContent=count+' matching formats';
    }));
    activate(inspect[0],false);restore();
    root.addEventListener('hashchange',restore);root.addEventListener('popstate',restore);
    d.getElementById('catalog-status').textContent='6 matching formats';
  }
  const emailModel=d.getElementById('enquiry-model'),purpose=d.getElementById('purpose');
  function syncEnquiry() {
    if(!emailModel)return;
    emailModel.value=source.value;
    d.querySelector('[name="intended_use"]').value=purpose.value;
    d.querySelector('.enquiry-context').textContent=purpose.value?'Intended use: '+purpose.value+'.':'You can leave the format open and describe your idea.';
  }
  if(emailModel) {
    syncEnquiry();
    emailModel.addEventListener('change',()=>{source.value=emailModel.value;source.dispatchEvent(new root.Event('change',{bubbles:true}));});
    source.addEventListener('change',syncEnquiry);purpose.addEventListener('change',syncEnquiry);
    d.addEventListener('click',e=>{if(e.target.closest('[data-product]')){syncEnquiry();emailModel.focus({preventScroll:true});}});
  }
})(typeof window !== 'undefined' ? window : globalThis);
