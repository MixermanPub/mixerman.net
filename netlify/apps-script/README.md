# Desk-copy requests → Google Sheet

**Status (2026-09-02): live.** The script is installed in the "For Faculty,
Instructors and Educators" Sheet as the Apps Script project *Website desk-copy
feed*, deployed as a web app, and both Netlify variables are set. The steps
below are for rebuilding it from scratch; day to day, only "If you edit the
script later" matters.

Nothing on Netlify can write to a Google Sheet by itself, so the sheet is fed
by a small Apps Script that lives *inside the sheet*. The Netlify function
`netlify/functions/submission-created.mjs` runs after every form submission and
POSTs desk-copy requests to that script, which appends a row.

## One-time set-up (about five minutes, all in the browser)

1. Open the Google Sheet that should receive requests.
2. **Extensions → Apps Script.** Delete the sample code, paste in
   `desk-copy-sheet.gs`, and change `SECRET` to any long random string.
   Save (⌘S).
3. **Deploy → New deployment.** Type: *Web app*.
   Execute as: **Me**. Who has access: **Anyone**. Click Deploy, approve the
   permission prompt (it only asks for this spreadsheet), and copy the
   **Web app URL** (it ends in `/exec`).
   Opening that URL in a tab should show “ok — desk-copy sheet hook is deployed”.
4. In Netlify: **Site configuration → Environment variables**, add
   - `SHEETS_WEBHOOK_URL` = the web app URL
   - `SHEETS_WEBHOOK_SECRET` = the same string you put in `SECRET`
5. Redeploy the site (env vars only reach a function on its next deploy).

From then on every desk-copy request lands as a new row on the first tab —
the same one Tally writes to — with each value placed under the matching
header (Full Name, Email, Country, and so on). Columns the website form
doesn't have, such as STATUS, are left blank for you. Opening the web app URL
in a tab lists exactly which column gets which value.

## If you edit the script later

Apps Script web apps are versioned: after changing the code, use
**Deploy → Manage deployments → ✎ → Version: New version → Deploy**.
The URL stays the same. Editing the code without a new version changes nothing live.

## Checking it worked

Netlify → the site → **Logs → Functions → submission-created** shows either
`sheet row added for <email>` or the reason it didn't.
