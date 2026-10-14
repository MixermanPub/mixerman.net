// One-shot migration: pulls all content from the live WordPress site via its
// public REST API and writes Markdown + downloads the media library.
//
//   node scripts/migrate.mjs
//
// Outputs:
//   content/blog/<slug>.md        - posts (Markdown + frontmatter)
//   content/pages/<slug>.md       - pages (nested slugs use __ separator)
//   public/uploads/...            - full WP media library, original paths kept
//   migration/raw/*.json          - raw API responses, kept for reference

import fs from 'node:fs';
import path from 'node:path';
import TurndownService from 'turndown';

const SITE = 'https://mixerman.net';
const ROOT = path.join(import.meta.dirname, '..');

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
// Podcast/video embeds and audio players must survive conversion as-is.
turndown.keep(['iframe', 'audio', 'video', 'embed', 'figure']);

async function fetchAll(endpoint) {
  const out = [];
  for (let page = 1; ; page++) {
    const url = `${SITE}/wp-json/wp/v2/${endpoint}?per_page=100&page=${page}&_embed=1`;
    const res = await fetch(url);
    if (res.status === 400) break; // past the last page
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    const batch = await res.json();
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }

function localizeUploads(html) {
  // Point all media references at our own copy of the uploads library.
  return html.replaceAll(/https?:\/\/(?:www\.)?mixerman\.net\/wp-content\/uploads\//g, '/uploads/');
}

function fm(value) {
  return JSON.stringify(value ?? '');
}

function writeMarkdown(dir, item, categories) {
  const html = localizeUploads(item.content?.rendered ?? '');
  const md = turndown.turndown(html);
  const title = turndown.turndown(item.title?.rendered ?? item.slug);
  const excerpt = turndown.turndown(item.excerpt?.rendered ?? '').trim();
  const cats = (item.categories ?? []).map(id => categories.get(id)).filter(Boolean);
  const featured = item._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? '';
  const lines = [
    '---',
    `title: ${fm(title)}`,
    `slug: ${fm(item.slug)}`,
    `date: ${fm(item.date)}`,
    `modified: ${fm(item.modified)}`,
    `wpUrl: ${fm(item.link)}`,
    `status: ${fm(item.status)}`,
    cats.length ? `categories: ${JSON.stringify(cats)}` : null,
    excerpt ? `excerpt: ${fm(excerpt)}` : null,
    featured ? `featuredImage: ${fm(localizeUploads(featured))}` : null,
    '---',
    '',
    md,
    '',
  ].filter(l => l !== null);
  // Nested page paths like books/zen-... become books__zen-....md
  const rel = new URL(item.link).pathname.replace(/^\/|\/$/g, '').replaceAll('/', '__') || 'home';
  fs.writeFileSync(path.join(dir, `${rel}.md`), lines.join('\n'));
}

async function downloadMedia(media) {
  let done = 0, failed = [];
  for (const m of media) {
    const src = m.source_url;
    if (!src || !src.includes('/wp-content/uploads/')) continue;
    const rel = src.split('/wp-content/uploads/')[1];
    const dest = path.join(ROOT, 'public/uploads', rel);
    if (fs.existsSync(dest)) { done++; continue; }
    ensure(path.dirname(dest));
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      done++;
    } catch (e) {
      failed.push(`${src}  (${e.message})`);
    }
    if (done % 25 === 0) console.log(`  media: ${done}/${media.length}`);
  }
  return { done, failed };
}

// --- run ---
ensure(path.join(ROOT, 'content/blog'));
ensure(path.join(ROOT, 'content/pages'));
ensure(path.join(ROOT, 'public/uploads'));
ensure(path.join(ROOT, 'migration/raw'));

console.log('Fetching categories…');
const catList = await fetchAll('categories');
const categories = new Map(catList.map(c => [c.id, c.name]));

console.log('Fetching posts…');
const posts = await fetchAll('posts');
console.log('Fetching pages…');
const pages = await fetchAll('pages');
console.log('Fetching media library…');
const media = await fetchAll('media');

fs.writeFileSync(path.join(ROOT, 'migration/raw/posts.json'), JSON.stringify(posts, null, 2));
fs.writeFileSync(path.join(ROOT, 'migration/raw/pages.json'), JSON.stringify(pages, null, 2));
fs.writeFileSync(path.join(ROOT, 'migration/raw/media.json'), JSON.stringify(media, null, 2));
fs.writeFileSync(path.join(ROOT, 'migration/raw/categories.json'), JSON.stringify(catList, null, 2));

for (const p of posts) writeMarkdown(path.join(ROOT, 'content/blog'), p, categories);
for (const p of pages) writeMarkdown(path.join(ROOT, 'content/pages'), p, categories);
console.log(`Wrote ${posts.length} posts, ${pages.length} pages.`);

console.log(`Downloading ${media.length} media items…`);
const { done, failed } = await downloadMedia(media);
console.log(`Media: ${done} downloaded, ${failed.length} failed.`);
if (failed.length) fs.writeFileSync(path.join(ROOT, 'migration/failed-media.txt'), failed.join('\n'));
