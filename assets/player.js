/**
 * DTSC 520 — Player state client (Phase A, ROADMAP_3.0)
 *
 * Headless module: fetches and caches the server-authoritative player state
 * (credits balance, streak, achievements, inventory, equipped layout,
 * catalog). The Phase B shell renders from this; until then it simply keeps
 * the cache warm and re-broadcasts changes.
 *
 * Include AFTER auth.js on any page that needs player state:
 *   <script src="/520_full/auth/auth.js" defer></script>
 *   <script src="/520_full/assets/player.js" defer></script>
 *
 * API:
 *   Player.getState()            -> cached state (or null), refreshing in
 *                                   the background if stale
 *   Player.refresh()             -> force a server fetch; resolves state
 *   Player.purchase(itemId)      -> server-validated purchase; resolves
 *                                   {ok, balance} or {ok:false, error}
 *   Player.equip(layout)         -> save workspace layout JSON
 *   Player.onChange(fn)          -> fn(state) now and on every change
 *
 * Events (on document):
 *   'dtsc520:award'  (from auth.js) -> credits/badges just earned; player.js
 *                    listens, patches the cache, re-emits 'dtsc520:player'
 *   'dtsc520:player' -> detail = full state; the shell's render signal
 *
 * The cache is display-only. The server re-derives everything from verified
 * events, so editing localStorage changes nothing real.
 */
(function () {
  'use strict';

  const CACHE_KEY = 'dtsc520_player';
  const STALE_MS = 5 * 60 * 1000;   // background-refresh after 5 minutes

  let cache = loadCache();
  let inflight = null;
  const listeners = [];

  window.Player = {
    getState: function () {
      if (!cache || Date.now() - (cache._fetched || 0) > STALE_MS) refresh();
      return cache ? strip(cache) : null;
    },
    refresh: refresh,
    purchase: async function (itemId) {
      const res = await window.authPost({ action: 'purchase', itemId: itemId });
      if (res && res.ok) await refresh();
      return res;
    },
    equip: async function (layout) {
      const res = await window.authPost({ action: 'equip', layout: layout });
      if (res && res.ok && cache) {
        cache.equipped = layout;
        saveCache();
        emit();
      }
      return res;
    },
    onChange: function (fn) {
      listeners.push(fn);
      if (cache) fn(strip(cache));
    }
  };

  async function refresh() {
    if (!window.authPost) return null;
    if (inflight) return inflight;
    inflight = (async function () {
      const res = await window.authPost({ action: 'state' });
      inflight = null;
      if (!res || !res.ok) return cache ? strip(cache) : null;
      cache = res;
      cache._fetched = Date.now();
      saveCache();
      emit();
      return strip(cache);
    })();
    return inflight;
  }

  // Server told us (via auth.js) that credits/badges just landed: patch the
  // cache immediately for instant UI, then do a full refresh for truth.
  document.addEventListener('dtsc520:award', function (e) {
    const d = e.detail || {};
    if (cache) {
      if (typeof d.balance === 'number') cache.balance = d.balance;
      if (typeof d.streak === 'number') cache.streak = d.streak;
      (d.newlyEarned || []).forEach(function (a) {
        cache.achievements = cache.achievements || [];
        if (cache.achievements.indexOf(a.id) === -1) cache.achievements.push(a.id);
      });
      saveCache();
      emit();
    }
    if ((d.newlyEarned || []).length) refresh();
  });

  function emit() {
    const s = strip(cache);
    listeners.forEach(function (fn) { try { fn(s); } catch (err) {} });
    try {
      document.dispatchEvent(new CustomEvent('dtsc520:player', { detail: s }));
    } catch (err) {}
  }

  function strip(c) {
    return {
      balance: c.balance, streak: c.streak,
      achievements: c.achievements || [],
      inventory: c.inventory || [],
      equipped: c.equipped || {},
      completions: c.completions || {},
      catalog: c.catalog || { items: [], achievements: [] }
    };
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
  }

  // Warm the cache once signed in.
  document.addEventListener('DOMContentLoaded', function () {
    if (window.Auth) {
      window.Auth.onChange(function (user) {
        if (user) refresh();
      });
    }
  });
})();
