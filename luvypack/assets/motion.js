/* Visual enhancement only. Content, navigation and measurement work without it. */
(function () {
  'use strict';
  if (!window.matchMedia || document.documentElement.dataset.motionInitialized) return;
  document.documentElement.dataset.motionInitialized = 'true';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const root = document.documentElement;
  const running = new Map();
  const cleanups = [];
  let observer = null;

  function finish(node) {
    const animation = running.get(node);
    if (animation) animation.cancel();
    running.delete(node);
    if (observer) observer.unobserve(node);
  }

  function stop() {
    root.classList.remove('motion-ready');
    if (observer) observer.disconnect();
    observer = null;
    running.forEach(animation => animation.cancel());
    running.clear();
    cleanups.splice(0).forEach(cleanup => cleanup());
  }

  function start() {
    stop();
    if (reduced.matches) return;
    root.classList.add('motion-ready');

    // Animate only when a section arrives. Never hide or gate the original HTML.
    if (typeof window.IntersectionObserver === 'function' &&
        typeof Element.prototype.animate === 'function') {
      const targets = document.querySelectorAll(
        '.section-heading, .collection-board > .format-card, .format-grid > .format-card,' +
        '.sku-lineup > .format-card, .occasion-link, .visual-spread-copy,' +
        '.visual-board .planned-visual, .region-grid > li, .material-atelier-intro,' +
        '.about-story > div, .factory-intro > div, .project-timeline > ol, .fit-editorial > div, .process-list > li, .closing-contact > .wrap'
      );
      observer = new IntersectionObserver((entries, observed) => {
        if (observer !== observed) return;
        entries.forEach(entry => {
          const node = entry.target;
          if (!entry.isIntersecting) return;
          observed.unobserve(node);
          if (node.hidden || node.contains(document.activeElement) || document.hidden) return;
          node.classList.add('motion-seen');
          const peers = Array.from(node.parentElement.children);
          const delay = Math.min(peers.indexOf(node) % 4, 3) * 85;
          const animation = node.animate([
            {opacity: .72, transform: 'translateY(22px)'},
            {opacity: 1, transform: 'translateY(0)'}
          ], {duration: 650, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'none'});
          running.set(node, animation);
          animation.onfinish = () => running.delete(node);
        });
      }, {threshold: .08, rootMargin: '0px 0px -24px 0px'});
      targets.forEach(node => observer.observe(node));
    }

    // A photograph moves as one plane; no simulated box opening or folding.
    if (fine.matches && typeof window.requestAnimationFrame === 'function') {
      document.querySelectorAll('.hero-main > a, .product-photo-stage').forEach(stage => {
        let frame = 0;
        let point = null;
        function reset() {
          if (frame) window.cancelAnimationFrame(frame);
          frame = 0;
          point = null;
          stage.style.removeProperty('transform');
          stage.classList.remove('photo-engaged');
        }
        function move(event) {
          if (event.pointerType && event.pointerType !== 'mouse') return;
          point = {x: event.clientX, y: event.clientY};
          if (frame) return;
          frame = window.requestAnimationFrame(() => {
            frame = 0;
            const rect = stage.getBoundingClientRect();
            if (!rect.width || !rect.height || !point) return;
            const x = Math.max(-1, Math.min(1, (point.x - rect.left) / rect.width * 2 - 1));
            const y = Math.max(-1, Math.min(1, (point.y - rect.top) / rect.height * 2 - 1));
            stage.classList.add('photo-engaged');
            stage.style.transform = 'perspective(1100px) rotateX(' + (-y * 2).toFixed(2) +
              'deg) rotateY(' + (x * 2).toFixed(2) + 'deg)';
          });
        }
        stage.addEventListener('pointermove', move);
        stage.addEventListener('pointerleave', reset);
        stage.addEventListener('pointercancel', reset);
        stage.addEventListener('focusin', reset);
        window.addEventListener('blur', reset);
        const onVisibility = () => { if (document.hidden) reset(); };
        document.addEventListener('visibilitychange', onVisibility);
        cleanups.push(() => {
          reset();
          stage.removeEventListener('pointermove', move);
          stage.removeEventListener('pointerleave', reset);
          stage.removeEventListener('pointercancel', reset);
          stage.removeEventListener('focusin', reset);
          window.removeEventListener('blur', reset);
          document.removeEventListener('visibilitychange', onVisibility);
        });
      });
    }
  }

  // Keyboard navigation must not chase a moving control.
  document.addEventListener('focusin', event => {
    running.forEach((animation, node) => { if (node.contains(event.target)) finish(node); });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) running.forEach((animation, node) => finish(node));
  });
  for (const query of [reduced, fine]) {
    if (query.addEventListener) query.addEventListener('change', start);
    else if (query.addListener) query.addListener(start);
  }
  start();
}());
