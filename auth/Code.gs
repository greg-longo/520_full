/**
 * DTSC 520 — Activity Logger
 * Google Apps Script web app, bound to a Google Sheet.
 *
 * Purpose: receives completion events from the course site, verifies the
 * student's Google ID token, confirms they're on the eastern.edu domain,
 * and appends a row to the `Events` sheet. Also returns a student's events
 * back so the dashboard can show "completed" markers across devices.
 *
 * Endpoints (all POSTed as text/plain JSON to avoid CORS preflight):
 *   action: "log"      -> append a completion row
 *   action: "progress" -> return all events for the signed-in student
 *   action: "lda"      -> return last activity date for an email
 *                          (only callable by ADMIN_EMAILS — for the lookup tab)
 *
 * SETUP:
 *   1. In script.google.com, create a new project bound to your tracking Sheet.
 *   2. Paste this file as Code.gs.
 *   3. Set CLIENT_ID below to the OAuth client ID from Google Cloud Console.
 *   4. Set ADMIN_EMAILS to instructor/staff emails who can run LDA lookups.
 *   5. Deploy -> New deployment -> type "Web app" -> Execute as: Me ->
 *      Who has access: Anyone. Copy the /exec URL into site/auth/auth.js.
 */

// ── CONFIG ──────────────────────────────────────────────────────────────────
const CLIENT_ID = 'PASTE_OAUTH_CLIENT_ID_HERE.apps.googleusercontent.com';
const ALLOWED_HD = 'eastern.edu';
const ADMIN_EMAILS = ['gregory.longo@eastern.edu'];
const EVENTS_SHEET = 'Events';
const HEADER_ROW = [
  'timestamp_iso', 'email', 'name', 'event_type', 'event_id',
  'score', 'max_score', 'payload_json', 'user_agent'
];

// ── ENTRY POINTS ────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || 'log';

    // Every action requires a verified Google ID token.
    const claims = verifyIdToken_(body.idToken);
    if (!claims) return json_({ ok: false, error: 'invalid_token' });
    if (claims.hd !== ALLOWED_HD) return json_({ ok: false, error: 'wrong_domain' });

    if (action === 'log')      return json_(handleLog_(body, claims, e));
    if (action === 'progress') return json_(handleProgress_(claims));
    if (action === 'lda')      return json_(handleLda_(body, claims));
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return json_({ ok: false, error: 'server_error', detail: String(err) });
  }
}

// Apps Script web apps respond to GET with a tiny health check so you can
// hit the URL in a browser tab and confirm the deployment is live.
function doGet() {
  return json_({ ok: true, service: 'dtsc520-activity-logger' });
}

// ── ACTIONS ─────────────────────────────────────────────────────────────────
function handleLog_(body, claims, e) {
  const sheet = getEventsSheet_();
  const row = [
    new Date().toISOString(),
    claims.email,
    claims.name || '',
    String(body.eventType || ''),
    String(body.eventId || ''),
    body.score == null ? '' : Number(body.score),
    body.maxScore == null ? '' : Number(body.maxScore),
    body.payload ? JSON.stringify(body.payload) : '',
    (e && e.parameter && e.parameter.ua) || ''
  ];
  sheet.appendRow(row);
  return { ok: true };
}

function handleProgress_(claims) {
  const sheet = getEventsSheet_();
  const data = sheet.getDataRange().getValues();
  const events = [];
  // Row 0 is header.
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === claims.email) {
      events.push({
        ts: data[i][0],
        type: data[i][3],
        id: data[i][4],
        score: data[i][5],
        max: data[i][6]
      });
    }
  }
  return { ok: true, email: claims.email, events: events };
}

function handleLda_(body, claims) {
  if (ADMIN_EMAILS.indexOf(claims.email) === -1) {
    return { ok: false, error: 'not_admin' };
  }
  const target = String(body.email || '').trim().toLowerCase();
  if (!target) return { ok: false, error: 'missing_email' };

  const sheet = getEventsSheet_();
  const data = sheet.getDataRange().getValues();
  let lastDate = null;
  let totalEvents = 0;
  const recent = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() === target) {
      totalEvents++;
      const ts = data[i][0];
      if (!lastDate || ts > lastDate) lastDate = ts;
      recent.push({
        ts: ts, type: data[i][3], id: data[i][4],
        score: data[i][5], max: data[i][6]
      });
    }
  }
  recent.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  return {
    ok: true,
    email: target,
    last_activity: lastDate,
    total_events: totalEvents,
    recent: recent.slice(0, 10)
  };
}

// ── HELPERS ─────────────────────────────────────────────────────────────────
function getEventsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(EVENTS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(EVENTS_SHEET);
    sheet.appendRow(HEADER_ROW);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADER_ROW.length).setFontWeight('bold');
  }
  return sheet;
}

/**
 * Verifies a Google ID token by hitting the official tokeninfo endpoint.
 * Returns the verified claims object, or null if the token is bad.
 *
 * This is the security boundary — without this step anyone could POST a
 * forged email and write rows. We trust ONLY what Google signed.
 */
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
    // Token expiry — tokeninfo returns `exp` as seconds since epoch.
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
  // One-shot: creates the Events sheet with headers if it doesn't exist.
  getEventsSheet_();
  SpreadsheetApp.getActiveSpreadsheet().toast('Events sheet ready.');
}
