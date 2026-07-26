# Future Signals — Chrome extension (MV3)

Captures the **active browser tab** into your Future Signals workspace as an **Input**: title, optional description (e.g. text selection), and a **cleaned** source URL. Default **project** is **Inbox** (`project_id = null`). **Subtype** defaults to `signal` and is stored **lowercase**, matching the main app’s `InputFormFields` ids.

## Stack

- Manifest **V3**, **Side panel** UI (no page overlay).
- **Vite** + React in `sidepanel.html`.
- **Supabase** with the **anon key only**; session storage uses `chrome.storage.local`.
- **Local tab extraction** via a content script + `chrome.tabs.sendMessage` (no `/api/scrape` in MVP). The content script is injected on demand (`chrome.scripting.executeScript`) rather than declared as a static `content_scripts` entry, so it only runs on the tab the user is actively capturing from — never on every page load. Injection is backed by broad `host_permissions` (`http://*/*`, `https://*/*`) in the manifest, **not** `activeTab`: the earlier `activeTab`-only model broke when the side panel stayed open across a tab switch (the new tab had no grant, so "Reload from active tab" failed with "Could not read this page"). `content.js` guards its own setup so a repeat injection into the same page is a no-op.
- After a successful insert, **`embed-input`** is invoked; failures are ignored for the user-facing success state.

## Setup

```bash
cd extension
cp .env.example .env
# Edit .env — use the same Supabase URL + anon key as the web app.
npm install
npm run build
```

Load **unpacked** in Chrome: `chrome://extensions` → Developer mode → **Load unpacked** → choose `extension/dist`.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `VITE_APP_ORIGIN` | Web app base URL, no trailing slash (e.g. `https://app.futuresignals.example`) |

Supabase **Auth** → **Redirect URLs**: add  
`chrome-extension://<YOUR_EXTENSION_ID>/sidepanel.html`  
if you use password recovery from the extension. Required in both the staging and production Supabase projects.

## Known gotchas

- **`sidepanel.html` must stay listed under `manifest.json`'s `web_accessible_resources`.** The password-reset email link navigates directly to `chrome-extension://<id>/sidepanel.html` from an external page (the user's email client). Chrome blocks any top-level navigation into a `chrome-extension://` URL that isn't explicitly web-accessible (`ERR_BLOCKED_BY_CLIENT`), regardless of the auth code being correct. Opened this way, the page loads as a full undocked browser tab, not the docked side panel — `#root` in `sidepanel.html` caps at `max-width: 420px` and centers itself so the layout doesn't stretch full-bleed in that case.
- **`background.ts` opens the side panel via an explicit `chrome.action.onClicked` listener, not `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`.** This was originally required because the old `activeTab` model only granted host access in response to `onClicked` firing. That coupling is gone now that injection is backed by `host_permissions`, but the explicit-listener approach is retained deliberately: `chrome.sidePanel.open()` must be called from a user gesture, and the `onClicked` listener is that gesture. Note `openPanelOnActionClick` is a setting Chrome persists per-extension, not something derived from whether the code currently calls it — if it was ever set to `true` in a previous build, removing the call doesn't undo it; it must be explicitly set back to `false`, or `onClicked` never fires at all.

## Main app routes (reference)

The SPA is **state-driven**; URLs are mostly cosmetic. After capture, “Open Future Signals” points to `/` on `VITE_APP_ORIGIN`. Project deep links use `/projects/{uuid}` when supported by the web app.

## Manual QA checklist

1. **Sign in** — Email/password; session survives closing the side panel and reopening it.

2. **No selected text → meta description fallback** — On an `https://` page with no text selected, open the side panel. Title and URL populate from the page; Description populates from the page's meta description (og > twitter > description). No “selected text” in the description field.

3. **Selected text → description** — Select some text on the page, then open the side panel. Description field is pre-filled with the selected text (not the meta description).

4. **Selected text A → reload** — Select text A, open panel (description = A). Select different text B on the page without closing the panel, then click “Reload from active tab”. Description updates to B. Status reads “Description updated from selected text.”

5. **Selected text B → reload** — Same as above starting from B. Confirm reload replaces the previous selection correctly.

6. **Manual description preserved when no selected text** — Type a custom description in the Description field. Click “Reload from active tab” on the same page with no text selected. Your typed description is not overwritten. Status reads “Page details reloaded.” (title/URL may update) or “No new page details found.” if all fields were already set.

7. **Manual description overwritten when selected text exists** — Type a custom description. Select some text on the page. Click “Reload from active tab”. Description is replaced with the selected text. Status reads “Description updated from selected text.”

8. **Save to Inbox** — Select no project (leave “Inbox (default)”). Save. Success banner reads “Saved to Inbox.” CTA reads “Open Future Signals” and links to the app root.

9. **Save to project** — Pick a project from the dropdown. Save. Success banner reads “Saved to [Project Name].” CTA reads “Open Project” and links to `/projects/:project_id`.

10. **Failed save preserves draft** — Disconnect from the network (or disable your Supabase URL) and click Save. A user-friendly error message appears (no raw Supabase/fetch errors). The form fields and draft are intact — nothing is cleared.

11. **Sign out / sign back in preserves draft** — Start filling in a capture. Click “Sign out”. Sign back in. The draft fields are still populated (draft is stored in `chrome.storage.local`, not cleared on sign-out).

12. **Signal strength / Source confidence** — Rows render below Input type. Selecting an option shows it as selected (checkmark); clicking the selected option again clears it back to unset. Selection survives closing and reopening the side panel (draft persistence). After saving, the input's `signal_strength` / `source_confidence` columns are set in Supabase — not `signal_quality`.

13. **STEEPLED category / Time horizon / "+ Add details" disclosure** — The four classification fields (STEEPLED, Signal strength, Source confidence, Time horizon) are collapsed by default under a plain "+ Add details" toggle (no border/background/badge, just a rotating chevron) on a fresh capture. STEEPLED is a multi-select 8-pill grid — multiple categories can be selected/deselected independently. Time horizon is a flat H1/H2/H3 toggle, single-select with click-to-clear. Making any selection inside, closing the side panel, and reopening it on that page auto-expands the section (so a returning user doesn't lose sight of a prior classification) instead of showing it collapsed. After saving, the input's `steepled` array and `horizon` value are set correctly in Supabase.

14. **Toolbar / side panel icon** — The toolbar icon and the side panel's native Chrome header both show the red circular Future Signals mark, not a generic placeholder, and it's legible at actual toolbar size (~16px). The in-panel `Topbar` no longer shows a wordmark anywhere; the sign-in screen has no empty header strip above the form; the signed-in capture form still has a working, right-aligned "Sign out" button.

15. **Password reset** — From signed out, "Forgot password?" → submit email → open the actual reset email → click the link. It should open `sidepanel.html` as a full tab directly into a "choose a new password" form (not sign-in, not the capture form) — full extension reload/remove-and-reload is not required for this, but the redirect URL must be allowlisted in Supabase Auth for the extension's real ID. Mismatched password/confirmation shows "Passwords do not match" and blocks submit; under 6 characters shows the length error; a valid 6+ character matching password succeeds and lands in the normal capture flow. Sign out and back in with the new password to confirm it took. Sign in/Sign up mode tabs are hidden on both the "Forgot password?" and reset screens; "← Back to sign in" from forgot still works.

16. **Permission scope (broad `host_permissions`) + cross-tab capture** — The extension requests `host_permissions` for `http://*/*` and `https://*/*`, so on a fresh **remove-and-reload** (not just a panel refresh — Chrome caches granted permissions at install time) Chrome *will* prompt for "Read your data on all websites"; accept it. The core capture loop (title/URL/selection autopopulate on open, live selection-push on text select, "Reload from active tab", save to Supabase) should work on a normal `https://` page. **Cross-tab regression check (the bug this permission model fixes):** with the side panel open on page A, switch to a different `https://` tab B *without closing the panel*, then click "Reload from active tab" — the form must repopulate from tab B (title/URL/description), and "Start over" must repopulate too. Previously (under `activeTab`) this failed with "Could not read this page"; it must now succeed. A page Chrome won't allow script injection into (e.g. `chrome://extensions`) should still fall back gracefully to title/URL only, no crash, no selection.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run build` | Production bundle to `dist/` (side panel + background + content) |
| `npm run dev` | `vite build --watch` for iterative reloading |

## Out of scope (MVP)

- `/api/scrape` and remote HTML scraping.
- Duplicate detection.
- Images.
- **chrome.alarms** periodic refresh.
