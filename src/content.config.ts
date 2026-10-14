import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const wpFields = {
  title: z.string(),
  slug: z.string(),
  date: z.coerce.date(),
  modified: z.coerce.date().optional(),
  wpUrl: z.string(),
  status: z.string(),
  categories: z.array(z.string()).optional(),
  excerpt: z.string().optional(),
  featuredImage: z.string().optional(),
  /* shadowless, transparent cover used only on the Books index cards */
  cardImage: z.string().optional(),
  /* short title for the Books index cards; the full title still runs the book page */
  cardTitle: z.string().optional(),
  /* which part of a card image survives the card's 16:10 crop —
     any CSS object-position value, e.g. "top". Defaults to the centre. */
  cardFocus: z.string().optional(),
  /* BCP 47 language of a translated edition, e.g. "fr"; English when unset */
  language: z.string().optional(),
  /* archived posts keep their URL alive but stay off the posts page and home listings */
  archived: z.boolean().optional(),
  justify: z.boolean().optional(), // fill-justify the page's prose
  /* a post that opens on the Producing sampler form, so the reader asks for
     it here rather than being sent to the book page to find it */
  sampler: z.boolean().optional(),
  /* the cover as the page shows it, transparent; featuredImage keeps the one
     with its background, which is what a link preview needs */
  coverImage: z.string().optional(),
  /* the band behind the foot buy box, when the page wants one: "white" puts a
     cream card on white (for a pale cover), "cream" puts the white card on cream */
  footBand: z.enum(['white', 'cream']).optional(),
  /* a buy card whose one format holds two or three buttons can read better as
     a column than as a wide, shallow row */
  buyStack: z.boolean().optional(),
  /* formats the foot box leaves out, where the page has already listed them */
  footOmit: z.array(z.string()).optional(),
  buyLinks: z.array(z.object({
    format: z.string(),
    links: z.array(z.object({ label: z.string(), url: z.string(), note: z.string().optional(), sticker: z.string().optional() })),
  })).optional(),
};

const blog = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/blog' }),
  schema: z.object(wpFields),
});

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './content/pages' }),
  schema: z.object(wpFields),
});

export const collections = { blog, pages };
