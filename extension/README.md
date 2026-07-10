# Future Signals — Chrome extension (MV3)

Captures the **active browser tab** into your Future Signals workspace as an **Input**: title, optional description (e.g. text selection), and a **cleaned** source URL. Default **project** is **Inbox** (`project_id = null`). **Subtype** defaults to `signal` and is stored **lowercase**, matching the main app’s `InputFormFields` ids.

## Stack

- Manifest **V3**, **Side panel** UI (no page overlay).
- **Vite** + React in `sidepanel.html`.
- **Supabase** with the **anon key only**; session storage uses `chrome.storage.local`.
- **Local tab extraction** via a content script + `chrome.tabs.sendMessage` (no `/api/scrape` in MVP).
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
if you use password recovery from the extension.

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
