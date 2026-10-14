// Loads every page of the site and reports any <img> that fails to render.
//   node scripts/check-images.mjs
// Routes are discovered from the dist/ build output (run `astro build` first).

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

function routes(dir, base = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...routes(path.join(dir, e.name), `${base}/${e.name}`));
    // redirect stubs leave the site before the page ever settles; nothing to check
    else if (e.name === 'index.html' && !fs.readFileSync(path.join(dir, e.name), 'utf8').includes('http-equiv="refresh"')) out.push(`${base}/` || '/');
  }
  return out;
}

const all = routes(DIST);
console.log(`Checking ${all.length} pages…`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
let broken = 0;

for (const r of all) {
  // 'load', not 'networkidle': a page with a podcast embed that keeps polling
  // never goes idle, and the wait below already covers every image.
  await page.goto(`http://localhost:4321${r}`, { waitUntil: 'load' });
  // Lazy images below the fold never load, so force them eager before judging,
  // then wait until every image has actually finished (loaded or errored).
  await page.$$eval('img', imgs => imgs.forEach(i => { i.loading = 'eager'; }));
  await page.waitForFunction(
    () => [...document.images].every(i => i.complete),
    { timeout: 30000 }
  ).catch(() => {});
  const bad = await page.$$eval('img', imgs =>
    imgs.filter(i => !(i.complete && i.naturalWidth > 0)).map(i => i.getAttribute('src')));
  for (const src of bad) { console.log(`BROKEN  ${r}  ->  ${src}`); broken++; }
}

await browser.close();
console.log(broken ? `${broken} broken image(s).` : 'All images render on all pages.');
process.exit(broken ? 1 : 0);
