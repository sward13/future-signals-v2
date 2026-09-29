# Rich Text Editing for Future Models & Strategic Options — Requirements

## Background

Future Models (System Analysis, Preferred Futures, Scenarios) and Strategic Options currently store their narrative fields — Description, Narrative, Implications, "What this involves," and similar — as plain text. These blocks are rendered on the app's publish-to-web output, so their formatting is currently limited to whatever line breaks and paragraph spacing the UI applies automatically. Users have asked for more expressive formatting (bold, headings, lists, links) in these fields, specifically because the content is published externally and currently reads as flat, undifferentiated text.

## Goal

Add WYSIWYG rich text editing to the narrative-style fields in Future Models and Strategic Options, with formatting that survives into the publish-to-web output, without introducing a stored-XSS risk on public pages or destabilizing existing saved data.

## Non-goals

- Rebuilding the Future Models UX into the spatial/canvas experience described in the v2 Staged Launch Plan ("inline narrative editing" on a card canvas). This work is a narrower, faster step that can sit underneath that later effort, not a replacement for it.
- Adding rich text to the line-delimited list fields (Guiding principles, Strategic priorities, Key differences from today) unless the audit in Phase 0 finds a reason to. These are structured add/remove-row lists, a different UI pattern from the paragraph fields, and are out of scope by default.
- Collaborative/multiplayer editing, comments, or version history on these fields.

## Phase 0 — Field and system audit (Claude Code, before any implementation)

Do not implement anything in this phase. Produce an audit report covering:

1. **Field inventory.** Every text field in the Future Models (System Analysis, Preferred Futures, Scenarios) and Strategic Options forms, its current input type (textarea vs. input), and where it's defined in code. Starting hypothesis to verify, not a final list:
   - System Analysis: Description, Implications
   - Preferred Futures: Description, Desired outcomes, Guiding principles*, Strategic priorities*
   - Scenarios: Description, Narrative
   - Strategic Options: Description, Intended outcome, What this involves, Implications
   (*list-style fields — flag these separately per the non-goals section above; confirm whether they're truly line-delimited plain text or already something else.)
2. **Current storage format.** How each field is persisted (column type, plain string vs. JSON, any existing rich-text or markdown handling anywhere else in the app that should be reused for consistency).
3. **Read paths.** Every place each field is rendered today: the edit form, any internal detail/read view, and — critically — the publish-to-web template(s). Confirm exactly how the publish renderer currently outputs these fields (plain text with CSS white-space handling, markdown-to-HTML, etc.).
4. **Existing data volume.** Rough count of saved records per field, to size the migration.
5. **Conventions to match.** Existing component patterns for form fields (the current fields all appear to share a common style — description/placeholder pattern), so the new rich text component fits the existing design system rather than introducing a new one-off pattern.

Deliverable: a short written audit (field-by-field table) confirming or correcting the hypothesis above, plus a recommendation on which fields are in scope for Phase 1. Get this reviewed before proceeding.

## Functional requirements

For each in-scope field:

- Toolbar formatting: bold, italic, headings (H2/H3 only — these are sub-blocks within an already-titled page, not standalone documents), bullet list, numbered list, link.
- Toolbar should be minimal and match the app's existing minimal visual style — not a full word-processor ribbon.
- Paste handling: pasting from Word/Google Docs/web pages should not drag in inline styles, font tags, or tracked-change markup; strip to the supported mark/node set on paste.
- Empty state: fields should behave like today — placeholder text shown when empty, no stray empty paragraph tags saved.
- Keyboard shortcuts for the common marks (Cmd/Ctrl+B, Cmd/Ctrl+I) should work as expected.

## Technical approach

- **Editor:** Tiptap (ProseMirror-based). It's the standard choice for this in React apps, supports a constrained schema (important for the security requirement below), and serializes cleanly to both JSON and HTML.
- **Storage format:** Store Tiptap's JSON document representation, not raw HTML. This is the safer choice for content that publishes externally — the editor's schema only permits the node/mark types you explicitly enable, so there's no arbitrary HTML to sanitize after the fact. Reserve raw-HTML storage only if there's a strong existing reason in the codebase to prefer it (surface this in the Phase 0 audit if so).
- **Shared component:** Build one `RichTextField` component (editor + toolbar) and reuse it across every in-scope field, rather than a bespoke implementation per field. Given how many fields share the same current pattern, this should also cut the amount of new code substantially versus a field-by-field build.
- **Publish rendering:** Build a renderer that turns the stored JSON into the HTML used on the public page (Tiptap provides utilities for generating HTML from its JSON schema server-side or at build time). This is a new code path, not a reuse of the edit-time renderer, and needs its own review.
- **Sanitization:** Even with JSON-schema storage constraining input, treat the publish render path as a security boundary: confirm the render step can't be coerced into emitting anything outside the intended tag set, and add a sanitization pass on the publish path as defense in depth.

## Data model & migration

- Add/alter the relevant columns to hold the JSON document format (or a new column if a parallel-run/rollback path is preferred — decide based on the Phase 0 data volume findings).
- Migrate existing plain-text values by wrapping each as a single paragraph node in the new format. This should be reversible or at minimum easily re-derivable, in case the migration needs a second pass.
- Confirm API request/response validation is updated wherever these fields are read or written (including any export/API surface identified in Phase 0, e.g. Markdown export).

## Acceptance criteria

- All in-scope fields (per the Phase 0-confirmed list) support the formatting marks listed above, in both the edit form and the published output.
- Existing saved projects display unchanged (as plain paragraphs) after migration, with no data loss.
- Published pages render the new formatting correctly and contain no injected script/style content from pasted or typed input (verified with a deliberate XSS-payload test during QA).
- No regression in the non-rich-text list fields (Guiding principles, Strategic priorities, Key differences from today) unless Phase 0 recommended including them.
- Markdown/PDF export paths (if confirmed in Phase 0 to include these fields) still produce correct output from the new format.

## Suggested sequencing

1. Phase 0 audit (above) — review before proceeding.
2. Build `RichTextField` component in isolation (storybook/sandbox or equivalent), styled to match the app.
3. Wire into one field end-to-end (edit → save → publish render) as a proof path, get it reviewed.
4. Roll out to remaining in-scope fields.
5. Data migration for existing records.
6. QA pass: existing-data regression, paste-handling, XSS payload test, export paths.

## Open questions for Sam

- Confirm the in-scope field list once Phase 0 audit comes back — does it match the hypothesis above, or did the audit surface fields not visible in the current screenshots?
- Should the list-style fields (Guiding principles, Strategic priorities, Key differences from today) get any inline formatting (bold/italic within a line), or stay plain?
- Any existing markdown/export paths that need to stay in sync with this change?
