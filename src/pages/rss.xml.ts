// The posts as RSS, at /rss.xml. The WordPress site served a feed at
// /feed/, which _redirects sends here, so readers subscribed to the old
// address keep getting posts. Archived posts stay out, as they do on the
// posts page itself.
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = (await getCollection('blog', (p) => !p.data.archived))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  return rss({
    title: 'Mixerman — Posts',
    description: 'Posts and podcast appearances from Mixerman on producing, recording, and mixing records.',
    site: context.site!,
    items: posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.date,
      description: p.data.excerpt,
      link: `/${p.data.slug}/`,
    })),
    customData: '<language>en-us</language>',
  });
}
