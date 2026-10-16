/* Keep the selected occasion and the existing project purpose in sync. */
(() => {
  'use strict';
  const purposes = {weddings:'Weddings',gameday:'Gameday',corporate:'Corporate',party:'Party',charities:'Charities',schools:'Colleges & Schools'};
  const field = document.getElementById('purpose');
  const feedback = [...document.querySelectorAll('.chosen-scenario')].map(node => ({node, initial:node.textContent}));
  function refreshPurpose() {
    feedback.forEach(({node, initial}) => {
      node.textContent = field.value ? 'Your intended use: ' + field.value + '. Add the format and questions below.' : initial;
    });
  }
  field.addEventListener('change', refreshPurpose);
  document.querySelectorAll('[data-scene]').forEach(link => link.addEventListener('click', () => {
    const label = purposes[link.dataset.scene];
    if (!label) return;
    field.value = label;
    field.dispatchEvent(new Event('change', {bubbles:true}));
  }));
  refreshPurpose();
})();
