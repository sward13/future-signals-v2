/** Data read from the active tab via content script messaging. */

export type PageExtractionPayload = {
  title: string;
  href: string;
  canonicalUrl: string;
  selectionText: string;
  ogDescription: string;
  twitterDescription: string;
  metaDescription: string;
};
