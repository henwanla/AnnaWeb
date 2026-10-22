'use strict';
// Native links and disclosures stay usable without this enhancement.
(function () {
  function reveal(hash, moveFocus) {
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    // A section link must not choose an unrelated product or optional form fields.
    const directDetails = [...target.children].filter(child => child.matches('details'));
    const detail = target.matches('details') ? target : directDetails.length === 1 ? directDetails[0] : null;
    if (!detail) return;
    detail.open = true;
    let parent = detail.parentElement;
    while (parent) {
      if (parent.matches('details')) parent.open = true;
      parent = parent.parentElement;
    }
    const summary = detail.querySelector('summary');
    requestAnimationFrame(function () {
      summary.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (moveFocus) summary.focus({ preventScroll: true });
    });
  }
  document.addEventListener('click', function (event) {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const hash = link.getAttribute('href');
    if (hash === '#contact') {
      const topic = link.dataset.enquiryTopic || '';
      const field = document.querySelector('[name="topic"]');
      const note = document.querySelector('.enquiry-topic');
      field.value = topic || 'General hand fan enquiry';
      note.textContent = topic ? 'About: ' + topic : '';
      note.hidden = !topic;
    }
    reveal(hash, true);
  });
  window.addEventListener('hashchange', function () { reveal(location.hash, false); });
  reveal(location.hash, false);
})();
