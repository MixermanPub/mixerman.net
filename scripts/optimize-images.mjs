// Writes a webp sibling for every raster image the pages reference that is
// over the size floor, capped at MAX_W wide, and repoints the references in
// content/ and src/ to the webp. Originals stay in public/ so no old image
// URL breaks; only our own pages stop asking for them.
//   node scripts/optimize-images.mjs            # convert + rewrite
//   node scripts/optimize-images.mjs --dry-run  # report only
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.join(import.meta.dirname, '..');
const MAX_W = 1600;          // 2x the widest any page shows an image
const MAX_W_PORTRAIT = 800;  // covers never show wider than 360px; 2x that
const FLOOR = 100 * 1024;    // leave anything already this small alone
const SKIP = [/share-card/];  // og:image cards stay jpg for the crawlers
const DRY = process.argv.includes('--dry-run');

const sources = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (/\.(md|astro|css|ts|mjs)$/.test(e.name)) sources.push(p);
} };
walk(path.join(ROOT, 'content')); walk(path.join(ROOT, 'src'));

// A reference already pointing at a webp maps back to the png/jpg it was made
// from, if that original is still in public/, so the script can be run again
// after changing a cap and every image is remade from its source.
const originalOf = (url) => {
  if (!/\.webp$/i.test(url)) return url;
  for (const ext of ['.png', '.jpg', '.jpeg']) {
    const o = url.replace(/\.webp$/i, ext);
    if (fs.existsSync(path.join(ROOT, 'public', o))) return o;
  }
  return null;
};
const refs = new Set();
for (const f of sources)
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/\/(?:uploads|brand)\/[^\s"'()<>]+?\.(?:png|jpe?g|webp)/gi)) {
    const o = originalOf(m[0]); if (o) refs.add(o);
  }

const done = [];
let before = 0, after = 0;
for (const url of [...refs].sort()) {
  if (SKIP.some(r => r.test(url))) continue;
  const src = path.join(ROOT, 'public', url);
  if (!fs.existsSync(src)) { console.log(`MISSING ${url}`); continue; }
  const size = fs.statSync(src).size;
  if (size < FLOOR) continue;
  const out = src.replace(/\.(png|jpe?g)$/i, '.webp');
  const meta = await sharp(src).metadata();
  const w = Math.min(meta.width, meta.height > meta.width ? MAX_W_PORTRAIT : MAX_W);
  if (!DRY) {
    await sharp(src).rotate().resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 82, alphaQuality: 90, effort: 6 }).toFile(out);
  }
  const outSize = DRY ? 0 : fs.statSync(out).size;
  before += size; after += outSize;
  done.push({ url, webp: url.replace(/\.(png|jpe?g)$/i, '.webp') });
  console.log(`${(size/1024).toFixed(0).padStart(6)}K -> ${(outSize/1024).toFixed(0).padStart(5)}K  ${meta.width}x${meta.height}${w < meta.width ? ` -> ${w}w` : ''}  ${url}`);
}
console.log(`\n${done.length} images: ${(before/1048576).toFixed(1)} MB -> ${(after/1048576).toFixed(1)} MB`);

if (!DRY) {
  let touched = 0;
  for (const f of sources) {
    let t = fs.readFileSync(f, 'utf8'); const o = t;
    for (const { url, webp } of done) t = t.split(url).join(webp);
    if (t !== o) { fs.writeFileSync(f, t); touched++; }
  }
  console.log(`references rewritten in ${touched} files`);
}
