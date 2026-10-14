// Full-page screenshots of the dev site for visual review.
//   node scripts/shoot.mjs [path ...]
// Writes migration/shots/<name>.png

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'migration/shots');
fs.mkdirSync(OUT, { recursive: true });

// --mobile flag shoots at iPhone size instead of desktop.
const args = process.argv.slice(2);
const mobile = args.includes('--mobile');
const paths = args.filter(a => a !== '--mobile');
const targets = paths.length ? paths : ['/'];

const browser = await chromium.launch();
const page = await browser.newPage(
  mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 900 } }
);

for (const p of targets) {
  const base = p === '/' ? 'home' : p.replace(/^\/|\/$/g, '').replaceAll('/', '__');
  const name = mobile ? `${base}--mobile` : base;
  await page.goto(`http://localhost:4321${p}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  console.log(`${name}.png`);
}
await browser.close();
