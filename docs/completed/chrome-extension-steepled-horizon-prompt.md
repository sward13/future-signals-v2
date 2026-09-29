Context: The extension's capture form was missing two fields the main app's `InputDrawer.jsx` shows for Signal-type inputs: STEEPLED category (multi-select) and Time Horizon (H1/H2/H3). `insertInputAndRequestEmbed()` was hardcoding `steepled: []` and `horizon: null` on every insert. Documented in `chrome-extension-alignment-audit.md`, sections 2 and 3.

The fix has already been implemented (not by you), following on from the Signal Strength / Source Confidence work (`1d5749f`) and the `ThreeCardSelector` styling rebuild:
- `extension/src/constants.ts` — added `STEEPLED_OPTIONS` (copied from `src/data/seeds.js`'s `STEEPLED` array) and `HORIZON_OPTIONS` (H1/H2/H3)
- `extension/src/sidepanel/SteepleSelector.tsx` — new component, a 4-column multi-select pill grid mirroring the main app's `SteepleSelector` in `InputFormFields.jsx`
- `extension/src/lib/insertInput.ts` — `steepled` and `horizon` are now real params on `InsertInputParams`, written to the row instead of hardcoded
- `extension/src/utils/draft.ts` — both fields persist in the capture draft, with a new `normalizeStringArray` helper that drops anything not in `STEEPLED_OPTIONS` on load
- `extension/src/sidepanel/CaptureForm.tsx` — both fields wired into state, draft hydration, the `startOver`/`captureAnother` resets, and the submit payload. Field order in the form now matches `InputDrawer.jsx`: STEEPLED → Signal strength → Source confidence → Time horizon → Project. Time horizon reuses the existing `ToggleOptionRow` component (flat toggle), since the main app's own `HorizonSelector` is a flat toggle too, not a card.

`npx tsc --noEmit` was run in a sandboxed environment and shows no new errors beyond the same pre-existing warnings from before (implicit-any on `tokens.js` imports, one `metadata` Json-type mismatch on an untouched line). The real `npm run build` could not be run in that sandbox. Not built or manually verified yet.

Task (read the diff first, do not re-architect anything):

1. Review the diff on the five files above. Confirm `STEEPLED_OPTIONS` exactly matches `src/data/seeds.js`'s `STEEPLED` array (same 8 strings, same order, same casing) — the array is stored directly as the `steepled` column value, not mapped through ids, so any mismatch here is a real data bug, not cosmetic.
2. Run `npm run build` inside `extension/`. Fix only actual build failures — do not refactor working code, do not touch auth, `manifest.json` permissions, or `metadata.capture_source`.
3. Load the built `extension/dist` unpacked in Chrome and manually verify: STEEPLED renders as an 8-pill grid below Input type, multiple categories can be selected and deselected independently (not single-select), the pills aren't so cramped that labels like "Technological" or "Environmental" become unreadable (if they wrap awkwardly, note it rather than silently shrinking the font further); Time horizon renders as a flat H1/H2/H3 toggle below Source confidence, single-select with click-to-clear; both selections persist across closing and reopening the side panel; a saved input has the correct `steepled` array and `horizon` value in Supabase.
4. Commit with a conventional commit message. Do not push until you've told me the build and manual check both passed.

Do not touch: auth flow, `manifest.json` permissions, `metadata.capture_source` naming, the type-description banner / "Type fields" divider gap (still open, separate item), or anything in `src/` outside what's needed to confirm the STEEPLED array match in step 1.
