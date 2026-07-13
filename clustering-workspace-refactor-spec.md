# Future Signals — Clustering Workspace Refactor
## Spec v1 · June 2026

> **Status: Complete** — all 8 steps implemented on `workspace-refactor` branch, 2026-06-28.
> Steps: (1) layout refactor, (2) cluster detail panel, (3) sidebar cleanup, (4) drop zone, (5) drag-and-drop, (6) multi-select, (7) Suggested mode AI panel, (8) wiring + bug fixes + cleanup.
> Pending: merge `workspace-refactor` → `master` after alpha review.

---

## Prototype reference

A fully interactive HTML prototype of this design is at:
`prototypes/future-signals-workspace-refactor.html`

This prototype (v5) demonstrates the two-column layout, drag-and-drop interaction model, list/card view toggle, cluster detail panel, multi-select behavior, and the Manual/Suggested mode toggle with AI suggestion cards. Use it as the primary visual and behavioral reference for implementation. Do not copy its code directly — it uses vanilla JS and inline styles, not the React component architecture or design token system.

---

## Current state (what exists today)

Understanding what is being replaced is essential for writing accurate Claude Code prompts.

### Current Inputs screen (`/projects/:id/inputs`)

A full-width inputs table on the left (approximately 75% width) with a right-hand sidebar (approximately 25% width). The sidebar contains three stacked sections:

1. **Clusters summary widget** — header labeled "Clusters" with a "Build a cluster" button. Below it, a list of the first 5 cluster cards (type badge + horizon badge + input count + name). A "View all clusters →" text link navigates to the Clustering screen.
2. **System Map widget** — header labeled "System Map" with a "Go to System Map" button. Below it, status text: either "The System Map is built from clusters. Complete your clustering step first." (if no system map) or a summary of the built map.
3. **Project Details section** — header labeled "PROJECT DETAILS" with an "Edit ›" link. Below it, four label/value rows: Domain, Focus, Geography, Stakeholders. Unset fields show in italic.

The inputs table has tabs (All / Unassigned / In cluster), filters (search, Type, Horizon, STEEPLED), and a column set of: checkbox · Title · Type · Strength · STEEPLED · Horizon · Cluster.

Unassigned inputs show an "Assign →" button in the Cluster column. Clicking opens a dropdown listing available clusters. If no clusters exist, the dropdown shows "No clusters yet — build one first." Assigned inputs show the cluster name truncated.

When one or more inputs are selected via checkbox, a black action bar appears below the tab/filter row with: "N selected" · "Assign →" · "Delete" (red) · "✕ Clear". The "Assign →" button on this bar is currently non-functional (bug — see bug fixes below).

The assign dropdown is currently clipped by the table's overflow boundary when clusters exist (bug — see bug fixes below).

### Current Clustering screen (`/projects/:id/clusters`)

A separate full-page view with:
- Page title "Clustering" and subtitle "N inputs · N clusters"
- A "Build a cluster" primary button (top right)
- Filter bar: search, Type, Horizon, Likelihood
- A two-column grid of cluster cards, each showing: type badge + horizon badge + likelihood badge + input count + name + truncated description
- Below the cluster grid: an "Unassigned inputs" section with its own table (Title, Strength, Horizon, STEEPLED columns) and an "Assign →" button per row
- Below that: a "Cluster suggestions" section with AI-generated cluster suggestions

Clicking a cluster card opens a right-side detail panel showing: cluster name, type/horizon/likelihood badges, description, linked inputs list, and a "Find related inputs" section.

The cluster creation flow ("Build a cluster" button) opens a right-side panel with: Cluster name field, Subtype selector (Trend / Driver / Tension), Horizon selector (H1 / H2 / H3), Likelihood selector (Possible / Plausible / Probable), Description textarea, and a scrollable "Link inputs" checklist.

### Current nav sidebar (project section)

```
Inputs          [count]
Clusters        [count]
System Map      [✓ or —]
System Analysis
Future Models
```

---

## What this refactor changes

### The problem

Inputs appear in too many places:
1. Dashboard — "Recent inputs" section at the bottom of the project grid
2. Inbox — the full inputs holding area
3. Inputs screen — the project-scoped inputs table with the clusters sidebar
4. Clustering screen — the separate unassigned inputs table below the cluster grid

The Inputs and Clustering screens share deeply related work — you assign inputs to clusters, you check clusters while reviewing inputs, you go back and forth constantly — but the separate-screen model forces practitioners to navigate between them repeatedly, losing context on each transition.

### The solution

Merge the Inputs screen and the Clustering screen into a single unified **Inputs workspace** with a two-column layout: inputs table on the left, clusters panel on the right. Both panels are visible and usable simultaneously.

Assignment happens through direct manipulation, borrowing the macOS Finder drag-and-drop metaphor: inputs are files, clusters are folders. Drag to move. Hold ⌥ Option while dragging to copy.

The right-hand sidebar on the current Inputs screen (Clusters summary, System Map widget, Project Details) is replaced entirely by the new full-height clusters panel. Project Details moves into the project header. System Map status moves to the nav item.

The Clustering screen is removed. Its URL redirects to the Inputs screen.

---

## Goals

- Eliminate context-switching between Inputs and Clustering screens during the clustering workflow.
- Make the relationship between inputs and clusters spatially obvious — both visible simultaneously.
- Reduce the number of surfaces where inputs appear (from four to two: Inbox and the Inputs workspace).
- Expose persistent project context (key question, time horizons, metadata) so practitioners stay oriented to their foresight question.

## Out of scope

- Changes to the System Map, System Analysis, or Future Models screens.
- Changes to the Inbox screen.
- Changes to the Dashboard — the Dashboard is not touched by this refactor.
- Changes to the cluster creation form fields or the AI clustering suggestion API.
- UMAP embedding visualization (planned for later sprint).
- Mobile layout (desktop-first; responsive pass deferred).

---

## Navigation changes

### Sidebar

Remove the **Clusters** nav item. The project section becomes:

```
Inputs          [count badge]
System Map
System Analysis
Future Models
```

No locking, no disabled states. All items navigable at all times per design principle #5.

### Routes

- `/projects/:id/inputs` — existing route, extended with clusters panel (no URL change needed)
- `/projects/:id/clusters` — add redirect to `/projects/:id/inputs`

---

## Screen layout

### Overall structure

```
[Sidebar 208px] | [Project Header]
                | [Workspace]
                |   [Inputs Panel — flex:1] | [Clusters Panel — 320px fixed]
```

The workspace is a horizontal flex container filling the remaining viewport height below the project header. Neither panel scrolls as a unit — only their internal content areas scroll independently.

### Project header

The project header sits above the workspace and contains, top to bottom:

1. **Breadcrumb** — "Projects" link only. The project title immediately below makes repeating the project name in the breadcrumb redundant.
2. **Title row** — project name (large, semibold), header action buttons right-aligned: "Project settings", "Add from Inbox", "+ Add an input" (primary blue).
3. **Key question block** — `c.brandDeep` background, `c.brandBorder` border, `c.brand` label. "KEY QUESTION" label (10px uppercase) + question text (13px italic). Wraps naturally for longer questions — no truncation, no height cap.
4. **Project metadata strip** — a single horizontal row of label/value pairs separated by thin dividers: Domain · Focus · Geography · Stakeholders. Unset values show "Not set" in `c.faint` italic. Not editable inline — editing via "Project settings."
5. **Time horizons bar** — H1 / H2 / H3 color-coded bands with year ranges. Uses `h1Bg/h1Text`, `h2Bg/h2Text`, `h3Bg/h3Text` tokens.

**What moves here from the current UI:**
- Domain, Focus, Geography, Stakeholders — currently in the Project Details section of the Inputs screen right-hand sidebar. That section is removed; these fields move to the project header metadata strip.

**What is removed with no replacement:**
- System Map widget — currently in the Inputs screen right-hand sidebar. System Map status is visible in the nav (the item itself indicates whether a map exists). No additional widget is needed.

---

## Inputs panel (left)

### Tabs

Three tabs. **Unassigned is the default active tab** on page load — this is the working view during clustering. Switching tabs clears the current row selection.

| Tab | Content |
|---|---|
| All | Every input in the project |
| Unassigned | Inputs with no cluster assignment |
| Clustered | Inputs assigned to at least one cluster |

"Clustered" replaces the current "In cluster" label. It describes state rather than location.

### Filters bar

Below the tabs: search input, Type filter, Horizon filter, STEEPLED filter. Identical to current implementation.

### Instruction nudge

A slim strip below the filters bar, visible only on the Unassigned tab while unassigned inputs remain:

> _N inputs unassigned. Drag an input to a cluster to add. Hold ⌥ Option to copy instead of move._

Hidden on All and Clustered tabs. Hidden when unassigned count reaches zero.

Nudge suppression applies per design principle #6 — if dismissed twice, suppress for 30 days. Store suppression state in the `user_preferences` table under a `nudge_suppression` JSONB column keyed by nudge ID (e.g. `workspace-refactor-assign-nudge`).

### Inputs table

Column set: checkbox · drag handle · Title · Type · Strength · STEEPLED · Cluster

This removes the Horizon column from the current layout to make room for the drag handle. Horizon remains filterable via the Horizon filter chip.

**Cluster column behavior:**
- Unassigned inputs: show "Assign →" button, visible on row hover (opacity 0 → 1 transition). Clicking opens the assign popover.
- Assigned inputs: show cluster name as a truncated pill chip. Clicking the chip opens the assign popover to allow reassignment or removal.

**Row selection:**
- Checkbox click: toggle selection for that row.
- Shift-click: range select from last-checked row to current row (Finder convention).
- Select-all checkbox in thead: selects/deselects all rows visible in current tab. Shows indeterminate state for partial selections.
- Selected rows display `c.brandBg` background highlight.
- Tab switch clears selection.

**Drag behavior:**
- Dragging an unselected row: starts a single-item drag. Does not alter existing selection.
- Dragging a selected row: drags the entire current selection as a group.
- Browser default drag image is suppressed. A custom ghost element tracks the cursor.

**Ghost element:**
- Single item: truncated input title.
- Multiple items: "N inputs".
- ⌥ Option held: green "+" badge appears in the top-right corner of the ghost (copy mode signal). Updates in real time as Option is pressed or released mid-drag.

**Row removal animation:** On a successful move (not copy), from the Unassigned or All tab, the row slides right and fades out over 180ms before the list re-renders. On the Clustered tab, moved rows remain visible (they are still assigned, just to a different cluster).

### Assign popover

Triggered by: "Assign →" button, cluster chip click, multi-select bar "Assign →" button, or right-click context menu.

Contains:
- List of existing clusters (type badge + name). Clicking assigns the selected input(s) and closes.
- Divider.
- "+ New cluster" — opens the existing cluster creation panel (unchanged).

When no clusters exist yet: show only the "+ New cluster" option with no "no clusters" message.

**Renders via React portal** appended to `document.body` — this fixes the current bug where the dropdown is clipped by the table's overflow boundary.

### Multi-select action bar

When one or more rows are selected, a persistent action bar appears at the bottom of the inputs panel (above the table bottom edge, not a page-level overlay):

```
[N selected]    [Assign →]  [Delete]  [✕ Clear]
```

Styling:
- Background: `rgb(249, 249, 247)`
- "Assign →": `c.brand` fill, white text. Opens the assign popover operating on all selected inputs. **This fixes the current bug where this button does nothing.**
- "Delete": `rgb(254, 226, 226)` background, `rgb(185, 28, 28)` text, no border.
- "✕ Clear": text link only, `rgb(102, 102, 102)`. Label is exactly "✕ Clear" — the ✕ character, not × or x.

---

## Clusters panel (right)

Fixed 320px width. The panel does not scroll as a unit — only the cluster list inside it scrolls.

This panel **replaces the current right-hand sidebar** on the Inputs screen (which contains the Clusters summary, System Map widget, and Project Details section). All three of those sections are removed. The clusters panel is a full-height, richer replacement.

### Panel header

Two rows:

```
Row 1:  Clusters                           [+ New cluster]
Row 2:  [Manual | Suggested]                      [☰ | ⊞]
```

**Row 1** — "Clusters" label (13px semibold) left-aligned. "+ New cluster" button right-aligned: `c.brandBg` background, `c.brand` text, `c.brandBorder` border. Visible in both Manual and Suggested modes.

**Row 2** — Left: Manual/Suggested mode toggle (connected segmented control, active state fills `c.brand`). Right: list/card view toggle (connected segmented control). The view toggle is hidden in Suggested mode since it is irrelevant there.

### Manual mode

Default mode on page load. Contains the new cluster drop zone and the scrollable cluster list.

### Suggested mode

Switching to Suggested mode replaces the cluster list area with the AI suggestion interface. The "+ New cluster" button remains available in Suggested mode — the practitioner may want to create a cluster manually while reviewing suggestions.

#### Suggested mode toolbar

Below the panel header:

```
[Tight | Balanced | Exploratory]          [✦ Suggest clustering]
```

- **Sensitivity toggle** (Tight / Balanced / Exploratory): connected segmented control, dark fill on active. Balanced is the default. Matches the existing sensitivity control on the current Clustering screen — preserve existing behavior.
- **"✦ Suggest clustering" button**: on-demand only. Triggers the existing AI clustering call. Shows a loading state while running. After completion, renders suggestion cards.

#### Suggestion types

The AI returns two distinct suggestion types, rendered in separate labeled sections:

**Section 1 — "Add to existing clusters"**

Cards proposing specific inputs to add to clusters the practitioner has already built. Each card:

- Header: "Add to [Cluster Name]" — cluster name is a link that opens the cluster detail panel.
- Input list: each row shows bullet · input title · confidence badge (Strong / Moderate) · Remove button.
- Footer: "Accept" button (primary) · "Dismiss" link. "Accept all" link aligned right in the header area.

Accepting adds all remaining inputs in the card to the named cluster and removes the card. "Accept all" in the header does the same. Removing an individual input via the Remove button removes it from that suggestion only — the card remains for the other inputs. If all inputs are removed, the card disappears.

Dismissing removes the card permanently. The inputs are not assigned anywhere. The practitioner can re-run suggestions to get new recommendations.

**Section 2 — "New cluster suggestions"**

Cards proposing entirely new clusters that don't exist yet. Each card:

- Header: proposed cluster name (bold) + type badge (Trend / Tension / Driver) right-aligned. Below: proposed description (2-line clamp). "· Why this cluster?" expand link.
- Input list: same format as above — bullet · title · confidence badge · Remove button.
- Footer: "Create cluster" button (primary) · "Edit" button · "Dismiss" link.

"Create cluster" creates the cluster with the remaining inputs assigned and removes the card. "Edit" opens the cluster creation panel pre-filled with the suggested name, type, description, and inputs — the practitioner can modify before saving. "Dismiss" removes the card permanently.

#### Idle / empty states

- **Before first run:** Centered message — "No suggestions yet" + subtext explaining how to run.
- **After all suggestions resolved:** Centered message — "All suggestions resolved" + subtext indicating the practitioner can re-run.

#### Relationship to inputs panel

The inputs panel is unchanged when Suggested mode is active. Drag-and-drop to manual clusters still works. The Unassigned count in the tabs updates in real time as suggestions are accepted.

### New cluster drop zone

A fixed strip directly below the panel header, always visible above the scrollable cluster list. Does not scroll away:

> ⊕ Drop inputs here to create a new cluster

Styled with dashed border (`c.border`), `c.faint` text. On drag-over: border highlights `c.brand`, background shifts to `c.brandBg`. On drop: opens the cluster creation panel with the dropped input(s) pre-selected in the Link inputs field.

### Cluster list — list view (default)

Compact single-row items. Three columns: **Type badge (fixed 62px) · Name (flex, truncates) · Input count.**

Order is: name first, then type, then count — because the name is the primary scan target when working through a list of 10–20 clusters.

Fixed-width type badge container (62px) ensures all cluster names start on the same horizontal grid regardless of badge label length (Trend, Tension, Driver differ in width).

On drag-over (move): item border highlights `c.brand`, "Move" pill appears.
On drag-over with ⌥ Option (copy): item border highlights green, "Copy" pill appears.
Both states update in real time as Option is pressed or released.

### Cluster list — card view

The existing card layout from the Clustering screen, adapted to fit the 320px panel width. Each card shows: type + horizon + likelihood badges, cluster name (bold), truncated description (2-line clamp), input count (top-right). Hover state adds subtle box shadow.

Card view provides more context per cluster but shows fewer clusters before scrolling. List view is better for projects with 8+ clusters.

### Cluster detail panel

Clicking any cluster item or card opens a detail panel that slides in from the right over the cluster list (translateX animation, 220ms). The inputs panel remains fully visible and interactive while the detail panel is open.

The detail panel replaces the current cluster detail panel on the Clustering screen.

Contents, top to bottom:
1. **Header** — "← Clusters" back link (returns to cluster list), "Edit" button (opens existing cluster edit form, unchanged).
2. **Type / horizon / likelihood badges** — same pill style as card view.
3. **Cluster name** — 16px semibold.
4. **Description** — full text, not truncated.
5. **Linked inputs** — section label "Linked inputs (N)". Each input row shows: bullet dot · title · ✕ remove button. Clicking ✕ removes the input from the cluster and returns it to Unassigned immediately, with an animation. The detail panel stays open and updates its count.
6. No redundant metadata grid below the input list — type, horizon, and likelihood are already shown as badges above.

Closes on: "← Clusters" click, Escape key, or clicking anywhere in the inputs panel.

**Delete cluster** — "Delete cluster" button in the detail panel footer (destructive styling). Should confirm before deleting. On delete: panel closes, cluster removed from list, all previously assigned inputs return to Unassigned.

---

## Drag-and-drop interaction model

Follows macOS Finder conventions for files and folders.

### Move (default)

Drag one or more inputs onto a cluster. On drop:
- Input(s) are assigned to the target cluster.
- If an input was previously in a different cluster, it is removed from that cluster.
- In the Unassigned tab, assigned rows fade out (180ms animation).
- Cluster input count updates in real time.
- Toast: "Moved to [cluster name]" (single) or "Moved N inputs to [cluster name]" (multi).

### Copy (⌥ Option)

Hold ⌥ Option while dragging. On drop:
- An independent duplicate of each input is created (new `inputs` row, new UUID).
- The original input remains in its current cluster or Unassigned state.
- The duplicate is assigned to the target cluster.
- No row fade-out — the original stays visible.
- Toast: "Copied to [cluster name]" or "Copied N inputs to [cluster name]".

The copy carries forward the original's `embedding` vector (avoids re-embedding cost). The copy's `metadata` field includes `copied_from: sourceInputId` for traceability.

⌥ Option can be pressed or released mid-drag. The ghost badge and drop target pill update in real time.

### Drag to new cluster

Dragging onto the "Drop inputs here to create a new cluster" zone:
- Opens the cluster creation panel.
- Dropped inputs are pre-listed in the Link inputs field.
- No AI pre-fill — the name field is blank, metadata fields are at their defaults.
- The practitioner enters a cluster name (required) and optionally sets Subtype, Horizon, Likelihood.
- On save: cluster is created, inputs are assigned, inputs disappear from Unassigned.
- On cancel: panel closes, no cluster is created, inputs remain in Unassigned.

### Multi-select drag

Checking rows (or Shift-clicking for range selection) then dragging any selected row drags the entire selection. Ghost shows "N inputs". All inputs move (or copy) to the target in one operation.

Selection clears after a successful assignment.

### Drop target states

| State | Border | Background | Pill label | Pill color |
|---|---|---|---|---|
| Move hover | `c.brand` | `c.brandBg` | "Move" | `c.brand` fill, white text |
| Copy hover (⌥) | green (`#3B6D11`) | `#EAF3DE` | "Copy" | green fill, white text |
| Idle | `c.border` | `c.white` | — | — |

---

## Context menu (right-click)

Right-clicking any input row opens a floating context menu:

```
[Input title — truncated to 38 chars]
──────────────────────────────────────
Move to cluster        ▶  [submenu]
Duplicate to cluster   ▶  [submenu]
──────────────────────────────────────
Remove from cluster         ← only if currently assigned
```

Each submenu lists available clusters by name, with "+ New cluster" at the bottom after a divider.

"Remove from cluster": `c.alertText` color, `c.alertBg` hover background.

Closes on: outside click, Escape, action selected.

This is the primary discoverability path for users who do not know the ⌥ Option copy convention.

---

## Toast notifications

| Action | Toast text |
|---|---|
| Single input moved | "Moved to [cluster name]" |
| Multiple inputs moved | "Moved N inputs to [cluster name]" |
| Single input copied | "Copied to [cluster name]" |
| Multiple inputs copied | "Copied N inputs to [cluster name]" |
| Removed from cluster | "Removed from cluster" |

Auto-dismisses after 2.4 seconds. Renders at bottom-center of viewport. No action button.

---

## Bug fixes included in this refactor

Two existing bugs on the current Inputs screen are fixed as part of this work:

**Bug 1 — "Assign →" in multi-select action bar does nothing.** The button exists but has no handler. Fix: wire it to open the assign popover operating on all currently selected inputs, using the same React portal popover component built for this refactor.

**Bug 2 — Assign dropdown clipped by table overflow.** The cluster assignment dropdown on the Inputs screen is clipped by the table container's overflow boundary. Fix: render the popover via React portal appended to `document.body`, positioned absolutely relative to the triggering element's `getBoundingClientRect()`.

---

## What is removed

| Element | Current location | Disposition |
|---|---|---|
| Clusters nav item | Project sidebar | Removed |
| `/projects/:id/clusters` route | Router | Redirects to `/projects/:id/inputs` |
| Clusters summary widget | Inputs screen right-hand sidebar | Replaced by full clusters panel |
| System Map widget | Inputs screen right-hand sidebar | Removed — status visible in nav |
| Project Details section | Inputs screen right-hand sidebar | Moved to project header metadata strip |
| Standalone Clustering screen | `/projects/:id/clusters` | Removed (redirected) |
| Unassigned inputs table | Bottom of Clustering screen | Merged into Inputs panel |
| Cluster suggestions section | Bottom of Clustering screen | Replaced by Suggested mode in clusters panel |

---

## What is preserved unchanged

- All cluster creation form fields (Name, Subtype, Horizon, Likelihood, Description, Link inputs).
- The AI clustering suggestion system and context-aware clustering behavior.
- The Inbox screen and its workflow (My Inputs + AI Suggested sections).
- The "Add from Inbox" and "+ Add an input" entry points on the Inputs screen.
- All existing filter behavior on the inputs table (search, Type, Horizon, STEEPLED).
- The existing cluster detail panel content — adapted to the new sliding panel container.
- The existing cluster edit form.

---

## Files likely affected

Verify actual filenames in the codebase before writing Claude Code prompts — these are approximate.

| File | Change |
|---|---|
| `src/components/Sidebar.jsx` (or equivalent) | Remove Clusters nav item |
| `src/pages/ProjectInputs.jsx` (or equivalent) | Major refactor — add clusters panel, drag-and-drop, detail panel; remove right-hand sidebar |
| `src/pages/ProjectClusters.jsx` (or equivalent) | Replace with redirect to `/projects/:id/inputs` |
| `src/App.jsx` (or router file) | Update routes; add redirect |
| `src/components/ClusterCard.jsx` (or equivalent) | Adapt for list-view and card-view within the 320px panel |
| `src/components/ClusterDetail.jsx` | New or adapted — sliding detail panel |
| `src/components/ClusterSuggestions.jsx` | New component — Suggested mode panel with both suggestion card types |
| `src/components/AssignPopover.jsx` | New shared component — used by row button, multi-select bar, and context menu |
| `src/components/DragGhost.jsx` | New component — custom drag ghost |
| `src/pages/Dashboard.jsx` (or equivalent) | Remove Recent inputs section |

---

## Branch and environment

- **Branch:** `workspace-refactor`
- **Staging Supabase:** separate project (future-signals-staging) — run all migrations here before production
- **Preview URL:** auto-generated by Vercel on push to branch
- **Merge gate:** John + at least one additional alpha tester validates the new flow on preview before merging to main

Do not begin implementation until the prototype has been reviewed by John and this spec is approved. Audit against `docs/design-principles.md` before writing Claude Code prompts — particularly principles #4 (AI outputs require practitioner action), #5 (no navigation gates), and #6 (nudge suppression).

---

## Open questions (resolve before implementation)

**1. Cluster creation from drag-to-new-cluster zone.**
When inputs are dropped on the "Drop inputs here to create a new cluster" zone, the cluster creation panel opens with those inputs pre-listed in the Link inputs field. No AI pre-fill. The practitioner completes the Name field (the only required field), optionally sets Subtype / Horizon / Likelihood, then saves. On save: cluster is created and inputs are assigned. On cancel: inputs return to Unassigned with no cluster created. No LLM call is involved in this flow.

**2. Nudge suppression column.**
Design principle #6 requires nudge suppression after two dismissals for 30 days. The `user_preferences` table is the correct location. Confirm whether a `nudge_suppression` JSONB column already exists; add it in a migration if not. Migration must include explicit grants per the October 2026 Supabase enforcement deadline documented in CLAUDE.md.

**3. Suggested mode — accept behavior and input assignment.**
When "Accept" is clicked on an "Add to existing cluster" suggestion card, confirm whether the accepted inputs should be assigned via the existing RPC used for manual assignment, or via a separate suggestion-acceptance endpoint. The behavior should be identical from the practitioner's perspective — inputs move from Unassigned to the cluster, the Unassigned count drops, and the tab updates — but the implementation path may differ depending on whether suggestion acceptance needs to be logged separately for future model improvement.
