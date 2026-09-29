Context: The Chrome extension's capture form (`extension/`) was missing Signal Strength and Source Confidence — fields that exist everywhere else in the app (`InputDrawer.jsx`, `Inbox.jsx`, `ClusterScreen.jsx`, etc.) but were absent from the extension, which was still writing to the retired `signal_quality` column. This was flagged in `chrome-extension-alignment-audit.md`.

The fix has already been implemented (not by you) across four files:
- `extension/src/constants.ts` — added `SIGNAL_STRENGTH_OPTIONS` and `SOURCE_CONFIDENCE_OPTIONS`
- `extension/src/sidepanel/ToggleOptionRow.tsx` — new component, a compact single-select toggle row
- `extension/src/lib/insertInput.ts` — insert now writes `signal_strength` / `source_confidence` instead of `signal_quality`
- `extension/src/utils/draft.ts` and `extension/src/sidepanel/CaptureForm.tsx` — new fields wired into draft persistence, resets, and the save payload

Type-checking (`npx tsc --noEmit`) was run in a sandboxed environment and passed for these changes, but the real `npm run build` (Vite) could not be run there due to a native-binding mismatch unrelated to this code. It has not been built or manually tested yet.

Task (read the diff first, do not re-architect anything):

1. Review the diff on these four files. Confirm the new fields match the naming, casing, and value sets used in `src/components/inputs/InputDrawer.jsx` (`SIGNAL_STRENGTH_OPTIONS` / `SOURCE_CONFIDENCE_OPTIONS`: weak/moderate/strong, low/medium/high).
2. Run `npm run build` inside `extension/`. Fix only actual build failures that surface — do not refactor working code, do not touch auth (`AuthView.tsx`, `createSupabase.ts`), do not touch `manifest.json` permissions, do not touch the `metadata.capture_source` key. Those are separate, not-yet-actioned audit findings and out of scope here.
3. Load the built `extension/dist` unpacked in Chrome and manually verify: Signal strength and Source confidence rows render below Input type, selecting an option shows it as selected (checkmark), clicking a selected option again clears it back to unset, the choice survives closing and reopening the side panel (draft persistence), and a saved input actually has `signal_strength` / `source_confidence` set correctly in Supabase (not `signal_quality`).
4. Add one line to the manual QA checklist in `extension/README.md` covering this (Signal strength / Source confidence selection, persistence, and correct column on save).
5. Commit with a conventional commit message. Do not push until you've told me the build and manual check both passed.

Do not touch: auth flow, `manifest.json` permissions, `metadata.capture_source` naming, or anything in `src/` outside what's needed to confirm the type match in step 1.
