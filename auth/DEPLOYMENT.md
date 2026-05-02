# DTSC 520 — Auth + Activity Logging: Deployment Guide

This walks you through standing up Google sign-in + an Apps Script logger + the LDA Lookup tab. One-time setup, ~30 minutes. After this, adding new quizzes and sims is just a `logEvent()` call.

The system has three pieces:

1. **Google Cloud OAuth client** — issues sign-in tokens, restricted to `eastern.edu`.
2. **Google Sheet + Apps Script** — receives events, writes rows, hosts the LDA Lookup.
3. **`auth.js` on the site** — handles sign-in and posts events.

Do them in that order. Each step ends with a "verify" check so you can catch problems early.

---

## Part 1 — Create the OAuth client (10 min)

There are two ways to do this depending on what Cloud project you have access to. **Pick one path** — they end at the same place (a Client ID you paste into `auth.js`).

| | Path A: Workspace project | Path B: Personal project |
|---|---|---|
| **Who creates the project** | Eastern IT (requires CFO approval) | You |
| **Consent screen user type** | Internal | External |
| **Where eastern.edu is enforced** | Google's sign-in screen (Google enforces) | Apps Script server-side check (we enforce) |
| **Verification needed?** | No | No (only `openid email profile` scopes are used, which are non-sensitive) |
| **When to use it** | After IT delivers the Workspace project | Right now, while waiting on IT |

**Status as of 2026-05-01:** the Workspace project request is in with IT, waiting on CFO approval. If you want to start building today, use Path B and migrate to Path A later by creating a new Client ID in the Workspace project and updating one line in `auth.js`.

### Path A — Workspace project (Internal consent screen)

Use this once IT has created a Cloud project under the eastern.edu organization with you as Owner.

1. Open https://console.cloud.google.com/ and sign in with your eastern.edu account.
2. Top-bar project picker -> select the project IT created for you.
3. Left sidebar -> **APIs & Services** -> **OAuth consent screen**.
   - User type: **Internal**
   - App name: `DTSC 520`
   - User support email: your eastern.edu address
   - Developer contact email: same
   - Save and continue through the remaining screens with defaults.
4. Left sidebar -> **APIs & Services** -> **Credentials** -> **Create credentials** -> **OAuth client ID**.
   - Application type: **Web application**
   - Name: `DTSC 520 site`
   - Authorized JavaScript origins — add both:
     - `https://greg-longo.github.io`
     - `http://localhost:8000`
   - Authorized redirect URIs: leave empty (Google Identity Services doesn't use a redirect).
   - Create.
5. Copy the **Client ID** that appears. Paste it into two files in Part 3.

**Verify:** the Credentials page lists `DTSC 520 site` with a Client ID ending in `.apps.googleusercontent.com`.

### Path B — Personal project (External consent screen)

Use this if you already own a personal Google Cloud project (or are spinning one up under your personal Google account). Functionally equivalent to Path A — just enforces the eastern.edu restriction server-side instead of at Google's sign-in screen.

1. Open https://console.cloud.google.com/ signed in to the account that owns the project.
2. Top-bar project picker -> select your project (or create one — `New Project`, name `DTSC 520 Activity Logger`).
3. Left sidebar -> **APIs & Services** -> **OAuth consent screen**.
   - User type: **External** (only option on personal projects)
   - App name: `DTSC 520`
   - User support email: your eastern.edu address
   - App logo: optional
   - App home page: `https://greg-longo.github.io/520_full/`
   - Developer contact email: your eastern.edu address
   - **Scopes** screen: leave defaults (we only use `openid`, `email`, `profile` which are non-sensitive — no scope changes needed).
   - **Test users** screen: add your own eastern.edu email plus 2-3 student test emails. While in Testing mode only these users can sign in.
   - Save.
4. Left sidebar -> **APIs & Services** -> **Credentials** -> **Create credentials** -> **OAuth client ID**.
   - Application type: **Web application**
   - Name: `DTSC 520 site`
   - Authorized JavaScript origins — add both:
     - `https://greg-longo.github.io`
     - `http://localhost:8000`
   - Authorized redirect URIs: leave empty.
   - Create.
5. Copy the **Client ID**. Paste it into two files in Part 3.
6. **Before launching to all 2,000 students** (not needed for testing): on the OAuth consent screen page, click **Publish app** to push from "Testing" to "In production." For our non-sensitive scopes this is instant and requires no Google review. Test users limit (~100) goes away.

**Verify:** the Credentials page lists `DTSC 520 site` with a Client ID ending in `.apps.googleusercontent.com`. The OAuth consent screen page shows "Publishing status: Testing" (fine for now) or "In production" (after step 6).

### Migrating from Path B to Path A later

When IT delivers the Workspace project:

1. Run through Path A steps 3-5 inside the new project to create a fresh Client ID.
2. In `site/auth/auth.js` and `site/auth/Code.gs` (the `CLIENT_ID` constant in each), replace the personal-project Client ID with the new Workspace one.
3. Re-deploy the Apps Script web app (Manage deployments -> existing deployment -> New version).
4. Old sessions remain valid until they expire (~1 hour); after that, students sign in fresh against the new Client ID seamlessly.

You can also delete the personal-project Client ID once the new one is confirmed working.

---

## Part 2 — Set up the Sheet and Apps Script (15 min)

1. Go to https://drive.google.com (signed in as eastern.edu) and create a new Google Sheet. Name it `DTSC 520 Activity Log`.
2. From inside the sheet: **Extensions** -> **Apps Script**. A new tab opens.
3. Rename the script project (top-left): `DTSC 520 Activity Logger`.
4. The editor shows a default `Code.gs`. Replace its contents with the contents of `site/auth/Code.gs` from this repo.
5. Click the **+** next to "Files" -> **Script** -> name it `LdaLookup`. Paste the contents of `site/auth/LdaLookup.gs`.
6. In `Code.gs`, edit the CONFIG block at the top:
   ```
   const CLIENT_ID = '<<paste your client ID from Part 1 step 6>>';
   const ADMIN_EMAILS = ['gregory.longo@eastern.edu']; // add staff who can run LDA lookups
   ```
   Save (Cmd+S / Ctrl+S).
7. **Build the sheets:**
   - Top of the editor, function dropdown -> select `setupSheet` -> Run. First run prompts for permissions (allow it — review the scopes, click "Continue", "Advanced -> Go to project (unsafe)", Allow). Watch for "Events sheet ready." toast in the spreadsheet tab.
   - Function dropdown -> select `setupLdaLookup` -> Run. Watch for "LDA Lookup tab ready." toast.
8. **Deploy as web app:**
   - Top right: **Deploy** -> **New deployment**.
   - Gear icon -> **Web app**.
   - Description: `v1 activity logger`
   - Execute as: **Me (your eastern.edu address)**
   - Who has access: **Anyone**  ← required, but the script itself enforces eastern.edu via token verification
   - Deploy. Authorize again if prompted.
   - Copy the **Web app URL** — ends in `/exec`. You'll paste this into `auth.js`.

**Verify:** open the Web app URL in a new browser tab. You should see `{"ok":true,"service":"dtsc520-activity-logger"}`. If you get a Google sign-in page, the deployment is set wrong — re-deploy with "Anyone" access.

---

## Part 3 — Wire the site (5 min, then commit/push)

1. Open `site/auth/auth.js` and edit the two CONFIG values at the top:
   ```
   const CLIENT_ID  = '<<same client ID>>';
   const SCRIPT_URL = '<<the /exec URL from Part 2 step 8>>';
   ```
2. On any page where you want sign-in, add to the `<head>`:
   ```html
   <link rel="stylesheet" href="/520_full/auth/auth.css">
   <script src="/520_full/auth/auth.js" defer></script>
   ```
   And drop a slot somewhere visible (top-right of the header is the natural spot):
   ```html
   <div id="auth-slot"></div>
   ```
3. To log a completion from a quiz or sim, call `logEvent()` after you record the score:
   ```js
   logEvent('quiz_complete', 'm4_quiz', score, 100);
   logEvent('sim_complete',  'branch_crisis', score, 20);
   ```
   That's the entire integration. Drafts and partial state stay in localStorage; only **completed** runs go to the server.
4. Commit + push from your Mac terminal:
   ```bash
   cd "/Users/gregory.longo/Library/CloudStorage/GoogleDrive-gregory.longo@eastern.edu/My Drive/Courses/DTSC_520/520 Cowork/520/site"
   git add auth/ index.html  # plus any pages you wired
   git commit -m "Add Google sign-in + activity logging"
   git push
   ```

**Verify the round trip:**
1. Open the live site, click "Sign in with Eastern Google", complete the popup.
2. Open the browser devtools console and run:
   ```js
   await logEvent('test', 'manual_check', 1, 1);
   ```
   Expected: `{ ok: true }`.
3. Switch to your `DTSC 520 Activity Log` spreadsheet — a new row appears in `Events` with your email and the timestamp.
4. Switch to the `LDA Lookup` tab. Type your email into the yellow cell. The "Last activity" line populates and the event table fills in.

If all four checks pass, the system is live.

---

## Day-to-day use

**Adding a new quiz or sim:**
- Include `auth.js` and `auth.css` on the page.
- Call `logEvent('sim_complete', 'your_unique_id', score, max)` when the user finishes.
- That's it — no Apps Script changes, no spreadsheet changes.

**Running an LDA lookup (financial aid request):**
- Open the spreadsheet, switch to `LDA Lookup`.
- Type the student's email in the yellow cell.
- "Last activity" is the date for the financial-aid form. Below it is the supporting event log.

**Updating the script later:**
- Edit `Code.gs` or `LdaLookup.gs` in script.google.com.
- Save.
- **Deploy -> Manage deployments -> the existing deployment -> pencil icon -> Version: New version -> Deploy.** Same `/exec` URL stays valid — no need to update `auth.js`.

**Pulling everyone's history:**
- The `Events` sheet is the source of truth. You can sort/filter/PivotTable it like any spreadsheet, or use formulas like `=COUNTIF(Events!D:D, "sim_complete")` for course-wide totals.
