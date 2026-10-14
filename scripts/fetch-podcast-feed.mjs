/*
  Snapshot the Buzzsprout RSS feed for The Daily Adventures of Mixerman into
  src/data/tdaomm-podcast.json, which the podcast page builds from — that page
  is unfinished and parked at src/drafts/podcast.astro, so it is not built.

    node scripts/fetch-podcast-feed.mjs

  Why a committed snapshot rather than a fetch in the page's frontmatter: a
  build that reaches out to Buzzsprout is a build that fails when Buzzsprout
  is slow or down, and on Netlify a failed deploy still costs a deploy. The
  series is finished — 54 episodes, all from 2022 — so there is nothing to go
  stale. Run this again if the feed itself changes (an edited title, new
  episode notes) and commit what it writes.

  The audio still streams from Buzzsprout's URLs, so plays are counted there
  exactly as they are on the Buzzsprout page.
*/

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FEED = 'https://feeds.buzzsprout.com/2027446.rss';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'tdaomm-podcast.json');

/* One tag out of a chunk of XML, CDATA unwrapped. */
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  if (!m) return '';
  return m[1].replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '').trim();
};

const attr = (xml, name, which) => {
  const m = xml.match(new RegExp(`<${name}\\b[^>]*\\b${which}="([^"]*)"`));
  return m ? m[1] : '';
};

/* Titles and the channel blurb are interpolated as text, so the entities the
   feed writes have to come out as characters here or they show up on the page
   spelled out. Episode notes keep theirs: those go in as HTML. */
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', hellip: '\u2026', mdash: '\u2014', ndash: '\u2013', rsquo: '\u2019', lsquo: '\u2018', ldquo: '\u201c', rdquo: '\u201d' };
const text = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
  .replace(/&([a-z]+);/gi, (whole, name) => entities[name.toLowerCase()] ?? whole)
  .replace(/\s+/g, ' ')
  .trim();

/* Episode notes arrive as author-written HTML from a service we don't
   control, and they end up in the page through set:html. Keep the handful of
   tags that carry meaning and drop everything else, attributes included —
   only a link's href survives, and only when it is http(s) or mailto. */
const ALLOWED = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'ul', 'ol', 'li', 'a']);
const clean = (html) => html
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<\/?([a-zA-Z0-9]+)((?:"[^"]*"|'[^']*'|[^'">])*)\/?>/g, (whole, name, rest) => {
    const el = name.toLowerCase();
    if (!ALLOWED.has(el)) return '';
    if (whole.startsWith('</')) return `</${el}>`;
    if (el === 'br') return '<br />';
    if (el !== 'a') return `<${el}>`;
    const href = (rest.match(/\bhref\s*=\s*("([^"]*)"|'([^']*)')/) || [])
      .slice(2).find((v) => v !== undefined) ?? '';
    return /^(https?:|mailto:)/i.test(href.trim())
      ? `<a href="${href.trim().replace(/"/g, '&quot;')}">`
      : '<a>';
  })
  .replace(/(?:\s*<br \/>\s*){3,}/g, '<br /><br />')   // Buzzsprout's editor leaves runs of them
  .replace(/<p>\s*(?:<br \/>\s*)+/g, '<p>')
  .replace(/(?:<br \/>\s*)+<\/p>/g, '</p>')
  .replace(/<p>\s*<\/p>/g, '')
  .trim();

const res = await fetch(FEED, { headers: { 'user-agent': 'mixerman.net build' } });
if (!res.ok) throw new Error(`${FEED} answered ${res.status}`);
const xml = await res.text();

const channel = xml.split('<item>')[0];
const items = xml.split('<item>').slice(1).map((chunk) => chunk.split('</item>')[0]);

const episodes = items.map((it) => ({
  number: Number(tag(it, 'itunes:episode')),
  title: text(tag(it, 'title')),
  date: new Date(tag(it, 'pubDate')).toISOString(),
  seconds: Number(tag(it, 'itunes:duration')),
  audio: attr(it, 'enclosure', 'url'),
  bytes: Number(attr(it, 'enclosure', 'length')) || null,
  guid: tag(it, 'guid'),
  notes: clean(tag(it, 'description')),
})).sort((a, b) => a.number - b.number);   // a story, so it is told in order

const missing = episodes.filter((e) => !e.number || !e.audio || !e.seconds);
if (missing.length) throw new Error(`incomplete episodes in the feed: ${missing.map((e) => e.title).join(', ')}`);

const feed = {
  fetched: new Date().toISOString(),
  feed: FEED,
  title: text(tag(channel, 'title')),
  description: text(tag(channel, 'description')),
  copyright: text(tag(channel, 'copyright')),
  artwork: attr(channel, 'itunes:image', 'href'),
  seconds: episodes.reduce((sum, e) => sum + e.seconds, 0),
  episodes,
};

writeFileSync(OUT, `${JSON.stringify(feed, null, 2)}\n`);
console.log(`${episodes.length} episodes, ${(feed.seconds / 3600).toFixed(1)} hours → ${OUT}`);
