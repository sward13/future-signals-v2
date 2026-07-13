# Future Signals v2 — Handoff

_Last updated: 2026-07-09_

---

## Project overview

Future Signals v2 is a strategic foresight SPA (React 18 + Vite + Supabase). It guides practitioners through a structured methodology: Inputs → Clusters → System Map → System Analysis → Future Models.

**Stack:** React 18, Vite, Supabase (Postgres + pgvector + RLS), Vercel (hosting + cron), OpenAI (embeddings + GPT-4o)

**Repo:** `sward13/future-signals-v2` on GitHub  
**Prod:** Deployed on Vercel, auto-deploys from `master`

---

## Current state — main app

All core screens are built and functional:

| Screen | Status |
|---|---|
| Auth (sign up / sign in / email confirm) | Done |
| Onboarding flow | Done |
| Dashboard | Done |
| Inbox | Done |
| **Project Overview** (default landing — key question, horizons, scanner, phase cards) | **Done** |
| **Scan** screen (`ProjectDetail.jsx`, screen key `"project"`) — inputs table, tabs, duplicate-to-cluster | **Done** |
| **Cluster** screen (`ClusterScreen.jsx`, screen key `"cluster"`) — InputRail + ClustersPanel + drag state | **Done** |
| System Map | Done |
| System Analysis | Done |
| Future Models (Scenarios + Strategic Options) | Done |

Note: Scan and Cluster are now separate sidebar items and separate screens. `Clustering.jsx` is dead code (no longer imported). The `"clustering"` case in App.jsx is a legacy redirect to `ClusterScreen` to handle any stored localStorage state.

**2026-07-09 session — Sample project cloning shipped end-to-end (on `workspace-refactor` branch):**
- **Started as a read-only schema audit** (per `Sample_Project_Onboarding_PRD.md`) that surfaced several undocumented direct-to-database changes: `projects.source_template_id` and `projects.is_sample_template` (added with no migration file), `projects.last_visited_at`/`analyses.updated_at` present on staging but missing on production for a week (the consuming `openProject()` write was a bare `.then()` with no error capture — silently failing the whole time), and an undocumented `AFTER INSERT` trigger on `projects`, `trg_auto_populate_project_sources`, that auto-populates `project_sources` with `opted_in: true` on every new project. All four backfilled with proper migrations on both databases; the two silent-failure write sites (`last_visited_at` in `useAppState.js`, `onboarding_completed` in `App.jsx`) now log via `console.error`, still fire-and-forget.
- **`server-lib/clone-project.js`** (moved from `api/lib/` — see Infrastructure notes) — `cloneProject(sourceProjectId, destWorkspaceId, options)` / `rollback()`. Walks all 13 project-scoped tables, remaps every FK including the jsonb/array id references with no FK enforcement (`preferred_futures.scenario_ids`, `strategic_options.scenario_ids`, `cluster_suggestions.input_ids`). Paginates every read and chunks every insert (PostgREST's ~1000-row cap bit a real project with 8,100 `project_candidates` rows). `project_candidates` is now **never** cloned by either path — it's derived scanner data that goes stale the moment scanning is re-enabled; 8,100 stale rows already cloned into the production template were purged after the fact.
- **Tested thoroughly before touching real data**: constructed throwaway staging projects to deliberately force the `project_sources` trigger-collision path and the jsonb-remap path (including a dangling-reference case), both passed. Then ran the real clone against John's live production project ("Future of Alternative Proteins") into the templates account — all 13 tables matched exactly, including 8,100 `project_candidates` (pre-exclusion-fix) and full jsonb-remap correctness on real non-empty data.
- **`api/clone-sample-project.js`** — Bearer-auth endpoint (same pattern as `seed-onboarding.js`), source project id from `SAMPLE_TEMPLATE_PROJECT_ID` env var only, never client-supplied. Wired into `App.jsx`'s `handleOnboardingComplete` as fire-and-forget, alongside the existing `onboarding_completed` write.
- **Real end-to-end test via preview deployment**: signed up a throwaway account and completed onboarding through the actual UI. Found the clone had succeeded server-side (confirmed via Vercel function logs + direct SQL) but didn't appear on the dashboard without a manual reload — `appState.projects` was never refetched after the fire-and-forget clone landed. Fixed by adding `refreshProjectsRef`/`refreshProjects`, following the exact existing `refreshInputs`/`refreshClusters` pattern; the clone's fetch `.then()` now calls it on success. Verified the delete-through-app flow too: deleting the clone correctly moves its inputs to the Inbox (not deleted — matches `deleteProject`'s existing semantics) and leaves the template completely untouched.
- **Dashboard labeling**: cloned projects show a `"[Sample] "` name prefix in both the card and table views, computed at render time only (`project.name` never mutated).
- **Removed dead `seeds.js` sample data** (`SAMPLE_PROJECTS`/`SAMPLE_CLUSTERS`/`SAMPLE_SCENARIOS`/`SAMPLE_CANVAS_NODES`/`SAMPLE_RELATIONSHIPS`) — an earlier abandoned attempt at the same problem, never imported anywhere, superseded by the clone-based approach.
- **Permanent template projects now exist**: staging `44b699ff-0fb1-44fb-9eb6-17a077cc7c9d`, production `566911c6-65b4-4648-962f-f0e662033cb8`. `SAMPLE_TEMPLATE_PROJECT_ID` set in Vercel for both Production and Preview/`workspace-refactor`.
- **Security note**: both the production DB password and the production `service_role` key ended up pasted in plaintext into the session transcript at different points (mechanics of relaying credentials between terminal and chat) — **both should be rotated** if not already done. Also found and removed a leftover `PGPASSWORD=...` allowlist entry in `.claude/settings.local.json` (gitignored, never committed, but was sitting in plaintext on disk).

**2026-07-07 session — Badge/chip audit + form-field label consistency fix (on `workspace-refactor` branch):**
- **Badge/chip audit (read-only):** Full audit of every badge/chip in the app (Signal Strength, Source Confidence, STEEPLED, Horizon, Likelihood, Cluster Subtype, Archetype) against the one real shared primitive, `Tag.jsx` (`Tag`/`StrengthDot`/`HorizTag`/`ArchTag`/`SubtypeTag`/`ConfidenceBadge` — font-size 10px, padding `2px 7px`, radius 10px, 1px border). Found the root cause of most drift: `StrengthDot`/`ConfidenceBadge` expect Title-Case keys (`Weak`/`Moderate`/`High`) but the real DB fields are lowercase, so nearly every screen reimplements its own inline badge instead of using the shared component. Surfaced a live color-scale conflict for Signal Strength (shared component vs. four ad hoc inline copies), a cyan-vs-blue mismatch for Cluster Subtype "Driver" between `Tag.jsx` and `ScenarioCanvas.jsx`, at least 4 distinct STEEPLED tag treatments, and several places where Horizon/Likelihood/Confidence render as plain text instead of a badge (System Map relationships table, Inbox table view). No code changed in this pass — findings and a consolidation plan written to `fable-badge-consolidation-prompt.md` (untracked) for a future fix pass.
- **Form-field label size/letter-spacing fix:** Separate audit found the small caption-style label above form fields (e.g. "Source", "STEEPLED", "Signal strength" in `InputDetailDrawer.jsx`) was reimplemented inline ~30 times across drawers, detail/read views, and the project-name "eyebrow" breadcrumb family, with inconsistent values (font-size 9–11px, letter-spacing 0.04em–0.09em) rather than a shared token. Updated every confirmed instance to `font-size: 11px, letter-spacing: 0.02em`; color, font-weight, text-transform, and margins were left untouched. Commit `f4dff2c`.
- **`CLAUDE.md` typography spec updated to match:** "Column headers" and the Scan-screen "eyebrow" spec now read 11px / letter-spacing 0.02em, so they don't get flagged as drift in a future design review. Commits `d2d7e1d`, `cb1d412`.

**2026-07-05 session — Cluster screen polish: full-field edit, list/card improvements, multi-select (on `workspace-refactor` branch):**
- **`ClusterDrawer` edit mode:** Added `initialValues` and `mode = "create" | "edit"` props. A single `useEffect([open])` seeds `fields` from `initialValues ?? EMPTY` and resets `nameError` + `selectedInputIds` on each open. In edit mode: `onSave` receives only `{ name, subtype, horizon, likelihood, description }`; footer button reads "Save changes"; eyebrow reads "Edit cluster"; linked-inputs section is hidden (wrapped in `mode === "create" && (...)`).
- **`ClusterDetailPanel` full-field edit:** Removed the old inline name-edit (text input + commit/cancel). The "Edit" header button now sets `editDrawerOpen = true`, which renders `<ClusterDrawer mode="edit" initialValues={...} onSave={(fields) => { updateCluster(cluster.id, fields); setEditDrawerOpen(false); }} />` overlaid on the detail panel. `updateCluster` prop threaded through from `ClusterScreen` → `ClustersPanel` → `ClusterDetailPanel`.
- **Search input fix:** ClustersPanel search input changed from `flex-1 min-w-0` to `w-[200px] shrink-0` to match the 200px fixed width used by the Inputs rail.
- **List view column headers + new columns:** Added a header row (Name | Type | H | Likelihood | #) above the cluster list. `ClusterListRow` gains a 34px Horizon column (`HorizTag`) and a 74px Likelihood column (local `LikelihoodTag` — Tailwind-only, no `tokens.js`). Column order: name flex-1 · type 62px · horizon 34px · likelihood 74px · count `min-w-6`.
- **Card view multi-select:** `selectedClusterIds` (Set) + `lastCheckedClusterId` + `confirmBulkDelete` state in ClustersPanel. `ClusterCard` gains `isSelected`, `onCheckboxClick`, `anySelected` props; checkbox opacity-transitions in on hover or when any card is selected. Shift-click range-selects the slice between last-checked and current in `visibleClusters` order. Sticky action bar at bottom of scroll area shows "{N} selected · Delete N · ✕ Clear"; `ConfirmDialog` guards bulk delete (iterates `deleteCluster(id)` per id).
- **Uniform card heights:** `ClusterCard` outer div uses `display:flex; flexDirection:column; height:100%; boxSizing:border-box`. Description always renders with `minHeight: 34` (≈ 2 × 11px × 1.55 line-height). Footer uses `marginTop: "auto", paddingTop: 8` to pin to card bottom regardless of description length. Grid cells stretch to row height via CSS Grid default `align-items:stretch`.
- **ClustersPanel heading removed:** Removed the "Clusters" label row from the panel header. Mode toggle row now has `pt-4` (16px) top padding to compensate. `border-b` divider on the panel header container is kept (still meaningful as the control bar shows/hides with mode).

**2026-07-03 session (cont'd) — ClusterScreen layout + AI Suggested tab (on `workspace-refactor` branch):**
- **ClusterScreen vertical stack:** Layout changed from side-by-side columns to a vertical stack — ClustersPanel full-width on top (`flex: 1, minHeight: 0`), InputRail pinned to bottom (`flexShrink: 0`). ClustersPanel receives `style` prop so ClusterScreen can override its fixed `w-80` and `border-l` Tailwind classes via inline-style specificity.
- **Resizable drag handle:** 7px hit area between ClustersPanel and InputRail with grip dots and `cursor: row-resize`. Mousedown captures `{ startY, startHeight }` in a ref; `mousemove` / `mouseup` listeners attach/detach via `useEffect([resizing])`, same pattern as HorizonSlider. Height clamped `[120px, 60vh]`. Persisted to `localStorage` as `fs_inputrail_height`.
- **Full input table in InputRail:** All / Unassigned / Clustered tabs, search, Type / Horizon / STEEPLED filter dropdowns, checkboxes with shift-click range select, sticky batch-assign action bar (ClusterAssignMenu). Matches ProjectDetail's input table feature-for-feature.
- **`FilterDropdown` extracted** from `ProjectDetail.jsx` to `src/components/shared/FilterDropdown.jsx`. Imported by ProjectDetail, Inbox, and ClusterScreen — single source of truth.
- **AI Suggested tab in ProjectDetail (Scan screen):** 4th tab — scanner-promoted candidates scoped to this project, partitioned into Emerging / Reinforcing sections. Filters: Type + STEEPLED (Horizon omitted — not set at promotion time). Emerging badge = amber; Reinforcing = blue.
- **Accept / Dismiss actions wired:** Per-row hover buttons (Accept calls `saveInputToProject(id, activeProjectId)`; Dismiss calls `dismissSuggestedInput(input)`). Batch action bar: Accept N (`saveInputsToProject`) + Dismiss N (iterates `dismissSuggestedInput`). Accepted inputs drop from AI Suggested immediately and appear in All/Unassigned via optimistic state. `saveInputToProject` and `dismissSuggestedInput` added to ProjectDetail's appState destructuring.

**2026-07-03 session — Scan/Cluster screen split (on `workspace-refactor` branch):**
- **`ProjectDetail.jsx` stripped** to Scan-only: all clustering concerns removed (ClustersPanel, DragGhost, ClusterAssignMenu, drag state, Cluster column, Assign buttons). Heading renamed "Inputs" → "Scan". `handleDuplicateToCluster`, the dupe picker, and the All/Unassigned/Clustered tabs are kept (they reference clusters but don't own clustering).
- **`ClusterScreen.jsx` created** (`src/components/screens/ClusterScreen.jsx`): two-column layout — a lean InputRail (name + type badge + Assign→/cluster-name per row, draggable) on the left, ClustersPanel unchanged on the right. All drag state (`dragIds`, `dragPos`, `dragIsCopy`, `blankImgRef`) now lives here. `handleDrop` simplified (no animation branch — InputRail shows all inputs regardless of tab). `createUntitledCluster` and `nextUntitledName` moved here from ProjectDetail.
- **Sidebar**: "Scan" (was "Inputs") and "Cluster" (new, screen `"cluster"`) are now separate nav items. `projCounts` key updated from `"clustering"` → `"cluster"` so the count badge displays correctly.
- **Routing**: `App.jsx` has `case "cluster"` → ClusterScreen, `case "clustering"` → ClusterScreen (legacy localStorage fallback), `"cluster"` added to AppShell scroll-exclusion list.
- **Overview phase cards**: Cluster card `onClick` → `setActiveScreen("cluster")`. Scan card + "Manage sources" button remain on `"project"`.
- **Context card fix**: All 6 fields (Focus, Audience, Stakeholders, Assumptions, In/Out scope) always render with italic "Not set" fallback — previously hidden when empty.
- **Stale copy fixed**: `ScenarioCanvas.jsx` empty-state "Clustering screen" → "Cluster screen".
- **Chrome extension scaffold committed**: `extension/` directory with full MVP source (background, content script, sidepanel, lib utils). See Chrome extension section below.

**2026-07-02 session — Tailwind migration: ProjectOverview.jsx (on `workspace-refactor` branch):**
- **`ProjectOverview.jsx` fully migrated** to Tailwind v4 — removes the last `tokens.js` import from this file. All inline style objects replaced with Tailwind utility classes; `clsx` used for conditional composition.
- **`PHASE_STATUS` converted** from style objects (`borderTop`, `labelColor`) to class-name objects (`topClass`, `labelClass`). The "Active this week" border uses `border-t-green-600` → our custom `--color-green-600: #16a34a` (same hex as original `c.green600`); label uses `text-green-700` → `--color-green-700: #3B6D11`.
- **`PhaseCard` hover shadow** converted from imperative `onMouseEnter`/`onMouseLeave` DOM mutation to `hover:shadow-hover` (the `--shadow-hover` `@theme` token generates the `shadow-hover` utility).
- **`HorizonScatter` SVG colours** converted from resolved `c.*` hex literals to `var(--color-*)` CSS variable strings — works in modern browsers for SVG presentation attributes.
- **`AnalysisFillGrid`** replaced `cellBase`/`cellStyle` style-object functions with a `cellClass(panel, isKd)` helper using `clsx`. The KD cell's `items-start` / other cells' `items-center` split across branches to avoid cascade ambiguity (never appear together in the same `className` string).
- **Migrated components to date:** `ClustersPanel.jsx`, `HorizonBar.jsx`, `ProjectOverview.jsx`.

**2026-07-02 session — Project Overview screen (on `workspace-refactor` branch):**
- **`ProjectOverview.jsx`** built as the new default project landing screen (`src/components/screens/ProjectOverview.jsx`). Sections: project name eyebrow + "Overview" title + ⚙ Project settings button; key question card (60/40 question / Domain+Geography split); proportional HorizonBar; scanner card ("N new signals since your last visit" using `priorVisitedAt` captured at mount before the `last_visited_at` stamp lands); collapsible context card (Focus, Audience, Stakeholders, Assumptions, In/Out scope); 5 phase cards.
- **Phase cards:** Scan · Cluster · System Map · System Analysis · Future Models. Each card shows a colour-coded `borderTop` status (Active today = brand blue, Active this week = green, earlier/not started = `c.border`) and a "Continue here" pill on the most-recently-active stage. System Analysis card shows a 3×2 `AnalysisFillGrid` using the exported `analysisHasCont` helper. Cluster card shows subtype pills + `HorizonScatter` SVG (dots per H1/H2/H3 zone).
- **`HorizonBar` extracted** from `ProjectDetail.jsx` into `src/components/shared/HorizonBar.jsx`. Both ProjectOverview and the shared file use it; ProjectDetail no longer imports it.
- **`analysisHasCont` exported** from `SystemAnalysisCanvas.jsx` for reuse in the Overview fill grid.
- **`projectSources` added** to `useAppState.js` — fetched per active project on `activeProjectId` change (the `project_sources` table has no `workspace_id`; scoped by `project_id`). Exposed as `appState.projectSources`.
- **`projects.last_visited_at` stamped** fire-and-forget in `openProject()`. Column already existed in the DB; `database.types.ts` regenerated from staging to surface it (also adds `canvas_text_nodes` and `analyses.updated_at`).
- **`canvas_text_nodes.created_at`** added to the state mapping in `fetchCanvasTextNodes` (was selected via `*` but dropped). `latestMapTs` in ProjectOverview now takes the MAX of relationship timestamps and text node timestamps — placing a text annotation counts as System Map activity.
- **Routing wired:** `openProject(id)` navigates to `"project-overview"`; `"project-overview"` case added to `App.jsx` switch and scroll exclusion list; Overview added as first `PROJECT_ITEMS` entry in `Sidebar.jsx` (Eye icon); `openProject` threaded through `AppShell` → `Sidebar` to fix the sidebar project-list bypass (was calling `setActiveProjectId + setActiveScreen` directly, now calls `openProject()`).
- **Inputs screen header trimmed:** key question block, metadata strip (Domain/Focus/Geography/Stakeholders), and HorizonBar removed from `ProjectDetail.jsx`. The Inputs header now shows only the project name eyebrow + "Inputs" title + CTAs. Content surfaces once, on Overview.

**2026-06-29 session — Tailwind CSS v4 migration + CSV import fix (on `workspace-refactor` branch):**
- **Tailwind CSS v4 installed** via `@tailwindcss/vite` Vite plugin — no `tailwind.config.js`. `@import "tailwindcss"` added to `src/index.css`.
- **Design system mapped to `@theme`:** All 38 color tokens from `tokens.js c{}` registered as `--color-*` custom properties. Seven off-grid spacing tokens and two typography tokens (`--text-ui: 13px`, `--leading-body: 1.55`) also in `@theme`. `clsx` installed for conditional class composition.
- **ClustersPanel.jsx migrated** — first component fully converted from `tokens.js` inline styles to Tailwind v4 classes. Token gaps resolved by adding `surfaceHover`, `brandBg`, `brandBorder`, `green25`, `green600` to both `tokens.js` and `@theme`.
- **CSV import updated** (`CsvImportModal.jsx`): column mapping now matches current export schema (`Name, Subtype, Description, Source URL, STEEPLED, Horizon, Signal Strength, Source Confidence, Date Added`). Removed stale `signal_quality`, `title`, `type`, `time_horizon` references.
- **CLAUDE.md updated** with full Tailwind v4 section: setup, 38-token color table, spacing tokens, typography tokens, border-radius two-tier design note (`rounded-[7px]` is intentional — don't replace with `rounded-lg`), migration rules, `clsx` convention.

**2026-06-28 session — Clustering workspace refactor (complete, on `workspace-refactor` branch):**
- **Merged Inputs + Clustering into one workspace.** The separate Clustering screen is removed. ProjectDetail now renders a two-column layout: inputs table (flex:1, left) and a fixed 320px ClustersPanel (right). Both panels are visible and interactive simultaneously — no more context-switching.
- **ClustersPanel** (`src/components/clusters/ClustersPanel.jsx`): Manual/Suggested mode toggle, list/card view toggle, new-cluster drop zone, scrollable cluster list. Cluster detail slides in from right on click (translateX animation, `ClusterDetailPanel.jsx`).
- **Drag-and-drop** (macOS Finder model): drag inputs onto cluster rows/cards to move; hold ⌥ Option to copy. Custom ghost element via React portal (`DragGhost.jsx`). Drop zone for "create new cluster." Multi-item drag when rows are selected.
- **Multi-select** with shift-click range, indeterminate select-all checkbox (callback ref), sticky action bar at bottom of inputs panel (Assign → / Delete / ✕ Clear).
- **ClusterSuggestions** (`src/components/clusters/ClusterSuggestions.jsx`): Suggested mode panel. Calls `compute-cluster-suggestions` Supabase edge function (deployed to staging `kptatqipjwihkdxdxlvh`). Assignment suggestion cards (Accept / Dismiss / Accept all / per-row Remove). New cluster suggestion cards (Create / Edit inline / Dismiss / rationale expand). Sensitivity toggle (Tight / Balanced / Exploratory). Empty + resolved states.
- **Bug fixes:** multi-select "Assign →" was a no-op (now wired to `handleBatchAssign` via `ClusterAssignMenu`); assign dropdown was clipped by table overflow (now portal-based via `ClusterAssignMenu.jsx`).
- **Dashboard cleanup:** removed "Recent inputs" section and the unused `ProjectPickerPopover` component.
- **Sidebar:** Clusters nav item removed. Project nav is now: Inputs · System Map · System Analysis · Future Models · Export.
- **Props wired end-to-end:** `projectId`, `assignInputToCluster`, `addCluster` all passed explicitly from ProjectDetail → ClustersPanel → ClusterSuggestions.

Recent notable additions (pre-refactor):
- CSV import for Inputs (sidebar entry point, template download, preview, bulk write)
- Search + filter on Clustering screen (type / horizon / likelihood)
- Strategic Options: Reversibility + Resource Intensity fields with colour-coded badges
- System Map: fullscreen toggle, "Other" relationship type with custom label, table view reorder
- Signal Quality disaggregated into Signal Strength (`Weak | Moderate | Strong`) and Source Confidence (`Low | Medium | High`) — both practitioner-set; `signal_quality` DB column retained but unused
- Inbox AI Suggested Project filter: defaults to "All projects" on fresh load; persists within session; deep-link from "Review N suggestions" still pre-selects the correct project
- Per-project scanning controls in Account Settings
- Security hardening: SSRF protection on `/api/scrape`, auth required on `/api/trigger-score`, RLS on `source_health`, dropped `candidates_insert` open policy, O(1) unsubscribe token verification, unsubscribe URL routed through app domain

**2026-06-25/26 session — Clustering UX polish + UI standardisation:**
- **AssignmentSugRow Option D:** The cluster assignment suggestion row in Clustering is now a click-to-expand row. Clicking anywhere on the row (except Accept/Dismiss) toggles the rationale sub-row. A rotating `›` chevron at the left of the title animates open/closed via CSS transition. Accept/Dismiss use `e.stopPropagation()`. Extracted as a named `AssignmentSugRow` component so each row has its own `useState`.
- **Bulk assign button fix (Clustering):** The "Assign to cluster →" button in the Clustering bulk action bar was silently no-oping because `AssignPicker` returns `null` without an `anchorRect` prop. Fixed by adding `bulkAssignBtnRef` and `bulkAssignAnchorRect` state, capturing `getBoundingClientRect()` on click — same pattern as the per-row assign button.
- **Cluster assign popover portal fix (Inputs screen):** `ClusterAssignPopover` in `ProjectDetail.jsx` was using `position: absolute` and being clipped by the table's `overflow: hidden` ancestor. Converted to `createPortal` with `position: fixed` anchored to the triggering button's bounding rect. Both per-row and batch assign buttons now store their anchor rect on click and pass it as `anchorRect`.
- **Shared `ClusterAssignMenu` component:** `AssignPicker` (Clustering) and `ClusterAssignPopover` (ProjectDetail) consolidated into a single `src/components/shared/ClusterAssignMenu.jsx`. Portal-based, `position: fixed`. Always shows `+ New cluster` at the bottom of the list — no "No clusters yet" empty-state text. Both screens import and use this component; `onNewCluster` opens the cluster creation drawer (`setNewClusterDrawerOpen(true)` in Clustering, `setClusterDrawerOpen(true)` in ProjectDetail).
- **Bulk action bar standardisation:** All three screens (Clustering, Inputs/ProjectDetail, Inbox) now share the same action bar spec: `background: rgb(249,249,247)`, `border: 1px solid c.border`, primary button = brand blue, secondary button = transparent + `rgb(200,200,200)` border + `rgb(102,102,102)` text, destructive = `rgb(254,226,226) / rgb(185,28,28)` no border, clear link = text-only `rgb(102,102,102)` labelled exactly `✕ Clear`. ProjectDetail bar was previously dark `c.ink` background.
- **Copy changes:** "Build a cluster" → "New cluster" (Clustering header button and empty-state CTA). "Clear selection" → "✕ Clear" (Inbox My Inputs and AI Suggested bars). Dismiss button in AI Suggested bar restyled to secondary spec.

**2026-06-24 session — System Map Inspector + canvas improvements:**
- **Canvas subtype filter:** Filter pill (bottom-centre-right, separate from tool toolbar) lets practitioners hide Trend / Driver / Tension nodes and any edges connected to them. `hiddenSubtypes` is a `Set` in `CanvasArea`; `visibleNodes` and `visibleEdges` are derived in render without mutating RF state. Active state shows `"Filter · N"` count badge; single click on active filter clears all. Click-outside closes the popover via a `mousedown` document listener. `SlidersHorizontal` icon from lucide-react.
- **Cluster panel search:** Search input in `LeftSidebar` (local state, only rendered when `clusters.length > 5`). Filters the cluster list by name in real time, case-insensitive. "No clusters match" empty state when search yields nothing.
- **Inspector Edit button:** Clicking a cluster node in the System Map now shows an Edit button in the Inspector header. Opens `ClusterDetailDrawer` (the same drawer used on the Clustering screen) via `drawerCluster` state in `ScenarioCanvas`. `onEditCluster` prop added to `Inspector` function. No editing logic duplicated.
- **Drawer opens in edit mode:** Added `startInEditMode` prop to `ClusterDetailDrawer`. When `true`, initialises `editing` to `true` and resets to `true` on `clusterId` change (the useEffect that resets state on open now respects the prop). Passed as `startInEditMode` from the Inspector path only — Clustering screen behaviour unchanged.
- **Immediate canvas refresh:** Added a `useEffect` in `CanvasArea` that watches the `clusters` prop and patches `rfNode.data.cluster` for any node whose cluster ID matches a changed entry — without resetting positions. `ClusterNodeComponent` already calls `updateNodeInternals` when `cluster.name` changes, so no external call needed. Canvas name/subtype badge updates immediately after saving in the drawer.

**2026-06-23 session — System Map canvas:**
- **Text annotation nodes:** freeform text labels on the canvas (`TextNodeComponent`), persisted to the new `canvas_text_nodes` Supabase table. Double-click to edit, format bar for font/size/bold/italic/colour, drag to reposition. UUID pre-generated client-side to keep optimistic RF node and DB row in sync from creation.
- **Canvas toolbar consolidation:** three FigJam-style pill groups replace scattered controls — bottom-left (fullscreen + panel toggle), bottom-centre (Select/Hand/Text/Connect tools), bottom-right (zoom −/%/+/reset). Tool state is `activeTool: 'select' | 'hand' | 'text' | 'connect'` in `CanvasArea`; keyboard shortcuts V/H/T/C/Escape. Connect tool syncs to ReactFlow `connectMode` via `useEffect`. Icons: `MousePointer2`, `Hand`, `Type`, `Network` from lucide-react.
- **Viewport persistence:** canvas pan/zoom saved to `localStorage` as `fs_vp_{projectId}` on `onMoveEnd`; restored in `onInit`. Removed `fitView` prop — viewport is now set imperatively (fitView only on first visit to a project's map). Prevents the `fitView` prop from re-firing when `updateNodeInternals` causes internal ReactFlow layout changes.
- **Edge rendering fixes:**
  - `useUpdateNodeInternals` called in `ClusterNodeComponent` on mount and when `cluster.name / .description / .input_ids?.length` change — fixes handle positions on content-sized (variable-height) nodes.
  - `arrowOffset()` helper offsets edge endpoints outward by `ARROW_DEPTH = 5` SVG user units before `getBezierPath`, so the path terminates at the arrowhead base and the tip lands at the node boundary. Markers use `markerUnits="userSpaceOnUse"` (absolute px, not scaled by stroke weight).
  - `refX="0"` on all markers — arrowhead base at the adjusted path endpoint, tip extends forward to the node border.
- **Toolbar styling:** all three pill groups and the text-node format bar use the white-surface design system (`c.white` background, `c.border` border, `0 1px 3px` shadow, `c.ink` icons). Active tool button is the only dark element (ink fill, white icon). Panel toggle active states use `rgba(0,0,0,0.06)` tint rather than full ink fill.

---

## Chrome extension

**Location:** `extension/` in the same repo — separate Vite/TypeScript build  
**Architecture:** Manifest V3, Chrome native side panel, React + Supabase

### What's done

- Full capture flow: auth check → metadata extraction → form → Supabase insert → success/failure states
- Metadata extraction: `og:title`, `document.title`, `h1` fallback; canonical URL; meta description
- Selected text: content script listens for `selectionchange` (debounced 300ms) and updates the description field automatically while the panel is open
- Subtype picker: TypeSwitcherChip-style dropdown matching main app design
- Project selector: dropdown populated from user's workspaces; defaults to Inbox if no project selected
- Draft persistence: form state saved to `chrome.storage.local`, restored on re-open; stale draft (wrong URL) is cleared on mount
- URL cleanup: strips common tracking params (`utm_*`, `fbclid`, `gclid`, etc.)
- Metadata saved on insert: `{ source: "chrome_extension", page_title, canonical_url }`
- Embedding triggered non-blocking after insert
- Design system: follows main app tokens (colours, typography, spacing)
- Extension context invalidation guard: `isContextValid()` check before any `chrome.runtime.sendMessage` call

### What's not done (post-MVP)

These are explicitly out of scope for MVP per the requirements doc:

- **Expanded fields section** — STEEPLED, signal quality, time horizon are not in the extension form yet. The requirements spec calls for an optional "Add details" toggle. Currently users set these fields in the main app after capture.
- **Duplicate detection** — no warning if the same URL already exists in the selected project
- **Right-click / context menu capture** — highlight text on page, right-click → "Save to Future Signals"
- **Already-saved indicator** — badge or message on the extension icon when current URL is already captured
- **Save to Inbox shortcut** — fast capture without project selection
- **Chrome Web Store submission** — extension is currently loaded unpacked for development; not yet published

### Extension build

```bash
cd extension
npm install
npm run build      # builds dist/ for unpacking in Chrome
npm run dev        # watch mode
```

Load unpacked from `extension/dist/` in `chrome://extensions`.

---

## Signal scanning

### Architecture

The scanner is a Vercel cron pipeline running nightly at 02:00 UTC:

```
/api/scan          — fetches RSS feeds, deduplicates, inserts candidates
/api/classify      — classifies candidates by domain (batched, GPT-4o-mini)
/api/score.js      — scores candidates per project (relevance to key question)
```

Edge functions (Supabase):
```
embed-input                  — generates pgvector embeddings for inputs
score-candidates             — scores candidates per project
generate-cluster-suggestions — LLM cluster name generation
compute-cluster-suggestions  — pgvector similarity clustering
find-related-inputs          — finds semantically related inputs for a cluster
check-scanner-health         — nightly diagnostics; emails admin digest
send-email                   — thin Resend wrapper used by health check
```

### Current source coverage

- **62 active sources** across all 8 domains (Technology & AI, Health & Life Sciences, Defence & Security, Media & Culture, Economy & Finance, Government & Policy, Climate & Energy, Education & Learning)
- **28 inactive sources** in the `sources` table — solid names (Brookings, CFR, RAND, IMF Blog, Stanford HAI, etc.) that were seeded but not yet enabled. Enable with:

  ```sql
  update sources set active = true where active = false;
  ```

  Worth checking the health report first — if any current sources are already flagged noisy, adding 28 more will increase scoring load.

### Scanner health check

- Runs nightly after scoring; emails `sam@aldermanandward.com`
- Email sent via `send-email` edge function (Resend), from `scanner@futuresignals.io`
- Reports: dead / degraded / noisy / healthy status per source; lowest promotion rates
- Only sends on issues or Mondays (all-clear weekly digest)

### Known recent issues resolved

- **Fierce Biotech** (and potentially other sources) were failing due to `rss-parser` sending a generic Node.js User-Agent that some publishers block. Fixed 2026-05-13 by adding a browser-compatible User-Agent to the parser. Should clear on the next scan run.
- **CRON_SECRET** must match between Vercel environment variables and the Supabase edge function secrets dashboard — both must have the same value for cron-triggered health checks to authenticate.

### Source removal policy (rule of thumb)

| Situation | Action |
|---|---|
| Never fetched + 3–5 consecutive failures | Cut — no history to lose |
| Previously healthy, dead < 2 weeks | Investigate — may be a temporary outage |
| Previously healthy, dead 2+ weeks | Cut or replace |
| Degraded / noisy | Monitor for 2 cycles before acting |

---

## Infrastructure notes

- **Vercel cron** (`vercel.json`): `/api/scan` runs at `0 2 * * *`
- **Supabase edge functions** are deployed with `--no-verify-jwt` where needed (health check, send-email)
- **`workspaces` table** uses `user_id` not `owner_id` — check this on any new RLS policy
- **pgvector** columns: do not use `.not('embedding', 'is', null)` via PostgREST — use a workaround
- **Vercel API routes** must be flat files under `api/` — dynamic route paths (e.g. `api/projects/[id]/action.js`) are not recognised by the Vite preset; use query params instead (e.g. `api/action.js?id=`)
- **Vercel Hobby plan caps deployments at 12 serverless functions**, and every `.js` file under `api/` counts — including helper files with no `handler` export, even nested ones (`api/lib/*.js` used to count). Shared server-side logic now lives in a top-level `server-lib/` directory instead (outside `api/`, never counted). Hit this limit 2026-07-09 adding `clone-sample-project.js` + its dependency; fixed by moving `cron-auth.js`/`scoring.js`/`clone-project.js` out of `api/lib/`. Check count before adding a new endpoint: `find api -name "*.js" | wc -l` (currently 10).
- **`supabase db push` version-collision bug**: multiple migrations sharing the same bare `YYYYMMDD` version (no time) collide in the remote bookkeeping table, and once one's applied, `db push`/`--dry-run` fails for unrelated migrations too ("Remote migration versions not found in local migrations directory"). Fix: `supabase migration repair --linked --status reverted <bare-date-version...>`, retry (sometimes needs `--include-all`). Bookkeeping-only, doesn't touch schema/data. Avoid by giving new migrations full `YYYYMMDDHHMMSS` versions.

---

## Environment variables

**Vercel (production):**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `CRON_SECRET`
- `APP_URL` (= `https://future-signals-v2.vercel.app`)
- `SAMPLE_TEMPLATE_PROJECT_ID` (added 2026-07-09) — not a secret, set with `--no-sensitive` so `vercel env pull` returns it in plaintext. Production: `566911c6-65b4-4648-962f-f0e662033cb8`. Preview/`workspace-refactor`: `44b699ff-0fb1-44fb-9eb6-17a077cc7c9d`.

**Supabase edge function secrets:**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `ADMIN_EMAIL`
- `CRON_SECRET` (must match Vercel value)
- `OPENAI_API_KEY`
- `UNSUBSCRIBE_SECRET`
- `APP_URL` (= `https://future-signals-v2.vercel.app`) — used to build unsubscribe URLs in digest emails

---

## What's deferred to v3

Do not scaffold or reference these in v2:
- Real-time collaboration
- Corpus ingestion
- Explore / social layer
- Slide deck generation (explicitly out of scope, not coming)

Preferred Futures, Strategic Options, and Scenario Narratives **are v2** — they live under Future Models.
