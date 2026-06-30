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
  const CLIENT_ID  = '200825489748-dikns9eltmg8dsv3p72o3aj5v14bed2n.apps.googleusercontent.com';
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyDxN2eYN4hqs2eDycxzo1evJQgACDwSSsGS0XtV61GHUhqiNYJRJy_R8tXD7UGHScIhQ/exec';

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
      btn.textContent = 'Sign in';
      btn.title = 'Sign in with your @eastern.edu Google account';
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

  // ── AUTH GATE ──────────────────────────────────────────────────────────────
  // On pages whose <body> has the `data-auth-required` attribute, show a
  // full-screen blocking overlay until a valid eastern.edu session exists.
  // This guarantees no quiz or sim can be started — and therefore none can be
  // completed — without being signed in, so every completion is logged.
  const GATE_ID = 'auth-gate';

  function buildGate() {
    const gate = document.createElement('div');
    gate.id = GATE_ID;
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-modal', 'true');
    gate.setAttribute('aria-label', 'Sign in required');
    gate.innerHTML =
      '<div class="auth-gate-card">' +
        '<div class="auth-gate-title">Sign in required</div>' +
        '<p class="auth-gate-msg">You must sign in with your <strong>@eastern.edu</strong> ' +
        'Google account to access this activity. Your completion is recorded for ' +
        'academic-activity reporting.</p>' +
        '<button type="button" class="auth-gate-btn">Sign in with Eastern Google</button>' +
        '<p class="auth-gate-hint">Trouble signing in? Contact your instructor.</p>' +
      '</div>';
    gate.querySelector('.auth-gate-btn').addEventListener('click', signIn);
    return gate;
  }

  function applyGate(user) {
    const required = document.body && document.body.hasAttribute('data-auth-required');
    if (!required) return;
    let gate = document.getElementById(GATE_ID);
    const signedIn = !!user;            // user is null when signed out / expired
    if (!signedIn) {
      if (!gate) {
        gate = buildGate();
        document.body.appendChild(gate);
      }
      gate.style.display = 'flex';
      document.body.classList.add('auth-gated');   // lock scroll via CSS
    } else if (gate) {
      gate.style.display = 'none';
      document.body.classList.remove('auth-gated');
    }
  }

  // ── BOOT ─────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    renderSlot();
    // onChange fires immediately with the current user, then on every change —
    // so this both gates on load and reacts to later sign-in / sign-out.
    window.Auth.onChange(applyGate);
    // Pre-load GIS so the popup is instant when the user clicks.
    ensureGsiLoaded(() => {});
  });
})();
