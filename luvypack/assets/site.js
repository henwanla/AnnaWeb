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
  const analyticsAvailable = cfg.environment === 'release' && /^G-[A-Z0-9]+$/.test(cfg.measurementId || '');
  const started = new WeakSet();
  const sending = new WeakSet();
  const openers = new WeakMap();
  const requestedTopic = new URL(window.location.href).searchParams.get('topic');
  let consent = 'unknown';
  let tagStarted = false;
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
      Object.assign(values, {source_scope: 'consented_tab_observation', source_evidence: record.evidence,
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
      viewed_item_id: id, source_page: sourcePage(id), site_environment: cfg.environment,
      _subject: '[LuvyPack] ' + c.label};
    for (const [name, value] of Object.entries(values)) if (form.elements.namedItem(name)) form.elements.namedItem(name).value = value;
    setSourceFields(form);
    const panel = form.closest('dialog, .contact-form-panel');
    if (panel) {
      panel.querySelectorAll('[data-context-label]').forEach(el => { el.textContent = c.label; });
      panel.querySelectorAll('[data-whatsapp]').forEach(el => setWhatsApp(el, id));
    }
  }
  function payload(name, id, details) {
    if (!page) return null;
    const base = core.event(cfg.traffic, pageId,
      name === 'form_submit_accepted' ? 'contact_click' : name,
      name === 'form_submit_accepted' ? {contact_method: 'form', cta_location: details.cta_location} : details || {});
    base.name = name;
    const c = context(knownId(id));
    if (c.type === 'product') {
      base.params.style_id = knownId(id);
      base.params.product_family_id = c.family;
      base.params.category_id = c.category;
    } else if (c.type === 'scenario') base.params.scenario_id = knownId(id);
    return base;
  }
  function track(name, id, details) {
    if (!analyticsAvailable || consent !== 'granted' || !tagStarted || typeof window.gtag !== 'function') return false;
    try {
      const event = payload(name, id, details);
      if (!event) return false;
      window.gtag('event', event.name, event.params);
      return true;
    } catch (_) { return false; }
  }
  function startTag() {
    if (!analyticsAvailable || consent !== 'granted') return;
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
    if (page) {
      window.gtag('event', 'page_view', {site_id: 'luvypack', page_id: page.id,
        page_variant: page.page_variant, page_location: location, page_referrer: referrer,
        ...(page.style_id ? {style_id: page.style_id} : {}),
        ...(page.scenario_id ? {scenario_id: page.scenario_id} : {})});
      const product = context(pageId);
      if (product.type === 'product' && page.style_id === pageId && product.path === page.path) {
        window.gtag('event', 'product_view', {site_id: 'luvypack', page_id: page.id,
          category_id: product.category, product_family_id: product.family, style_id: pageId,
          page_variant: page.page_variant, page_location: location, page_referrer: referrer});
      }
    }
  }
  function chooseConsent(value) {
    consent = value;
    try { localStorage.setItem(consentKey, value); } catch (_) {}
    if (value !== 'granted') {
      sourceRecord = null;
      sourceObserved = false;
      try { sessionStorage.removeItem(sourceKey); } catch (_) {}
    }
    if (analyticsAvailable) {
      window['ga-disable-' + cfg.measurementId] = value !== 'granted';
      if (value === 'granted') startTag();
      else if (typeof window.gtag === 'function') {
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
    preferences.querySelector('[data-consent-status]').textContent = value === 'granted' && analyticsAvailable ? 'Optional analytics is allowed.' : 'Optional analytics is off.';
    if (preferences.open && typeof preferences.close === 'function') preferences.close();
  }
  function show(dialog, opener) {
    if (!dialog || typeof dialog.showModal !== 'function') return false;
    openers.set(dialog, opener);
    if (!dialog.open) dialog.showModal();
    const first = dialog.querySelector('input[type=email], [data-consent]');
    if (first) first.focus();
    return true;
  }
  window.addEventListener('storage', event => {
    if (event.key === consentKey && event.newValue !== 'granted') chooseConsent('denied');
  });
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('close', () => {
      const opener = openers.get(dialog);
      if (opener && opener.isConnected) opener.focus();
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
    url.searchParams.set('text', 'Hello LuvyPack, I have a question.\nViewing: ' + context(id).label + '\nPage: ' + sourcePage(id));
    link.href = url.href;
    link.dataset.context = id;
  }
  if (pageId === 'contact' && requestedTopic && cfg.contexts[requestedTopic]) {
    document.querySelectorAll('[data-context="contact"]').forEach(el => { el.dataset.context = requestedTopic; });
  }
  document.querySelectorAll('[data-whatsapp]').forEach(link => {
    setWhatsApp(link, link.dataset.context);
  });
  document.querySelectorAll('[data-inquiry-form]').forEach(form => {
    const requested = pageId === 'contact' && requestedTopic ? knownId(requestedTopic) : pageId;
    setContext(form, requested);
    form.addEventListener('input', () => {
      if (!started.has(form)) {
        started.add(form);
        track('inquiry_start', form.dataset.context);
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
        started.delete(form);
        status.textContent = 'Thank you. Your question has been submitted.';
      } catch (_) {
        status.textContent = 'Your question could not be submitted. Your text is still here. Please try again or contact us on WhatsApp.';
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

  document.addEventListener('click', event => {
    const target = event.target.closest('a, button');
    if (!target) return;
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
      if (!analyticsAvailable) {
        preferences.querySelector('[data-analytics-description]').textContent = 'Optional analytics is currently off.';
        preferences.querySelector('[data-consent="granted"]').hidden = true;
      }
      if (show(preferences, target)) event.preventDefault();
      return;
    }
    if (target.matches('[data-open-inquiry]')) {
      const id = knownId(target.dataset.context);
      track('contact_click', id, {contact_method: 'email', cta_location: target.dataset.placement || 'content'});
      const form = inquiry.querySelector('form');
      if (!sending.has(form)) setContext(form, id);
      if (show(inquiry, target)) event.preventDefault();
      return;
    }
    if (target.matches('[data-whatsapp]')) track('contact_click', target.dataset.context,
      {contact_method: 'whatsapp', cta_location: target.dataset.placement || 'content'});
    if (target.matches('[data-scenario-link]')) track('scenario_select', pageId,
      {target_page_id: target.dataset.targetPage});
    if (target.matches('[data-download]')) track('catalog_click', pageId);
  });
  document.querySelectorAll('[data-spec]').forEach(el => el.addEventListener('toggle', () => {
    if (el.open) track('spec_open', pageId);
  }));

  const filter = document.querySelector('[data-catalog-filter]');
  if (filter) {
    filter.hidden = false;
    const search = filter.querySelector('input[type=search]');
    const kind = filter.querySelector('select');
    const cards = Array.from(document.querySelectorAll('[data-format-card]'));
    function applyFilter() {
      const query = search.value.trim().toLowerCase();
      let count = 0;
      cards.forEach(card => {
        const match = (!query || card.dataset.search.includes(query)) && (kind.value === 'all' || card.dataset.kind === kind.value);
        card.hidden = !match;
        if (match) count++;
      });
      filter.querySelector('[data-catalog-count]').textContent = count + (count === 1 ? ' format' : ' formats');
      document.querySelector('[data-no-results]').hidden = count !== 0;
    }
    filter.addEventListener('submit', event => { event.preventDefault(); applyFilter(); });
    search.addEventListener('input', applyFilter);
    kind.addEventListener('change', applyFilter);
    applyFilter();
  }

  if (analyticsAvailable) {
    window['ga-disable-' + cfg.measurementId] = consent !== 'granted';
    if (consent === 'granted') startTag();
    else if (consent === 'unknown') {
      const banner = document.createElement('aside');
      banner.dataset.analyticsBanner = '';
      banner.className = 'analytics-banner';
      banner.setAttribute('aria-label', 'Optional analytics');
      const text = document.createElement('span');
      text.textContent = 'Allow optional analytics to help us understand which packaging is useful?';
      banner.append(text);
      for (const [value, label] of [['granted', 'Allow analytics'], ['denied', 'Keep analytics off']]) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'button button-line';
        button.dataset.consent = value; button.textContent = label; banner.append(button);
      }
      document.querySelector('.site-header').after(banner);
    }
  }
}());
