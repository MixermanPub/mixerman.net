// Netlify runs a function with this exact name after every verified form
// submission. Two jobs, each on its own so one failing never blocks the other:
//   1. every desk-copy request is appended as a row to Eric's Google Sheet
//      (via the Apps Script web app in netlify/apps-script/desk-copy-sheet.gs)
//   2. anyone who leaves the opt-in box ticked on the contact, retreat or
//      desk-copy form joins the Kit list, and gets whatever tags the form sent
// Environment variables (site settings → Environment variables):
//   KIT_API_KEY            Kit v4 API key
//   SHEETS_WEBHOOK_URL     the Apps Script web app URL (ends in /exec)
//   SHEETS_WEBHOOK_SECRET  the same string pasted into the Apps Script's SECRET
const SHEET_FORMS = ['desk-copy'];
const SUBSCRIBING_FORMS = ['contact', 'retreat-interest', 'desk-copy'];

export async function handler(event) {
  let payload;
  try {
    ({ payload } = JSON.parse(event.body));
  } catch (err) {
    console.error('submission-created: unreadable body', err);
    return { statusCode: 200, body: 'bad body' };
  }
  const form = payload?.form_name;

  if (SHEET_FORMS.includes(form)) await appendToSheet(payload);
  if (SUBSCRIBING_FORMS.includes(form)) await subscribeToKit(payload);

  // always 200 — a downstream hiccup must never make Netlify treat the message itself as failed
  return { statusCode: 200, body: 'ok' };
}

async function appendToSheet(payload) {
  try {
    const url = process.env.SHEETS_WEBHOOK_URL;
    const secret = process.env.SHEETS_WEBHOOK_SECRET;
    if (!url || !secret) {
      console.error('SHEETS_WEBHOOK_URL / SHEETS_WEBHOOK_SECRET not set; row not written for', payload?.data?.email);
      return;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        form: payload.form_name,
        submitted: payload.created_at,
        submissionId: payload.id,
        siteUrl: payload.site_url,
        data: payload.data || {},
      }),
    });
    const text = await res.text();
    if (!res.ok || !/^ok/i.test(text.trim())) console.error('Sheet append failed', res.status, text.slice(0, 300));
    else console.log('sheet row added for', payload?.data?.email);
  } catch (err) {
    console.error('Sheet append error', err);
  }
}

async function subscribeToKit(payload) {
  try {
    // the opt-in box is ticked by default; unticked sends nothing at all
    if (payload?.data?.subscribe !== 'yes') return;
    const email = payload?.data?.email;
    if (!email) return;
    const first = (payload?.data?.name || '').trim().split(/\s+/)[0];

    const key = process.env.KIT_API_KEY;
    if (!key) {
      console.error('KIT_API_KEY is not set; skipped subscribing', email);
      return;
    }
    const res = await fetch('https://api.kit.com/v4/subscribers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Kit-Api-Key': key },
      body: JSON.stringify({ email_address: email, first_name: first || undefined }),
    });
    if (!res.ok) {
      console.error('Kit subscribe failed', res.status, await res.text());
      return;
    }
    console.log('subscribed', email, 'via', payload.form_name);
    await tagInKit(email, payload?.data?.tags, key);
  } catch (err) {
    console.error('Kit subscribe error', err);
  }
}

// Tags arrive in the form's hidden "tags" field, comma-separated (the desk
// copy form sends "Desk Copy Request", plus "Advisory Panel Member" when they
// say yes). Kit's create-a-tag is idempotent on name — an existing tag comes
// back with 200 and its id — so it is the lookup as well as the create. The
// subscriber has to exist before it can be tagged, which is why this runs
// only after the subscribe call above succeeded.
async function tagInKit(email, tags, key) {
  const names = String(tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  const headers = { 'Content-Type': 'application/json', 'X-Kit-Api-Key': key };
  for (const name of names) {
    try {
      const made = await fetch('https://api.kit.com/v4/tags', {
        method: 'POST', headers, body: JSON.stringify({ name }),
      });
      if (!made.ok) {
        console.error('Kit tag lookup failed', name, made.status, await made.text());
        continue;
      }
      const { tag } = await made.json();
      const res = await fetch(`https://api.kit.com/v4/tags/${tag.id}/subscribers`, {
        method: 'POST', headers, body: JSON.stringify({ email_address: email }),
      });
      if (!res.ok) console.error('Kit tagging failed', name, res.status, await res.text());
      else console.log('tagged', email, name);
    } catch (err) {
      console.error('Kit tag error', name, err);
    }
  }
}
