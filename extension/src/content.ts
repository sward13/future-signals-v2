/// <reference types="chrome" />

import type { PageExtractionPayload } from "./pageDataTypes";
import { extractPageData } from "./content/extract-page-data";
import { PAGE_QUERY_MESSAGE_TYPE, SELECTION_CHANGED_MESSAGE_TYPE } from "./constants";

// ── On-demand page data (requested by the side panel) ─────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== PAGE_QUERY_MESSAGE_TYPE) {
    return undefined;
  }
  const payload: PageExtractionPayload = extractPageData();
  sendResponse(payload);
  return true;
});

// ── Automatic selection push ───────────────────────────────────────────────────
// Watches for text selections on the page and pushes them to the side panel
// so the Description field updates without the user needing to click Reload.
// Debounced at 300 ms to avoid flooding while dragging.

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
let _lastSentSelection = "";

document.addEventListener("selectionchange", () => {
  if (_debounceTimer !== null) clearTimeout(_debounceTimer);

  _debounceTimer = setTimeout(() => {
    const selected = window.getSelection()?.toString()?.trim() ?? "";

    // Skip empty selections and unchanged text to avoid redundant messages.
    if (!selected || selected === _lastSentSelection) return;
    _lastSentSelection = selected;

    const canonicalUrl =
      document.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim() ?? "";

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
  }, 300);
});
