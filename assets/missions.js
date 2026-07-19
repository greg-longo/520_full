/**
 * DTSC 520 — Module mission block (Phase B, ROADMAP_3.0)
 *
 * Self-contained launcher-style "MISSIONS" panel for module pages. Include
 * after shell.js on modules/moduleN/index.html only:
 *   <script src="/520_full/assets/missions.js" defer></script>
 *
 * It detects the module number from the URL, inserts itself right after the
 * page banner (.mod-banner / .mod-header / .hero), and renders that module's
 * quiz + sims as launch cards with live status: localStorage first, upgraded
 * by server-verified completions from player.js (cross-device).
 */
(function () {
  'use strict';

  var m = location.pathname.match(/\/modules\/module(\d)\//);
  if (!m) return;
  var MOD = Number(m[1]);
  var S = '../../sims/';

  // type: quiz | sim | event (event = after-hours genre sims)
  var CATALOG = {
    0: [
      { type: 'quiz', title: 'Module 0 Quiz', href: 'quiz.html', event: 'm0_quiz', read: quizReader(0) },
      { type: 'sim', title: 'The Morning Brief', href: S + 'morning-brief/index.html', event: 'morning_brief',
        read: pctReader('dtsc520_morningbrief', 'score') }
    ],
    1: [
      { type: 'quiz', title: 'Module 1 Quiz', href: 'quiz.html', event: 'm1_quiz', read: quizReader(1) },
      { type: 'sim', title: 'Find Your Path', href: S + 'find-your-path/index.html', event: 'find_your_path',
        read: function () { var d = get('dtsc520_findyourpath'); return d ? done('complete') : none(); } }
    ],
    2: [
      { type: 'quiz', title: 'Module 2 Quiz', href: 'quiz.html', event: 'm2_quiz', read: quizReader(2) },
      { type: 'sim', title: 'Python Field Training', href: S + 'python_sim/index.html', event: 'python_sim', read: pftReader },
      { type: 'event', title: 'Escape from McInnis Hall', href: S + 'escape-mcinnis/index.html', event: 'escape_mcinnis',
        read: timeReader('dtsc520_escape') }
    ],
    3: [
      { type: 'quiz', title: 'Module 3 Quiz', href: 'quiz.html', event: 'm3_quiz', read: quizReader(3) },
      { type: 'sim', title: 'NumPy Lab', href: S + 'numpy-lab/index.html', event: 'numpy_lab',
        read: scoreReader('dtsc520_charttoppers', 18) },
      { type: 'sim', title: 'Debug the Pipeline', href: S + 'debug-pipeline/index.html', event: 'debug_pipeline',
        read: scoreReader('dtsc520_debugpipeline', 20) }
    ],
    4: [
      { type: 'quiz', title: 'Module 4 Quiz', href: 'quiz.html', event: 'm4_quiz', read: quizReader(4) },
      { type: 'sim', title: 'The Dirty Dataset', href: S + 'dirty-dataset/index.html', event: 'dirty_dataset',
        read: pctReader('dtsc520_dirtydataset', 'score') },
      { type: 'sim', title: 'RTG Investigation', href: S + 'rtg-investigation/index.html', event: 'rtg_investigation', read: rtgReader },
      { type: 'event', title: 'ARIA Returns: The pandas Update', href: S + 'aria-returns/index.html', event: 'aria_returns',
        read: timeReader('dtsc520_ariareturns') }
    ],
    5: [
      { type: 'quiz', title: 'Module 5 Quiz', href: 'quiz.html', event: 'm5_quiz', read: quizReader(5) },
      { type: 'sim', title: 'The Board Meeting', href: S + 'board-meeting/index.html', event: 'board_meeting',
        read: function () { var d = get('dtsc520_boardmeeting'); return d && d.completed ? done('complete', (d.confidence != null ? d.confidence + '%' : '')) : none(); } }
    ],
    6: [
      { type: 'quiz', title: 'Module 6 Quiz', href: 'quiz.html', event: 'm6_quiz', read: quizReader(6) },
      { type: 'sim', title: 'Terminal Trainer', href: S + 'terminal-trainer/index.html', event: 'terminal_trainer',
        read: function () { var d = get('dtsc520_terminaltrainer'); return d && d.completed ? done('complete') : none(); } },
      { type: 'sim', title: 'The Branch Crisis', href: 'branch_crisis_sim.html', event: 'branch_crisis',
        read: pctReader('dtsc520_branchcrisis', 'score') }
    ]
  };

  // ── localStorage readers ────────────────────────────────────────────────
  function get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function none() { return { state: 'empty', label: 'Not started' }; }
  function done(state, extra) {
    return { state: state, label: state === 'complete' ? ('Complete' + (extra ? ' · ' + extra : '')) : 'In progress' };
  }
  function quizReader(n) {
    return function () {
      var d = get('dtsc520_quiz_m' + n);
      return d && d.completed ? done('complete', d.score + '%') : none();
    };
  }
  function pctReader(key, field) {
    return function () {
      var d = get(key);
      if (!d) return none();
      var v = d[field];
      return done('complete', v != null ? v + '%' : '');
    };
  }
  function scoreReader(key, max) {
    return function () {
      var d = get(key);
      return d ? done('complete', d.score + '/' + max) : none();
    };
  }
  function timeReader(key) {
    return function () {
      var d = get(key);
      if (d && d.completed) {
        var ms = d.bestTimeMs;
        var lbl = '';
        if (ms > 0) { var s = Math.floor(ms / 1000); lbl = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
        return done('complete', lbl);
      }
      return none();
    };
  }
  function rtgReader() {
    var d = get('dtsc520_rtginvestigation');
    if (d && d.done && d.done.every(Boolean)) {
      var pts = (d.scores || []).reduce(function (a, b) { return a + (b || 0); }, 0);
      return done('complete', pts + '/20');
    }
    if (d && d.done && d.done.some(Boolean)) return { state: 'partial', label: 'In progress' };
    return none();
  }

  function pftReader() {
    var p = get('pft_progress') || {};
    var parts = ['mod1', 'mod2', 'mod3', 'finale'];
    var n = parts.filter(function (k) { return p[k] && p[k].status === 'completed'; }).length;
    if (n === 4) return done('complete', '4/4 parts');
    if (n > 0 || parts.some(function (k) { return p[k]; })) return { state: 'partial', label: n + '/4 parts' };
    return none();
  }

  // ── Server overlay ──────────────────────────────────────────────────────
  var SERVER = {};
  function status(mission) {
    var st = mission.read();
    if (st.state !== 'complete' && SERVER[mission.event]) {
      var d = SERVER[mission.event];
      var lbl = (d.score != null && d.max > 1) ? Math.round(100 * d.score / d.max) + '%' : '';
      return { state: 'complete', label: 'Complete' + (lbl ? ' · ' + lbl : '') };
    }
    return st;
  }

  // ── Render ──────────────────────────────────────────────────────────────
  var TYPE_LABEL = { quiz: 'Quiz', sim: 'Simulation', event: 'After-hours event' };

  function render() {
    var missions = CATALOG[MOD] || [];
    var host = document.getElementById('dtsc-missions-list');
    var count = document.getElementById('dtsc-missions-count');
    if (!host) return;
    host.innerHTML = '';
    var complete = 0;
    missions.forEach(function (ms) {
      var st = status(ms);
      if (st.state === 'complete') complete++;
      var a = document.createElement('a');
      a.className = 'dm-card dm-' + st.state + ' dm-t-' + ms.type;
      a.href = ms.href;
      a.innerHTML =
        '<span class="dm-type">' + TYPE_LABEL[ms.type] + '</span>' +
        '<span class="dm-title">' + ms.title + '</span>' +
        '<span class="dm-status">' + st.label + '</span>' +
        '<span class="dm-launch">' + (st.state === 'complete' ? 'Replay' : 'Launch') + ' &rarr;</span>';
      host.appendChild(a);
    });
    if (count) count.textContent = complete + '/' + missions.length + ' complete';
  }

  function build() {
    var css = document.createElement('style');
    css.textContent =
      '#dtsc-missions{max-width:1100px;margin:1.4rem auto 0.4rem;padding:0 2rem;font-family:"IBM Plex Sans",system-ui,sans-serif}' +
      '.dm-head{display:flex;align-items:baseline;gap:0.8rem;margin-bottom:0.7rem}' +
      '.dm-head h2{font-family:"IBM Plex Mono",monospace;font-size:0.72rem;letter-spacing:0.2em;text-transform:uppercase;color:#9a948c;margin:0;font-weight:500}' +
      '#dtsc-missions-count{font-family:"IBM Plex Mono",monospace;font-size:0.7rem;color:#6f6a63}' +
      '#dtsc-missions-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:0.7rem}' +
      '.dm-card{display:flex;flex-direction:column;gap:0.3rem;padding:0.85rem 1rem;border-radius:9px;text-decoration:none;' +
        'background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.09);border-left-width:3px;' +
        'transition:border-color 0.15s,box-shadow 0.15s,background 0.15s}' +
      '.dm-card:hover,.dm-card:focus-visible{background:rgba(139,28,64,0.10);border-color:#8B1C40;box-shadow:0 0 14px rgba(139,28,64,0.35)}' +
      '.dm-empty{border-left-color:#5a554f}' +
      '.dm-partial{border-left-color:#d9932f}' +
      '.dm-complete{border-left-color:#3fa06a}' +
      '.dm-type{font-family:"IBM Plex Mono",monospace;font-size:0.6rem;letter-spacing:0.16em;text-transform:uppercase;color:#8f8981}' +
      '.dm-t-event .dm-type{color:#c9a24a}' +
      '.dm-title{font-size:0.98rem;font-weight:600;color:#e8e4de;line-height:1.25}' +
      '.dm-status{font-family:"IBM Plex Mono",monospace;font-size:0.7rem;color:#9a948c}' +
      '.dm-complete .dm-status{color:#3fa06a}' +
      '.dm-partial .dm-status{color:#d9932f}' +
      '.dm-launch{margin-top:0.25rem;font-family:"IBM Plex Mono",monospace;font-size:0.7rem;color:#a82050;opacity:0;transition:opacity 0.15s}' +
      '.dm-card:hover .dm-launch,.dm-card:focus-visible .dm-launch{opacity:1}' +
      '@media (prefers-reduced-motion: reduce){.dm-card{transition:none}.dm-launch{opacity:1}}' +
      ':root.theme-light .dm-card{background:rgba(0,0,0,0.03);border-color:rgba(0,0,0,0.14);border-left-width:3px}' +
      ':root.theme-light .dm-title{color:#1a1715}' +
      ':root.theme-light .dm-head h2,:root.theme-light .dm-status,:root.theme-light .dm-type{color:#5a5550}';
    document.head.appendChild(css);

    var sec = document.createElement('section');
    sec.id = 'dtsc-missions';
    sec.setAttribute('aria-label', 'Module ' + MOD + ' missions');
    sec.innerHTML =
      '<div class="dm-head"><h2>Module ' + MOD + ' Missions</h2>' +
      '<span id="dtsc-missions-count"></span></div>' +
      '<div id="dtsc-missions-list"></div>';

    var banner = document.querySelector('.mod-banner, .mod-header, .hero');
    if (banner) banner.insertAdjacentElement('afterend', sec);
    else document.body.insertBefore(sec, document.body.firstChild.nextSibling);

    render();
  }

  document.addEventListener('dtsc520:player', function (e) {
    SERVER = (e.detail && e.detail.completions) || {};
    render();
  });

  document.addEventListener('DOMContentLoaded', function () {
    build();
    if (window.Player) {
      var s = window.Player.getState();
      if (s) { SERVER = s.completions || {}; render(); }
    }
  });
})();
