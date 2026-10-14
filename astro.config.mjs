import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';

/* Archived posts stay reachable — an old link still lands on the post — but
   they are off the posts page, off the home page and out of the RSS feed, and a
   sitemap is the one place left where the site would still be handing them to
   Google. Advertising a post you have retired is the contradiction; keeping
   its URL alive is not. Read from the posts themselves so that archiving one
   is still a single line of frontmatter and nothing here needs remembering. */
const BLOG = path.join(import.meta.dirname, 'content/blog');
const archivedSlugs = fs.readdirSync(BLOG)
  .filter((f) => f.endsWith('.md'))
  .map((f) => fs.readFileSync(path.join(BLOG, f), 'utf8'))
  .filter((src) => /^archived:\s*true\s*$/m.test(src))
  .map((src) => src.match(/^slug:\s*"([^"]+)"/m)?.[1])
  .filter(Boolean);

export default defineConfig({
  site: 'https://mixerman.net',
  trailingSlash: 'always',
  // dev server only: lets the iPad and phone reach it by the Mac's Bonjour name
  server: { allowedHosts: ['.local'] },
  integrations: [sitemap({
    // the thank-you page is where forms land, and the faculty and review pages
    // are reached by their links, not by search; none belongs in the sitemap
    filter: (page) => !page.endsWith('/thank-you/')
      && !page.endsWith('/review/')
      && !page.includes('/faculty-review-adoption-mug2prms/')
      && !archivedSlugs.some((slug) => page.endsWith(`/${slug}/`)),
  })],
  redirects: {
    // The old site's Discography nav points at the Muso.ai credit list.
    '/discography/': 'https://credits.muso.ai/search?keyword=Eric%20Sarafin',
    // Desk copy request now lives on the faculty page.
    '/deskcopy/': '/faculty-review-adoption-mug2prms/',
    // Old WordPress-era page paths still linked from the wild.
    '/about/': '/about-contact/',
    '/musicians-survival-guide-to-a-killer-record/': '/books/musicians-survival-guide-to-a-killer-record/',
    '/zen-and-the-art-of-mixing/': '/books/zen-the-art-of-mixing-mix-music-like-a-pro/',
    '/the-daily-adventures-of-mixerman/': '/books/the-daily-adventures-of-mixerman-hilarious-unauthorized-diary/',
    // Zen and the Art of Producing is out of print; its successor gets the traffic.
    '/zen-and-the-art-of-producing-2/': '/books/mm-ultimate-producing/',
    // The French and Portuguese editions of Zen are retired; the original takes their readers.
    '/books/le-zen-lart-du-mixage/': '/books/zen-the-art-of-mixing-mix-music-like-a-pro/',
    '/books/zen-e-a-arte-da-mixagem-aprender-a-mixar-com-confianca/': '/books/zen-the-art-of-mixing-mix-music-like-a-pro/',
    // TDAOMM podcast shortlinks, carried over from the WordPress site.
    '/TDAOMM-Apple/': 'https://podcasts.apple.com/us/podcast/the-daily-adventures-of-mixerman/id1638184428',
    '/TDAOMM-spotify/': 'https://open.spotify.com/show/7Mt41LeLk5CCw5JLJJEkNJ',
    '/TDAOMM-iHeart/': 'https://www.iheart.com/podcast/269-the-daily-adventures-of-mi-289362633',
  },
});
