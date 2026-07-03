import { PAGE_QUERY_MESSAGE_TYPE } from "../constants.js";
import type { PageExtractionPayload } from "../pageDataTypes.js";
import { resolveMetaDescription } from "./metadata.js";
import { cleanUrl } from "../utils/cleanUrl.js";

async function queryActiveTabId(): Promise<number | undefined> {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0]?.id;
}

/**
 * Reads title, raw href, optional selection via content script messaging.
 */
export async function fetchActiveTabPage(): Promise<(PageExtractionPayload & { cleanedUrl: string }) | null> {
  const tabId = await queryActiveTabId();
  if (tabId == null) return null;

  try {
    const page = (await chrome.tabs.sendMessage(tabId, {
      type: PAGE_QUERY_MESSAGE_TYPE,
    })) as PageExtractionPayload | undefined;
    if (!page?.href) return null;
    const preferredUrl = page.canonicalUrl || page.href;
    return {
      ...page,
      cleanedUrl: cleanUrl(preferredUrl),
    };
  } catch {
    try {
      const tab = await chrome.tabs.get(tabId);
      const href = tab.url ?? "";
      if (!href || href.startsWith("chrome://") || href.startsWith("edge://")) {
        return null;
      }
      return {
        title: tab.title || "",
        href,
        canonicalUrl: "",
        selectionText: "",
        ogDescription: "",
        twitterDescription: "",
        metaDescription: "",
        cleanedUrl: cleanUrl(href),
      };
    } catch {
      return null;
    }
  }
}

export function debugLogPageExtraction(page: PageExtractionPayload): void {
  if (!import.meta.env.DEV) return;
  console.debug("[fs-extension] active tab extraction", {
    title: page.title,
    href: page.href,
    canonicalUrl: page.canonicalUrl,
    hasSelectionText: page.selectionText.length > 0,
    hasOgDescription: page.ogDescription.length > 0,
    hasTwitterDescription: page.twitterDescription.length > 0,
    hasMetaDescription: page.metaDescription.length > 0,
    resolvedMetaDescription: resolveMetaDescription(page),
  });
}
