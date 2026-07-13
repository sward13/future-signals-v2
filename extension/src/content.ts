/// <reference types="chrome" />

import type { PageExtractionPayload } from "./pageDataTypes";
import { extractPageData } from "./content/extract-page-data";
import { PAGE_QUERY_MESSAGE_TYPE, SELECTION_CHANGED_MESSAGE_TYPE } from "./constants";

// Now injected on demand via chrome.scripting.executeScript (see
// lib/activeTabPage.ts) instead of a static manifest content_scripts entry,
// so it can run without the extension holding broad host_permissions. That
// means it can be injected more than once into the same page — e.g. the side
// panel re-requests page data and re-injects defensively — so everything
// below is guarded to only run once per page.
if (!(window as unknown as { __fsContentScriptLoaded?: boolean }).__fsContentScriptLoaded) {
  (window as unknown as { __fsContentScriptLoaded?: boolean }).__fsContentScriptLoaded = true;

  // ── On-demand page data (requested by the side panel) ───────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== PAGE_QUERY_MESSAGE_TYPE) {
      return undefined;
    }
    const payload: PageExtractionPayload = extractPageData();
    sendResponse(payload);
    return true;
  });

  // ── Automatic selection push ─────────────────────────────────────────────────
  // Watches for text selections on the page and pushes them to the side panel
  // so the Description field updates without the user needing to click Reload.
  // Debounced at 300 ms to avoid flooding while dragging.

  let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let _lastSentSelection = "";

  /** Returns false if the extension was reloaded and the context is no longer valid. */
  const isContextValid = (): boolean => {
    try {
      return Boolean(chrome.runtime.id);
    } catch {
      return false;
    }
  };

  document.addEventListener("selectionchange", () => {
    if (_debounceTimer !== null) clearTimeout(_debounceTimer);

    _debounceTimer = setTimeout(() => {
      // Guard: extension may have been reloaded since this content script started.
      if (!isContextValid()) return;

      const selected = window.getSelection()?.toString()?.trim() ?? "";

      // Skip empty selections and unchanged text to avoid redundant messages.
      if (!selected || selected === _lastSentSelection) return;
      _lastSentSelection = selected;

      const canonicalUrl =
        document.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim() ?? "";

      try {
        chrome.runtime
          .sendMessage({
            type: SELECTION_CHANGED_MESSAGE_TYPE,
            selectedText: selected,
            currentUrl: window.location.href,
            canonicalUrl,
          })
          .catch(() => {
            // Side panel is not open — silently ignore.
          });
      } catch {
        // Extension context was invalidated between the guard check and sendMessage.
      }
    }, 300);
  });
}
