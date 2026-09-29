# Feature Spec: Driving & Suppressed Forces Picker

**Status:** Draft — revised against Pass 1 codebase audit findings, one scope decision (OQ-FORCES-03) still open with Sam
**PRD section:** Scenario Builder — Driving forces / Suppressed forces fields
**Last updated:** 16 August 2026 (revised same day, post-audit)

---

## Overview

The Scenario builder's Driving forces and Suppressed forces fields currently show the full cluster list twice at once: once as a checklist with checkmarks, and again as a row of removable chips above it. Both stay visible at the same time, so the same selection state is represented twice, and the checklist doesn't hold up once a project has more than a screen's worth of clusters.

This spec replaces both fields with a searchable token picker (chips live inside the field; the dropdown only ever shows what isn't already picked) and reflects a product decision made with John: a cluster can be assigned to both Driving and Suppressed within the same scenario, since a force can plausibly drive change under one condition and suppress it under another. The interface doesn't block that, but it also shouldn't let it happen silently, so a cluster already assigned to the other role prompts a one-tap confirmation before it's added to both.

Two working HTML prototypes are attached to this project as the functional reference for the interaction described below (see **Reference prototypes**).

---

## Non-goals

- The Scenario Archetype and Time Horizon fields elsewhere on the form are unchanged by this spec.
- How Driving/Suppressed forces render downstream (Scenario Analyze modal, Scenario Analysis/Report views, System Map) is **not** covered here. A cluster assigned to both roles needs to display sensibly wherever forces are shown elsewhere in the product; that's flagged as a follow-up in Open Questions rather than specified here, since this spec only covers the picker itself.
- No changes to cluster creation, editing, or the Subtype/Horizon/Likelihood fields on the cluster record — this feature only reads them.

---

## Interaction model

### Layout

Driving forces and Suppressed forces sit side by side in two columns with a hairline divider between them, rather than stacked. Each column carries a consistent accent: a small dot and a top border on the field, purple for Driving, amber for Suppressed. This is deliberate — the opposition between the two roles should read from the layout and color before anyone reads the labels. Columns stack vertically below ~700px width.

### The field itself (combobox)

- Selected clusters render as chips *inside* the field, each with a small remove (×).
- A text input sits inline after the chips, with placeholder "Search clusters…".
- Clicking or focusing the field opens a panel below it showing the clusters not yet added to *that* field. The panel **floats over the page** (absolutely positioned, drop shadow) rather than pushing the rest of the form down — nothing else on the page should move when a picker opens.
- Typing filters the panel's list by name, live.
- Picking a cluster adds it as a chip and keeps the panel open with focus still in the input, so multiple clusters can be added in a row without reopening the field.
- The panel closes on an outside click.

### Filters, not invented categories

Clusters don't currently have a topical/thematic taxonomy, but they do have three existing fields, all closed sets: **Subtype** (Trend / Driver / Tension), **Horizon** (H1 / H2 / H3), and **Likelihood** (Possible / Plausible / Probable). These are already surfaced as pills on the Clusters page and filterable there via Type / Horizon / Likelihood dropdowns.

The picker reuses that same vocabulary instead of introducing new grouping logic:

- Each row in the dropdown shows the cluster name plus its existing Subtype / Horizon / Likelihood pills, styled the same as they are on the Clusters page.
- A filter bar sits above the list, sticky while the list scrolls beneath it, with the same three facets as toggle chips (compact enough at three options per facet that a full dropdown isn't needed). Search text and any active filters combine — a cluster must match all of them to appear.
- A "Clear filters" action appears once any facet has an active selection.
- **Color treatment:** Subtype uses three distinct hues (it's a nominal choice — Trend, Driver, and Tension aren't a scale). Horizon and Likelihood each use a single hue shaded from dark to light, since both are ordinal (Horizon: H1 darkest/nearest → H3 lightest/furthest; Likelihood: Probable darkest → Possible lightest).

### Cross-role selection (the John/Sam decision)

A cluster can be added to both Driving and Suppressed. The picker never silently allows that, and it never blocks it:

1. If a cluster is already assigned to the *other* role, its row in this field's dropdown shows a plain tag naming that role (e.g. "Driving") — not "Also Driving." No "also" wording appears anywhere in the picker.
2. Clicking that row does **not** add it immediately. The row expands in place into an inline confirmation: the cluster name, the line "Already added as {OtherRole}. Add as {ThisRole} too?", and two actions — **Add anyway** and **Cancel**. Cancel reverts the row with no state change.
3. Clicking a row for a cluster that isn't in the other role adds it immediately — no confirmation needed for a first assignment.
4. Once a cluster is assigned to both roles, its chip in **each** field carries a small tag naming the other role, so the dual assignment stays visible on review without reopening the picker.
5. Removing a chip only removes that role's assignment. It has no effect on the same cluster's assignment to the other role.

---

## Visual reference

**Confirmed by Pass 1 audit — replaces the prototype's invented palette below.** The prototype's colors were drafted from a single screenshot and don't match the app's real tokens (`tokens.js` / `Tag.jsx` / `ClustersPanel.jsx`). Use these instead:

| Role | Accent |
|---|---|
| Subtype — Trend | `dustyViolet` token |
| Subtype — Driver | `mutedTeal` token |
| Subtype — Tension | `dustyRose` token |
| Horizon — H1 | `green` token |
| Horizon — H2 | `blue` token |
| Horizon — H3 | `amber` token |
| Likelihood | Currently borrows the Horizon green/blue/amber family in `ClustersPanel.jsx`'s local `LikelihoodTag`, rather than the dedicated `likelihood{Possible,Plausible,Probable}` tokens that already exist in `tokens.js`/`index.css` but are only consumed by Web Publish today. This is a known, pre-existing inconsistency, not something introduced here — **decide explicitly whether this feature fixes it (adopts the dedicated likelihood tokens) or matches current in-app behavior (reuses the Horizon family)** rather than leaving it ambiguous. |

Real Horizon and Likelihood colors are categorical (green/blue/amber), **not** the dark-to-light ordinal shading the original prototype used — drop that gradient idea in favor of matching the existing token set.

There is no established Driving-vs-Suppressed color convention to reconcile against — the only existing precedent is a small green-dot/gray-dot pairing in `ScenarioRead.jsx` (`c.green700` for Driving, `c.hint` neutral gray for Suppressed), and the current editing UI (`ChipMultiSelect`) doesn't color-distinguish the two fields at all. Treat the picker's Driving/Suppressed accent colors as new design work, not a reconciliation, but consider anchoring Driving to `green700` for consistency with the one place a convention already exists.

<details>
<summary>Original prototype palette (superseded, kept for context)</summary>

| Role | Accent |
|---|---|
| Driving | `#6E62E0` (purple), background `#EEEAFB` |
| Suppressed | `#C9702B` (amber), background `#FBEFE3` |
| Subtype — Trend | `#2D6FE0` (blue), background `#E8F0FE` |
| Subtype — Driver | `#0F8A6B` (teal), background `#E3F6EF` |
| Subtype — Tension | `#C2416B` (rose), background `#FBE7EE` |
| Horizon (ordinal, dark→light H1→H3) | base `#4B4636` over tan backgrounds, decreasing in saturation |
| Likelihood (ordinal, dark→light Probable→Possible) | base `#33415E` over blue-gray backgrounds, decreasing in saturation |

</details>

---

## Data model

**Confirmed by Pass 1 audit — updated from the original draft below.** No join table is needed and none should be built. `driving_forces` and `suppressed_forces` already exist as two independent `jsonb` array columns directly on `scenarios` (each a flat array of cluster-id strings), with no FK and no uniqueness constraint between them. That already permits a cluster to appear in both arrays at the data layer — the dual-role confirmation flow is purely a frontend addition on top of data that already allows the state it's confirming. **No schema migration is required for this feature.**

Two things worth carrying into implementation:

- **Do not repurpose `scenario_clusters` for this feature.** It's a separate, pre-existing junction table (System Map / "cluster belongs to this scenario" membership) with `UNIQUE(scenario_id, cluster_id)` and no role column. It's unrelated to driving/suppressed forces today, but it's the exact shape of constraint that would silently break dual-role assignment if anyone reached for it as a shortcut.
- `clusters.subtype` is `NOT NULL DEFAULT 'Trend'`, but `horizon` and `likelihood` are nullable with no default. The picker's pills and filters need a defined "no value" treatment for Horizon and Likelihood, not just their three named states — a cluster can legitimately have neither set.

<details>
<summary>Original draft (superseded, kept for context)</summary>

The scenario-to-cluster relationship needs a join table that explicitly supports a cluster appearing on both sides of one scenario:

```
scenario_forces
├── id              uuid, PK
├── scenario_id     uuid, FK → scenarios
├── cluster_id      uuid, FK → clusters
├── role            enum: 'driving' · 'suppressed'
├── created_at      timestamptz
```

**Constraint:** unique on `(scenario_id, cluster_id, role)` — **not** on `(scenario_id, cluster_id)` alone. A unique constraint on the pair without `role` would silently break the dual-assignment behavior this spec exists to support.

</details>

---

## Acceptance criteria

- [ ] Driving forces and Suppressed forces render as two columns with a divider, each carrying its role's accent color and label.
- [ ] Selected clusters appear as removable chips inside their field; the dropdown never shows a cluster that's already selected *for that field*.
- [ ] Opening a field's dropdown does not shift or resize any other content on the page.
- [ ] Typing in a field filters its dropdown by cluster name.
- [ ] Each dropdown row shows the cluster's Subtype, Horizon, and Likelihood as pills matching the Clusters page styling.
- [ ] The filter bar's Type / Horizon / Likelihood chips narrow the dropdown list; combined with search text, all active conditions apply together (AND).
- [ ] "Clear filters" appears only when at least one filter chip is active, and clears all three facets at once.
- [ ] Picking a cluster not already assigned to the other role adds it immediately and keeps the dropdown open.
- [ ] Picking a cluster already assigned to the other role shows an inline confirmation ("Already added as {OtherRole}. Add as {ThisRole} too?") instead of adding it; "Add anyway" commits, "Cancel" reverts with no change.
- [ ] Once a cluster is assigned to both roles, its chip in both fields shows a tag naming the other role.
- [ ] Removing a chip only affects that field's assignment; the cluster's assignment in the other field is untouched.
- [ ] A field with every cluster already assigned shows an explicit empty state rather than a blank list.
- [ ] A project with zero clusters shows guidance to build clusters first, rather than a picker with nothing in it.

---

## Accessibility (required for ship, not covered by the prototype)

The prototype is mouse/click-only and does not meet this bar — it exists to validate the interaction, not the accessibility implementation. Production needs:

- Full keyboard support: the field behaves as a combobox (open on Down/Enter, arrow keys move through options, Enter selects, Escape closes the panel or cancels an open confirmation row).
- ARIA: `role="combobox"` on the input with `aria-expanded`/`aria-controls`, `role="listbox"` on the panel, `role="option"` with `aria-selected` on each row, and the confirmation prompt announced to screen readers when it appears (live region or equivalent).
- Sensible focus handling when a confirmation row appears and when Add anyway/Cancel resolve it.
- Touch targets on chip-remove buttons, filter chips, and confirm/cancel buttons sized for mobile, not just mouse pointers.

---

## Floating panel positioning

**Confirmed by Pass 1 audit.** No positioning library exists in the app (no Floating UI, Popper, Radix, etc.), but `ClusterAssignMenu.jsx` already hand-rolls exactly what this needs: it measures the trigger's `getBoundingClientRect()`, compares available space below against the panel's height, flips to open upward when there isn't room, and renders via `createPortal(..., document.body)` at a high explicit `zIndex` to escape any ancestor stacking context. **Copy this pattern rather than adding a new dependency or reinventing it.**

The Scenario builder is a full page, not a modal — no backdrop, just a sticky header at `zIndex: 10`. (A `ScenarioDrawer.jsx` modal-style version exists in the codebase but is dead code, imported nowhere — don't build against it.) Because there's no elevated container to inherit stacking from, the panel should portal to `document.body` with its own explicit z-index, per `ClusterAssignMenu`, rather than assuming it needs to nest inside a modal's z-index scheme.

---

## Edge cases

- **Very few clusters (under ~10):** the filter bar and search still render but won't be doing much work — no special-casing needed.
- **Zero clusters in the project:** see acceptance criteria; block on guidance to create clusters rather than showing an empty picker.
- **Long cluster names:** row layout is two-line (name, then pills below) specifically so long names don't crowd the pills — keep that stacking rather than forcing everything onto one line.
- **All clusters already assigned to a role:** empty-state copy in that field's panel, distinct from the "no search/filter matches" empty state.
- **Large cluster counts (100+):** not exercised by the prototype's 28-item dataset. Worth confirming typical cluster counts per project before deciding whether client-side filtering stays fast enough or filtering needs to move server-side.

---

## Open questions

**OQ-FORCES-01: Filter chip selection model. ✅ Resolved by Pass 1 audit.**
The Clusters page's Type / Horizon / Likelihood filters (`FilterDropdown.jsx`) are single-select per facet. The picker's filters should match — single-select, not the multi-select toggle chips in the prototype — unless there's a specific reason to diverge from the existing convention.

**OQ-FORCES-02: Chip order.**
Chips currently render in the cluster list's master order, not the order they were selected in. If the sequence of driving forces matters when someone reads a scenario back — narratively or analytically — chips should preserve selection order instead. Worth confirming before this is load-bearing in the data model.

**OQ-FORCES-03: Downstream rendering — now a confirmed gap, needs a scope decision.**
Pass 1 audit found `suppressed_forces` is already invisible outside the builder form and `ScenarioRead.jsx`: Markdown export (`buildMarkdown.js`), Web Publish (`src/publish/sections.js`), and the FutureModels card grid all render `driving_forces` only and never touch `suppressed_forces`. (There's no "Scenario Analyze modal" or System Map integration for forces in the codebase — that surface doesn't exist.) This is a pre-existing gap, not something dual-role assignment newly breaks, but it means someone could carefully assign a cluster as Suppressed in the new picker and have it vanish from every export/publish surface. **Decide whether closing this gap is in scope for this pass or explicitly deferred** — see Sam's note in the audit prompt doc.

**OQ-FORCES-04: Should the scenario's own Time Horizon field influence these pickers?**
The scenario has its own Time Horizon selector elsewhere on the form. Once set, the pickers could default-prioritize or pre-filter to clusters matching that horizon, without hiding the rest. Not required for a first ship; flagged as a plausible follow-up.

**OQ-FORCES-05: Is inline confirmation the right pattern for cross-role selection?**
The spec above uses an inline expand-in-place confirmation (Add anyway / Cancel). An alternative worth a design conversation: add the cluster immediately and surface a brief, dismissible "Added to Suppressed too — Undo" notice instead, trading a confirmation step for an undo path. Both are defensible; this spec goes with inline confirmation because it matches what's already been prototyped and reviewed, not because the alternative was ruled out.

---

## Implementation sequence

*Updated per Pass 1 audit — this is a refactor of shipped code, not a net-new build.*

1. **No data layer step required.** `driving_forces`/`suppressed_forces` already exist as independent `jsonb` columns and already permit dual assignment. Confirm this during implementation rather than migrating anything.
2. **Lift state above the two `ChipMultiSelect` instances.** Today's two instances (`ScenarioForm.jsx:345-361`) are independent and share no state, which is why a cluster can already silently end up in both arrays with no warning. The cross-role confirmation and dual-role chip tags require both fields to read each other's selections — this needs the two picker instances to share state at the `ScenarioForm` level (or an equivalent lift), not just a visual restyle of `ChipMultiSelect` in place.
3. **Field shell** — two-column layout, chip rendering, floating panel built on the `ClusterAssignMenu.jsx` collision-detection/portal pattern (see Floating panel positioning above).
4. **Search + filters** — wire the filter bar (single-select per facet, per OQ-FORCES-01) and search input to the cluster query.
5. **Selection logic** — add/remove per role, the cross-role confirmation flow, dual-role chip tags.
6. **Keyboard & ARIA pass** — combobox semantics per the Accessibility section.
7. **Empty and edge-case states**, including the "no value" treatment for clusters with a null Horizon or Likelihood.
8. **Decide and, if in scope, close the `suppressed_forces` downstream visibility gap** (OQ-FORCES-03) in `buildMarkdown.js`, `src/publish/sections.js`, and the FutureModels card grid.
9. **QA pass** against the acceptance criteria and accessibility checklist above.

---

## Reference prototypes

Two static HTML files were shared in this project's conversation and are the functional reference for this spec:

- `scenario-forces-picker-prototype-v2.html` — current version, described throughout this spec (real Subtype/Horizon/Likelihood fields, filter chips, cross-role confirmation).
- `scenario-forces-picker-prototype.html` / `scenario-forces-picker-prototype-v1-fallback.html` — earlier iteration with invented thematic groups instead of real cluster fields, kept as a fallback reference only. Superseded by v2; not the intended design.

Both are self-contained (open directly in a browser, no build step) and can be used to check exact behavior — panel positioning, confirmation copy, filter interaction — against what ships.
