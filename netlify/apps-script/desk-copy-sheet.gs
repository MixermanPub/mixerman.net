/**
 * Desk-copy requests → Google Sheet.
 *
 * Lives in the Google Sheet itself (Extensions → Apps Script), not on Netlify.
 * The Netlify function submission-created.mjs POSTs each desk-copy submission
 * here; this appends one row to the same tab Tally writes to, matching the
 * columns by their header text so the two feeds share one table.
 * Set-up steps are in netlify/apps-script/README.md.
 */

// paste the same string into Netlify as SHEETS_WEBHOOK_SECRET
const SECRET = 'CHANGE-ME';

// the tab that receives rows: '' means the first tab (where Tally writes)
const SHEET_NAME = '';

// Header text (lower-cased) → what to put in that column. First rule that
// matches a header wins; a header nothing matches is left blank.
const usuk = (s) => ['United States', 'United Kingdom'].includes(s.data.country);
const choice = (s) => s.data.format === 'Paperback' ? 'Paperback' : 'Ebook';
const paid = (s) => s.data.format === 'Paperback';

const RULES = [
  [/submitted|submission date|^date|timestamp/, (s) => s.submitted ? new Date(s.submitted) : new Date()],
  [/(confirm|faculty member|accredited).*\(yes\)/, (s) => s.data['faculty-confirmation'] ? 'Yes' : ''],
  [/confirm|faculty member|accredited/, (s) => s.data['faculty-confirmation']],
  [/full name|^name$/,          (s) => s.data.name],
  [/institution|school|college/,(s) => s.data.institution],
  [/country/,                   (s) => s.data.country],
  [/role/,                      (s) => s.data.role],
  [/advisory/,                  (s) => s.data.advisory],
  // Tally shows one of two paperback questions depending on country; mirror that
  [/paperback.*\$15|\$15/,      (s) => usuk(s) ? choice(s) : ''],
  [/paperback.*\$25|\$25/,      (s) => usuk(s) ? '' : choice(s)],
  [/paperback|format/,          (s) => s.data.format],
  [/address 2|address line 2|apt|suite/, (s) => s.data.street2],
  [/street|address/,            (s) => s.data.street],
  [/city/,                      (s) => s.data.city],
  [/state|province/,            (s) => s.data.state],
  [/zip|postal/,                (s) => s.data.zip],
  [/phone/,                     (s) => s.data.phone],
  // Tally expands each payment block into (price) (currency) (name) (email) (link)
  [/payment.*\(us, ?uk\).*\(price\)/,    (s) => paid(s) && usuk(s) ? 15 : ''],
  [/payment.*\(us, ?uk\).*\(currency\)/, (s) => paid(s) && usuk(s) ? 'USD' : ''],
  [/payment.*\(us, ?uk\).*\(name\)/,     (s) => paid(s) && usuk(s) ? s.data.name : ''],
  [/payment.*\(us, ?uk\).*\(email\)/,    (s) => paid(s) && usuk(s) ? s.data.email : ''],
  [/payment.*intern.*\(price\)/,          (s) => paid(s) && !usuk(s) ? 25 : ''],
  [/payment.*intern.*\(currency\)/,       (s) => paid(s) && !usuk(s) ? 'USD' : ''],
  [/payment.*intern.*\(name\)/,           (s) => paid(s) && !usuk(s) ? s.data.name : ''],
  [/payment.*intern.*\(email\)/,          (s) => paid(s) && !usuk(s) ? s.data.email : ''],
  [/payment.*\(link\)/,                   () => ''],
  [/payment.*(us|uk)/,          (s) => usuk(s) ? s.data['paperback-price'] : ''],
  [/payment.*intern/,           (s) => usuk(s) ? '' : s.data['paperback-price']],
  [/payment|price|amount/,      (s) => s.data['paperback-price']],
  [/e-?mail/,                   (s) => s.data.email],
  [/tags/,                      (s) => s.data.tags],
  [/source|via/,                () => 'Website form'],
];

function targetSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return SHEET_NAME ? (ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME)) : ss.getSheets()[0];
}

// Sheets reads a cell that starts with = (or + - @) as a formula, even when
// it arrives through appendRow. Anything a visitor typed is text, so a leading
// apostrophe pins it as text; Sheets hides the apostrophe when displaying it.
function asText(v) {
  return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
}

function headerRow(sheet) {
  const width = sheet.getLastColumn();
  return width ? sheet.getRange(1, 1, 1, width).getValues()[0].map((h) => String(h)) : [];
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply('error: bad json');
  }
  if (!body || body.secret !== SECRET) return reply('error: bad secret');
  body.data = body.data || {};

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = targetSheet();
    const headers = headerRow(sheet);
    if (!headers.length) return reply('error: sheet has no header row');
    const row = headers.map((h) => {
      const key = h.trim().toLowerCase();
      if (!key) return '';
      const rule = RULES.find(([re]) => re.test(key));
      const v = rule ? rule[1](body) : '';
      return v === undefined || v === null ? '' : asText(v);
    });
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
  return reply('ok');
}

// a GET in the browser proves the deployment is alive and shows which
// columns the script will fill, so a header change is easy to check
function doGet() {
  const headers = headerRow(targetSheet());
  const map = headers.map((h) => {
    const key = h.trim().toLowerCase();
    const rule = RULES.find(([re]) => re.test(key));
    return h + ' → ' + (rule ? rule[0].source : '(left blank)');
  });
  return reply('ok — desk-copy sheet hook is deployed\n\n' + map.join('\n'));
}

function reply(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.TEXT);
}
