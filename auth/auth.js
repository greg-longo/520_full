/**
 * DTSC 520 — Auth + activity logging
 *
 * Drop into any page with:
 *   <script src="/520_full/auth/auth.js" defer></script>
 *   <div id="auth-slot"></div>   <!-- where the sign-in chip renders -->
 *
 * To log a completion from a quiz or sim:
 *   logEvent('quiz_complete', 'm4_quiz', score, maxScore, { extras: ... });
 *   logEvent('sim_complete',  'branch_crisis', score, 20);
 *
 * Only completion events go to the server. Drafts / partial progress stay
 * in localStorage.
 */
(function () {
  'use strict';

  // ── CONFIG (edit these two values after deploying) ────────────────────────
  const CLIENT_ID  = 'PASTE_OAUTH_CLIENT_ID_HERE.apps.googleusercontent.com';
  const SCRIPT_URL = 'PASTE_APPS_SCRIPT_WEB_APP_URL_HERE';

  // ── STATE ────────────────────────────────────────────────────────────────
  const SESSION_KEY = 'dtsc520_auth';
  let state = loadSession();
  const listeners = [];

  // ── PUBLIC API ───────────────────────────────────────────────────────────
  window.Auth = {
    get user()    { return state ? { email: state.email, name: state.name } : null; },
    get token()   { return state ? state.idToken : null; },
    signIn,
    signOut,
    onChange(fn)  { listeners.push(fn); fn(window.Auth.user); },
  };

  window.logEvent = async function (eventType, eventId, score, maxScore, payload) {
    if (!state || isExpired(state)) {
      console.warn('[auth] logEvent skipped — not signed in');
      return { ok: false, error: 'not_signed_in' };
    }
    return post({
      action:    'log',
      idToken:   state.idToken,
      eventType: eventType,
      eventId:   eventId,
      score:     score,
      maxScore:  maxScore,
      payload:   payload || null
    });
  };

  window.fetchProgress = async function () {
    if (!state || isExpired(state)) return { ok: false, error: 'not_signed_in' };
    return post({ action: 'progress', idToken: state.idToken });
  };

  // ── SIGN-IN UI ───────────────────────────────────────────────────────────
  // Loads Google Identity Services and renders a chip into #auth-slot if
  // present. Pages without that slot still get the global API and can
  // call Auth.signIn() from their own button.
  function ensureGsiLoaded(cb) {
    if (window.google && window.google.accounts && window.google.accounts.id) return cb();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = cb;
    document.head.appendChild(s);
  }

  function signIn() {
    ensureGsiLoaded(() => {
      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredential,
        hd: 'eastern.edu',          // hint to Google to filter to Workspace
        ux_mode: 'popup',
        auto_select: false
      });
      google.accounts.id.prompt();
    });
  }

  function signOut() {
    state = null;
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
    renderSlot();
    listeners.forEach(fn => fn(null));
  }

  function handleCredential(resp) {
    const claims = parseJwt(resp.credential);
    if (!claims) return;
    if (claims.hd !== 'eastern.edu') {
      alert('Please sign in with your @eastern.edu account.');
      return;
    }
    state = {
      idToken: resp.credential,
      email:   claims.email,
      name:    claims.name || claims.email,
      exp:     claims.exp * 1000  // ms
    };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(state)); } catch (e) {}
    renderSlot();
    listeners.forEach(fn => fn(window.Auth.user));
  }

  // ── RENDER ───────────────────────────────────────────────────────────────
  function renderSlot() {
    const slot = document.getElementById('auth-slot');
    if (!slot) return;
    slot.innerHTML = '';
    if (state && !isExpired(state)) {
      const chip = document.createElement('div');
      chip.className = 'auth-chip';
      chip.innerHTML =
        '<span class="auth-name">' + escapeHtml(state.name) + '</span>' +
        '<button type="button" class="auth-signout">Sign out</button>';
      chip.querySelector('.auth-signout').addEventListener('click', signOut);
      slot.appendChild(chip);
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'auth-signin';
      btn.textContent = 'Sign in with Eastern Google';
      btn.addEventListener('click', signIn);
      slot.appendChild(btn);
    }
  }

  // ── HELPERS ──────────────────────────────────────────────────────────────
  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (isExpired(s)) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return s;
    } catch (e) { return null; }
  }

  function isExpired(s) {
    return !s || !s.exp || s.exp < Date.now();
  }

  function parseJwt(jwt) {
    try {
      const payload = jwt.split('.')[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decodeURIComponent(escape(decoded)));
    } catch (e) { return null; }
  }

  // POST as text/plain to skip CORS preflight (Apps Script web apps don't
  // handle OPTIONS well; this is the standard workaround).
  async function post(payload) {
    try {
      const resp = await fetch(SCRIPT_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body:    JSON.stringify(payload),
        redirect:'follow'
      });
      return await resp.json();
    } catch (e) {
      console.warn('[auth] network error', e);
      return { ok: false, error: 'network' };
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }

  // ── BOOT ─────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    renderSlot();
    // Pre-load GIS so the popup is instant when the user clicks.
    ensureGsiLoaded(() => {});
  });
})();
