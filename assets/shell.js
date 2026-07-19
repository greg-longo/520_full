/**
 * DTSC 520 — Game shell (Phase B, ROADMAP_3.0)
 *
 * Builds the fixed HUD bar (context-aware Back button, streak, credits,
 * sign-in chip) and the toast stack on every page that includes it. Renders
 * live from player.js state and the `dtsc520:award` events auth.js fires.
 *
 * Include order matters (all deferred):
 *   auth.css + shell.css in <head>
 *   auth.js  ->  assets/player.js  ->  assets/shell.js
 *
 * Pages that already contain a #auth-slot div get it adopted into the bar
 * automatically. Pages with data-shell-back="<url>" on <body> override the
 * computed Back target (multi-stage sims can point at their own stage map).
 */
(function () {
  'use strict';

  var BASE = '/520_full/';

  // Sim id -> home module page. Single source for Back-button wiring.
  var SIM_MODULE = {
    'morning-brief': 'modules/module0/index.html',
    'find-your-path': 'modules/module1/index.html',
    'python_sim': 'modules/module2/index.html',
    'escape-mcinnis': 'modules/module2/index.html',
    'numpy-lab': 'modules/module3/index.html',
    'debug-pipeline': 'modules/module3/index.html',
    'aria-returns': 'modules/module4/index.html',
    'rtg-investigation': 'modules/module4/index.html',
    'dirty-dataset': 'modules/module4/index.html',
    'board-meeting': 'modules/module5/index.html',
    'terminal-trainer': 'modules/module6/index.html'
  };

  // ── Context: where are we, where does Back go? ─────────────────────────
  function backTarget() {
    var b = document.body.getAttribute('data-shell-back');
    if (b) return { href: b, label: document.body.getAttribute('data-shell-back-label') || 'Back' };

    var p = location.pathname;
    var m;

    if ((m = p.match(/\/sims\/([^\/]+)\//))) {
      var mod = SIM_MODULE[m[1]];
      if (mod) {
        var n = mod.match(/module(\d)/)[1];
        return { href: BASE + mod, label: 'Module ' + n };
      }
      return { href: BASE + 'sims/index.html', label: 'Missions' };
    }
    if (p.indexOf('branch_crisis_sim') !== -1) {
      return { href: BASE + 'modules/module6/index.html', label: 'Module 6' };
    }
    if ((m = p.match(/\/modules\/module(\d)\/quiz\.html/))) {
      return { href: BASE + 'modules/module' + m[1] + '/index.html', label: 'Module ' + m[1] };
    }
    if (p.match(/\/modules\/module\d\//)) {
      return { href: BASE + 'index.html', label: 'Mission Control' };
    }
    if (p.indexOf('/capstone/') !== -1 && p.indexOf('index.html') === -1 && !p.match(/\/capstone\/$/)) {
      return { href: BASE + 'capstone/index.html', label: 'Briefing Room' };
    }
    if (p.indexOf('/capstone/') !== -1) {
      return { href: BASE + 'index.html', label: 'Mission Control' };
    }
    if (p.indexOf('/sims/') !== -1) {           // sims hub itself
      return { href: BASE + 'index.html', label: 'Mission Control' };
    }
    return null;                                 // homepage: no Back
  }

  // ── Build the bar ──────────────────────────────────────────────────────
  function buildBar() {
    var bar = document.createElement('header');
    bar.id = 'dtsc-shell';
    bar.setAttribute('role', 'banner');

    var back = backTarget();
    if (back) {
      var a = document.createElement('a');
      a.className = 'shell-back';
      a.href = back.href;
      a.innerHTML = '<span class="arr" aria-hidden="true">&larr;</span><span>' + esc(back.label) + '</span>';
      a.setAttribute('aria-label', 'Back to ' + back.label);
      bar.appendChild(a);
    }

    var crest = document.createElement('a');
    crest.className = 'shell-crest';
    crest.href = BASE + 'index.html';
    crest.innerHTML = '<img src="' + BASE + 'assets/eastern_shield.png" alt="">' +
                      '<span>DTSC 520</span>';
    crest.setAttribute('aria-label', 'DTSC 520 Mission Control');
    bar.appendChild(crest);

    var spacer = document.createElement('div');
    spacer.className = 'shell-spacer';
    bar.appendChild(spacer);

    var streak = document.createElement('span');
    streak.className = 'shell-pill streak';
    streak.id = 'shell-streak';
    streak.hidden = true;
    streak.innerHTML = '<span class="ico" aria-hidden="true">&#128293;</span><span class="val">0</span>';
    streak.setAttribute('aria-label', 'Login streak');
    streak.title = 'Login streak (weekends are free)';
    bar.appendChild(streak);

    var credits = document.createElement('span');
    credits.className = 'shell-pill credits';
    credits.id = 'shell-credits';
    credits.hidden = true;
    credits.innerHTML = '<span class="ico" aria-hidden="true">&#9672;</span><span class="val">0</span>';
    credits.setAttribute('aria-label', 'Credit balance');
    credits.title = 'Credits';
    bar.appendChild(credits);

    // Adopt (or create) the auth slot so the chip lives in the bar.
    var slot = document.getElementById('auth-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.id = 'auth-slot';
    }
    slot.classList.remove('auth-slot-fixed');
    bar.appendChild(slot);

    document.body.prepend(bar);
    document.body.classList.add('has-shell');
  }

  // ── Toasts ─────────────────────────────────────────────────────────────
  var toastStack;
  function ensureToasts() {
    if (toastStack) return toastStack;
    toastStack = document.createElement('div');
    toastStack.id = 'dtsc-toasts';
    toastStack.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastStack);
    return toastStack;
  }

  function toast(opts) {
    var stack = ensureToasts();
    var el = document.createElement('div');
    el.className = 'shell-toast ' + (opts.className || '');
    el.innerHTML =
      '<span class="t-ico" aria-hidden="true">' + (opts.icon || '&#9733;') + '</span>' +
      '<span class="t-body">' +
        (opts.kicker ? '<div class="t-kicker">' + esc(opts.kicker) + '</div>' : '') +
        '<div class="t-name">' + esc(opts.name || '') + '</div>' +
        (opts.sub ? '<div class="t-sub">' + esc(opts.sub) + '</div>' : '') +
      '</span>';
    stack.appendChild(el);
    var raf = window.requestAnimationFrame || function (f) { setTimeout(f, 16); };
    raf(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { el.remove(); }, 300);
    }, opts.ms || 5000);
    while (stack.children.length > 4) stack.firstChild.remove();
  }
  window.shellToast = toast;   // sims may reuse it

  var RARITY_ICON = {
    common: '&#9733;', rare: '&#9670;', epic: '&#9650;', legendary: '&#9819;'
  };

  document.addEventListener('dtsc520:award', function (e) {
    var d = e.detail || {};
    (d.newlyEarned || []).forEach(function (a, i) {
      setTimeout(function () {
        toast({
          className: 'rarity-' + (a.rarity || 'common'),
          icon: RARITY_ICON[a.rarity] || RARITY_ICON.common,
          kicker: (a.rarity || 'common') + ' achievement',
          name: a.name || a.id,
          sub: a.credits ? '+' + a.credits + ' credits' : '',
          ms: 6000
        });
        sfx('win');
      }, i * 700);
    });
    if (d.creditsDelta > 0 && !(d.newlyEarned || []).length) {
      toast({
        className: 'credits-toast',
        icon: '&#9672;',
        kicker: 'credits',
        name: '+' + d.creditsDelta,
        sub: d.streak > 1 ? d.streak + ' day streak' : '',
        ms: 3500
      });
      sfx('pass');
    }
  });

  // ── HUD state rendering ────────────────────────────────────────────────
  function renderState(s) {
    if (!s) return;
    setPill('shell-streak', s.streak, s.streak > 0);
    setPill('shell-credits', s.balance, typeof s.balance === 'number');
  }

  function setPill(id, val, show) {
    var el = document.getElementById(id);
    if (!el) return;
    var v = el.querySelector('.val');
    var old = v.textContent;
    el.hidden = !show;
    if (!show) return;
    var next = String(val);
    if (old !== next) {
      v.textContent = next;
      if (id === 'shell-credits') {
        el.classList.remove('bump');
        void el.offsetWidth;               // restart animation
        el.classList.add('bump');
      }
    }
  }

  document.addEventListener('dtsc520:player', function (e) { renderState(e.detail); });
  document.addEventListener('dtsc520:award', function (e) {
    var d = e.detail || {};
    renderState({ balance: d.balance, streak: d.streak });
  });

  function sfx(name) {
    try { if (window.sfx && window.sfx[name]) window.sfx[name](); } catch (err) {}
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── Boot ───────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    buildBar();
    if (window.Player) renderState(window.Player.getState());
  });
})();
