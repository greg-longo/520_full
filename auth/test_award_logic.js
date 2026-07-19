/**
 * Node test harness for the pure logic in Code.gs (streaks + achievement
 * criteria). Run:  node test_award_logic.js
 *
 * It extracts computeStreak_ / evalCriteria_ / helper functions straight out
 * of Code.gs so the tested code IS the deployed code (no copies to drift).
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');

// Pull the pure functions + the config constants they need. Stub the Apps
// Script globals they never touch in pure paths.
const wanted = [
  'const TZ', 'const STREAK_WEEKENDS_FREE', 'const MODULE_SIMS', 'const ALL_SIMS',
  'const GRADED_SIMS',
  'function evalCriteria_', 'function computeStreak_', 'function isWeekend_',
  'function parseDay_', 'function fmtDay_', 'function sessionDays_',
  'function buildCtx_'
];
function extract(name) {
  const start = src.indexOf(name);
  if (start === -1) throw new Error('not found: ' + name);
  if (name.startsWith('const')) {
    // consts run to the first ';' at depth 0 after any {..} or [..]
    let i = start, depth = 0;
    for (;; i++) {
      const c = src[i];
      if (c === '{' || c === '[' || c === '(') depth++;
      if (c === '}' || c === ']' || c === ')') depth--;
      if (c === ';' && depth === 0) break;
    }
    return src.slice(start, i + 1);
  }
  // functions: match braces
  let i = src.indexOf('{', start), depth = 0;
  for (;; i++) {
    if (src[i] === '{') depth++;
    if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
}
// `const` declarations don't escape eval scope; `var` + sloppy-mode
// function declarations do, so the test file can see them.
const code = wanted.map(extract).join('\n').replace(/^const /gm, 'var ');
// dayKey_ uses Utilities (Apps Script) — stub a UTC version for tests.
const stub = 'function dayKey_(ts){const d=(ts instanceof Date)?ts:new Date(ts);return d.toISOString().slice(0,10);}';
eval(code + '\n' + stub);

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { pass++; }
  else { fail++; console.error('FAIL', label, '→ got', actual, 'want', expected); }
}

// ── computeStreak_ ──────────────────────────────────────────────────────────
// 2026-07-13 Mon .. 2026-07-17 Fri; 18 Sat, 19 Sun, 20 Mon
eq(computeStreak_([], '2026-07-17', true), 0, 'empty history');
eq(computeStreak_(['2026-07-17'], '2026-07-17', true), 1, 'first day');
eq(computeStreak_(['2026-07-15', '2026-07-16', '2026-07-17'], '2026-07-17', true), 3, '3 weekdays');
// Not yet active today: streak from yesterday still shows
eq(computeStreak_(['2026-07-15', '2026-07-16'], '2026-07-17', true), 2, 'yesterday anchor');
// Weekend gap: Fri active, Mon check — Sat/Sun free, streak holds
eq(computeStreak_(['2026-07-16', '2026-07-17', '2026-07-20'], '2026-07-20', true), 3, 'weekend bridged');
// Weekend day itself active: counts as bonus
eq(computeStreak_(['2026-07-17', '2026-07-18', '2026-07-20'], '2026-07-20', true), 3, 'sat counts when active');
// Missed a weekday: broken
eq(computeStreak_(['2026-07-14', '2026-07-16', '2026-07-17'], '2026-07-17', true), 2, 'wed gap breaks');
// weekendsFree=false: weekend gap breaks the chain
eq(computeStreak_(['2026-07-16', '2026-07-17', '2026-07-20'], '2026-07-20', false), 1, 'strict mode breaks on weekend');
// Saturday check-in, weekend free: anchored on Sat's own activity
eq(computeStreak_(['2026-07-16', '2026-07-17', '2026-07-18'], '2026-07-18', true), 3, 'sat active today');
// Sunday check, inactive weekend, active Fri: anchor walks back to Fri
eq(computeStreak_(['2026-07-16', '2026-07-17'], '2026-07-19', true), 2, 'sun shows fri streak');
// Long gap: nothing
eq(computeStreak_(['2026-07-10'], '2026-07-17', true), 0, 'stale history');

// ── evalCriteria_ ───────────────────────────────────────────────────────────
function ev(type, id, payload) { return { ts: '2026-07-17T12:00:00Z', type, id, score: 1, max: 1, payload: payload || {} }; }
const hist = [
  ev('sim_complete', 'escape_mcinnis', { tier: 'summa', hints: 0 }),
  ev('sim_complete', 'python_sim'),
  ev('sim_complete', 'terminal_trainer', { seconds: 250 }),
  ev('quiz_complete', 'm0_quiz'),
  ev('secret_found', 'vending_machine'),
  ev('pb_improved', 'terminal_trainer'),
  ev('pb_improved', 'terminal_trainer'),
  ev('pb_improved', 'terminal_trainer')
];
const ctx = buildCtx_(hist, 5);

eq(evalCriteria_({ type: 'event', id: 'escape_mcinnis' }, ctx), true, 'event hit');
eq(evalCriteria_({ type: 'event', id: 'aria_returns' }, ctx), false, 'event miss');
eq(evalCriteria_({ type: 'module', module: 2 }, ctx), true, 'module 2 complete (pft+mcinnis)');
eq(evalCriteria_({ type: 'module', module: 4 }, ctx), false, 'module 4 incomplete');
eq(evalCriteria_({ type: 'all_sims' }, ctx), false, 'all_sims false');
eq(evalCriteria_({ type: 'all_quizzes' }, ctx), false, 'all_quizzes false');
eq(evalCriteria_({ type: 'honors', tier: 'summa', scope: 'any' }, ctx), true, 'summa any');
eq(evalCriteria_({ type: 'honors', tier: 'summa', scope: 'all' }, ctx), false, 'summa all false');
eq(evalCriteria_({ type: 'no_hint', id: 'escape_mcinnis' }, ctx), true, 'no-hint run');
eq(evalCriteria_({ type: 'streak', days: 3 }, ctx), true, 'streak >= 3');
eq(evalCriteria_({ type: 'streak', days: 7 }, ctx), false, 'streak < 7');
eq(evalCriteria_({ type: 'speed', id: 'terminal_trainer', under_sec: 300 }, ctx), true, 'speedrun under par');
eq(evalCriteria_({ type: 'speed', id: 'terminal_trainer', under_sec: 200 }, ctx), false, 'speedrun over par');
eq(evalCriteria_({ type: 'secret', key: 'vending_machine' }, ctx), true, 'secret found');
eq(evalCriteria_({ type: 'count', event: 'pb_improved', n: 3 }, ctx), true, 'count met');
eq(evalCriteria_({ type: 'count', event: 'pb_improved', n: 4 }, ctx), false, 'count unmet');
eq(evalCriteria_({ type: 'manual' }, ctx), false, 'manual never auto');

// full-clear path: complete everything
const allDone = ALL_SIMS.map(function (s) { return ev('sim_complete', s); });
eq(evalCriteria_({ type: 'all_sims' }, buildCtx_(allDone, 0)), true, 'all_sims true');
const allQuiz = [0,1,2,3,4,5,6].map(function (m) { return ev('quiz_complete', 'm' + m + '_quiz'); });
eq(evalCriteria_({ type: 'all_quizzes' }, buildCtx_(allQuiz, 0)), true, 'all_quizzes true');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
