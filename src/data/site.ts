/* Site-wide settings that are switches rather than content.

   Google Analytics measurement ID, from Admin → Data streams → the web
   stream, shaped G-XXXXXXXXXX. Setting this back to '' turns analytics off
   everywhere at once — the script stops rendering in the head, and the
   privacy policy's Cookies and Tracking section stops describing something
   the site no longer does. That is the whole point of keeping it here: the
   promise and the practice cannot drift apart.

   The property has existed since the ericsarafin.com days and has never collected a
   thing, because the tag was never installed anywhere. */
export const gaMeasurementId = 'G-CNNRSWY5P3';

/* Page titles used to end " — Mixerman" without exception, which on a page
   already called "MIXERMAN'S Ultimate Guide to PRODUCING Records, Music &
   Songs" gave Google "…Music & Songs — Mixerman" — the name twice, and eleven
   characters spent inside a result Google cuts off at around sixty. The suffix
   is worth having where a title does not say who wrote it, and worth nothing
   where it does, so it is added only in the first case.

   The book titles stay long. They are long because the books are called that,
   the distinctive words come first, and what Google trims off the end is the
   part nobody was reading. */
export const pageTitle = (title: string) =>
  /mixerman/i.test(title) ? title : `${title} — Mixerman`;
