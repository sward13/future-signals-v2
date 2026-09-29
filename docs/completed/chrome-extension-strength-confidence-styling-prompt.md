Context: The extension's Signal Strength / Source Confidence fields (added in commit `1d5749f`) worked correctly but didn't visually match the main app. They were built on `ToggleOptionRow`, a flat single-row toggle modeled on `HorizonSelector`. The main app actually renders these two specific fields with `ThreeCardSelector` (`src/components/inputs/InputFormFields.jsx`) — a 3-column grid of bordered cards, each with a colored dot, a title, and a description line, with a checkmark on the selected card. This mismatch is documented in `chrome-extension-alignment-audit.md`, section 3.

The fix has already been implemented (not by you) across three files:
- `extension/src/constants.ts` — added a `desc` string to each `SIGNAL_STRENGTH_OPTIONS` / `SOURCE_CONFIDENCE_OPTIONS` entry, copied verbatim from `InputDrawer.jsx`
- `extension/src/sidepanel/ThreeCardSelector.tsx` — new component, mirrors the main app's card-grid pattern (dot color assigned by tier position: amber/blue/green for position 0/1/2, matching how the main app colors both fields the same way regardless of label semantics)
- `extension/src/sidepanel/CaptureForm.tsx` — Signal Strength and Source Confidence now render via `ThreeCardSelector` instead of `ToggleOptionRow`

`ToggleOptionRow.tsx` is left in the codebase, unused for now — it's the correct pattern for a future Time Horizon field (the main app's own `HorizonSelector` is a flat toggle, not a card), so don't delete it.

`npx tsc --noEmit` was run in a sandboxed environment and shows no new errors: only the same pre-existing warnings that already exist on every file importing `tokens.js` (implicit-any) and one pre-existing `metadata` Json-type mismatch on an untouched line. The real `npm run build` (Vite) could not be run in that sandbox due to a native-binding mismatch unrelated to this code. It has not been built or manually verified yet.

Task (read the diff first, do not re-architect anything):

1. Review the diff on the three files above. Confirm `ThreeCardSelector.tsx`'s structure (dot + title + description, checkmark on select, click-to-clear) genuinely mirrors `ThreeCardSelector` in `InputFormFields.jsx`, adjusted only for the side panel's narrower width (tighter padding/gaps, smaller font sizes — not a different interaction model).
2. Run `npm run build` inside `extension/`. Fix only actual build failures — do not refactor working code, do not touch auth, `manifest.json` permissions, or `metadata.capture_source` (separate, not-yet-actioned audit findings).
3. Load the built `extension/dist` unpacked in Chrome and manually verify: Signal strength and Source confidence now render as bordered cards with a dot, title, and description (not flat pills); selecting a card shows the dot in color and a checkmark; clicking the selected card again clears it; the cards are readable and not visually cramped at the side panel's actual width (if the description text wraps awkwardly or the cards feel too tight, note that rather than silently shrinking font sizes further); the choice still persists across closing/reopening the side panel; a saved input still has the correct `signal_strength` / `source_confidence` value in Supabase.
4. Do not add STEEPLED or Time Horizon fields in this pass — those are a separate, already-planned follow-up.
5. Commit with a conventional commit message. Do not push until you've told me the build and manual check both passed.

Do not touch: auth flow, `manifest.json` permissions, `metadata.capture_source` naming, STEEPLED, Time Horizon, or anything in `src/` outside what's needed to confirm the pattern match in step 1.
