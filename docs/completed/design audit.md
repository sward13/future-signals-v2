Design review — Future Signals v2 (workspace-refactor preview)

Reviewed against: 49 screenshots (screenshot-log.md, 1440×900), src/styles/tokens.js, the @theme block in src/index.css, CLAUDE.md, design-principles.md. Labeling corrections from the brief applied (instant-create cluster screenshot; ClusterDetailDrawer treated as its own drawer type).

---
1. Grid and column alignment

Current state. No documented page grid. The de-facto standard is a 187px sidebar with a content gutter at x≈220 running full-bleed to x≈1408 (Scan, Cluster, Inbox, Dashboard). Tables and their filter rows align to this gutter consistently — the strongest alignment pattern in the product.

Violations and inconsistencies.

- Six different content containers across the main screens. Scan/Cluster/Inbox/Dashboard: ~220 → ~1408 (full-bleed). Overview: inset both sides, ~283 → ~1345 (01-project-overview-landing.png). Future Models: ~960px block, ~225 → ~1183 (06-futuremodels-default.png). Account Settings: single ~520px column with a large dead zone right (07-account-default.png). System Analysis: nearly edge-to-edge, ~199 → ~1429 (05-systemanalysis-default.png). The three Future Models editors: centered ~672px column starting at x≈478 (06-futuremodels-preferredfuture.png et al.). The content edge jumps four times as you move between siblings.
- Overview's left gutter doesn't match its siblings — eyebrow/title at x≈283 vs x≈220 everywhere else (compare 01-project-overview-landing.png with 02-scan-populated.png). Overview is the landing screen, so this is the first misalignment every practitioner sees.
- Cluster list-view column headers collide. "Horizon" and "Likelihood" render flush as "HorizonLikelihood", and neither aligns with the badges below (03-cluster-listview-populated.png; header/row widths in src/components/clusters/ClustersPanel.jsx).
- Phase-card status chip crowds the card edge on the System Analysis card because the title is long; Scan/Cluster cards show a comfortable inset (01-project-overview-landing.png; src/components/screens/ProjectOverview.jsx ~410–470).
- Same data, different rendering widths across tables. The relationships table shows Horizon/Likelihood as plain text (04-systemmap-relationshipstable.png); the Cluster list shows badges — identical columns with different visual weight on adjacent screens.
- Toast overlaps the bulk-action bar — the bottom-right toast lands directly on the "Assign →" bulk button (03-cluster-listview-populated.png, 03-cluster-cardview-populated.png).

Opportunities. (1) Define two containers — full-bleed workspace and a reading column (~720–960px) — and pin every page header to one x-position. (2) Share one grid template between ClustersPanel header and rows. (3) Fixed phase-card header layout (title truncates, chip keeps inset). (4) Offset toasts above sticky action bars.

---
2. Type hierarchy

Current state. CLAUDE.md specifies Roboto headings / Open Sans body, 22px/500 page titles, 16px/500 section headings, 13px body, 12–12.5px labels, 10–11px metadata, 10px uppercase column headers. @theme adds --text-ui: 13px, --leading-body: 1.55.

Violations and inconsistencies.

- The specified fonts are not loaded at all. No Google Fonts link or font-family setup exists in index.html or src/index.css (verified by grep) — the entire app renders in the fallback system stack. The single largest gap between documented and shipped type. Either load the fonts or update CLAUDE.md to bless the system stack.
- An undocumented serif. The key question is hardcoded Georgia, 'Times New Roman', serif italic at 19px — src/components/screens/ProjectOverview.jsx:242-243. CLAUDE.md specs this element at 13px italic; the system has no serif tier, and 19px sits between section heading and page title, competing with the latter. If it's a deliberate editorial accent, tokenize and document it; otherwise revert.
- Title Case vs sentence case is unsettled. Sentence case dominates ("Key question", "Scanning preferences"), but System Analysis card headers ("Key Dynamics", "Critical Uncertainties" — 05-systemanalysis-default.png), "Account Settings"/"Signal Scanning" (07-account-default.png), and Future Models sections ("Preferred Future", "Strategic Options") are Title Case. "Clear Map" is Title Case while every other button is sentence case.
- Two eyebrow styles for the same job — 11px normal-case on Overview vs 10px uppercase letter-spaced on Scan/Cluster/System Map. Both documented in CLAUDE.md; worth collapsing to one.
- Duplicated label stacks. "EDIT CLUSTER" eyebrow immediately above an "Edit cluster" title (03-cluster-editdrawer-empty.png; ClusterDrawer.jsx:87); "STEEPLED" micro-label directly above "STEEPLED category" (02-scan-signaledit.png).
- Label drift: "Title" at creation, "Title / Name" in edit (02-scan-signaledit.png).
- Editors introduce an off-scale 24px tier ("Name this scenario" placeholder-titles) — consistent across the trio, just needs adding to the scale or reducing to 22px.
- What works and should be protected: empty-state typography, 10px uppercase column headers, and the form label + italic helper pattern are consistent everywhere.

---
3. Color

Current state. tokens.js and @theme agree 1:1, and the workspace background matches the brief's rgb(245,244,240). Note that CLAUDE.md's design-system section documents an older palette (#F7F7F5 bg, #1A1A1A ink, confirmedBg/h1Bg/edge* entries that no longer exist) — the docs are the stale side, not the code. Verified conforming: off-white workspace everywhere, white horizon-bar card, H1/H2/H3 green/blue/amber tints used consistently, Trend violet everywhere, toast/destructive pairs on-token.

Violations and inconsistencies.

- Selected states use four different treatments with no discernible rule. Brand-blue fill: Manual/Suggested, Canvas/Table, view toggles. Ink-black fill: clustering sensitivity (directly below the blue Manual/Suggested toggle on the same screen, 03-cluster-suggestions-initial.png), Likelihood pills, canvas tools, ClusterDetailDrawer subtype pills. Green tint: selected Horizon (03-cluster-editdrawer-filled.png). Blue tint+border: onboarding cards. Gray-bordered card: ClusterDrawer subtype — meaning the same field (cluster subtype) has two different selected styles across its two editing surfaces, and within one form Horizon selects green while Likelihood selects black.
- Likelihood has three colorings and no token. Blue pill in Cluster list/card, gray badge in the System Map Inspector (04-systemmap-inspector-clusterselected.png), black when selected — and its blue pill is visually the same family as the H2 badge, so two unrelated dimensions share a hue.
- System Map edge palette is untokenized. Seven relationship types in the legend; zero edge colors in tokens.js/@theme (CLAUDE.md lists four that no longer exist in code).
- "New cluster" is a third button species — brandBg tint + brand text + CirclePlus, unlike every other solid-brand create CTA.
- Toggles are ink-black (Scanning preferences, Account Settings) while the stated aesthetic reserves blue for interactive primaries — looks deliberate, but undocumented.

Opportunities. (1) Write a two-tier selection rule — brand blue = view/mode switches, ink = data-value selection — then fix the two rule-breakers (green Horizon tint in forms; gray-card subtype). (2) Add a likelihood semantic pair to the tokens. (3) Tokenize the seven edge colors. (4) Normalize "New cluster" to the standard primary.

---
4. Accessibility

What passes: all *-700-on-*-50 badge pairs (~5.5:1), muted (5.2:1) and hint (5.6:1) on white, ink toggles and filled pills.

Violations (WCAG AA).

1. White on brand #3B82F6 = 3.68:1 — fails for normal-size text. Every primary button in the product sets 12–13px white text on brand. Systemic; fix at the token (btnP/btnSm in tokens.js:61-83). Darkening the button fill to ~`#2563EB` (4.54:1) resolves it product-wide.
2. Brand-blue text on white = 3.68:1 — fails for all small blue text: active nav (12.5px), the 11px "Key question" eyebrow, tab counts, "Inputs →" links, "← Clusters". Add a darker brand-text variant (#2563EB, or the existing passing blue700 #185FA5) for text-on-light.
3. Placeholders fail (~`#9CA3AF` ≈2.5:1) — and several forms carry real guidance in placeholders (the Preferred Future examples). No placeholder token exists; add one at ≥4.5:1.
4. Input borders fail non-text contrast (1.4.11). borderMid rgba(0,0,0,0.18) ≈1.6:1 vs the 3:1 requirement for control boundaries — affects all fields, selects, and secondary buttons. Add a borderStrong for interactive controls.
5. Onboarding progress dots (inactive) ≈1.4:1 — they convey position, so they need 3:1 or a supplementary cue.
6. faint #717171 on the off-white bg ≈4.48:1 — marginal fail (passes on white at 4.9). One shade darker clears both surfaces.
7. Verify: "Clear Map" red (if #DC2626-class, it's at the 4.5 borderline; red800 is the token-correct choice); 10px chip text at ≈4.6:1 has no margin.

Focus indicators, keyboard traversal of the canvas, and drag-and-drop alternatives can't be judged from static screenshots — unverified, not violations.

---
5. General UX

Principle violations (design-principles.md).

- Required fields exist, with three marker conventions. Input Title: "required" chip + blocking error (InputDrawer.jsx:330,342). Cluster name: "required" chip (ClusterDrawer.jsx:99). Project name: red asterisk in EditProjectDrawer (EditProjectDrawer.jsx:130) and a chip in NewProjectModal (NewProjectModal.jsx:502). Meanwhile "optional" chips on Description and Archetype imply the unmarked rest are required. This contradicts the product's most explicit rule ("zero required fields") — reconcile the principle or remove the gates, and in either case pick one marker convention.
- The New Input form has no Enhanced toggle — STEEPLED, strength, confidence, horizon all inline under a "Type fields" divider, no + Add more detail collapse (02-scan-addinput-empty.png). This is the canonical progressive-disclosure surface, and it's flat.
- Advanced setup opens by default for experts (ProjectCreateStep.jsx:79 — useState(experienceLevel === "expert")), against the unconditional "never the default open state on first project creation." Deliberate code vs written rule — reconcile.
- Completion/gating copy on Overview phase cards: "Sections complete 0/5" with a progress bar, "Needs clusters first" / "Needs a system map first" / "Needs analysis first" (ProjectOverview.jsx:422,434,447,465). Status labels are supposed to be time-based with no completion judgment, and stages are ungated by principle. Navigation isn't blocked, but the copy asserts prerequisites.
- Scan/Inbox empty states lead with manual entry while the convention says the scanner is the primary CTA; the Inbox empty state also plugs the Chrome extension, a deferred surface.

Copy/terminology bugs.

- Signal Strength "High" should be "Strong" — InputDrawer.jsx:37, InputDetailDrawer.jsx:37, AddFromInboxModal.jsx:10. Also collides with Source Confidence "High" one field below, undermining the deliberate disaggregation of the two scales.
- The drawer is titled "Edit project" (EditProjectDrawer.jsx:119) — the terminology table pins "Project settings" and bans exactly this phrase. The Overview button gets it right; the drawer it opens doesn't.
- Dashboard cards say "Analysis" and "Futures" (Dashboard.jsx:69-70,298-299) — both banned labels.
- Onboarding references a "Scanner tab" (ScannerInboxStep.jsx:359,503) — the nav item is "Scan"; the same screen claims "You skipped signal selection" when nothing was skipped.
- "1 inputs" on cluster cards (ClusterCard.jsx:98); "No inputs yet" duplicated as title and caption in the same empty state.

Interaction/pattern inconsistencies.

- Four editing-surface patterns (right drawers; Cluster screen's full-pane takeover; ClusterDetailDrawer full-page overlay; Future Models full-page editors) where the architecture doc says drawers. The two cluster-detail surfaces also expose different capabilities ("Related inputs" search exists only in the drawer).
- Save buttons differ per surface — ghost "Save" (System Analysis), primary "Save changes" (drawers), an oversized near-full-width "Save" (EditProjectDrawer), compact primary (editors/Account).
- Delete affordances differ per surface — the full-width red "Delete cluster" bar (03-cluster-detail.png) is disproportionately loud vs the compact versions elsewhere.
- "Import via CSV" is styled as a fifth tab but is an action, not a filter.
- Canvas auto-zooms to 300% with one node, producing a comically oversized card — cap fit-view zoom.
- ClusterDetailDrawer edit mode shows Horizon/Likelihood twice (badges + selectors) and has two adjacent triggers for the same search ("Find related" + "Find related inputs").
- Empty badge artifact next to Trend before a horizon is set (03-cluster-detail.png).
- Onboarding omits "Custom / Other" (deliberately, ProjectCreateStep.jsx:6) — practitioners outside the eight domains have no honest path.
- Two terminal onboarding screens in a row — "We're still building signals" then "Your project is ready"; the second adds nothing.

---
6. Token and convention adherence (remaining items)

- Icon discipline: CirclePlus-on-primaries and Wand2-on-"Suggest clustering" are correct. Violations: secondaries carry icons — "Scanning preferences" (sliders), "Add from Inbox" (tray), "Project settings" (gear). These were added deliberately in commit a3cf5d1, so the convention and the commit disagree — revert or amend the rule. "Find related inputs" is arguably a run action missing Wand2; the Suggested-mode empty state uses a "✦" text glyph to refer to a wand-iconed button.
- System Map count badge "1" in the sidebar (01-overview-populated.png) — CLAUDE.md: the map is binary, never show a count.
- Sidebar shows a Projects list at workspace level, contradicting CLAUDE.md's "Dashboard + Inbox only." Implementation has moved on; CLAUDE.md is also stale on appState.drawer, the c{} palette, the edge-color list, and the ClusterDrawer create flow — worth one documentation sweep.
- Migration gaps: ProjectOverview.jsx is a migrated component but carries an inline style for the Georgia serif at line 243 — per the migration rule, that's a leak. No screen showed a hybrid reading as a visual defect; treat the rest as tracked migration backlog, not design flaws.
- Off-white background and white horizon-bar card: both conform.

---
Priority summary

1. Brand-blue contrast failures (systemic) — every primary button and all small blue text at 3.68:1; two token changes fix the whole product.
2. Load the specified fonts or re-spec the type system — Roboto/Open Sans aren't loaded anywhere.
3. Signal Strength "High" → "Strong" — core-scale terminology violation colliding with Source Confidence; three files.
4. Unify selected-state treatment — four styles, two within one form, one field with two styles across surfaces.
5. Required-field markers vs the zero-required-fields principle — three conventions across four forms.
6. Overview completion/gating copy — "Sections complete 0/5", "Needs X first" on every project's landing screen.
7. Container-grid consolidation — six content widths; Overview's gutter off from its siblings.
8. Locked-terminology copy fixes — "Edit project" → "Project settings"; Dashboard "Analysis"/"Futures"; "Scanner tab".
9. Non-text contrast — input borders, placeholders, progress dots; one borderStrong + placeholder token.
10. Small visible defects in the core clustering flow — "HorizonLikelihood" header collision; toast covering the bulk-action bar.