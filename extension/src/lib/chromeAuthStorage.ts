/**
 * Persists Supabase auth session in chrome.storage.local so it survives restarts
 * and is available if we add other extension surfaces later.
 */
export const chromeLocalAuthStorage = {
  getItem: (key: string) =>
    chrome.storage.local.get(key).then((obj) => {
      const v = obj[key];
      return v != null && typeof v === "string" ? v : null;
    }),
  setItem: (key: string, value: string) => chrome.storage.local.set({ [key]: value }),
  removeItem: (key: string) => chrome.storage.local.remove(key),
};
