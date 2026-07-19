/**
 * DTSC 520 — Activity Logger + Player State (v2, Phase A of ROADMAP_3.0)
 * Google Apps Script web app, bound to the `DTSC 520 Activity Log` Sheet.
 *
 * v1 (unchanged): verifies the student's Google ID token, confirms
 * eastern.edu, appends completion rows to `Events`, returns progress,
 * admin LDA lookup.
 *
 * v2 adds the gamification backbone. The server DERIVES all credits and
 * achievements from verified events — the client has no "give me credits"
 * verb. Balance = SUM of the append-only Ledger; disputes are auditable.
 *
 * Endpoints (POSTed as text/plain JSON to avoid CORS preflight):
 *   action: "log"        -> append a completion row, run the award pass
 *   action: "progress"   -> all events for the signed-in student (v1)
 *   action: "lda"        -> last-activity lookup (ADMIN_EMAILS only) (v1)
 *   action: "heartbeat"  -> one session_start/day; streak credit; award pass
 *   action: "state"      -> balance, inventory, equipped, badges, streak
 *   action: "purchase"   -> buy a Catalog item (server validates funds/gates)
 *   action: "equip"      -> save workspace layout JSON
 *   action: "admin_grant"-> ADMIN_EMAILS only: manual credits/badges
 *
 * REDEPLOY: paste this file over Code.gs in the existing Apps Script
 * project, run setupPlayerState() once from the editor (creates + seeds
 * the new tabs), then Deploy -> Manage deployments -> Edit -> New version.
 * The /exec URL does not change. See DEPLOYMENT.md §7.
 */

// ── CONFIG ──────────────────────────────────────────────────────────────────
const CLIENT_ID = '200825489748-dikns9eltmg8dsv3p72o3aj5v14bed2n.apps.googleusercontent.com';
const ALLOWED_HD = 'eastern.edu';
const ADMIN_EMAILS = ['gregory.longo@eastern.edu'];
const TZ = 'America/New_York';

const EVENTS_SHEET = 'Events';
const LEDGER_SHEET = 'Ledger';
const PURCHASES_SHEET = 'Purchases';
const EQUIPPED_SHEET = 'Equipped';
const CATALOG_SHEET = 'Catalog';

const HEADER_ROW = [
  'timestamp_iso', 'email', 'name', 'event_type', 'event_id',
  'score', 'max_score', 'payload_json', 'user_agent'
];
const LEDGER_HEADER = ['timestamp_iso', 'email', 'delta', 'reason', 'ref_id'];
const PURCHASES_HEADER = ['timestamp_iso', 'email', 'item_id', 'price_paid'];
const EQUIPPED_HEADER = ['email', 'layout_json', 'updated_iso'];
const CATALOG_HEADER = [
  'kind', 'id', 'name', 'description', 'rarity', 'price', 'slot',
  'gate_achievement', 'criteria_json', 'active'
];

// ── ECONOMY TUNING (ROADMAP_3.0 §5.1 starting values — tune freely) ─────────
const ECON = {
  quizBase: 50,                    // × score pct
  simWeights: {                    // first-completion credit per sim
    escape_mcinnis: 200, aria_returns: 200, board_meeting: 200,
    debug_pipeline: 150, numpy_lab: 150, rtg_investigation: 150,
    dirty_dataset: 150, python_sim: 150,
    terminal_trainer: 100, branch_crisis: 100,
    morning_brief: 100, find_your_path: 100,
    // early-access copies never pay (avoid double-earning)
    debug_pipeline_ea: 0, morning_brief_ea: 0, pitch_the_viz_ea: 0
  },
  simDefault: 100,                 // unknown sim id fallback
  honorsBonus: { summa: 100, magna: 50 },   // payload.tier, if the sim sends it
  rarityBonus: { common: 25, rare: 75, epic: 150, legendary: 300 },
  heartbeatBase: 10,
  streakMultMax: 2.0,              // 1.0 + 0.1/day, capped
  pbCredit: 15,
  pbDailyCap: 3,                   // pb_improved credits per day
  capstoneStage: 150,
  capstoneFinale: 500
};

// Weekends neither count toward nor break streaks (proposed rule; decision
// #1 in ROADMAP_3.0 §8 — flip to false to require all-days streaks).
const STREAK_WEEKENDS_FREE = true;

// Module -> sims map (used by "module" achievement criteria).
const MODULE_SIMS = {
  0: ['morning_brief'],
  1: ['find_your_path'],
  2: ['python_sim', 'escape_mcinnis'],
  3: ['numpy_lab', 'debug_pipeline'],
  4: ['aria_returns', 'rtg_investigation', 'dirty_dataset'],
  5: ['board_meeting'],
  6: ['terminal_trainer', 'branch_crisis']
};
const ALL_SIMS = Object.keys(MODULE_SIMS).reduce(function (a, k) {
  return a.concat(MODULE_SIMS[k]);
}, []);
const GRADED_SIMS = ['escape_mcinnis', 'aria_returns', 'board_meeting',
  'debug_pipeline', 'numpy_lab', 'rtg_investigation', 'dirty_dataset'];

// ── ENTRY POINTS ────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || 'log';

    const claims = verifyIdToken_(body.idToken);
    if (!claims) return json_({ ok: false, error: 'invalid_token' });
    if (claims.hd !== ALLOWED_HD) return json_({ ok: false, error: 'wrong_domain' });

    if (action === 'log')         return json_(handleLog_(body, claims, e));
    if (action === 'progress')    return json_(handleProgress_(claims));
    if (action === 'lda')         return json_(handleLda_(body, claims));
    if (action === 'heartbeat')   return json_(handleHeartbeat_(claims));
    if (action === 'state')       return json_(handleState_(claims));
    if (action === 'purchase')    return json_(handlePurchase_(body, claims));
    if (action === 'equip')       return json_(handleEquip_(body, claims));
    if (action === 'admin_grant') return json_(handleAdminGrant_(body, claims));
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return json_({ ok: false, error: 'server_error', detail: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'dtsc520-activity-logger', version: 2 });
}

// ── ACTION: log (v1 behavior + v2 award pass) ───────────────────────────────
function handleLog_(body, claims, e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const email = claims.email;
    const events = readEvents_(email);           // BEFORE this event
    const sheet = getSheet_(EVENTS_SHEET, HEADER_ROW);
    sheet.appendRow([
      new Date().toISOString(), email, claims.name || '',
      String(body.eventType || ''), String(body.eventId || ''),
      body.score == null ? '' : Number(body.score),
      body.maxScore == null ? '' : Number(body.maxScore),
      body.payload ? JSON.stringify(body.payload) : '',
      (e && e.parameter && e.parameter.ua) || ''
    ]);

    const evt = {
      type: String(body.eventType || ''), id: String(body.eventId || ''),
      score: body.score == null ? null : Number(body.score),
      max: body.maxScore == null ? null : Number(body.maxScore),
      payload: body.payload || {}
    };
    const award = awardPass_(email, events, evt);
    return {
      ok: true,
      credits_delta: award.creditsDelta,
      balance: award.balance,
      newlyEarned: award.newlyEarned,
      streak: award.streak
    };
  } finally {
    lock.releaseLock();
  }
}

// ── ACTION: heartbeat (daily session_start; streak fuel) ────────────────────
function handleHeartbeat_(claims) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const email = claims.email;
    const today = dayKey_(new Date());
    const events = readEvents_(email);
    const already = events.some(function (ev) {
      return ev.type === 'session_start' && dayKey_(ev.ts) === today;
    });
    if (already) {
      const st = playerState_(email);
      return { ok: true, deduped: true, balance: st.balance, streak: st.streak };
    }
    getSheet_(EVENTS_SHEET, HEADER_ROW).appendRow([
      new Date().toISOString(), email, claims.name || '',
      'session_start', today, '', '', '', ''
    ]);
    const evt = { type: 'session_start', id: today, score: null, max: null, payload: {} };
    const award = awardPass_(email, events, evt);
    return {
      ok: true, deduped: false,
      credits_delta: award.creditsDelta, balance: award.balance,
      newlyEarned: award.newlyEarned, streak: award.streak
    };
  } finally {
    lock.releaseLock();
  }
}

// ── ACTION: state (everything the shell needs in one call) ──────────────────
function handleState_(claims) {
  const st = playerState_(claims.email);
  return {
    ok: true, email: claims.email,
    balance: st.balance, streak: st.streak,
    achievements: st.achievements,
    inventory: st.inventory,
    equipped: st.equipped,
    completions: st.completions,
    catalog: readCatalog_()          // items + badge display data, Greg-tunable
  };
}

// ── ACTION: purchase ────────────────────────────────────────────────────────
function handlePurchase_(body, claims) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const email = claims.email;
    const itemId = String(body.itemId || '');
    const item = readCatalog_().items.find(function (i) { return i.id === itemId; });
    if (!item || !item.active) return { ok: false, error: 'unknown_item' };

    const st = playerState_(email);
    if (st.inventory.indexOf(itemId) !== -1) return { ok: false, error: 'already_owned' };
    if (item.gate_achievement &&
        st.achievements.indexOf(item.gate_achievement) === -1) {
      return { ok: false, error: 'gated', gate: item.gate_achievement };
    }
    const price = Number(item.price) || 0;
    if (st.balance < price) return { ok: false, error: 'insufficient_funds', balance: st.balance };

    const now = new Date().toISOString();
    getSheet_(LEDGER_SHEET, LEDGER_HEADER)
      .appendRow([now, email, -price, 'purchase', itemId]);
    getSheet_(PURCHASES_SHEET, PURCHASES_HEADER)
      .appendRow([now, email, itemId, price]);
    return { ok: true, balance: st.balance - price, item: itemId };
  } finally {
    lock.releaseLock();
  }
}

// ── ACTION: equip (save workspace layout) ───────────────────────────────────
function handleEquip_(body, claims) {
  const layout = body.layout;
  const raw = JSON.stringify(layout || {});
  if (raw.length > 4000) return { ok: false, error: 'layout_too_large' };

  // Every placed item must be owned.
  const st = playerState_(claims.email);
  const placed = extractItemIds_(layout);
  for (let i = 0; i < placed.length; i++) {
    if (st.inventory.indexOf(placed[i]) === -1) {
      return { ok: false, error: 'not_owned', item: placed[i] };
    }
  }

  const sheet = getSheet_(EQUIPPED_SHEET, EQUIPPED_HEADER);
  const data = sheet.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (data[r][0] === claims.email) {
      sheet.getRange(r + 1, 2, 1, 2).setValues([[raw, new Date().toISOString()]]);
      return { ok: true };
    }
  }
  sheet.appendRow([claims.email, raw, new Date().toISOString()]);
  return { ok: true };
}

// ── ACTION: admin_grant (make-goods, event prizes) ──────────────────────────
function handleAdminGrant_(body, claims) {
  if (ADMIN_EMAILS.indexOf(claims.email) === -1) return { ok: false, error: 'not_admin' };
  const target = String(body.email || '').trim().toLowerCase();
  if (!target) return { ok: false, error: 'missing_email' };
  const now = new Date().toISOString();
  const ledger = getSheet_(LEDGER_SHEET, LEDGER_HEADER);

  if (body.achievementId) {
    const ach = readCatalog_().achievements.find(function (a) {
      return a.id === String(body.achievementId);
    });
    if (!ach) return { ok: false, error: 'unknown_achievement' };
    const bonus = ECON.rarityBonus[ach.rarity] || 0;
    ledger.appendRow([now, target, bonus, 'achievement:' + ach.id, 'admin_grant']);
    return { ok: true, granted: ach.id, credits: bonus };
  }
  const delta = Number(body.delta);
  if (!delta || isNaN(delta)) return { ok: false, error: 'missing_delta' };
  ledger.appendRow([now, target, delta, 'admin_grant',
    String(body.reason || claims.email)]);
  return { ok: true, credits: delta };
}

// ── THE AWARD PASS (server-derived credits + achievements) ──────────────────
/**
 * Runs after a new event is appended. `events` = the student's history
 * BEFORE this event; `evt` = the new event. Appends Ledger rows for any
 * credits or achievements earned, and returns what's new so the client
 * can toast immediately.
 */
function awardPass_(email, events, evt) {
  const ledgerSheet = getSheet_(LEDGER_SHEET, LEDGER_HEADER);
  const ledger = readLedger_(email);
  const earned = earnedAchievements_(ledger);
  const now = new Date().toISOString();
  const newlyEarned = [];
  let creditsDelta = 0;

  const all = events.concat([{
    ts: now, type: evt.type, id: evt.id, score: evt.score, max: evt.max,
    payload: evt.payload
  }]);
  const streak = computeStreak_(sessionDays_(all), dayKey_(new Date()), STREAK_WEEKENDS_FREE);

  // 1) Completion credits (first time only).
  if (evt.type === 'quiz_complete' || evt.type === 'sim_complete') {
    const prior = events.some(function (ev) {
      return ev.type === evt.type && ev.id === evt.id;
    });
    if (!prior) {
      let credit = 0;
      if (evt.type === 'quiz_complete') {
        const pct = (evt.max > 0 && evt.score != null) ? (evt.score / evt.max) : 1;
        credit = Math.round(ECON.quizBase * Math.max(0, Math.min(1, pct)));
      } else {
        credit = (evt.id in ECON.simWeights) ? ECON.simWeights[evt.id] : ECON.simDefault;
      }
      const tier = evt.payload && evt.payload.tier;
      if (tier && ECON.honorsBonus[tier]) credit += ECON.honorsBonus[tier];
      if (credit > 0) {
        ledgerSheet.appendRow([now, email, credit, 'completion', evt.id]);
        creditsDelta += credit;
      }
    }
  }

  // 2) Capstone stage / finale credits (first time per stage).
  if (evt.type === 'capstone_stage' || evt.type === 'capstone_finale') {
    const prior = events.some(function (ev) {
      return ev.type === evt.type && ev.id === evt.id;
    });
    if (!prior) {
      const credit = evt.type === 'capstone_finale' ? ECON.capstoneFinale : ECON.capstoneStage;
      ledgerSheet.appendRow([now, email, credit, 'completion', evt.id]);
      creditsDelta += credit;
    }
  }

  // 3) Daily heartbeat credit with streak multiplier.
  if (evt.type === 'session_start') {
    const mult = Math.min(ECON.streakMultMax, 1 + 0.1 * Math.max(0, streak - 1));
    const credit = Math.round(ECON.heartbeatBase * mult);
    ledgerSheet.appendRow([now, email, credit, 'daily_login', evt.id]);
    creditsDelta += credit;
  }

  // 4) Personal-best improvements (capped per day).
  if (evt.type === 'pb_improved') {
    const today = dayKey_(new Date());
    const todays = ledger.filter(function (l) {
      return l.reason === 'pb_improved' && dayKey_(l.ts) === today;
    }).length;
    if (todays < ECON.pbDailyCap) {
      ledgerSheet.appendRow([now, email, ECON.pbCredit, 'pb_improved', evt.id]);
      creditsDelta += ECON.pbCredit;
    }
  }

  // 5) Achievement checks (server-derived; client never claims).
  const ctx = buildCtx_(all, streak);
  const catalog = readCatalog_();
  catalog.achievements.forEach(function (ach) {
    if (!ach.active || earned.indexOf(ach.id) !== -1) return;
    if (!ach.criteria || ach.criteria.type === 'manual') return;
    if (evalCriteria_(ach.criteria, ctx)) {
      const bonus = ECON.rarityBonus[ach.rarity] || 0;
      ledgerSheet.appendRow([now, email, bonus, 'achievement:' + ach.id, evt.id]);
      creditsDelta += bonus;
      newlyEarned.push({ id: ach.id, name: ach.name, rarity: ach.rarity, credits: bonus });
    }
  });

  const balance = ledger.reduce(function (s, l) { return s + l.delta; }, 0) + creditsDelta;
  return { creditsDelta: creditsDelta, balance: balance, newlyEarned: newlyEarned, streak: streak };
}

/** Build the evaluation context for achievement criteria. */
function buildCtx_(all, streak) {
  const completions = {};   // id -> best event (for sims/quizzes)
  const secrets = {};
  all.forEach(function (ev) {
    if (ev.type === 'sim_complete' || ev.type === 'quiz_complete') {
      completions[ev.id] = completions[ev.id] || [];
      completions[ev.id].push(ev);
    }
    if (ev.type === 'secret_found') secrets[ev.id] = true;
  });
  return { completions: completions, secrets: secrets, streak: streak, all: all };
}

/**
 * Criteria types (criteria_json in the Catalog sheet):
 *   {"type":"event","id":"escape_mcinnis"}           any completion of id
 *   {"type":"module","module":4}                     all of that module's sims
 *   {"type":"all_sims"}                              every sim complete
 *   {"type":"all_quizzes"}                           m0_quiz..m6_quiz complete
 *   {"type":"honors","tier":"summa","scope":"any"}   scope any|all (graded sims)
 *   {"type":"no_hint","id":"aria_returns"}           payload.hints === 0
 *   {"type":"streak","days":7}
 *   {"type":"speed","id":"terminal_trainer","under_sec":300}  payload.seconds
 *   {"type":"secret","key":"vending_machine"}        a secret_found event
 *   {"type":"count","event":"pb_improved","n":3}     n events of a type
 *   {"type":"manual"}                                admin_grant only
 */
function evalCriteria_(c, ctx) {
  switch (c.type) {
    case 'event':
      return !!ctx.completions[c.id];
    case 'module': {
      const sims = MODULE_SIMS[c.module] || [];
      return sims.length > 0 && sims.every(function (s) { return !!ctx.completions[s]; });
    }
    case 'all_sims':
      return ALL_SIMS.every(function (s) { return !!ctx.completions[s]; });
    case 'all_quizzes':
      return [0, 1, 2, 3, 4, 5, 6].every(function (m) {
        return !!ctx.completions['m' + m + '_quiz'];
      });
    case 'honors': {
      const has = function (id) {
        return (ctx.completions[id] || []).some(function (ev) {
          return ev.payload && ev.payload.tier === c.tier;
        });
      };
      if (c.scope === 'all') return GRADED_SIMS.every(has);
      return GRADED_SIMS.some(has);
    }
    case 'no_hint':
      return (ctx.completions[c.id] || []).some(function (ev) {
        return ev.payload && Number(ev.payload.hints) === 0;
      });
    case 'streak':
      return ctx.streak >= Number(c.days);
    case 'speed':
      return (ctx.completions[c.id] || []).some(function (ev) {
        return ev.payload && Number(ev.payload.seconds) > 0 &&
               Number(ev.payload.seconds) <= Number(c.under_sec);
      });
    case 'secret':
      return !!ctx.secrets[c.key];
    case 'count':
      return ctx.all.filter(function (ev) { return ev.type === c.event; }).length >= Number(c.n);
    default:
      return false;
  }
}

// ── STREAKS ─────────────────────────────────────────────────────────────────
/** Distinct yyyy-MM-dd day keys with a session_start OR any completion. */
function sessionDays_(events) {
  const days = {};
  events.forEach(function (ev) {
    if (ev.type === 'session_start' || ev.type === 'sim_complete' ||
        ev.type === 'quiz_complete') {
      days[dayKey_(ev.ts)] = true;
    }
  });
  return Object.keys(days);
}

/**
 * Consecutive-day streak ending today (or yesterday, so the streak shows
 * before today's first activity). Pure function — unit tested in
 * auth/test_award_logic.js. If weekendsFree, Sat/Sun neither count nor
 * break the chain.
 */
function computeStreak_(dayKeys, todayKey, weekendsFree) {
  const have = {};
  dayKeys.forEach(function (d) { have[d] = true; });

  let cursor = parseDay_(todayKey);
  // Anchor: today if active today, else the most recent day that could
  // legally continue a streak (skipping free weekends), else no streak.
  if (!have[fmtDay_(cursor)]) {
    let back = new Date(cursor.getTime() - 86400000);
    while (weekendsFree && isWeekend_(back)) back = new Date(back.getTime() - 86400000);
    if (!have[fmtDay_(back)]) return 0;
    cursor = back;
  }

  let streak = 0;
  while (true) {
    if (weekendsFree && isWeekend_(cursor)) {
      // free day: doesn't break, counts only if active
      if (have[fmtDay_(cursor)]) streak++;
      cursor = new Date(cursor.getTime() - 86400000);
      continue;
    }
    if (!have[fmtDay_(cursor)]) break;
    streak++;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return streak;
}

function isWeekend_(d) { const g = d.getUTCDay(); return g === 0 || g === 6; }
function parseDay_(key) { return new Date(key + 'T00:00:00Z'); }
function fmtDay_(d) { return d.toISOString().slice(0, 10); }
function dayKey_(ts) {
  const d = (ts instanceof Date) ? ts : new Date(ts);
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

// ── PLAYER STATE (assembled from the sheets) ────────────────────────────────
function playerState_(email) {
  const events = readEvents_(email);
  const ledger = readLedger_(email);
  const balance = ledger.reduce(function (s, l) { return s + l.delta; }, 0);
  const achievements = earnedAchievements_(ledger);
  const streak = computeStreak_(sessionDays_(events), dayKey_(new Date()), STREAK_WEEKENDS_FREE);

  const inventory = [];
  const pData = getSheet_(PURCHASES_SHEET, PURCHASES_HEADER).getDataRange().getValues();
  for (let i = 1; i < pData.length; i++) {
    if (pData[i][1] === email) inventory.push(String(pData[i][2]));
  }

  let equipped = {};
  const eData = getSheet_(EQUIPPED_SHEET, EQUIPPED_HEADER).getDataRange().getValues();
  for (let i = 1; i < eData.length; i++) {
    if (eData[i][0] === email) {
      try { equipped = JSON.parse(eData[i][1]); } catch (err) {}
      break;
    }
  }

  const completions = {};
  events.forEach(function (ev) {
    if (ev.type === 'sim_complete' || ev.type === 'quiz_complete' ||
        ev.type === 'capstone_stage' || ev.type === 'capstone_finale') {
      const cur = completions[ev.id];
      if (!cur || (ev.score != null && ev.score > cur.score)) {
        completions[ev.id] = { type: ev.type, score: ev.score, max: ev.max };
      }
    }
  });

  return { balance: balance, streak: streak, achievements: achievements,
           inventory: inventory, equipped: equipped, completions: completions };
}

function earnedAchievements_(ledger) {
  const ids = [];
  ledger.forEach(function (l) {
    if (l.reason && l.reason.indexOf('achievement:') === 0) {
      const id = l.reason.slice('achievement:'.length);
      if (ids.indexOf(id) === -1) ids.push(id);
    }
  });
  return ids;
}

// ── READERS ─────────────────────────────────────────────────────────────────
function readEvents_(email) {
  const data = getSheet_(EVENTS_SHEET, HEADER_ROW).getDataRange().getValues();
  const out = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] !== email) continue;
    let payload = {};
    try { if (data[i][7]) payload = JSON.parse(data[i][7]); } catch (err) {}
    out.push({
      ts: data[i][0], type: String(data[i][3]), id: String(data[i][4]),
      score: data[i][5] === '' ? null : Number(data[i][5]),
      max: data[i][6] === '' ? null : Number(data[i][6]),
      payload: payload
    });
  }
  return out;
}

function readLedger_(email) {
  const data = getSheet_(LEDGER_SHEET, LEDGER_HEADER).getDataRange().getValues();
  const out = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] !== email) continue;
    out.push({ ts: data[i][0], delta: Number(data[i][2]) || 0,
               reason: String(data[i][3]), ref: String(data[i][4]) });
  }
  return out;
}

/** Catalog, cached ~60s (CacheService) since it changes rarely. */
function readCatalog_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('catalog_v1');
  if (hit) { try { return JSON.parse(hit); } catch (err) {} }

  const data = getSheet_(CATALOG_SHEET, CATALOG_HEADER).getDataRange().getValues();
  const items = [], achievements = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r[1]) continue;
    const row = {
      kind: String(r[0]), id: String(r[1]), name: String(r[2]),
      description: String(r[3]), rarity: String(r[4]) || 'common',
      price: r[5] === '' ? null : Number(r[5]),
      slot: String(r[6] || ''),
      gate_achievement: String(r[7] || ''),
      criteria: null,
      active: r[9] === true || r[9] === 'TRUE' || r[9] === 'true' || r[9] === 1
    };
    try { if (r[8]) row.criteria = JSON.parse(r[8]); } catch (err) {}
    if (row.kind === 'item') items.push(row);
    else if (row.kind === 'achievement') achievements.push(row);
  }
  const out = { items: items, achievements: achievements };
  try { cache.put('catalog_v1', JSON.stringify(out), 60); } catch (err) {}
  return out;
}

function extractItemIds_(layout) {
  const ids = [];
  (function walk(v) {
    if (v == null) return;
    if (typeof v === 'string') { if (ids.indexOf(v) === -1) ids.push(v); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === 'object') { Object.keys(v).forEach(function (k) { walk(v[k]); }); }
  })(layout);
  return ids;
}

// ── v1 ACTIONS (unchanged) ──────────────────────────────────────────────────
function handleProgress_(claims) {
  const events = readEvents_(claims.email).map(function (ev) {
    return { ts: ev.ts, type: ev.type, id: ev.id, score: ev.score, max: ev.max };
  });
  return { ok: true, email: claims.email, events: events };
}

function handleLda_(body, claims) {
  if (ADMIN_EMAILS.indexOf(claims.email) === -1) {
    return { ok: false, error: 'not_admin' };
  }
  const target = String(body.email || '').trim().toLowerCase();
  if (!target) return { ok: false, error: 'missing_email' };

  const data = getSheet_(EVENTS_SHEET, HEADER_ROW).getDataRange().getValues();
  let lastDate = null;
  let totalEvents = 0;
  const recent = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() === target) {
      totalEvents++;
      const ts = data[i][0];
      if (!lastDate || ts > lastDate) lastDate = ts;
      recent.push({ ts: ts, type: data[i][3], id: data[i][4],
                    score: data[i][5], max: data[i][6] });
    }
  }
  recent.sort(function (a, b) { return a.ts < b.ts ? 1 : -1; });
  return { ok: true, email: target, last_activity: lastDate,
           total_events: totalEvents, recent: recent.slice(0, 10) };
}

// ── HELPERS ─────────────────────────────────────────────────────────────────
function getSheet_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(header);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
  }
  return sheet;
}

function verifyIdToken_(idToken) {
  if (!idToken || typeof idToken !== 'string') return null;
  try {
    const resp = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true }
    );
    if (resp.getResponseCode() !== 200) return null;
    const claims = JSON.parse(resp.getContentText());
    if (claims.aud !== CLIENT_ID) return null;
    if (claims.email_verified !== true && claims.email_verified !== 'true') return null;
    if (!claims.email) return null;
    if (claims.exp && Number(claims.exp) * 1000 < Date.now()) return null;
    return claims;
  } catch (err) {
    return null;
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── MAINTENANCE (run from the script editor, not the web) ──────────────────
function setupSheet() {
  getEventsSheetCompat_();
  SpreadsheetApp.getActiveSpreadsheet().toast('Events sheet ready.');
}
function getEventsSheetCompat_() { return getSheet_(EVENTS_SHEET, HEADER_ROW); }

/**
 * ONE-SHOT for v2: creates Ledger/Purchases/Equipped/Catalog tabs and seeds
 * the Catalog with the launch achievements + items (skips ids that already
 * exist, so it is safe to re-run after adding rows by hand).
 */
function setupPlayerState() {
  getSheet_(LEDGER_SHEET, LEDGER_HEADER);
  getSheet_(PURCHASES_SHEET, PURCHASES_HEADER);
  getSheet_(EQUIPPED_SHEET, EQUIPPED_HEADER);
  const cat = getSheet_(CATALOG_SHEET, CATALOG_HEADER);

  const existing = {};
  const data = cat.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) existing[String(data[i][1])] = true;

  SEED_CATALOG.forEach(function (r) {
    if (existing[r[1]]) return;
    cat.appendRow(r);
  });
  CacheService.getScriptCache().remove('catalog_v1');
  SpreadsheetApp.getActiveSpreadsheet().toast('Player-state tabs ready + catalog seeded.');
}

// [kind, id, name, description, rarity, price, slot, gate, criteria_json, active]
const SEED_CATALOG = [
  // ── Achievements: completion ──
  ['achievement', 'ach_morning_brief', 'First Day', 'Complete Morning Brief', 'common', '', '', '', '{"type":"event","id":"morning_brief"}', true],
  ['achievement', 'ach_find_your_path', 'Pathfinder', 'Complete Find Your Path', 'common', '', '', '', '{"type":"event","id":"find_your_path"}', true],
  ['achievement', 'ach_python_sim', 'Field Trained', 'Complete Python Field Training', 'common', '', '', '', '{"type":"event","id":"python_sim"}', true],
  ['achievement', 'ach_escape', 'Escaped McInnis', 'Escape from McInnis Hall', 'rare', '', '', '', '{"type":"event","id":"escape_mcinnis"}', true],
  ['achievement', 'ach_numpy_lab', 'Array of Sunshine', 'Complete the NumPy Lab', 'common', '', '', '', '{"type":"event","id":"numpy_lab"}', true],
  ['achievement', 'ach_debug', 'Pipeline Medic', 'Debug the Pipeline before 8 AM', 'common', '', '', '', '{"type":"event","id":"debug_pipeline"}', true],
  ['achievement', 'ach_aria', 'Firmware Fixed', 'Complete ARIA Returns', 'rare', '', '', '', '{"type":"event","id":"aria_returns"}', true],
  ['achievement', 'ach_rtg', 'Grill Master', 'Complete the RTG Investigation', 'common', '', '', '', '{"type":"event","id":"rtg_investigation"}', true],
  ['achievement', 'ach_dirty', 'Data Janitor', 'Clean the Dirty Dataset', 'common', '', '', '', '{"type":"event","id":"dirty_dataset"}', true],
  ['achievement', 'ach_board', 'Board Approved', 'Survive The Board Meeting', 'rare', '', '', '', '{"type":"event","id":"board_meeting"}', true],
  ['achievement', 'ach_terminal', 'Command Line Cadet', 'Complete Terminal Trainer', 'common', '', '', '', '{"type":"event","id":"terminal_trainer"}', true],
  ['achievement', 'ach_branch', 'Merge Conflict Survivor', 'Complete Branch Crisis', 'common', '', '', '', '{"type":"event","id":"branch_crisis"}', true],
  // ── Achievements: module clears + full clear ──
  ['achievement', 'ach_m2_clear', 'Module 2 Cleared', 'Finish every Module 2 mission', 'rare', '', '', '', '{"type":"module","module":2}', true],
  ['achievement', 'ach_m3_clear', 'Module 3 Cleared', 'Finish every Module 3 mission', 'rare', '', '', '', '{"type":"module","module":3}', true],
  ['achievement', 'ach_m4_clear', 'Module 4 Cleared', 'Finish every Module 4 mission', 'rare', '', '', '', '{"type":"module","module":4}', true],
  ['achievement', 'ach_m6_clear', 'Module 6 Cleared', 'Finish every Module 6 mission', 'rare', '', '', '', '{"type":"module","module":6}', true],
  ['achievement', 'ach_full_clear', 'Full Clear', 'Complete every simulation in the course', 'epic', '', '', '', '{"type":"all_sims"}', true],
  ['achievement', 'ach_quiz_sweep', 'Quiz Sweep', 'Complete all seven module quizzes', 'rare', '', '', '', '{"type":"all_quizzes"}', true],
  // ── Achievements: mastery ──
  ['achievement', 'ach_summa_any', 'Summa', 'Earn summa cum laude in any graded sim', 'rare', '', '', '', '{"type":"honors","tier":"summa","scope":"any"}', true],
  ['achievement', 'ach_summa_all', 'Perfect Semester', 'Summa cum laude in every graded sim', 'legendary', '', '', '', '{"type":"honors","tier":"summa","scope":"all"}', true],
  ['achievement', 'ach_purist', 'Purist', 'Finish a graded sim without a single hint', 'epic', '', '', '', '{"type":"no_hint","id":"aria_returns"}', true],
  // ── Achievements: speed ──
  ['achievement', 'ach_tt_speed', 'Terminal Velocity', 'Terminal Trainer speedrun under 5:00', 'epic', '', '', '', '{"type":"speed","id":"terminal_trainer","under_sec":300}', true],
  ['achievement', 'ach_pb_grind', 'Personal Trainer', 'Improve a personal best 3 times', 'rare', '', '', '', '{"type":"count","event":"pb_improved","n":3}', true],
  // ── Achievements: streaks ──
  ['achievement', 'ach_streak3', 'Warming Up', 'Log in 3 days in a row', 'common', '', '', '', '{"type":"streak","days":3}', true],
  ['achievement', 'ach_streak7', 'Regular', 'Log in 7 days in a row', 'rare', '', '', '', '{"type":"streak","days":7}', true],
  ['achievement', 'ach_streak14', 'Locked In', 'Log in 14 days in a row', 'epic', '', '', '', '{"type":"streak","days":14}', true],
  // ── Achievements: capstone ──
  ['achievement', 'ach_capstone', 'Cabinet Approved', 'Deliver the Academic Success Report', 'legendary', '', '', '', '{"type":"count","event":"capstone_finale","n":1}', true],
  // ── Achievements: secrets (descriptions hidden client-side until earned) ──
  ['achievement', 'ach_vending', 'Exact Change', 'Ask ARIA about the vending machines', 'rare', '', '', '', '{"type":"secret","key":"vending_machine"}', true],
  ['achievement', 'ach_early_bird', 'Morning Person', 'Log in before 8 AM', 'common', '', '', '', '{"type":"manual"}', true],
  // ── Items: ducks (the collectible line) ──
  ['item', 'duck_classic', 'Classic Rubber Duck', 'The debugging companion every desk needs', 'common', 100, 'desk', '', '', true],
  ['item', 'duck_maroon', 'Eastern Maroon Duck', 'School spirit, duck form', 'common', 150, 'desk', '', '', true],
  ['item', 'duck_pirate', 'Pirate Duck', 'Yarr. It judges your variable names', 'rare', 250, 'desk', '', '', true],
  ['item', 'duck_disco', 'Disco Duck', 'Shimmers when the disco ball spins', 'epic', 400, 'desk', '', '', true],
  ['item', 'duck_grad', 'Graduation Duck', 'Tiny cap. Earned, not given', 'legendary', 600, 'desk', 'ach_full_clear', '', true],
  // ── Items: lighting ──
  ['item', 'lamp_desk', 'Desk Lamp', 'Warm pool of light for late-night pandas', 'common', 75, 'lighting', '', '', true],
  ['item', 'lamp_lava', 'Lava Lamp', 'Slow-motion focus fuel', 'rare', 200, 'lighting', '', '', true],
  ['item', 'neon_sign', 'Neon Sign', 'df.dropna() in hot pink', 'rare', 300, 'lighting', '', '', true],
  ['item', 'string_lights', 'String Lights', 'Cozy shelf glow', 'common', 125, 'lighting', '', '', true],
  ['item', 'disco_ball', 'Disco Ball', 'Spins. Sparkles. Respects reduced motion', 'epic', 500, 'lighting', '', '', true],
  // ── Items: backgrounds ──
  ['item', 'bg_mcinnis', 'McInnis at Dusk', 'Window view of the building you escaped', 'rare', 250, 'background', 'ach_escape', '', true],
  ['item', 'bg_philly', 'Philly Skyline', 'City lights past the window', 'rare', 250, 'background', '', '', true],
  ['item', 'bg_space', 'Deep Space', 'Your desk, among the stars', 'epic', 450, 'background', '', '', true],
  ['item', 'wall_maroon', 'Maroon Wall', 'Eastern colors', 'common', 75, 'background', '', '', true],
  // ── Items: desk + shelf props ──
  ['item', 'plant_monstera', 'Monstera', 'Thrives on neglect, like a cached DataFrame', 'common', 100, 'shelf', '', '', true],
  ['item', 'plant_cactus', 'Cactus', 'Low maintenance desk friend', 'common', 75, 'shelf', '', '', true],
  ['item', 'cat_tabby', 'Desk Cat', 'Sits on your keyboard at the worst times', 'epic', 450, 'desk', '', '', true],
  ['item', 'mini_terminal', 'Mini Terminal', 'Scrolls fake green code forever', 'rare', 300, 'shelf', '', '', true],
  ['item', 'coffee_mug', 'Bottomless Coffee', 'The analyst fuel', 'common', 75, 'desk', '', '', true],
  ['item', 'eagles_pennant', 'St. Davids Eagles Pennant', 'Single-A pride', 'common', 125, 'background', '', '', true],
  ['item', 'trophy_shelf', 'Trophy Shelf', 'Extra shelf tier for your flex items', 'rare', 350, 'shelf', '', '', true],
  ['item', 'rug_maroon', 'Maroon Rug', 'Ties the room together', 'common', 100, 'floor', '', '', true],
  ['item', 'beanbag', 'Beanbag Chair', 'For reading documentation, allegedly', 'rare', 250, 'floor', '', '', true],
  ['item', 'aria_plush', 'ARIA Plush', 'The building AI, huggable at last', 'legendary', 700, 'shelf', 'ach_aria', '', true]
];
