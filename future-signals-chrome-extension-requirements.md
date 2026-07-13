# Future Signals v2 Chrome Extension Requirements

## 1. Product purpose

The Chrome extension lets a Future Signals user capture a web page as a new **Input** while browsing.

The goal is to make signal capture fast, lightweight, and reliable. The extension should help users avoid losing useful sources, while still giving them enough structure to make the input useful inside Future Signals later.

The extension should prioritize:

1. Fast capture
2. Clean metadata extraction
3. Selected-text capture
4. User editability
5. Graceful fallback when scraping/metadata extraction is blocked
6. Reliable save to Supabase
7. Clear success/failure feedback
8. Easy return path to the Future Signals web app

---

## 2. Recommended implementation approach

Build a **Manifest V3 Chrome extension** using React, Vite, and TypeScript.

Do **not** try to reuse the old Bubble extension. Do **not** start from a fully blank folder unless necessary. Recommended approach:

> Create a clean MV3 React/Vite/TypeScript extension package in the same repo as the main Future Signals app, use Chrome’s native side panel API, and build the Future Signals-specific auth, metadata extraction, project selection, and Supabase insert logic on top.

The extension should use Chrome’s native **side panel** rather than injecting a custom overlay into every webpage.

### Why side panel instead of injected overlay?

#### Side panel advantages

- More stable across websites
- Avoids page CSS conflicts
- Avoids z-index issues
- Less likely to break page layout
- Better Chrome-native UX
- Easier to reason about permissions
- Cleaner Chrome Web Store review path

#### Injected overlay disadvantages

- Fragile across websites
- Can conflict with website styles
- Can be blocked by site policies
- More complex DOM/CSS isolation
- More likely to produce strange behavior on heavily styled pages

---

## 3. Repo/codebase recommendation

The extension should live in the **same codebase/repo** as the main Future Signals application, but as a separate app/package or folder.

Preferred structure if using a monorepo-style layout:

```text
future-signals/
  apps/
    web/
    extension/
  packages/
    shared/
```

If the current app is not yet structured as a monorepo, start with:

```text
future-signals/
  app/
  components/
  lib/
  supabase/
  extension/
    manifest.json
    src/
      background/
      content/
      sidepanel/
```

The extension should have its own build command and manifest, while reusing shared types/constants where practical.

Potential shared logic:

- `cleanUrl()`
- Input insert types
- Project types
- Auth/session helper types
- Enum values for STEEPLED, signal quality, time horizon, etc.
- Route helpers for opening saved inputs/projects in the web app

---

## 4. Primary user workflow

1. User browses to a website and sees an article, report, research item, blog post, dataset, or other source they want to save.
2. User optionally selects meaningful text on the page.
3. User clicks the Future Signals Chrome extension icon.
4. The extension opens a Chrome side panel.
5. If the user is authenticated, the side panel displays the **Create Input** form.
6. If the user is not authenticated, the side panel displays a sign-in prompt.
7. The extension attempts to extract page metadata.
8. The extension pre-populates the form:
   - **Title** from page metadata
   - **Description** from selected text, if present
   - **Description** from meta description only if no text was selected
   - **Source URL** from canonical URL or active tab URL
9. User accepts the defaults or edits them.
10. User optionally completes additional fields.
11. User clicks **Add Input**.
12. Extension creates the new Input in Supabase.
13. Extension displays a success or failure message.
14. On success, user can:
   - View the saved input in Future Signals
   - Open the project in Future Signals
   - Add another input
   - Close the side panel

---

## 5. Core UX principle

The extension should be a **fast capture tool**, not a full analysis tool.

When users are browsing, the primary job is usually:

> “Don’t let me lose this.”

Not:

> “Fully classify this signal right now.”

So the default UI should be lightweight. Advanced classification fields should be available, but not required.

---

## 6. Capture modes

### Default mode: Fast capture

Fields shown immediately:

- Project
- Title
- Description
- Source URL

Primary button:

```text
Add Input
```

### Expanded mode: Add details

Optional expandable section:

- STEEPLED category
- Signal quality
- Time horizon
- Notes or tags, if supported in v2

This keeps the default flow fast while still supporting more advanced users.

---

## 7. Form fields

### Required fields

- Project
- Title
- Description
- Source URL

### Defaulted fields

- Input type: `Signal`

### Optional fields

- STEEPLED category
- Signal quality
- Time horizon
- Notes
- Tags, if supported in v2

### Explicitly omitted from v2

- Image
- Image upload
- Image URL
- Image preview
- Page thumbnail extraction

Future Signals v2 is not using images, so the extension should not scrape, display, upload, or save page images.

---

## 8. Metadata extraction requirements

The extension should treat metadata extraction as **best-effort**. Auto-fill is a convenience, not a dependency.

If metadata extraction succeeds, prefill the form.

If metadata extraction partially succeeds, prefill whatever is available and show a soft warning.

If metadata extraction fails, still show the form and allow the user to add the input manually.

### 8.1 Title extraction

Use the first available value:

1. `og:title`
2. `twitter:title`
3. `document.title`
4. First `h1`
5. Empty field

### 8.2 Description extraction

Use the first available value:

1. **Selected text from the active page**
2. `og:description`
3. `twitter:description`
4. `meta[name="description"]`
5. Empty field

Selected text should override meta description because it represents what the user found meaningful.

### 8.3 Source URL extraction

Use the first available value:

1. Canonical URL from `link[rel="canonical"]`
2. Current active tab URL
3. Cleaned current active tab URL

The extension should clean common tracking parameters before saving.

Suggested removable parameters:

```text
utm_source
utm_medium
utm_campaign
utm_term
utm_content
fbclid
gclid
mc_cid
mc_eid
```

---

## 9. Selected text behavior

If the user has highlighted text on the page before opening the extension, that selected text should populate the **Description** field.

### Requirements

- Capture selected text from the active tab.
- Trim leading and trailing whitespace.
- Preserve paragraph breaks where possible.
- Allow the user to edit the captured text before saving.
- If selected text exists, do not overwrite it with meta description.
- If selected text is unavailable, fall back to page metadata.
- If both selected text and metadata are unavailable, leave Description blank.

### Suggested long-selection handling

For MVP:

```text
If selected text is under 2,000 characters:
  Use full selected text.

If selected text is over 2,000 characters:
  Use first 2,000 characters and show a small note:
  “Long selection truncated. You can edit before saving.”
```

This prevents accidentally dumping an entire article into the Description field.

---

## 10. Metadata extraction failure handling

Some sites block extensions from reading page metadata or return incomplete data. In v1, this sometimes produced obscure `403` errors. In v2, this should be handled gracefully.

### Expected behavior

If metadata extraction fails, the extension should:

1. Keep the side panel open.
2. Show a friendly, plain-language alert.
3. Avoid exposing raw errors like `403`, `CORS`, or `scraping failed`.
4. Pre-fill whatever fields are available.
5. Always populate Source URL from the active tab if possible.
6. Leave unavailable fields blank.
7. Allow the user to manually complete the form.
8. Preserve any user-entered information.

### General user-facing message

```text
We couldn’t read this page automatically.

Some websites block extensions from reading page details. You can still add this input manually.
```

### More specific failure messages

| Situation | User-facing alert |
|---|---|
| Site blocks page access / 403 | “This site blocks automatic page reading. You can still add the input manually.” |
| No metadata found | “We couldn’t find page details automatically. You can still fill them in.” |
| Selected text unavailable | “We couldn’t access the selected text, but you can paste it into the description.” |
| Chrome internal page | “Chrome does not allow extensions to read this type of page.” |
| PDF or non-HTML source | “This source may not expose page details. You can still save the URL and add a description.” |
| Future Signals/Supabase network issue | “We couldn’t reach Future Signals. Your draft is still here — try again in a moment.” |
| Unknown extraction issue | “We couldn’t read this page automatically. You can still add this input manually.” |

### Important distinction

There are two different classes of failure:

#### Metadata extraction failed

This is **non-blocking**.

The user can still manually fill in the form and save the input.

#### Supabase save failed

This is **blocking**.

The input has not been created. The user should see a retry option, and the draft should be preserved.

---

## 11. Project selection

The extension needs to know where to save the new input.

At the top of the form:

```text
Save to: [Future of Data Centers ▼]
```

### Default project selection order

Use this priority:

1. Last-used project in extension storage
2. User’s most recently active project, if available
3. User’s most recently updated project
4. Require user to choose

### Local storage behavior

Store the last-used project locally:

```ts
chrome.storage.local.set({ lastProjectId })
```

When the user opens the extension again, default to that project if the user still has access to it.

If the user no longer has access to the stored project, clear the stored project and require selection.

---

## 12. Authentication requirements

When the extension opens, it should check whether the user has an active Future Signals session.

### Logged-in state

Show the Create Input form.

### Logged-out state

Show:

```text
Sign in to Future Signals

Sign in to save inputs while browsing.

[Sign in]
```

After sign-in, the extension should return the user to the capture flow and re-run metadata extraction for the active tab.

### Recommended auth approach

Let the main Future Signals web app own authentication rather than making the extension an entirely separate auth surface.

Recommended flow:

1. Extension opens.
2. Extension checks for a valid stored session/token.
3. If no session is found, show **Sign in to Future Signals**.
4. User clicks sign-in.
5. Extension opens the Future Signals auth page.
6. User signs in through the normal web app.
7. Web app confirms extension connection.
8. Extension receives session/token through a secure handoff.
9. Extension stores session state locally.
10. Extension returns user to the Create Input form.

Important implementation instruction:

> Do not invent a new auth model before inspecting the existing Future Signals Supabase auth implementation. First propose the safest extension-compatible session handoff approach.

---

## 13. Supabase/database requirements

The extension should create a new Input record using the authenticated user’s permissions.

The database should treat extension-created inputs the same as app-created inputs, except for optional metadata indicating the source.

### Example insert payload

```ts
{
  project_id: selectedProjectId,
  type: "signal",
  title: title,
  description: description,
  source_url: sourceUrl,
  steepled_categories: selectedSteepledCategories,
  signal_quality: signalQuality,
  time_horizon: timeHorizon,
  notes: notes,
  tags: tags,
  created_from: "chrome_extension",
  captured_at: new Date().toISOString()
}
```

No image fields should be included.

### Required RLS behavior

Supabase Row Level Security should ensure:

- User can read projects they belong to.
- User can create inputs only in projects they have access to.
- User can read the input after creation.
- User cannot insert inputs into another user’s private project.
- Extension-created inputs respect the same permissions as app-created inputs.

---

## 14. Success and failure states

### 14.1 Save success

After the user clicks **Add Input** and the record is created successfully, show a success state.

Example:

```text
Input added

“Health authorities work to contain cruise ship hantavirus outbreak” was added to Future of Data Centers.

[View Input in Future Signals]
[Open Project]
[Add another]
[Close]
```

Requirements:

- Confirm that the input was saved.
- Include the input title.
- Include the destination project.
- Provide a link to the saved input, if possible.
- Provide a link back to the project or app.
- Allow the user to add another input.
- Allow the user to close the side panel.

### 14.2 Save failure

If the insert into Supabase fails, show a clear error and preserve form data.

Example:

```text
Input could not be added

We couldn’t save this input. Your draft is still here.

[Try again]
[Open Future Signals]
```

Requirements:

- Do not clear the form.
- Preserve edited fields.
- Preserve selected project.
- Explain the issue in plain language.
- Provide a retry button.
- Provide a link to open the app if appropriate.

---

## 15. UX states

The extension should support the following states.

### Not authenticated

```text
Sign in to Future Signals

Sign in to save inputs while browsing.

[Sign in]
```

### Checking auth

```text
Checking your Future Signals session…
```

### Loading metadata

```text
Reading page details…
```

### Metadata warning

```text
Couldn’t auto-fill page details

Some sites block extensions from reading page metadata. You can still add this input manually.
```

### Ready to save

Show the form with prefilled fields where available.

### Saving

```text
Adding input…
```

Disable the primary button while saving.

### Success

Show the saved confirmation and app links.

### Failure

Show an error message, preserve the draft, and provide retry.

---

## 16. Suggested extension architecture

```text
extension/
  manifest.json
  src/
    background/
      service-worker.ts
    content/
      extractPageData.ts
    sidepanel/
      App.tsx
      AuthGate.tsx
      CreateInputForm.tsx
      ProjectSelector.tsx
      SuccessState.tsx
      ErrorState.tsx
    lib/
      supabaseClient.ts
      cleanUrl.ts
      storage.ts
      auth.ts
      types.ts
```

---

## 17. Data flow

```text
User opens extension
        ↓
Chrome side panel opens
        ↓
Extension checks auth
        ↓
If logged out:
  show sign-in prompt
        ↓
If logged in:
  ask active tab for page data
        ↓
Content script extracts:
  - selected text
  - title
  - meta description
  - canonical URL
  - current URL
        ↓
Side panel populates form
        ↓
User edits/completes fields
        ↓
User clicks Add Input
        ↓
Extension inserts record into Supabase
        ↓
If save succeeds:
  show success message + app links
        ↓
If save fails:
  show failure message + preserve draft
```

---

## 18. Content script extraction requirements

The content script should return a structured object rather than throwing raw errors into the UI.

### Suggested extracted data type

```ts
type ExtractedPageData = {
  title: string | null;
  selectedText: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  currentUrl: string;
};
```

### Suggested extraction result type

```ts
type ExtractionResult = {
  ok: boolean;
  data?: ExtractedPageData;
  warning?: ExtractionWarning;
};

type ExtractionWarning =
  | "blocked_by_site"
  | "no_metadata_found"
  | "unsupported_page"
  | "pdf_or_non_html"
  | "selected_text_unavailable"
  | "unknown";
```

### Suggested form population logic

```ts
const title = extracted.title ?? "";

const description =
  extracted.selectedText?.trim()
  || extracted.metaDescription?.trim()
  || "";

const sourceUrl = cleanUrl(extracted.canonicalUrl || extracted.currentUrl);
```

---

## 19. Warning message mapping

```ts
const extractionMessages = {
  blocked_by_site:
    "This site blocks automatic page reading. You can still add the input manually.",
  no_metadata_found:
    "We couldn’t find page details automatically. You can still fill them in.",
  unsupported_page:
    "Chrome does not allow extensions to read this type of page.",
  pdf_or_non_html:
    "This source may not expose page details. You can still save the URL and add a description.",
  selected_text_unavailable:
    "We couldn’t access the selected text, but you can paste it into the description.",
  unknown:
    "We couldn’t read this page automatically. You can still add this input manually."
};
```

---

## 20. URL cleanup requirements

Before saving the source URL, remove common tracking parameters.

### Example cleanup behavior

Input:

```text
https://example.com/article?utm_source=newsletter&utm_medium=email&id=123
```

Saved URL:

```text
https://example.com/article?id=123
```

### Suggested removable parameters

```text
utm_source
utm_medium
utm_campaign
utm_term
utm_content
fbclid
gclid
mc_cid
mc_eid
```

---

## 21. Permissions

Likely Chrome permissions:

```json
{
  "permissions": [
    "activeTab",
    "scripting",
    "sidePanel",
    "storage"
  ],
  "host_permissions": [
    "https://*/*",
    "http://*/*"
  ]
}
```

However, for Chrome Web Store review and user trust, be conservative.

The developer should evaluate whether broad host permissions are necessary or whether the extension can rely primarily on `activeTab` after user interaction.

---

## 22. MVP scope

### Must-have

- Manifest V3 Chrome extension
- Native Chrome side panel
- React/Vite/TypeScript implementation
- Same repo as the main Future Signals app, ideally as a separate extension package/folder
- Auth check
- Sign-in flow
- Project selector
- Last-used project memory
- Active tab metadata extraction
- Selected text extraction
- Description prefers selected text over meta description
- Title extraction
- Source URL extraction
- URL cleanup
- Create Input form
- Supabase insert
- Graceful metadata extraction failure handling
- Friendly messages instead of raw `403` errors
- Save success state
- Save failure state
- Preserve draft on failure
- Link back to saved input or project in Future Signals

### Not in MVP

- Image extraction
- Image upload
- Full article scraping
- AI summarization
- AI STEEPLED classification
- AI signal quality suggestion
- AI time horizon suggestion
- Duplicate detection
- Cross-browser support
- Context menu capture
- Keyboard shortcut
- Browser badge indicator

---

## 23. Post-MVP enhancements

### 1. Duplicate detection

Warn the user if the same URL already exists in the selected project.

Example:

```text
This source may already be saved in this project.

[View existing input]
[Save anyway]
```

### 2. Right-click capture

Allow user to highlight text, right-click, and choose:

```text
Save selection to Future Signals
```

This would prefill Description with selected text and open the side panel.

### 3. Save to Inbox mode

Let users save quickly without classifying.

Example:

```text
Save to Inbox
```

This may be especially useful if capture should stay lightweight and triage should happen later in the app.

### 4. AI enrichment

After capture, optionally suggest:

- STEEPLED category
- Signal quality
- Time horizon
- Shorter description
- Related clusters
- Possible implications

This should be post-MVP because it adds cost, latency, and UX complexity.

### 5. Already-saved indicator

Show a badge or message if the current URL has already been captured.

Example:

```text
Already saved to Future of Data Centers
```

### 6. Open app destinations

After save, offer links to:

- View saved input
- View project inputs
- Open inbox
- Open project dashboard

---

## 24. Suggested implementation plan for Cursor/Codex

Do not ask the coding assistant to build the whole extension in one giant step. Work iteratively.

### Task 1: Inspect existing app

```text
Review this repo and identify the relevant Supabase schema, auth patterns, routing conventions, and UI components needed to build a Chrome extension that creates a new Input. Do not write code yet. First summarize the proposed implementation approach and any open questions.
```

### Task 2: Extension scaffold

```text
Create a new /extension package for a Manifest V3 Chrome extension using React, TypeScript, and Vite. It should support a Chrome side panel, a background service worker, and a content script. Do not implement Supabase yet. Add minimal build scripts and document how to load it unpacked in Chrome.
```

### Task 3: Page metadata extraction

```text
Implement the content script that extracts page data from the active tab:
- selected text
- og:title
- twitter:title
- document.title
- h1 fallback
- og:description
- twitter:description
- meta description
- canonical URL
- current URL

Selected text should populate description before meta description. Return structured ExtractionResult objects with warnings instead of throwing raw errors.
```

### Task 4: Side panel form

```text
Build the side panel UI for creating a Future Signals Input. The default fields are Project, Title, Description, and Source URL. Add an expandable “Add details” section for STEEPLED category, signal quality, and time horizon. Omit all image functionality.
```

### Task 5: Supabase integration

```text
Wire the extension to Supabase using the existing Future Signals auth and database patterns. The user should be able to select a project they have access to and insert a new Input with created_from = "chrome_extension". Respect the existing RLS model.
```

### Task 6: Auth approach

```text
Do not invent a new auth model. Inspect the existing Future Signals Supabase auth implementation and propose the safest extension-compatible session handoff approach before writing code. Once approved, implement the auth flow.
```

### Task 7: Error and success states

```text
Add graceful UX states:
- metadata extraction blocked
- no metadata found
- unsupported page
- PDF/non-HTML source
- Supabase save failed
- save success

Do not show raw 403/CORS errors to users. Preserve form data on failure. On success, show links to view the saved input and open the project in Future Signals.
```

### Task 8: Polish and tests

```text
Add utility tests for cleanUrl, metadata priority order, selected-text priority, and error-message mapping. Add README instructions for local extension development.
```

---

## 25. Product recommendation

For v1 of the new extension, the capture experience should be intentionally simple:

```text
Project
Title
Description
Source URL
Add Input
```

Then place additional fields behind an optional **Add details** section.

The most important improvement over the old Bubble extension is reliability and polish:

- Selected text becomes the description.
- Blocked metadata extraction produces a friendly message, not a confusing error.
- Save success is clearly confirmed.
- Failed saves preserve the user’s draft.
- Users can jump directly back into Future Signals after saving.

This makes the extension feel like a dependable capture companion instead of a fragile scraper.
