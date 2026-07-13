import type { PageExtractionPayload } from "../pageDataTypes.js";

export function resolveMetaDescription(page: PageExtractionPayload): string {
  return page.ogDescription || page.twitterDescription || page.metaDescription || "";
}

export function resolveBestDescription(page: PageExtractionPayload): string {
  return page.selectionText || resolveMetaDescription(page);
}
