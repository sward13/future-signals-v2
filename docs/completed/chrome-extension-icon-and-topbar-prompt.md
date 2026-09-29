Context: Chrome's native side panel header (the strip showing an icon, the extension name, and pin/close buttons) is not extension-controllable — it's fixed Chrome UI driven entirely by `manifest.json`'s `icons` / `action.default_icon` fields and `name`. `manifest.json` had neither an `icons` field nor `action.default_icon`, so Chrome was showing its generic fallback icon there. Below that, the extension's own `Topbar.tsx` component rendered the full "Future Signals" wordmark image again, which read as redundant once you're looking at both headers stacked.

The fix has already been implemented (not by you):
- `extension/public/icons/icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` (new) — the circular Future Signals mark, cropped out of `src/assets/logo_light.svg` and rasterized at each size. This was done with ImageMagick in a sandboxed environment; the crop and each generated size were visually inspected before finalizing, but never seen inside an actual Chrome side panel header.
- `extension/public/manifest.json` — added top-level `icons` and `action.default_icon`, both pointing at the four new files.
- `extension/src/sidepanel/Topbar.tsx` — removed the `<img>` wordmark and the now-unused `logo_light.svg` import. The component now returns `null` when it has no `right` content (e.g. on the sign-in screen, where there's nothing left to show once the logo is gone) and right-aligns its content with `justify-content: flex-end` instead of `space-between` (there's no longer a left-side element to space against).

`npx tsc --noEmit` was run in a sandboxed environment and shows no new errors beyond the same pre-existing warnings from every prior pass. The real `npm run build` could not be run in that sandbox, and — this is the part that most needs your eyes, not just a build — nobody has actually seen these icon files rendered inside Chrome's real side panel header at native size yet.

Task (read the diff first, do not re-architect anything):

1. Review `manifest.json`'s new `icons`/`action.default_icon` blocks and confirm the four PNG files exist at the paths referenced.
2. Run `npm run build` inside `extension/`. Fix only actual build failures.
3. Reload the unpacked extension in `chrome://extensions` (a full reload, not just the side panel — manifest and icon changes require reloading the extension itself, not just refreshing the panel). Verify: the toolbar icon and the side panel's native header icon both show the red circular mark, not a generic placeholder; the icon is recognizable at actual toolbar size (16-19px), not just at the larger 48/128px sizes; the in-panel Topbar no longer shows a wordmark logo anywhere; the sign-in screen (before login) has no empty header strip sitting above the sign-in form; the signed-in capture form still has a working "Sign out" button, now right-aligned in its own row with no logo beside it.
4. If the icon looks wrong at small size (illegible, oddly cropped, or the wrong shade against Chrome's toolbar), don't try to fix the PNGs yourself — flag it back to me with what's wrong so I regenerate the crop, since the source SVG surgery needs to happen in the same sandboxed step that produced these.
5. Commit with a conventional commit message. Do not push until you've told me the build and manual check both passed.

Do not touch: auth flow, `manifest.json` permissions or host_permissions, `metadata.capture_source` naming, the type-description banner / "Type fields" divider gap, or any of the capture form fields — this pass is only the icon and the Topbar logo removal.
