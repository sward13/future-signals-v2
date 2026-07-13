import type { PageExtractionPayload } from "../pageDataTypes";

function readMetaContent(selector: string): string {
  const el = document.querySelector(selector);
  if (!el) return "";
  const value = el.getAttribute("content")?.trim() ?? "";
  return value;
}

function readCanonicalHref(): string {
  const link = document.querySelector('link[rel="canonical"]');
  const href = link?.getAttribute("href")?.trim() ?? "";
  return href;
}

export function extractPageData(): PageExtractionPayload {
  const selectionText = window.getSelection()?.toString()?.trim() ?? "";
  const ogDescription = readMetaContent('meta[property="og:description"]');
  const twitterDescription = readMetaContent('meta[name="twitter:description"]');
  const metaDescription = readMetaContent('meta[name="description"]');
  const canonicalUrl = readCanonicalHref();

  return {
    title: document.title || "",
    href: window.location.href,
    canonicalUrl,
    selectionText,
    ogDescription,
    twitterDescription,
    metaDescription,
  };
}
