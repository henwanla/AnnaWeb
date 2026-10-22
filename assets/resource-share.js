/* Share only the fixed public resource link, after an explicit user action. */
(() => {
  'use strict';
  document.querySelectorAll('[data-resource-share]').forEach((panel) => {
    const permalink = panel.querySelector('[data-share-permalink]');
    const shareButton = panel.querySelector('[data-share-native]');
    const copyButton = panel.querySelector('[data-share-copy]');
    const status = panel.querySelector('[data-share-status]');
    const manual = panel.querySelector('[data-share-manual]');
    const manualLink = panel.querySelector('[data-share-link]');
    if (!permalink || !shareButton || !copyButton || !status || !manual || !manualLink) return;

    let url;
    try {
      url = new URL(permalink.getAttribute('href'));
      if (url.protocol !== 'https:' || url.search || url.hash || url.username || url.password) return;
    } catch (_) {
      return;
    }
    const publicUrl = url.href;
    const title = panel.getAttribute('data-share-title') || 'Fanique planning resource';
    manualLink.value = publicUrl;

    function showManualLink() {
      manual.hidden = false;
      manualLink.focus();
      manualLink.select();
      status.textContent = 'Automatic copying is unavailable. Copy the public link below.';
    }

    copyButton.hidden = false;
    copyButton.addEventListener('click', async () => {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        showManualLink();
        return;
      }
      copyButton.disabled = true;
      try {
        await navigator.clipboard.writeText(publicUrl);
        status.textContent = 'Public link copied. Calculator entries and worksheet details are not included.';
      } catch (_) {
        showManualLink();
      } finally {
        copyButton.disabled = false;
      }
    });

    if (window.isSecureContext && typeof navigator.share === 'function') {
      shareButton.hidden = false;
      shareButton.addEventListener('click', async () => {
        shareButton.disabled = true;
        try {
          await navigator.share({ title, url: publicUrl });
          status.textContent = 'Your device handled the share request. Check the chosen app to confirm delivery.';
        } catch (error) {
          status.textContent = error && error.name === 'AbortError'
            ? 'No share completed. You can copy the public link instead.'
            : 'Sharing is unavailable here. Use Copy link or the permalink.';
        } finally {
          shareButton.disabled = false;
        }
      });
    }
  });
})();
