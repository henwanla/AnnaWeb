(function () {
  'use strict';
  const cfg = window.LuvyPackSite;
  const core = window.TradeTraffic;
  if (!cfg || !core) return;
  const pageId = document.body.dataset.pageId;
  const page = cfg.traffic.pages.find(p => p.id === pageId);
  const inquiry = document.getElementById('inquiry-dialog');
  const preferences = document.getElementById('analytics-dialog');
  const consentKey = 'luvypack.analytics-consent.v1';
  const sourceKey = 'luvypack.inquiry-source.v1';
  const ga4Available = cfg.environment === 'release' && /^G-[A-Z0-9]+$/.test(cfg.measurementId || '');
  const ownedAvailable = cfg.environment === 'release' && cfg.eventsEndpoint === '/api/events' &&
    window.location.origin === cfg.origin;
  const analyticsAvailable = ga4Available || ownedAvailable;
  const inquiryStates = new WeakMap();
  const sending = new WeakSet();
  const openers = new WeakMap();
  const requestedTopic = new URL(window.location.href).searchParams.get('topic');
  // Start visit measurement without a first-visit prompt. A saved off choice
  // retains precedence; preview/unconfigured builds still cannot collect.
  let consent = 'granted';
  let tagStarted = false;
  let viewsStarted = false;
  const pendingAnalytics = new Set();
  let sourceObserved = false;
  let sourceRecord = null;
  try {
    const saved = localStorage.getItem(consentKey);
    if (saved === 'granted' || saved === 'denied') consent = saved;
  } catch (_) { /* A blocked storage API does not block contact. */ }
  if (!analyticsAvailable || consent !== 'granted') {
    try { sessionStorage.removeItem(sourceKey); } catch (_) {}
  }

  function context(id) {
    return Object.prototype.hasOwnProperty.call(cfg.contexts, id) ? cfg.contexts[id] : cfg.contexts[pageId];
  }
  function knownId(id) {
    return Object.prototype.hasOwnProperty.call(cfg.contexts, id) ? id : pageId;
  }
  function sourcePage(id) {
    const clean = new URL(window.location.href);
    clean.search = '';
    clean.hash = '';
    const target = new URL(context(id).path, cfg.origin);
    if (target.pathname === clean.pathname) clean.hash = target.hash;
    return clean.href;
  }
  function validateSource(value) {
    if (!value || value.version !== 1) return null;
    const entry = cfg.traffic.pages.find(p => p.id === value.page_id);
    const evidence = ['registered_url_labels', 'referrer_origin', 'unknown', 'internal_navigation',
      'other_external_referrer', 'unregistered_tags', 'incomplete_or_duplicate_tags'];
    if (!entry || !evidence.includes(value.evidence)) return null;
    const record = {version: 1, page_id: entry.id, evidence: value.evidence};
    if (value.referrer_origin) {
      try {
        const ref = new URL(value.referrer_origin);
        if (!['http:', 'https:'].includes(ref.protocol) || ref.origin !== value.referrer_origin) return null;
        const signal = core.arrival(cfg.traffic, cfg.origin + entry.path, ref.origin);
        if (signal.referrer_signal.evidence !== 'referrer_origin') return null;
        record.referrer_origin = ref.origin;
      } catch (_) { return null; }
    }
    if (record.evidence === 'referrer_origin' && !record.referrer_origin) return null;
    if (record.evidence === 'registered_url_labels') {
      const campaign = cfg.traffic.campaigns.find(c => c.id === value.record_id && c.page_id === entry.id);
      if (!campaign) return null;
      record.record_id = campaign.id;
    }
    return record;
  }
  function observedSource() {
    if (!analyticsAvailable || consent !== 'granted') return null;
    if (sourceObserved) return sourceRecord;
    sourceObserved = true;
    try { sourceRecord = validateSource(JSON.parse(sessionStorage.getItem(sourceKey))); } catch (_) {}
    if (page) {
      try {
        const current = new URL(page.path, cfg.origin);
        current.search = new URL(window.location.href).search;
        const signal = core.arrival(cfg.traffic, current.href, document.referrer);
        if (!sourceRecord || !['unknown', 'internal_navigation'].includes(signal.evidence)) {
          const candidate = {version: 1, page_id: page.id, evidence: signal.evidence};
          if (signal.evidence === 'registered_url_labels') candidate.record_id = signal.record_id;
          if (signal.referrer_signal.evidence === 'referrer_origin') candidate.referrer_origin = new URL(document.referrer).origin;
          sourceRecord = validateSource(candidate);
        }
      } catch (_) {}
    }
    try {
      if (sourceRecord) sessionStorage.setItem(sourceKey, JSON.stringify(sourceRecord));
      else sessionStorage.removeItem(sourceKey);
    } catch (_) { /* Blocked storage keeps same-page contact usable. */ }
    return sourceRecord;
  }
  function setSourceFields(form) {
    const values = {source_scope: 'not_observed', source_channel: 'unknown', source_medium: 'unknown',
      source_campaign: 'unknown', source_content: 'unknown', source_record_id: 'unknown',
      source_evidence: 'not_observed', source_entry_page_id: 'unknown', source_entry_page_variant: 'unknown',
      source_referrer_channel: 'unknown', source_referrer_medium: 'unknown'};
    const record = observedSource();
    if (record) {
      const entry = cfg.traffic.pages.find(p => p.id === record.page_id);
      const ref = core.arrival(cfg.traffic, cfg.origin + entry.path, record.referrer_origin || '').referrer_signal;
      Object.assign(values, {source_scope: 'tab_observation', source_evidence: record.evidence,
        source_entry_page_id: entry.id, source_entry_page_variant: entry.page_variant || 'unknown',
        source_referrer_channel: ref.source, source_referrer_medium: ref.medium});
      if (record.evidence === 'registered_url_labels') {
        const c = cfg.traffic.campaigns.find(c => c.id === record.record_id);
        Object.assign(values, {source_channel: c.source, source_medium: c.medium,
          source_campaign: c.campaign || c.id, source_content: c.content, source_record_id: c.id});
      } else if (record.evidence === 'referrer_origin') {
        values.source_channel = ref.source; values.source_medium = ref.medium;
      }
    }
    for (const [name, value] of Object.entries(values)) if (form.elements.namedItem(name)) form.elements.namedItem(name).value = value;
  }
  function setContext(form, id) {
    id = knownId(id);
    const c = context(id);
    form.dataset.context = id;
    const values = {site_id: 'luvypack', brand: 'LuvyPack', viewed_item: c.label,
      viewed_item_id: id, source_page: sourcePage(id), reference_page: new URL(c.path, cfg.origin).href,
      site_environment: cfg.environment, _subject: '[LuvyPack] ' + c.label};
    for (const [name, value] of Object.entries(values)) if (form.elements.namedItem(name)) form.elements.namedItem(name).value = value;
    setSourceFields(form);
    const panel = form.closest('dialog, .contact-form-panel');
    if (panel) {
      panel.querySelectorAll('[data-context-label]').forEach(el => { el.textContent = c.label; });
      panel.querySelectorAll('[data-whatsapp]').forEach(el => setWhatsApp(el, id));
    }
  }
  function inquiryState(form) {
    if (!inquiryStates.has(form)) inquiryStates.set(form, {drafts: new Map(), started: new Set()});
    return inquiryStates.get(form);
  }
  function switchInquiryContext(form, id) {
    id = knownId(id);
    const previous = knownId(form.dataset.context);
    if (previous !== id) {
      const state = inquiryState(form);
      // Contact identity stays in the form; project details belong to their own context.
      // Drafts live only in this document's memory, never in storage, URLs or analytics.
      state.drafts.set(previous, {message: form.elements.message.value, quantity: form.elements.quantity.value});
      const draft = state.drafts.get(id);
      form.elements.message.value = draft ? draft.message : '';
      form.elements.quantity.value = draft ? draft.quantity : '';
      form.querySelector('[data-form-status]').textContent = '';
    }
    setContext(form, id);
  }
  function payload(name, id, details) {
    if (!page) return null;
    let referrer = '';
    try {
      const ref = new URL(document.referrer);
      if (['http:', 'https:'].includes(ref.protocol)) referrer = ref.origin;
    } catch (_) {}
    const base = ['page_view', 'product_view'].includes(name) ? {name, params: {
      site_id: cfg.traffic.site_id, page_id: page.id, page_variant: page.page_variant,
      category_id: page.category_id, page_location: cfg.origin + page.path, page_referrer: referrer,
      ...(page.product_family_id ? {product_family_id: page.product_family_id} : {}),
      ...(page.style_id ? {style_id: page.style_id} : {}),
      ...(page.scenario_id ? {scenario_id: page.scenario_id} : {})
    }} : core.event(cfg.traffic, pageId,
      name === 'form_submit_accepted' ? 'contact_click' : name,
      name === 'form_submit_accepted' ? {contact_method: 'form', cta_location: details.cta_location} : details || {});
    base.name = name;
    const c = context(knownId(id));
    if (c.type === 'product') {
      base.params.style_id = knownId(id);
      base.params.product_family_id = c.family;
      base.params.category_id = c.category;
    } else if (c.type === 'family') {
      delete base.params.style_id;
      base.params.product_family_id = c.family;
      base.params.category_id = c.category;
    } else if (c.type === 'scenario') base.params.scenario_id = knownId(id);
    return base;
  }
  function sendOwned(event, id) {
    if (!ownedAvailable || consent !== 'granted' || typeof window.fetch !== 'function' ||
        !window.crypto || typeof window.crypto.randomUUID !== 'function') return false;
    const record = observedSource();
    let source = null;
    if (record) {
      const entry = cfg.traffic.pages.find(p => p.id === record.page_id);
      const ref = core.arrival(cfg.traffic, cfg.origin + entry.path, record.referrer_origin || '').referrer_signal;
      source = {page_id: entry.id, evidence: record.evidence,
        referrer_channel: ref.source, referrer_medium: ref.medium,
        ...(record.record_id ? {record_id: record.record_id} : {})};
    }
    const p = event.params;
    const data = {version: 1, site_id: cfg.traffic.site_id, consent: 'granted',
      event_id: window.crypto.randomUUID(), event_name: event.name, page_id: pageId,
      context_id: knownId(id), source};
    for (const key of ['target_page_id', 'contact_method', 'cta_location']) {
      if (p[key] !== undefined) data[key] = p[key];
    }
    const controller = new AbortController();
    pendingAnalytics.add(controller);
    const timeout = setTimeout(() => controller.abort(), 5000);
    // A failed analytics request must not block navigation or an inquiry. No persistent queue.
    try {
      window.fetch(cfg.eventsEndpoint, {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data), credentials: 'omit', referrerPolicy: 'no-referrer',
        cache: 'no-store', keepalive: true, signal: controller.signal})
        .then(response => { if (!response.ok) throw new Error('Analytics unavailable'); })
        .catch(() => {})
        .finally(() => { clearTimeout(timeout); pendingAnalytics.delete(controller); });
      return true;
    } catch (_) {
      clearTimeout(timeout); pendingAnalytics.delete(controller); return false;
    }
  }
  function track(name, id, details) {
    if (!analyticsAvailable || consent !== 'granted') return false;
    try {
      const event = payload(name, id, details);
      if (!event) return false;
      // These events are GA4-only: the existing D1 event constraint is unchanged.
      let sent = ['comparison_select', 'fit_calculation', 'fit_tool_open'].includes(name) ? false : sendOwned(event, id);
      if (ga4Available && tagStarted && typeof window.gtag === 'function') {
        window.gtag('event', event.name, event.params);
        sent = true;
      }
      return sent;
    } catch (_) { return false; }
  }
  function startTag() {
    if (!ga4Available || consent !== 'granted') return;
    window['ga-disable-' + cfg.measurementId] = false;
    if (tagStarted) {
      window.gtag('consent', 'update', {analytics_storage: 'granted'});
      return;
    }
    tagStarted = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {analytics_storage: 'denied', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied'});
    window.gtag('consent', 'update', {analytics_storage: 'granted'});
    window.gtag('js', new Date());
    let referrer = '';
    try {
      const url = new URL(document.referrer);
      if (url.protocol === 'https:' || url.protocol === 'http:') referrer = url.origin;
    } catch (_) {}
    const location = cfg.origin + (page ? page.path : context(pageId).path);
    let campaign = {};
    if (page) {
      try {
        const arrival = new URL(page.path, cfg.origin);
        arrival.search = new URL(window.location.href).search;
        const signal = core.arrival(cfg.traffic, arrival.href, document.referrer);
        if (signal.evidence === 'registered_url_labels') {
          campaign = {campaign_source: signal.source, campaign_medium: signal.medium,
            campaign_name: signal.campaign, campaign_content: signal.content};
        }
      } catch (_) { /* Unregistered arrival tags are not copied into event fields. */ }
    }
    window.gtag('config', cfg.measurementId, {send_page_view: false, allow_google_signals: false,
      allow_ad_personalization_signals: false, page_location: location, page_referrer: referrer,
      ...campaign});
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(cfg.measurementId);
    document.head.append(script);
  }
  function startAnalytics() {
    if (!analyticsAvailable || consent !== 'granted') return;
    startTag();
    if (page && !viewsStarted) {
      viewsStarted = true;
      track('page_view', pageId);
      const product = context(pageId);
      if (product.type === 'product' && page.style_id === pageId && product.path === page.path) {
        track('product_view', pageId);
      }
    }
  }
  function chooseConsent(value) {
    consent = value;
    try { localStorage.setItem(consentKey, value); } catch (_) {}
    if (value !== 'granted') {
      for (const controller of pendingAnalytics) controller.abort();
      sourceRecord = null;
      sourceObserved = false;
      try { sessionStorage.removeItem(sourceKey); } catch (_) {}
    }
    if (value === 'granted') startAnalytics();
    if (ga4Available) {
      window['ga-disable-' + cfg.measurementId] = value !== 'granted';
      if (value !== 'granted' && typeof window.gtag === 'function') {
        window.gtag('consent', 'update', {analytics_storage: 'denied'});
        for (const entry of document.cookie.split(';')) {
          const name = entry.trim().split('=')[0];
          if (name === '_ga' || name === '_ga_' + cfg.measurementId.substring(2)) {
            const host = window.location.hostname;
            document.cookie = name + '=; Max-Age=0; Path=/';
            document.cookie = name + '=; Max-Age=0; Path=/; Domain=' + host;
            document.cookie = name + '=; Max-Age=0; Path=/; Domain=.' + host.replace(/^www\./, '');
          }
        }
      }
    }
    document.querySelectorAll('[data-inquiry-form]').forEach(setSourceFields);
    document.querySelectorAll('[data-analytics-banner]').forEach(el => el.remove());
    preferences.querySelector('[data-consent-status]').textContent = value === 'granted' && analyticsAvailable ? 'Analytics is on.' : 'Analytics is off.';
    if (preferences.open && typeof preferences.close === 'function') preferences.close();
  }
  function show(dialog, opener) {
    if (!dialog || typeof dialog.showModal !== 'function') return false;
    openers.set(dialog, opener);
    if (!dialog.open) dialog.showModal();
    // Start with the heading when a dialog presents context and contact choices.
    // Do not open a phone keyboard before the visitor chooses an input field.
    const first = dialog.querySelector('[data-dialog-start]') ||
      dialog.querySelector('input[type=email], [data-consent]:not([hidden])');
    if (first) first.focus({preventScroll: true});
    dialog.scrollTop = 0;
    return true;
  }
  window.addEventListener('storage', event => {
    if (event.key === consentKey && event.newValue !== 'granted') chooseConsent('denied');
  });
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('close', () => {
      const opener = openers.get(dialog);
      if (opener && opener.isConnected) opener.focus({preventScroll: true});
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
    });
  });

  function setWhatsApp(link, id) {
    id = knownId(id);
    const url = new URL(cfg.whatsapp);
    const source = sourcePage(id);
    const reference = new URL(context(id).path, cfg.origin).href;
    const message = 'Hello LuvyPack, I have a question.\nViewing: ' + context(id).label + '\nPage: ' + source +
      (reference !== source ? '\nReference: ' + reference : '');
    url.searchParams.set('text', message);
    link.href = url.href;
    link.dataset.context = id;
  }
  // Carry only a registered jewelry-box reference through measuring guidance.
  // Never put dimensions or arbitrary query parameters in generated links.
  const currentContext = context(pageId);
  const fitPage = cfg.traffic.pages.find(p => p.id === 'packaging_fit');
  const sizePage = cfg.traffic.pages.find(p => p.id === 'jewelry_size');
  if (currentContext.type === 'product' && currentContext.category === 'jewelry-boxes') {
    document.querySelectorAll('.product-fit-help a[href]').forEach(link => {
      const url = new URL(link.href);
      if (url.origin === cfg.origin && [fitPage, sizePage].some(p => p && url.pathname === p.path)) {
        url.searchParams.set('topic', pageId);
        link.href = url.href;
      }
    });
  }
  const referenceTopic = ['packaging_fit', 'jewelry_size'].includes(pageId) && requestedTopic &&
    Object.prototype.hasOwnProperty.call(cfg.contexts, requestedTopic) &&
    cfg.contexts[requestedTopic].type === 'product' && cfg.contexts[requestedTopic].category === 'jewelry-boxes'
      ? requestedTopic : null;
  if (referenceTopic) {
    document.querySelectorAll('[data-context="' + pageId + '"]').forEach(el => { el.dataset.context = referenceTopic; });
    const intro = document.querySelector(pageId === 'packaging_fit' ? '.fit-tool .intro' : 'article.guide > header .lead');
    if (intro) {
      const reference = document.createElement('p');
      reference.className = 'fit-product-reference';
      reference.textContent = 'Product reference: ' + cfg.contexts[referenceTopic].label + '.';
      if (pageId === 'packaging_fit') reference.append(' Measurements are not prefilled.');
      else {
        const productLink = document.createElement('a');
        productLink.href = new URL(cfg.contexts[referenceTopic].path, cfg.origin).href;
        productLink.textContent = 'View product';
        const clearLink = document.createElement('a');
        clearLink.href = new URL(sizePage.path, cfg.origin).href;
        clearLink.textContent = 'Clear reference';
        reference.append(' ', productLink, ' · ', clearLink);
      }
      intro.insertAdjacentElement('afterend', reference);
    }
    if (pageId === 'jewelry_size' && fitPage) {
      document.querySelectorAll('article.guide a[href]').forEach(link => {
        const url = new URL(link.href);
        if (url.origin === cfg.origin && url.pathname === fitPage.path) {
          url.searchParams.set('topic', referenceTopic);
          link.href = url.href;
        }
      });
    }
  }
  if (pageId === 'contact' && requestedTopic && cfg.contexts[requestedTopic]) {
    document.querySelectorAll('[data-context="contact"]').forEach(el => { el.dataset.context = requestedTopic; });
  }
  document.querySelectorAll('[data-open-inquiry]').forEach(link => {
    const url = new URL(link.href);
    url.searchParams.set('topic', knownId(link.dataset.context));
    link.href = url.href;
  });
  document.querySelectorAll('[data-whatsapp]').forEach(link => {
    setWhatsApp(link, link.dataset.context);
  });
  document.querySelectorAll('[data-inquiry-form]').forEach(form => {
    const requested = pageId === 'contact' && requestedTopic ? knownId(requestedTopic) : (referenceTopic || pageId);
    setContext(form, requested);
    form.addEventListener('input', () => {
      const id = knownId(form.dataset.context);
      const state = inquiryState(form);
      if (!state.started.has(id)) {
        state.started.add(id);
        track('inquiry_start', id);
      }
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (sending.has(form)) return;
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const id = knownId(form.dataset.context);
      setContext(form, id);
      const data = new FormData(form);
      const status = form.querySelector('[data-form-status]');
      const button = form.querySelector('button[type=submit]');
      const oldButton = button.textContent;
      const fields = Array.from(form.querySelectorAll('input:not([type=hidden]), textarea'));
      const readonly = fields.map(el => el.readOnly);
      fields.forEach(el => { el.readOnly = true; });
      button.disabled = true;
      button.textContent = 'Sending…';
      sending.add(form);
      status.textContent = '';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(cfg.formAction, {method: 'POST', body: data,
          headers: {Accept: 'application/json'}, signal: controller.signal});
        const result = await response.json();
        if (!response.ok || !result || result.ok !== true) throw new Error('not accepted');
        track('form_submit_accepted', id, {cta_location: form.closest('dialog') ? 'dialog' : 'content'});
        form.reset();
        setContext(form, id);
        inquiryState(form).drafts.delete(id);
        inquiryState(form).started.delete(id);
        status.textContent = 'Thank you. Your question has been submitted.';
      } catch (_) {
        status.textContent = 'We could not confirm your submission. Your text is still here. You can also contact us on WhatsApp.';
        status.focus();
      } finally {
        clearTimeout(timeout);
        fields.forEach((el, i) => { el.readOnly = readonly[i]; });
        button.disabled = false;
        button.textContent = oldButton;
        sending.delete(form);
      }
    });
  });

  document.addEventListener('luvypack:fit-calculated', () => {
    if (pageId === 'packaging_fit') track('fit_calculation', pageId);
  });

  document.addEventListener('click', event => {
    const target = event.target.closest('a, button');
    if (!target) return;
    if (target.tagName === 'A' && !event.defaultPrevented && pageId !== 'packaging_fit') {
      const fitPage = cfg.traffic.pages.find(p => p.id === 'packaging_fit');
      if (fitPage && target.origin === cfg.origin && target.pathname === fitPage.path) {
        // Record a click only; never include query strings or measurement data.
        track('fit_tool_open', pageId);
      }
    }
    if (target.matches('[data-close-dialog]')) {
      const dialog = target.closest('dialog');
      if (dialog && typeof dialog.close === 'function') dialog.close();
      return;
    }
    if (target.matches('[data-consent]')) {
      chooseConsent(target.dataset.consent === 'granted' ? 'granted' : 'denied');
      return;
    }
    if (target.matches('[data-analytics-preferences]')) {
      preferences.querySelector('[data-consent-status]').textContent = analyticsAvailable && consent === 'granted' ? 'Analytics is on.' : 'Analytics is off.';
      if (!analyticsAvailable) {
        preferences.querySelector('[data-analytics-description]').textContent = 'Analytics is currently off for this site version.';
        preferences.querySelector('[data-consent="granted"]').hidden = true;
      }
      if (show(preferences, target)) event.preventDefault();
      return;
    }
    if (target.matches('[data-open-inquiry]')) {
      if (event.defaultPrevented) return;
      const id = knownId(target.dataset.context);
      track('contact_click', id, {contact_method: 'email', cta_location: target.dataset.placement || 'content'});
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0 ||
          (target.target && target.target !== '_self')) return;
      const form = inquiry.querySelector('form');
      if (!sending.has(form)) switchInquiryContext(form, id);
      else if (knownId(form.dataset.context) !== id) {
        form.querySelector('[data-form-status]').textContent = 'Sending your previous question. Please wait, then try your new selection again.';
      }
      if (show(inquiry, target)) event.preventDefault();
      return;
    }
    if (target.matches('[data-whatsapp]')) track('contact_click', target.dataset.context,
      {contact_method: 'whatsapp', cta_location: target.dataset.placement || 'content'});
    if (target.matches('[data-scenario-link]')) track('scenario_select', pageId,
      {target_page_id: target.dataset.targetPage});
    if (target.matches('[data-comparison-target]')) track('comparison_select', pageId,
      {target_page_id: target.dataset.comparisonTarget});
    if (target.matches('[data-download]')) track('catalog_click', pageId);
  });
  document.querySelectorAll('[data-spec]').forEach(el => el.addEventListener('toggle', () => {
    if (el.open) track('spec_open', pageId);
  }));

  const filter = document.querySelector('[data-catalog-filter]');
  if (filter) {
    filter.hidden = false;
    const kind = filter.querySelector('select');
    const cards = Array.from(document.querySelectorAll('[data-format-card]'));
    function applyFilter() {
      let count = 0;
      cards.forEach(card => {
        const match = kind.value === 'all' || card.dataset.kind === kind.value;
        card.hidden = !match;
        if (match) count++;
      });
      const noun = cards.every(card => card.hasAttribute('data-family-card')) ? ' collection' : ' format';
      filter.querySelector('[data-catalog-count]').textContent = count + noun + (count === 1 ? '' : 's');
    }
    kind.addEventListener('change', applyFilter);
    applyFilter();
  }

  if (analyticsAvailable) {
    if (ga4Available) window['ga-disable-' + cfg.measurementId] = consent !== 'granted';
    if (consent === 'granted') startAnalytics();
  }
  // Leave the fallback visible if this script or its prerequisites fail to load.
  document.querySelectorAll('[data-context-fallback]').forEach(el => { el.hidden = true; });
}());
