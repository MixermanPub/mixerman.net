# mixerman.net

The site behind the Mixerman books, blog and podcast, by Eric Sarafin. Twenty years of WordPress, rebuilt as a static site in the autumn of 2026.

Live at [mixerman.net](https://mixerman.net).

Built with Claude Code. Every decision in it is mine.

## What it is

- **[Astro](https://astro.build)**, no framework on top. Every page is rendered to plain HTML at build time. The client-side JavaScript is a few hand-written snippets where a form, a player or a sticker needs one; there is no bundle.
- **Content as Markdown.** The posts live in `content/blog`, the static pages in `content/pages`. Each file's frontmatter carries the URL it had on WordPress, so nothing that was ever linked has moved. A post is retired with one line of frontmatter, which also drops it from the sitemap.
- **Hosted on Netlify.** Forms post to Netlify's form handler; a single function in `netlify/functions` then adds the sender to the mailing list at Kit and, for desk-copy requests, appends a row to a Google Sheet through the Apps Script in `netlify/apps-script`. Secrets live in Netlify's environment, not here.
- **Redirects.** `public/_redirects` carries the old site's paths, country-routed review links and store shortlinks. Astro-level redirects in `astro.config.mjs` handle the rest.
- **Feeds.** RSS for the posts, a sitemap that leaves out the pages reached by link rather than search, and JSON-LD book schema on each book page.

## Layout

```
content/blog        the posts, one Markdown file each
content/pages       the standalone pages
src/pages           routes: home, posts, books, podcast, radio show, review
src/components      book header, store links, sampler and subscribe forms
src/layouts         the one base layout
src/data            site switches, podcast and radio-show feed snapshots
public/uploads      the media library, carried over with its original paths
netlify/            the form function and the Sheets script it talks to
scripts/            the WordPress migration, image optimisation and checks
```

## Running it

```bash
npm install
npm run dev
```

`npm run build` writes the site to `dist/`. Node 24.

## Scripts

- `scripts/migrate.mjs` pulled every post, page and image off the WordPress site through its REST API and wrote the Markdown. Run once; kept for the record.
- `scripts/optimize-images.mjs` writes a capped-width webp beside each large raster and repoints the pages at it. Originals stay put so old image URLs keep working.
- `scripts/fetch-podcast-feed.mjs` snapshots the Buzzsprout feed into `src/data`.
- `scripts/check-images.mjs` and `scripts/shoot.mjs` drive Playwright over the built site to catch broken images and take full-page screenshots for review.
