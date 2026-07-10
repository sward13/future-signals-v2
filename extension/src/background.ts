/// <reference types="chrome" />

/**
 * Open the side panel when the user clicks the toolbar action.
 *
 * Deliberately not chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }):
 * Chrome docs state activeTab is not supported in conjunction with
 * openPanelOnActionClick, because that path opens the panel at the platform
 * level without ever firing chrome.action.onClicked — and activeTab is only
 * granted in response to that event actually firing. Since content.js
 * injection (lib/activeTabPage.ts) relies on activeTab, the panel has to be
 * opened from inside a real onClicked listener instead.
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
