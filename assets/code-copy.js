/**
 * DTSC 520 — Code-block copy button.
 *
 * Adds a hover-revealed "Copy" icon to every <pre> block on the page.
 * Self-contained: include this script and the matching CSS, no other setup.
 *
 *   <link rel="stylesheet" href="/520_full/assets/code-copy.css">
 *   <script src="/520_full/assets/code-copy.js" defer></script>
 *
 * Behavior:
 *   - Wraps each <pre> in a relative-positioned shell.
 *   - Renders a small button in the upper-right that appears on hover.
 *   - Click -> copies the <pre>'s text content to the clipboard.
 *   - Confirms with a 1.2s "Copied" state.
 *   - Skips <pre> blocks that opt out via class="no-copy".
 */
(function () {
  'use strict';

  const ICON_COPY =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>' +
    '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';

  const ICON_CHECK =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="20 6 9 17 4 12"></polyline></svg>';

  function attachToPre(pre) {
    if (pre.dataset.copyAttached === '1') return;
    if (pre.classList.contains('no-copy')) return;

    pre.dataset.copyAttached = '1';

    // Wrap in a shell so we can position the button without disturbing
    // the existing <pre> styling.
    const shell = document.createElement('div');
    shell.className = 'code-copy-shell';
    pre.parentNode.insertBefore(shell, pre);
    shell.appendChild(pre);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy-btn';
    btn.setAttribute('aria-label', 'Copy code');
    btn.innerHTML = ICON_COPY + '<span class="code-copy-label">Copy</span>';
    shell.appendChild(btn);

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = pre.innerText.replace(/\s+$/, '');
      try {
        await navigator.clipboard.writeText(text);
        flash(btn, true);
      } catch (err) {
        // Fallback for older browsers / non-secure contexts.
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e2) {}
        document.body.removeChild(ta);
        flash(btn, ok);
      }
    });
  }

  function flash(btn, ok) {
    btn.classList.add(ok ? 'is-copied' : 'is-failed');
    btn.innerHTML = (ok ? ICON_CHECK : ICON_COPY) +
      '<span class="code-copy-label">' + (ok ? 'Copied' : 'Failed') + '</span>';
    setTimeout(() => {
      btn.classList.remove('is-copied', 'is-failed');
      btn.innerHTML = ICON_COPY + '<span class="code-copy-label">Copy</span>';
    }, 1200);
  }

  function scanAll() {
    document.querySelectorAll('pre').forEach(attachToPre);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAll);
  } else {
    scanAll();
  }

  // Re-scan if pages add code blocks dynamically (e.g. tabs that swap content).
  const obs = new MutationObserver(() => scanAll());
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
