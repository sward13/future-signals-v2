/// <reference types="chrome" />

/**
 * Open the side panel when the user clicks the toolbar action.
 *
 * Deliberately not chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }):
 * this was originally required because the old activeTab model only granted
 * host access in response to chrome.action.onClicked firing, and
 * openPanelOnActionClick opens the panel at the platform level without ever
 * firing it. That coupling is gone now that content.js injection
 * (lib/activeTabPage.ts) is backed by host_permissions instead of activeTab,
 * but the explicit-listener approach is kept on purpose: chrome.sidePanel.open()
 * must be called from a user gesture, and this onClicked listener is that gesture.
 *
 * openPanelOnActionClick is persisted by Chrome per-extension, not derived
 * from whether this code calls it — an earlier build called it with `true`
 * on every load, so that setting sticks until something explicitly clears
 * it. Must set it to false here, or onClicked below never fires at all.
 */
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

chrome.action.onClicked.addListener((tab) => {
  if (tab.id != null) void chrome.sidePanel.open({ tabId: tab.id, windowId: tab.windowId });
});
