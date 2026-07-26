# Future Signals v2 — Claude Code Instructions

## Project overview

Future Signals v2 is a strategic foresight SPA built with React + Vite. It guides practitioners through a structured methodology: Inputs → Clusters → System Map → System Analysis → Future Models. The Vercel prototype phase is complete — we are now building the production app with Supabase (Postgres + pgvector + RLS) as the backend.

**Stack:** React 18, Vite, React Flow (`@xyflow/react`), Supabase (auth + database + storage), Vercel (hosting), Tailwind CSS v4 (via `@tailwindcss/vite`) for migrated components; `tokens.js` inline styles for legacy components.

**AI model stack:** OpenAI only — `text-embedding-3-small` for embeddings, `gpt-4o-mini` for classification/tagging, `gpt-4o` for enrichment and synthesis. Do NOT reference or use any Anthropic/Claude API in implementation.

**Key principle:** AI supports but does not replace practitioner thinking. The UI should feel like a professional tool, not a consumer app.

**Prototype reference:** `prototypes/future-signals-inputs-redesign_4.html` — use as a visual reference for the Inputs screen and shared layout. Do not copy its code directly.

**Schema source of truth:** `supabase/migrations/` (read chronologically, latest wins) — not `src/types/database.types.ts`. The generated types file can lag behind the live database; see "Known database gotchas" for the current known gap.

---

## Staging environment (workspace-refactor branch)

- **Staging Supabase project ID:** `kptatqipjwihkdxdxlvh`
- **Staging URL:** `https://kptatqipjwihkdxdxlvh.supabase.co`
- **Production Supabase project ID:** `tbxjudpxzovbasuomekq` (do not run experimental migrations here)
- **Regenerate types against staging:** `supabase gen types typescript --project-id kptatqipjwihkdxdxlvh > src/types/database.types.ts`
- **Migration workflow:** run new migrations on staging first via `supabase db push --db-url <staging-db-url>`, then on production when merging to master
- **Vercel preview deployments** on the `workspace-refactor` branch automatically use staging credentials (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` pointed at staging)
- **DB passwords** are not stored here — retrieve from Supabase Dashboard → Project Settings → Database

---

## Design principles — read before any UX or form decision

**`design-principles.md`** is the authoritative source for all design and UX decisions. Read it before making any decision involving forms, fields, AI outputs, nudges, navigation, or empty states.

Key rules extracted here for fast access — but the full document has the reasoning behind each one:

1. **Every field is optional except the name of the object being created.** Naming (Input title, Cluster name, Project name) is the one piece of structure the product asks for; everything else can be filled in later or left blank. No entity creation form should block on any other field being empty.
2. **Quick Start is the default.** Enhanced fields live behind a `+ Add more detail` toggle. Never open by default on first project creation.
3. **New fields are Enhanced unless proven otherwise.** When adding a field to any form, place it in Enhanced tier. Promotion to Quick Start requires explicit justification: "Does a practitioner need this field *before* they can get value from this entity?"
4. **AI outputs require a practitioner action before entering the record.** Pre-populate and suggest — never silently apply. The practitioner confirms, edits, or promotes.
5. **No gate between stages.** Practitioners can navigate to any project stage at any time, regardless of whether earlier stages are "complete." Never block navigation on prior completion.
6. **Nudges have lifespans.** Any nudge implementation must include suppression logic: if ignored twice, suppress for 30 days. Nudges are preferences, not defaults — practitioners opt in.
7. **Re-entry surfaces answer "where was I and what's new?" —** not "here is your progress toward completion." Dashboard and project headers are re-entry surfaces, not progress trackers.
8. **Terminology is locked.** Use the table in the Terminology section below and in `design-principles.md`. No synonyms, no drift.

**Quick Start field sets by entity (minimum sufficient to create):**

| Entity | Quick Start fields |
|---|---|
| Project | Name, Domain, Key question |
| Input | Source URL (auto-populates metadata), Subtype |
| Cluster | Name, Subtype (Trend / Driver / Tension) |
| Scenario | Title, Archetype, Narrative (free text) |
| Preferred Future | Title, Vision statement |
| Strategic Option | Title, Description |

All other fields on these entities are Enhanced tier — behind the toggle, never required.

**Field governance rule:** Before adding any field to a creation form, answer: *"Does a practitioner need this field before they can get value from this entity?"* If yes → Quick Start (document justification). If no → Enhanced. This rule exists to prevent form field accumulation over time. Default answer is almost always Enhanced.

---

## Design system — tokens and primitives

**`src/styles/tokens.js` (the `c{}` object + the `inp`/`btnP`/… primitives) is the single source of truth for colour values and shared style primitives.** Do not hardcode hexes from memory or from this doc — import from `tokens.js` for legacy inline-style components, or use the Tailwind classes generated from the `@theme` block in `src/index.css` for migrated ones (the two must stay in sync — see "Styling: Tailwind CSS v4"). Never introduce new colours or spacing scales without explicit instruction.

The palette is a warm off-white / ink / muted system. The exact ~80 hexes drift, so they're not duplicated here — read `tokens.js` for values and `src/components/shared/Tag.jsx` for the badge → colour bindings. What's durable is the **semantic map** (which token family encodes which UI concept):

**Surfaces & text:** `bg` (page/sidebar), `white` (cards/content), `surfaceAlt`/`fieldBg` (subtle off-white fills), `canvas` (System Map bg); `ink` (primary text), `muted`/`faint`/`hint` (secondary → tertiary); `border`/`borderMid`/`borderStrong` (hairline → interactive); `brand`/`brandBg`/`brandBorder` (primary CTAs, active nav). Each semantic family below has `{name}50` (bg), `{name}700` (text), `{name}Border` (border).

| UI concept | Token family | Notes |
|---|---|---|
| Time Horizon (H1/H2/H3) | `green*` / `blue*` / `amber*` | H1 green, H2 blue, H3 amber |
| Cluster Type (Trend/Driver/Tension) | `dustyViolet*` / `mutedTeal*` / `dustyRose*` | muted, not saturated |
| Signal Strength (Weak/Mod/Strong) **and** Source Confidence (Low/Med/High) | `rust*` / `tan*` / `sage*` | one shared 3-tier scale: low→rust, mid→tan, high→sage |
| Cluster Likelihood (Possible/Plausible/Probable) | `likelihood{Possible,Plausible,Probable}*` | warm-neutral monochrome ramp (added 2026-07-16). **Currently consumed only by Web Publish; the in-app `LikelihoodTag` in `ClustersPanel.jsx` still borrows the Horizon green/blue/amber family** — a known inconsistency |
| Scenario Archetype (Continuation/Collapse/Constraint/Transformation) | `archContinuation*` / `archCollapse*` / `archConstraint*` / `archTransformation*` | one family each |
| System Map relationship-edge colours (Drives/Enables/Inhibits/…) | `REL_TYPES` in `src/components/screens/ScenarioCanvas.jsx` (**not** `tokens.js`) | mirrored in `src/publish/systemMap.js` |

These muted badge families are the result of the 2026-07 badge-consolidation audit (an earlier version of this section documented saturated `confirmedBg`/`h1Bg`/`driverBg`-style names that never matched the code — ignore any such names). Prefer the badge components in `Tag.jsx` (`HorizTag`, `SubtypeTag`, `StrengthDot`, `ConfidenceBadge`, `ArchTag`) over re-deriving colours inline.

**Shared style primitives** (all in `tokens.js`, import don't re-hardcode): `inp`/`ta`/`sel` (form fields, `1px solid borderStrong`, radius 8), `btnP`/`btnSm` (primary brand buttons), `btnSec`/`btnG` (secondary/ghost), `btnFull`, `fl`/`fh` (field label/hint), `badg`, `countBadge`/`tabCount`, `legend`.

---

## Styling: Tailwind CSS v4

### Setup

Tailwind CSS v4 is installed via the `@tailwindcss/vite` plugin. There is **no `tailwind.config.js`** — all theme customization lives in the `@theme` block at the top of `src/index.css`. The plugin is registered in `vite.config.js` alongside the React plugin.

### Color tokens

Every colour in the `c{}` object in `src/styles/tokens.js` is registered as a `--color-*` custom property in the `@theme` block of `src/index.css`, and each generates `bg-{name}`, `text-{name}`, and `border-{name}` utility classes automatically. **`src/index.css`'s `@theme` block is the authoritative list — keep it in sync with `tokens.js`.** The table below is a representative sample showing the camelCase→kebab naming convention (`surfaceAlt` → `--color-surface-alt`, `dustyViolet700` → `--color-dusty-violet-700`); it is **not** exhaustive.

| `tokens.js` key | CSS variable | Example classes |
|---|---|---|
| `bg` | `--color-bg` | `bg-bg`, `text-bg` |
| `white` | `--color-white` | `bg-white`, `text-white` |
| `surfaceAlt` | `--color-surface-alt` | `bg-surface-alt` |
| `fieldBg` | `--color-field-bg` | `bg-field-bg` |
| `canvas` | `--color-canvas` | `bg-canvas` |
| `surfaceHover` | `--color-surface-hover` | `bg-surface-hover` |
| `ink` | `--color-ink` | `text-ink`, `bg-ink` |
| `muted` | `--color-muted` | `text-muted` |
| `faint` | `--color-faint` | `text-faint` |
| `hint` | `--color-hint` | `text-hint` |
| `border` | `--color-border` | `border-border` |
| `borderMid` | `--color-border-mid` | `border-border-mid` |
| `brand` | `--color-brand` | `bg-brand`, `text-brand`, `border-brand` |
| `brandBg` | `--color-brand-bg` | `bg-brand-bg` |
| `brandBorder` | `--color-brand-border` | `border-brand-border` |
| `green25` | `--color-green-25` | `bg-green-25` |
| `green50` | `--color-green-50` | `bg-green-50` |
| `green600` | `--color-green-600` | `bg-green-600`, `text-green-600`, `outline-green-600` |
| `green700` | `--color-green-700` | `text-green-700` |
| `greenBorder` | `--color-green-border` | `border-green-border` |
| `blue50` | `--color-blue-50` | `bg-blue-50` |
| `blue700` | `--color-blue-700` | `text-blue-700` |
| `blueBorder` | `--color-blue-border` | `border-blue-border` |
| `amber50` | `--color-amber-50` | `bg-amber-50` |
| `amber700` | `--color-amber-700` | `text-amber-700` |
| `amberBorder` | `--color-amber-border` | `border-amber-border` |
| `violet50` | `--color-violet-50` | `bg-violet-50` |
| `violet700` | `--color-violet-700` | `text-violet-700` |
| `violetBorder` | `--color-violet-border` | `border-violet-border` |
| `cyan50` | `--color-cyan-50` | `bg-cyan-50` |
| `cyan700` | `--color-cyan-700` | `text-cyan-700` |
| `cyanBorder` | `--color-cyan-border` | `border-cyan-border` |
| `red50` | `--color-red-50` | `bg-red-50` |
| `red800` | `--color-red-800` | `text-red-800` |
| `redBorder` | `--color-red-border` | `border-red-border` |
| `teal50` | `--color-teal-50` | `bg-teal-50` |
| `teal700` | `--color-teal-700` | `text-teal-700` |
| `tealBorder` | `--color-teal-border` | `border-teal-border` |

The muted badge families (from the 2026-07 badge-consolidation audit) and the Likelihood ramp are **also** registered and follow the same `{name}50` / `{name}700` / `{name}Border` → `--color-{kebab-name}-{50\|700\|border}` pattern, but aren't listed above: `rust*`, `tan*`, `sage*` (Strength/Confidence), `dustyViolet*`, `mutedTeal*`, `dustyRose*` (Cluster Type), `archContinuation*` / `archCollapse*` / `archConstraint*` / `archTransformation*` (Archetype), and `likelihoodPossible*` / `likelihoodPlausible*` / `likelihoodProbable*` (Likelihood). See the `@theme` block in `src/index.css` for the complete, authoritative set.

### Spacing tokens

Seven off-grid values from the primitive objects (`inp`, `btnP`, etc.) are defined as custom spacing tokens. Values already on the 4px base grid (`4px=1`, `8px=2`, `12px=3`, `16px=4`) and Tailwind's fractional defaults (`6px=1.5`, `10px=2.5`) are **not** redefined — use Tailwind's built-in scale directly for those.

**Naming convention:** Tailwind v4 CSS variable names cannot contain dots, so the decimal separator is encoded as an underscore. The class suffix still uses a dot. Example: class `p-1.75` → CSS variable `--spacing-1_75`.

| CSS variable | Value | Class suffix | Source in tokens.js |
|---|---|---|---|
| `--spacing-px` | `1px` | `p-px`, `m-px`, etc. | `badg` padding-y |
| `--spacing-1_25` | `0.3125rem` (5px) | `p-1.25`, `gap-1.25`, etc. | `fl` margin-bottom |
| `--spacing-1_75` | `0.4375rem` (7px) | `p-1.75`, `rounded-1.75`, etc. | `btnSm`/`btnG` padding-y, border-radius |
| `--spacing-2_25` | `0.5625rem` (9px) | `p-2.25`, `py-2.25`, etc. | `inp`/`btnSec` padding-y |
| `--spacing-2_75` | `0.6875rem` (11px) | `px-2.75`, etc. | `inp` padding-x |
| `--spacing-4_5` | `1.125rem` (18px) | `px-4.5`, etc. | `btnSec` padding-x |
| `--spacing-5_5` | `1.375rem` (22px) | `px-5.5`, etc. | `btnP` padding-x |

### Typography tokens

Two scalars extracted from the inline-style primitive objects and promoted to `@theme`. Not in `tokens.js` — `c{}` is color-only; the primitive objects hold composite styles. These scalars have no natural home in either structure.

| CSS variable | Value | Tailwind class | Source in tokens.js |
|---|---|---|---|
| `--text-ui` | `0.8125rem` (13px) | `text-ui` | `inp.fontSize`, `btnP.fontSize`, `btnSec.fontSize` — 115+ occurrences |
| `--leading-body` | `1.55` | `leading-body` | `ta.lineHeight`, descriptions, canvas labels — 20+ occurrences |

### Border-radius tokens

All four radius values are now in `@theme` as `--radius-*` tokens. Tailwind v4 generates `rounded-{name}` utility classes from these automatically.

| CSS variable | Value | Tailwind class | Use |
|---|---|---|---|
| `--radius-container` | `8px` | `rounded-container` | Containers, inputs, modals, drawers, cards |
| `--radius-btn` | `7px` | `rounded-btn` | Compact interactive elements: toggle buttons, small action pills |
| `--radius-pill` | `10px` | `rounded-pill` | Pill badges: resume pill, scope tags, subtype chips |
| `--radius-chip` | `4px` | `rounded-chip` | Micro chips: AnalysisFillGrid cells, tight inline labels |

`rounded-btn` is **not an inconsistency** with `rounded-container` — it is an intentional second tier for compact elements. Do not replace `rounded-btn` with `rounded-container`. Do not use `rounded-[7px]` or `rounded-lg` — use the named tokens.

When inline-style components that currently use raw `borderRadius` values are migrated to Tailwind, replace:
- `borderRadius: 8` → `rounded-container`
- `borderRadius: 7` → `rounded-btn`
- `borderRadius: 10` → `rounded-pill`
- `borderRadius: 4` → `rounded-chip`

### Shadow token

| CSS variable | Value | Use |
|---|---|---|
| `--shadow-hover` | `0 1px 6px rgba(0,0,0,0.07)` | Card hover lift (e.g. phase cards on Overview) |

Use as an arbitrary value in Tailwind: `shadow-[var(--shadow-hover)]`, or in inline styles as `boxShadow: "var(--shadow-hover)"` once the component is migrated.

### 0.5px borders

Where a `0.5px` border is required (e.g. the sidebar border-right, panel dividers), use a border-width token (`border-[0.5px]` arbitrary value) rather than a raw inline style. Do not add a custom `--spacing` entry for sub-pixel values.

### Migration status and tokens.js

**`src/styles/tokens.js` is still the active design system** for any component not yet migrated to Tailwind classes. Do not remove or modify it until migration is complete.

- Components that **have not** been migrated: continue importing from `tokens.js` using inline styles as before.
- Components that **have** been migrated to Tailwind classes: must **not** import from `tokens.js`. The Tailwind classes and the `@theme` variables are the sole source of style for migrated components.
- The `@theme` block in `src/index.css` and `tokens.js` must stay in sync — if a token value changes, update both.

**Migrated components (no `tokens.js` import):**
- `src/components/shared/HorizonBar.jsx`
- `src/components/clusters/ClustersPanel.jsx`
- `src/components/screens/ProjectOverview.jsx`

### Dynamic and conditional classes

Use **`clsx`** for any component that assembles class strings conditionally. Do not use inline ternaries directly inside a `className` string or string concatenation.

```jsx
// ✓ correct
import clsx from 'clsx';
<div className={clsx('base-class', isActive && 'bg-brand text-white', hasError && 'border-red-border')} />

// ✗ avoid
<div className={`base-class ${isActive ? 'bg-brand text-white' : ''}`} />
```

`clsx` is installed (`npm install clsx` — already in `package.json`).

---

## Typography

**Heading font:** Roboto (Google Fonts)
**Body / UI font:** Open Sans (Google Fonts)
**Fallback stack:** `-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif`

Scale:
- Page title: 22px / weight 500
- Section heading: 16px / weight 500
- Body / table rows: 13px / weight 400
- Labels / nav: 12–12.5px / weight 400
- Metadata / badges: 10–11px
- Column headers: 11px / weight 500 / uppercase / letter-spacing 0.02em
- Micro-labels: 9px / weight 500 / uppercase / letter-spacing 0.08em (e.g. KEY QUESTION)

---

## Sidebar navigation — structure and rules

The sidebar is **196px wide**, `background: c.bg`, with a single `0.5px` border-right.

**Structure (top to bottom):**
1. Logo mark + "Future Signals" wordmark — no project name subtitle
2. Nav list — flat, no section labels
3. Account footer — user avatar, name, plan

**Nav list order:**
- Dashboard *(global)*
- Inbox *(global, shows an unread count badge — neutral grey `countBadge` style: `background: rgba(0,0,0,0.07)`, `color: c.muted`)*
- `0.5px` divider
- Overview *(project-scoped, first item — default landing screen when opening a project)*
- Scan *(project-scoped, shows input count — screen key `"project"`, file `ProjectDetail.jsx`)*
- Cluster *(project-scoped, shows cluster count — screen key `"cluster"`, file `ClusterScreen.jsx`)*
- System Map *(project-scoped)*
- System Analysis *(project-scoped)*
- Future Models *(project-scoped)*
- Export *(project-scoped, last item, download icon)*

**Active state:** `background: c.brandBg`, `color: c.brand`, `border-left: 2px solid c.brand`, `font-weight: 500`
**Inactive state:** `color: c.muted`, no background

**Visibility rules:**
- Dashboard and Inbox are always visible.
- Divider and all project-scoped items (Scan → Export) are only visible when `activeProjectId` is set.
- Navigating to Dashboard or Inbox clears the active project context.

---

## Page header — Overview screen (project landing)

`ProjectOverview.jsx` is the default landing screen when a project is opened (`openProject(id)` navigates to `"project-overview"`). It owns all project-context header content. Other project-scoped screens have minimal headers — just an eyebrow + screen title.

**Overview screen layout (top to bottom):**
```
eyebrow           → project.name (11px, c.faint)
title row         → "Overview" (22px/500) + [⚙ Project settings] right-aligned
key question card → 60% question (13px italic) / 40% Domain + Geography
HorizonBar        → proportional H1/H2/H3 coloured band (shared component)
scanner card      → "N new signals since your last visit" + source count + CTA buttons
context card      → collapsible: Focus, Audience, Stakeholders, Assumptions, In scope, Out of scope
phase cards       → 5-column grid: Scan · Cluster · System Map · System Analysis · Future Models
```

**Phase card status borders:**
- Active today (< 24 h) → `borderTop: 3px solid c.brand` + "Active today" label
- Active this week (< 7 d) → `borderTop: 3px solid c.green600` + "Active this week" label
- Not started / earlier → `borderTop: 3px solid c.border`, no label
- Most-recently-active stage gets a "Continue here" pill (`background: c.brand, color: c.white`)

**"N new signals since your last visit"** compares `inputs.created_at` to `priorVisitedAt`, captured at component mount via `useState(() => project?.last_visited_at ?? null)`. `openProject()` stamps `last_visited_at` fire-and-forget (no `setProjects` call), so state still holds the prior session's value at mount time.

**`projectSources`** is fetched per active project in a `useEffect` on `activeProjectId` in `useAppState.js` (the `project_sources` table has no `workspace_id` — must be scoped by `project_id`). Exposed as `appState.projectSources`.

**"Project settings" button** (not "Edit project") — opens `EditProjectDrawer`. Gear icon ⚙, styled `btnSec`. The drawer's prop API: `{ project, onClose, onSave, onDelete, workspaceScanningEnabled }` — not `appState`.

**Scan screen header (trimmed):**
The Scan screen (`ProjectDetail.jsx`) no longer shows the key question, metadata strip, or HorizonBar. Those now live on Overview. The Scan header contains only:
```
eyebrow  → project.name (11px, c.hint, letter-spacing 0.02em)
title    → "Scan" (22px/500)
CTAs     → "Add from Inbox" + "Add an input" (right-aligned)
```

**Scan screen input tabs:** All · Unassigned · Clustered · Scanner Suggestions (4th tab). The Scanner Suggestions tab shows scanner-promoted candidates scoped to this project (`project_id === null`, `is_seeded`, `metadata.source === "scanner"`, `!metadata.dismissed`, with a `metadata.suggested_projects` entry matching `activeProjectId`). Partitioned into Emerging (novel — `metadata.suggested_projects[].classification === "emerging"`) and Reinforcing (confirms existing clusters). Per-row hover actions: **Accept** (`saveInputToProject(id, activeProjectId)`) and **Dismiss** (`dismissSuggestedInput(input)`). Batch actions in sticky bar: **Accept N** (`saveInputsToProject`) and **Dismiss N**. Accepted inputs drop from Scanner Suggestions and appear in All/Unassigned immediately via optimistic state. Horizon filter is omitted from this tab — scanner candidates don't have `horizon` set at promotion time.

---

## Clusters panel — structure and rules

The 320px right-hand panel in the Cluster workspace (`ClusterScreen.jsx`). Project metadata lives on Overview; System Map status is visible via the nav item.

**Panel header:**
- Single row: Manual/Suggested mode toggle (left) + list/card view toggle (right, hidden in Suggested mode). `pt-4` (16px) top padding from panel top edge to toggle row. The "Clusters" heading has been removed — the panel header contains only the mode/view controls.
- "+ New cluster" button lives in the ClusterScreen page header (above the panel), not inside ClustersPanel.

**Manual mode** (default):
- Drop zone strip below header — dashed border, `c.faint` text "⊕ Drop inputs here to create a new cluster". Highlights `c.brand` / `c.brandBg` on drag-over. Drop opens ClusterDrawer with inputs pre-selected.
- Scrollable cluster list — two view modes:
  - **List view:** column header row (Name | Type | H | Likelihood | #); compact rows with `HorizTag` in a 34px column and `LikelihoodTag` in a 74px column. `LikelihoodTag` is a local Tailwind-only component in `ClustersPanel.jsx` — no `tokens.js` import.
  - **Card view:** type badge + horizon badge (header row), name, description (always rendered with `minHeight: 34` to hold 2-line space even when empty), footer pinned via `marginTop: "auto"` (input count left, likelihood right). Cards fill grid cell height via `display:flex; flexDirection:column; height:100%` + CSS Grid default `align-items:stretch`.
- **Multi-select (card view):** per-card checkboxes fade in on hover or when any card is selected (`anySelected` prop). Shift-click range-selects via `visibleClusters` render order. `selectedClusterIds` Set is shared across list and card view bulk-delete. Sticky action bar at bottom of scroll area shows "{N} selected · Delete N · ✕ Clear" when selection is non-empty; ConfirmDialog before bulk delete.
- Drag-and-drop targets: move (default) or copy (⌥ Option held). Drop target shows "Move"/"Copy" pill in `c.brand` / green.
- Cluster detail panel slides in from right on click (translateX, 220ms). Shows badges, name, description, linked inputs with ✕ remove per row, Edit button (opens `ClusterDrawer` in `mode="edit"` — full-field editing of name, subtype, horizon, likelihood, description; linked-inputs section hidden in edit mode), Delete button in footer. Closes on back-click, Escape, or clicking the inputs panel.

**Suggested mode:**
- Toolbar: sensitivity toggle (Tight / Balanced / Exploratory) + "✦ Suggest clustering" button.
- Calls `compute-cluster-suggestions` edge function. Requires `OPENAI_API_KEY` on the Supabase project.
- Section 1 "Add to existing clusters": assignment suggestion cards — Accept / Dismiss per card, Accept all header link, Remove per input row.
- Section 2 "New cluster suggestions": new cluster cards — Create cluster / Edit (inline) / Dismiss. Rationale expandable via "· Why this cluster?".
- Empty states: "No suggestions yet" before first run; "All suggestions resolved" after all acted on.

**Props ClustersPanel receives from ClusterScreen:**
`projectId`, `clusters`, `inputs`, `onNewCluster`, `removeInputFromCluster`, `deleteCluster`, `showToast`, `dragIds`, `dragIsCopy`, `onDrop`, `onDropToNewCluster`, `assignInputToCluster`, `addCluster`, `updateCluster`

---

## Terminology — always use these terms exactly

| Use this | Never this |
|---|---|
| Input | Signal (except in user-facing copy about the capture act) |
| Cluster | Trend |
| Project | Brief |
| Focus | Unit of analysis |
| Inbox | Collection |
| System Map | Relationship Canvas, Scenario Canvas |
| System Analysis | Analysis |
| Future Models | Futures, Scenarios (as a screen label) |
| Add an input | Add a signal |
| Project settings | Edit project |

**Nav labels, headings, sidebar items, empty states, and stat cards always use the left-hand column.** Internal variable names, prop names, file names, and database column names use whatever is most stable — do not rename existing code constructs just to match display labels.

**Cluster subtypes:** `Trend | Driver | Tension`
**Scenario archetypes:** `Continuation | Collapse | Constraint | Transformation`
**Input subtypes:** `Signal | Issue | Projection | Plan | Obstacle`
**Signal Strength values:** `Weak | Moderate | Strong`
**Source Confidence values:** `Low | Medium | High`
**Note:** The `signal_quality` DB column still exists but is no longer read or written anywhere in the UI. Do not use it in new code.

---

## Key product decisions

**Projects are mandatory. Clusters and System Maps only exist within a Project.**

- The Inbox holds inputs that have not yet been assigned to a project (`project_id === null`). It is a workspace-level screen.
- The Inbox's Scanner Suggestions section has its own search/filter bar, including a Project filter (filters on `metadata.suggested_projects`). It defaults to "All projects" (no filter) on fresh page load and on first navigation to the Inbox. Within a session, the filter persists whatever the user last selected (including cleared).
- A project's "Review N suggestions" action (Project Detail) sets `appState.inboxProjectFilter` and navigates to the Inbox — the Scanner Suggestions Project filter picks this up as its initial selection (deep-link), pre-filtering Scanner Suggestions to that project on arrival.
- **Overview is the default project landing screen.** `openProject(id)` navigates to `"project-overview"`, not `"project"` (Inputs). Every entry path to a project — Dashboard card click, Inbox links, sidebar project list, new project creation — lands on Overview first.
- The System Map is project-scoped and only appears in the sidebar when a project is active. Scan and Cluster are separate screens: `ProjectDetail.jsx` (`"project"`) is inputs-only; `ClusterScreen.jsx` (`"cluster"`) contains the InputRail + ClustersPanel and owns all drag-and-drop state.
- At workspace level (Dashboard, Inbox, no active project) the sidebar shows only: Dashboard, Inbox. No project-scoped items.
- Navigating to Dashboard or Inbox via the sidebar clears the active project context.
- The Dashboard stats strip shows workspace-level counts only: Projects and Inputs in Inbox. Per-project counts appear on each project card.
- There is always exactly one System Map per project (binary: built or not built). Never show a count.
- Workspace is 1:1 with user account in v2 — no team/org layer yet.

---

## Sample project cloning

Every new user finishes onboarding with a second project alongside their own: a full, working clone of a canonical template project, so they see a completed methodology pass (Signal → Cluster → System Map → Analysis → Scenario) rather than inferring it from empty states. See `Sample_Project_Onboarding_PRD.md` for the full spec.

- **`server-lib/clone-project.js`** — `cloneProject(sourceProjectId, destWorkspaceId, options)` and `rollback(projectId, clonedInputIds)`. Service-role only (RLS blocks a client session from reading another workspace's data, and there's no reason to trust a client-supplied destination workspace). Walks all 13 project-scoped tables (`inputs`, `clusters`, `cluster_inputs`, `scenarios`, `scenario_clusters`, `relationships`, `canvas_nodes`, `canvas_text_nodes`, `analyses`, `preferred_futures`, `strategic_options`, `cluster_suggestions`, `project_negative_pool`), generating a new id per row and remapping every FK reference — including the non-FK-enforced jsonb/array id references (`preferred_futures.scenario_ids`, `strategic_options.scenario_ids`, `cluster_suggestions.input_ids`), which get filtered (dropping anything that doesn't resolve) rather than erroring.
- **`project_candidates` is never cloned**, by either path — it's derived scanner data (Layer 3 relevance scores against a specific project's key question at a point in time) that goes stale the moment scanning is re-enabled on a clone. This was a deliberate exclusion added 2026-07-09 after the fact; if a clone predates that fix, its stale `project_candidates` rows need a one-off cleanup (`delete from project_candidates where project_id = '<clone-id>'`).
- **`project_sources`** is cloned only when `options.includeProjectSources` is true (the template-creation path), always pointing at the existing shared `source_id` — never a new row in `sources`/`candidates` (both are global, url-unique registries, never cloned).
- **`sources`/`candidates` themselves are never touched** by cloning.
- **`options.includeProjectSources`**: `true` for template creation (John's live project → the templates account, one-time/re-run only if the source changes), `false` for per-user clones (every onboarding completion). `options.isSampleTemplate` is `true` only on the one canonical templates-account project. `options.sourceTemplateId` is set to the templates-account project's id on a per-user clone.
- **Reads/writes are paginated/chunked**, not single-shot — PostgREST caps an unranged `select()` at ~1000 rows and doesn't auto-paginate; a real project's `project_candidates` (before it was excluded) hit 8,100 rows and would have silently truncated. `selectAll()` pages every multi-row read; `insertMany()` chunks every insert at 500 rows.
- **`api/clone-sample-project.js`** — the onboarding-facing endpoint. Bearer-auth (same pattern as `seed-onboarding.js`): verifies the token, derives `destWorkspaceId` from the caller's own session server-side, and reads the source project id only from `SAMPLE_TEMPLATE_PROJECT_ID` (env var) — never from the request body. Wired into `App.jsx`'s `handleOnboardingComplete` as a fire-and-forget call alongside the existing `onboarding_completed` write; on success it calls `appState.refreshProjects()` so the clone appears without a manual reload (the redirect itself never waits on it).
- **Dashboard labeling**: `ProjectCard` and the table/list view both prefix the name with `"[Sample] "` when `project.source_template_id` is non-null — computed at render time only, `project.name` is never mutated. Scoped to the two dashboard list views; `ProjectOverview` and other name-rendering surfaces intentionally don't show the prefix.
- **`scripts/clone-project.js`** — standalone CLI for testing/re-running a clone outside the onboarding flow (e.g. regenerating a template after the source project changes). Not imported by the app.

---

## Web Publish (shipped 2026-07-16 on `workspace-refactor`)

Publish a project to a live, hosted, public single-page site at a stable `/p/{slug}` link (for stakeholder sharing + social promotion). Full spec: `web-export-spec.md`. Publishes the whole project by default, or a curated subset via the section picker. Pipeline of pure, composable pieces, each unit-tested (see "Testing"):

- **`server-lib/resolve-references.js`** — shared, pure ID→name resolution layer (clusters, relationships, scenario driving forces, `scenario_ids`). Consumed by both Report Export (`src/components/projects/buildMarkdown.js`) and Publish. Dangling references degrade to a fallback, never throw. `resolveRelationship()` phrases edges as sentences.
- **`src/publish/sections.js`** — per-section static-HTML-string builders (Hero, Overview, System Analysis, Scenario/Preferred Future/Strategic Option, Appendix). Pure, HTML-escaped, `sanitizeUrl` on source links. Reads the live schema, not the prototype.
- **`src/publish/systemMap.js`** — `renderSystemMap()` reconstructs the System Map as an inline SVG from persisted rows (`canvas_nodes`/`canvas_text_nodes`/`relationships`) — no React Flow, no rasterization. Matches the real canvas: white ClusterNode cards with a subtype-keyed left accent + pill badges; per-relationship-type edge colors (from `REL_TYPES`); and **cubic-bezier edges replicating `@xyflow/system`'s `getBezierPath`** (default curvature 0.25, control points offset along the `source_handle`/`target_handle` side). Takes **DB-shaped (snake_case) rows**, matching `resolveRelationship`.
- **`server-lib/publish-project.js`** — `publishProject()` / `unpublishProject()`. Service-role (client injectable for tests). Fetches the project graph (note: `cluster_inputs` has no `project_id` — joined by `cluster_id`), assembles one HTML doc (with `<head>` Open Graph tags), uploads to Storage, and only *then* flips `status='published'`. Unpublish deletes the object *before* flipping status (public bucket — the flag alone won't take a page offline). `scripts/publish-project.js` is the CLI runner.
- **`server-lib/publish-handler.js` + `api/publish.js`** — one endpoint (handler in `server-lib` so its test isn't counted as a function): Bearer-authed `POST { action: 'publish'|'unpublish' }` (ownership via the seed-onboarding pattern, 404 for non-owner), and a **public, unauthenticated `GET ?view={slug}`** branch (also handles HEAD) reached via the `vercel.json` rewrite `/p/:slug → /api/publish?view=:slug`.
- **`src/publish/selectionModel.js`** — shared, pure selection model (client + server single source; `publish-project.js` re-exports `normalizeSelection`). Canonical `sections_included` shape: `{ version, overview, systemMap, systemAnalysis, futureModels: { enabled, scenarios|preferredFutures|strategicOptions: { enabled, ids } }, appendix }`. Overview + Appendix are never optional; a sub-type's `ids: null` = all, an array = only those. `null`/omitted selection (and the legacy `{ mode: 'all' }` from pre-picker rows) → everything. `publishProject` skips *fetching* excluded sections, not just rendering them; `sections_included` round-trips GET → picker → republish. `pickerStateFromSelection` / `selectionFromPickerState` / `visibleSubtypes` back the modal.
- **`src/publish/publishActions.js`** — injectable orchestration (unit-tested): first **Publish** OMITS the selection (backend → everything); **Republish** GETs the current `sections_included` and RESENDS it (never omits/resets); **Customize** publishes the constructed selection. `POST` accepts `selection`; `GET` returns `sectionsIncluded`.
- **`src/components/projects/PublishSection.jsx` + `SectionPickerModal.jsx`** — management surface at the bottom of the Project Settings drawer: status, copy link, Publish/Republish, Unpublish, and **Customize** (opens the picker). Publish-vs-Republish keys on whether the project has *ever* been published (`published_at`), not the live status — so an unpublished-then-republished project still resends its curated selection instead of resetting to everything. The modal pulls Scenario/PF/SO items from already-loaded app state (`appState` threaded through `EditProjectDrawer`); zero-item sub-types are hidden, single-item ones have no multi-select.

**Two non-obvious gotchas baked into the design:**
- **Supabase Storage serves user-uploaded HTML as `text/plain` + `nosniff`** (anti-abuse on the shared `*.supabase.co` domain) — so a raw storage URL shows source, not a page. Pages are served *through the app* (the `GET ?view` branch re-serves the stored HTML as `text/html`), which is why `publicUrl` is `/p/{slug}`, not the storage URL.
- **The served page uses `Cache-Control: no-cache` + a content `ETag`, NOT a `max-age`.** A republish overwrites the object in place under the same stable slug, so any `max-age` edge/browser cache keeps serving the old page until it expires (a real bug that shipped and was fixed: `max-age=300` → Vercel `x-vercel-cache: HIT` served stale for 5 min). Always-revalidate makes a republish visible immediately; the ETag keeps unchanged repeat views a cheap 304. Do not reintroduce a `max-age` on this response.
- The `?view` branch **must use the service-role client to bypass `project_publications` RLS** — an anonymous viewer has no workspace, so `workspace_id = get_workspace_id()` returns zero rows otherwise (verified against the DB).

**Schema/storage (applied to staging AND production):** `project_publications` table (`20260715195707`) + `published-projects` public bucket + `storage.objects` policies; `status` defaults to `'unpublished'` (`20260715200305`) so a row is never "live" before its file exists. A new **Likelihood** color token (warm-neutral ramp) was added to `tokens.js` and the `index.css` `@theme` block, first consumed by the Appendix/System Map. Note: Vercel Production env needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`; and each environment's Supabase Auth "Redirect URLs" must allow `/**` on its origin.

---

## Testing

There is now a test runner (added with Publish): `npm test` runs Node's built-in `node:test` over `server-lib/**/*.test.js` and `src/**/*.test.js` (no jsdom/RTL — React components aren't unit-tested). The pattern is to **extract pure logic into a testable module** and keep the React/effect wiring thin: e.g. `server-lib/resolve-references.js`, `server-lib/publish-*.js`, `src/publish/*.js`, `src/components/projects/buildMarkdown.js`, and `src/lib/authRedirect.js` (the URL-cleanup decision behind the post-password-reset redirect fix) are all covered this way. Fake Supabase clients are hand-rolled in the test files. `process`-related eslint errors in `server-lib`/`api`/`scripts` files are pre-existing (the flat config only ships browser globals) — not a regression signal.

---

## App architecture

### State
All app state lives in a single `useAppState` hook (or context) at the root level. Never use prop drilling more than 2 levels deep. State shape:

```js
{
  user: { name, email, level, domains, purpose },
  inputs: [],
  clusters: [],
  scenarios: [],
  projects: [],
  activeProjectId: null,
  activeScreen: 'dashboard',  // 'dashboard' | 'inbox' | 'project-overview' | 'project' | 'cluster' | 'scenarios' | 'analysis' | 'future-models'
                              // 'project' = Scan screen (ProjectDetail.jsx); 'cluster' = Cluster screen (ClusterScreen.jsx)
                              // 'clustering' is a legacy case in App.jsx that redirects to ClusterScreen (preserved for localStorage restore)
                              // openProject(id) navigates to 'project-overview' — Overview is the default project landing screen
  drawer: null,               // null | { type: 'newInput' | 'newCluster' | 'inputDetail' | 'clusterDetail' | 'projectSettings', data: {} }
  toast: null,                // null | { message, type: 'success' | 'error' }
}
```

### Navigation
The sidebar drives all navigation. Clicking a sidebar item calls `setActiveScreen()`. No URL routing in v2 — navigation is state-driven via `setActiveScreen()`, and `activeScreen`/`activeProjectId` are persisted to/restored from `localStorage` (`fs_active_screen`/`fs_active_project`, `useAppState.js`).

**The address bar is a cosmetic mirror of that state, and keeping it in sync is bug-prone — two reload bugs have come from it.** The invariant: the URL must never go stale relative to the active screen, or the one-shot `/projects/:id` deep-link handler in `App.jsx` will re-open the stale project on reload. Only two places write the URL for project context: `openProject()` (→ `/projects/:id`) and `AppShell.jsx`'s `handleNavigation` (→ `/` when navigating to a workspace-level screen: Dashboard/Inbox/Projects/Settings, which also clear `activeProjectId`). If you add a new nav path that changes the active project/screen, sync the URL too. The deep-link handler only defers to a restored project (`hasRestoredProject`), not to a restored non-project screen — so a stale URL, not `activeScreen`, is what hijacks a reload.

### Drawers
Input creation, cluster creation, project settings, and detail views all open as slide-over drawers from the right. Never navigate to a separate page for these. The drawer overlays the current content with a semi-transparent backdrop.

### Toast notifications
Every save/create/delete action shows a brief toast (2 seconds, bottom-right). Use a single `Toast` component driven by `appState.toast`.

---

## Component file structure

```
src/
  main.jsx
  App.jsx                   ← root, holds all state, renders layout
  hooks/
    useAppState.js          ← all state logic
  components/
    layout/
      Sidebar.jsx           ← navigation (flat list, no section labels)
      AppShell.jsx          ← sidebar + main content wrapper
      Drawer.jsx            ← slide-over drawer shell
      Toast.jsx             ← success/error notification
    screens/
      Dashboard.jsx
      Inbox.jsx
      ProjectOverview.jsx   ← default project landing: key question, horizons, scanner, phase cards
      ProjectDetail.jsx     ← Scan screen (inputs table only; no clustering; screen key "project")
      ClusterScreen.jsx     ← Cluster screen (InputRail + ClustersPanel + all drag state; screen key "cluster")
      Clustering.jsx        ← dead code; no longer imported (legacy file, safe to delete later)
      SystemMap.jsx
      SystemAnalysis.jsx
      FutureModels.jsx
    inputs/
      InputCard.jsx
      InputDrawer.jsx
      SeededSignalCard.jsx
    clusters/
      ClusterCard.jsx           ← card-view item for cluster in ClustersPanel
      ClusterDrawer.jsx         ← create/edit cluster slide-over
      ClusterDetailPanel.jsx    ← sliding detail panel inside ClustersPanel
      ClustersPanel.jsx         ← 320px right-hand panel (Manual/Suggested modes)
      ClusterSuggestions.jsx    ← Suggested mode content: AI suggestion cards
      DragGhost.jsx             ← portal-based custom drag ghost element
    shared/
      Tag.jsx               ← QualityBadge, HorizonTag, SubtypeTag
      EmptyState.jsx
      HorizonBar.jsx        ← proportional H1/H2/H3 time horizon band; used by ProjectOverview
      ClusterAssignMenu.jsx ← portal-based cluster picker; used by all "Assign →" buttons
      FilterDropdown.jsx    ← reusable filter pill + dropdown; used by ProjectDetail, Inbox, ClusterScreen
  data/
    seeds.js                ← DOMAINS, STEEPLED, DOMAIN_META, SEEDED_SIGNALS_POOL, DEFAULT_SEEDED_INPUTS. The SAMPLE_PROJECTS/SAMPLE_CLUSTERS/SAMPLE_SCENARIOS/SAMPLE_CANVAS_NODES/SAMPLE_RELATIONSHIPS dead data (an abandoned earlier sample-project attempt) was removed 2026-07-09 — superseded by the clone-based sample project (see below)
  styles/
    tokens.js               ← c{} object and shared style primitives
  prototypes/
    future-signals-inputs-redesign_4.html   ← visual reference only

api/                        ← Vercel serverless functions — see "Vercel function-count limit" below before adding new endpoints
  scan.js, score.js, classify.js, trigger-score.js, run-health-check.js  ← cron-triggered (see Security patterns for API endpoints)
  seed-onboarding.js, scrape.js, clone-sample-project.js                ← client-callable, Bearer-auth
  unsubscribe.js, validate-feed.js
server-lib/                 ← shared server-side logic imported by api/*.js. Deliberately NOT under api/ — see gotcha below
  cron-auth.js               ← cronSecretOk / bearerToken helpers
  scoring.js                 ← Layer 3 scoring primitives (cosineSimilarity, recencyScore, CREDIBILITY_SCORES)
  clone-project.js           ← cloneProject() / rollback() — see "Sample project cloning" below
scripts/
  clone-project.js           ← standalone CLI runner for cloneProject(), not wired into the app. Usage: `node --env-file=.env.local scripts/clone-project.js --source <id> --dest-workspace <id> [--include-sources] [--sample-template] [--source-template-id <id>]`
  rotate-cron-secret.sh      ← rotate CRON_SECRET for one env, pushing to Supabase + Vercel with a manual checklist for cron-job.org + LastPass. Usage: `scripts/rotate-cron-secret.sh <prod|staging>`. See docs/cron-secret.md
```

---

## Frontend design principles

- **Light mode only.** All surfaces use the warm off-white / white / light grey token system above. Dark mode is explicitly deferred.
- **Commit to the aesthetic** — warm off-white backgrounds (`#F7F7F5`), ink black (`#1A1A1A`), brand blue (`#3B82F6`) for interactive elements. Refined and minimal, not a consumer app.
- **Typography** — Roboto for headings, Open Sans for body/UI. Load via Google Fonts.
- **Density** — information-dense but not cramped. 12–13px body/labels, 10–11px metadata, 22px page headings.
- **No generic AI aesthetics** — no purple gradients on white, no pill-everything, no card shadows on every element.
- **Interactions** — hover states on all clickable elements, smooth drawer transitions (300ms ease), subtle border changes on focus.
- **Empty states** — every list/section needs a proper empty state with a clear CTA, not blank space. Copy is one sentence maximum: state what goes here and what to do. Scanner is the primary CTA on empty Inputs screens, not "Add signal manually."

---

## What is deferred to v3

Do not scaffold, stub, or reference these in v2 code:

- Real-time collaboration
- Corpus ingestion
- Explore / social layer
- Slide deck generation (explicitly out of scope — not a deferral, not coming)
- Chrome extension (separate surface, handled independently)

**Note:** Preferred Futures, Strategic Options, and Scenario Narratives are **in v2** under the Future Models screen. They are not deferred.

---

## Data model — entity schemas

All tables carry `workspace_id` and (where applicable) `project_id`. `workspace_id` is 1:1 with the user account in v2.

### Input
```js
{
  id: string,
  workspace_id: string,
  project_id: string|null,   // null = lives in Inbox
  name: string,
  description: string,
  source_url: string,
  subtype: string,           // 'Signal' | 'Issue' | 'Projection' | 'Plan' | 'Obstacle'
  steepled: string[],        // subset of ['Social','Technological','Economic','Environmental','Political','Legal','Ethical','Demographic']
  signal_strength: string|null,    // 'Weak' | 'Moderate' | 'Strong' — practitioner-set
  source_confidence: string|null,  // 'Low' | 'Medium' | 'High' — practitioner-set
  // signal_quality column exists in DB but is unused in UI — do not read or write it
  horizon: string,           // 'H1' | 'H2' | 'H3'
  metadata: object,
  created_at: string,
  is_seeded: boolean,
}
```

### Project
```js
{
  id: string,
  workspace_id: string,
  name: string,
  domain: string,
  question: string,          // key inquiry question
  focus: string,
  geo: string,
  h1_start: string, h1_end: string,
  h2_start: string, h2_end: string,
  h3_start: string, h3_end: string,
  assumptions: string,
  stakeholders: string,
  audience: string|null,                 // added 2026-04-25
  scope_in: string[],                    // added 2026-04-28 — in-scope topics; used in Layer 3 scoring as a 10% positive weight
  scope_out: string[],                   // added 2026-04-28 — explicitly out-of-scope topics; used as a hard/soft penalty in Layer 3 scoring
  scanning_enabled: boolean,             // per-project scanner toggle; workspace_settings.scanning_enabled is the workspace-wide override (see Known database gotchas)
  last_reviewed_at: string|null,         // Inbox inactivity detection
  last_visited_at: string|null,          // stamped fire-and-forget in openProject(); used by ProjectOverview for "N new signals since your last visit"
  key_question_embedding: number[]|null, // internal — cached embedding of `question` only; api/score.js builds a richer in-memory embedding (question + focus) at scoring time but never overwrites this cache
  is_sample_template: boolean,           // added 2026-07-09 — true only for the one canonical templates-account copy (see Sample_Project_Onboarding_PRD.md); false on every per-user clone and every normal project
  source_template_id: string|null,       // added 2026-07-09 — self-referencing FK to projects(id); set to the templates-account project's id on a per-user clone, null otherwise. Non-null is what the Dashboard checks to render the "[Sample] " name prefix (computed at render time — project.name itself is never modified)
  created_at: string,
  updated_at: string,                    // added 2026-07-21 (migration 20260721120000) — real "last activity" timestamp; the Dashboard card's "Updated" date reads `updated_at || created_at`. Kept current by DB triggers (see Known database gotchas), NOT written by the app except an optimistic local bump in useAppState's touchProjectLocal()
}
```

### Cluster
```js
{
  id: string,
  workspace_id: string,
  project_id: string,
  name: string,
  subtype: string,           // 'Trend' | 'Driver' | 'Tension'
  horizon: string,           // 'H1' | 'H2' | 'H3'
  description: string,
  input_ids: string[],       // app-state only — derived from the cluster_inputs join table (cluster_id, input_id, workspace_id); not a column on `clusters`
  likelihood: string,        // 'Possible' | 'Plausible' | 'Probable'
  created_at: string,
}
```

### Scenario
```js
{
  id: string,
  workspace_id: string,
  project_id: string,
  name: string,
  archetype: string,         // 'Continuation' | 'Collapse' | 'Constraint' | 'Transformation'
  horizon: string,
  cluster_ids: string[],     // app-state only — derived from the scenario_clusters join table (cluster_id, scenario_id, workspace_id); `scenarios.cluster_ids` is a legacy column, not the source of truth
  description: string,
  narrative: string,
  driving_forces: object[],
  suppressed_forces: object[],
  key_differences: object[],
  confidence: string,
  geographic_scope: string,
  created_at: string,
  updated_at: string,
}
```

### CanvasTextNode
```js
{
  id: string,             // uuid — pre-generated by client before insert (crypto.randomUUID())
  workspace_id: string,
  project_id: string,
  x: number, y: number,  // canvas position in flow coordinates
  text: string,
  font_family: string,
  font_size: number,      // integer px
  bold: boolean,
  italic: boolean,
  color: string,          // hex e.g. '#1A1A1A'
  created_at: string,
}
```
Stored in `canvas_text_nodes` table (migration `20260624_canvas_text_nodes.sql`). Client pre-generates the UUID so the optimistic ReactFlow node and the DB row share the same `id` from the moment of creation — avoids the double-node bug that arises when temp IDs diverge.

### DOMAINS list
```js
const DOMAINS = [
  "Technology & AI", "Climate & Energy", "Health & Life Sciences",
  "Government & Policy", "Economy & Finance", "Education & Learning",
  "Media & Culture", "Defence & Security", "Custom / Other"
];
```

---

## PRD reference

The full Product Requirements Document is at:
**https://docs.google.com/document/d/1enQk44JVvjS4mCF-1gzIBVBPyvAXtoVr20HuddJdako**

Key decisions already made:
- Cluster subtypes: **Trend, Driver, Tension** (Enabler removed)
- Scenario archetypes: **Continuation, Collapse, Constraint, Transformation**
- Signal Quality field has been disaggregated into two separate practitioner-set fields: **Signal Strength** (`Weak | Moderate | Strong`) and **Source Confidence** (`Low | Medium | High`). The `signal_quality` DB column is retained but unused.
- Inbox default container — `project_id: null` means "in Inbox"
- Workspace is 1:1 with user account in v2 — no team/org layer yet
- Real-time collaboration deferred to v3
- Analysis mode (Quick Scan / Deep Analysis toggle) removed entirely — do not reference `mode` on Projects
- Slide deck generation explicitly out of scope
- Chrome extension is a separate surface
- System Map is binary per project — built or not built, never a count
- "Project settings" is the correct label for the project configuration panel (not "Edit project")
- Preferred Futures, Strategic Options, and Scenario Narratives are v2 features under Future Models

---

## Key specs — read when relevant

| Spec | When to read |
|---|---|
| `design-principles.md` | Before any UX, form, AI output, nudge, or navigation decision |
| `signal-scanner-spec.md` | Any work touching the scanner, candidate ingestion, scoring, or onboarding seeding |
| `FutureSignals_Onboarding_ProgressiveDisclosure_Spec.md` | Any work touching the onboarding flow, project creation, or first-session experience. Its sample-project section (read-only project + structural-only "promote") is superseded by `Sample_Project_Onboarding_PRD.md`'s clone-based model — that section of this spec has not yet been formally retired/updated, don't treat it as current for sample-project behavior |
| `Sample_Project_Onboarding_PRD.md` | Any work touching sample-project cloning, `cloneProject()`, `is_sample_template`/`source_template_id`, or the per-user clone triggered at onboarding completion — see also "Sample project cloning" above |
| `web-export-spec.md` | Any work touching Web Publish — the pipeline, `/p/{slug}` serving, section templates, System Map SVG, or `project_publications` — see also "Web Publish" above |

---

## Known database gotchas

### Core schema facts
- `workspaces` table uses `user_id` not `owner_id` — check this on any new RLS policy or query touching workspaces. `workspaces` also has `onboarding_completed` (boolean) and `experience_level` (text, nullable — `null` is treated as `'regular'` throughout the product), both written from the onboarding flow.
- pgvector columns do not support `.not('embedding', 'is', null)` via PostgREST — use a workaround (e.g. a `SECURITY DEFINER` SQL function with `WHERE embedding IS NOT NULL`, as in `get_seeding_candidates`).
- Single `inputs` table with subtype column + JSONB metadata — do not create separate tables per subtype.
- Canvas (React Flow) is a view over the data model, not the data store — relationships persist when a cluster is removed from the canvas.
- Cluster↔Input and Scenario↔Cluster memberships live in junction tables (`cluster_inputs`, `scenario_clusters`), not array columns. `useAppState.js` derives `input_ids` / `cluster_ids` arrays from these joins on read and strips them before writing back. `scenarios.cluster_ids` exists as a legacy jsonb column but is not the source of truth.
- `candidates.steepled` is `string[]` (1-3 values), not a scalar `steepled_category` column. There is **no** `candidates.domain`, `candidates.confidence_score`, `candidates.created_at`, or `candidates.summary` column.
  - Use `candidates.ingested_at` for ingestion recency, not `created_at`.
  - Use `candidates.summary_ai || candidates.summary_raw` for display text, not `summary`.
  - Relevance scores live on the **promoted `inputs` row**, not on `candidates`: `inputs.metadata.suggested_projects: [{id, name, score, classification}]` and `inputs.metadata.top_score` (set by `api/score.js` at promotion time).
  - Domain relevance for a promoted candidate is implicit, not a column: `api/score.js` only promotes a candidate into the workspace whose project scored it highest, so anything in a workspace's Inbox (`inputs.project_id IS NULL`) is inherently relevant to that workspace's projects.
- `user_preferences` table (added 2026-06-14) holds per-user digest preferences (`digest_unsubscribed`), keyed by `user_id` referencing `auth.users.id`, RLS enabled. A row may not exist for every user — always `maybeSingle()` on reads and `upsert` on writes.
- **`trg_auto_populate_project_sources`** — an `AFTER INSERT` trigger on `projects` (documented in migration `20260709140000_document_auto_populate_project_sources.sql`, but was live on both databases long before that, undiscovered until a clone-testing session found it). On every new project row, it auto-inserts `project_sources` rows for every active `sources` row matching the new project's `domain`, with `opted_in` hardcoded `true`. This fires independent of and invisible to any application code that inserts a project — `cloneProject()` has to explicitly purge or neutralize whatever it creates (see "Sample project cloning" above). If you ever see unexpected `project_sources` rows appear right after a project insert, this is why.
- **`projects.updated_at` + activity triggers** (added 2026-07-21, migration `20260721120000_projects_updated_at.sql`, applied to staging AND production). The Dashboard card "Updated" date reads `updated_at || created_at`; the column never existed before, so every card silently showed `created_at` and never moved. Now kept current by DB triggers, NOT by app writes:
  - `projects_set_updated_at` — `BEFORE UPDATE` on `projects` using the shared `handle_updated_at()`, so any direct edit bumps it.
  - `touch_project_updated_at` — `AFTER INSERT/UPDATE/DELETE` on all 9 project-scoped **content** tables (`inputs`, `clusters`, `scenarios`, `relationships`, `canvas_nodes`, `canvas_text_nodes`, `analyses`, `preferred_futures`, `strategic_options` — the join tables `cluster_inputs`/`scenario_clusters` have no `project_id` and are skipped) via a `SECURITY DEFINER` function that does `update projects set updated_at = now() where id = coalesce(new.project_id, old.project_id)`. A null `project_id` (Inbox input) is a no-op; a cascade-delete of the project itself no-ops harmlessly. Adding an input to the Inbox does NOT bump any project (correct — it's unassigned).
  - The app never writes `updated_at`; `useAppState`'s `touchProjectLocal()` only mirrors the DB optimistically in local state (called from `addInput`/`addCluster`/`saveInputToProject`/`saveInputsToProject`) so the card moves in-session without a refetch. Everything else is correct on next load via the triggers.
- **Undocumented-schema-change pattern**: `projects.source_template_id`, `projects.is_sample_template`, `projects.last_visited_at`, `analyses.updated_at`, and the `trg_auto_populate_project_sources` trigger were all added directly to staging/production (dashboard or ad hoc SQL) with no migration file, discovered only via later audits and backfilled with documentation migrations. If a column or trigger seems to exist live but isn't accounted for in `supabase/migrations/`, this has happened before and will likely happen again — confirm live state directly (`information_schema.columns`, `pg_trigger`) rather than assuming the migrations directory is complete.

### `database.types.ts` can lag behind `supabase/migrations/`
Regenerated 2026-07-09. Now includes `canvas_text_nodes`, `projects.last_visited_at`, `analyses.updated_at`, `projects.source_template_id`, and `projects.is_sample_template`. **For schema questions, always treat `supabase/migrations/` (read chronologically, latest wins) as the source of truth, not `database.types.ts`** — this file will drift again after future migrations until regenerated with: `supabase gen types typescript --project-id kptatqipjwihkdxdxlvh > src/types/database.types.ts`

### `supabase db push` version-collision bug
Multiple migration files sharing the same bare `YYYYMMDD` version (no time component) will collide in `supabase_migrations.schema_migrations`'s primary key on push, and — more confusingly — once one of them is applied, `db push`/`db push --dry-run` starts failing with `"Remote migration versions not found in local migrations directory"` even for unrelated, correctly-versioned migrations. This recurred repeatedly in the 2026-07-09 session. Fix each time: `supabase migration repair --linked --status reverted <bare-date-version> [<other-bare-date-version>...]`, then retry `db push --dry-run` (sometimes needs `--include-all` if it now reports "local migration files to be inserted before the last migration on remote"). This is a bookkeeping-only operation — it doesn't touch actual schema/data, and re-applying an already-applied idempotent migration is harmless. Avoid the root cause going forward: give new migrations a full timestamp version (`YYYYMMDDHHMMSS_description.sql`), not just a bare date, especially when another migration might land the same day.

Recurred again on 2026-07-13 during the workspace-refactor merge-readiness push (versions 20260705 and 20260709). Same fix worked: `migration repair --status reverted 20260705 20260709`, then `db push --dry-run --include-all` came back clean listing both files, then the real `db push --include-all` applied cleanly, with NOTICEs confirming both migrations were already-satisfied no-ops. One new wrinkle: `migration list --linked` kept showing both versions as unmatched even after the successful push—this is a display bug in CLI 2.84.2, not a sign the ledger or schema is actually wrong. Confirm real state directly with `information_schema.columns` or `pg_policies` rather than trusting this command's output. Upgraded the CLI to 2.109.1 as a mitigation; not yet confirmed whether that resolves the display bug itself.

### RLS patterns
Two patterns are in use, depending on the table's key column:
- Tables with a `workspace_id` column (the vast majority): `FOR ALL USING (workspace_id = get_workspace_id())`, where `get_workspace_id()` is a `SECURITY DEFINER` SQL function resolving `auth.uid()` to the caller's `workspaces.id`. Used by `cluster_suggestions`, `preferred_futures`, `strategic_options` — default to this for new project/workspace-scoped tables.
- Tables keyed directly by `auth.users.id` (e.g. `user_preferences`): `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`.
- A second function, `get_user_workspace_id()`, also exists in the database but has no usages in any tracked migration — confirm its purpose before relying on it.

### Grants for new tables
- **New tables require explicit grants** — Supabase will not auto-grant public schema access from **October 2026** onward. Every `CREATE TABLE` migration must include:
```sql
  grant select on public.<table> to anon;
  grant select, insert, update, delete on public.<table> to authenticated;
  grant select, insert, update, delete on public.<table> to service_role;
  alter table public.<table> enable row level security;
```
  Run migrations manually in Supabase before handing off implementation prompts.
- Several existing tables (`cluster_suggestions`, `preferred_futures`, `strategic_options`, `source_health`, etc.) were created before this requirement was identified and have no explicit grants in their migration files. If a permissions error appears on one of these ahead of the October 2026 deadline, add the missing grants in a follow-up migration rather than widening access ad hoc.

### Environment variable conventions
- **Frontend (`src/`)**: only `VITE_`-prefixed vars are available to the client bundle — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ENABLE_QA_TOOLS`.
- **Server-side (`api/*.js`, Supabase Edge Functions)**: bare names, never `VITE_`-prefixed — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`, `APP_URL`, `ADMIN_EMAIL`, `RESEND_API_KEY`, `EMAIL_RELAY_SECRET`, `UNSUBSCRIBE_SECRET`, `SAMPLE_TEMPLATE_PROJECT_ID` (added 2026-07-09 — the templates-account project id `cloneProject()` reads for the per-user clone; not a secret, set via `vercel env add ... --no-sensitive` so it stays readable, but still only ever read server-side, never client-supplied. Production: `566911c6-65b4-4648-962f-f0e662033cb8`. Preview/`workspace-refactor`: `44b699ff-0fb1-44fb-9eb6-17a077cc7c9d`).

### Cron-triggered endpoints
- Both Vercel functions (`api/scan.js`, `api/score.js`) and Supabase Edge Functions (`check-scanner-health`, `send-weekly-digest`) that run on a schedule check an `x-cron-secret` header against `CRON_SECRET` (`process.env.CRON_SECRET` / `Deno.env.get("CRON_SECRET")`) and return 401 on mismatch. Use this pattern for any new cron-triggered endpoint.
- **`CRON_SECRET` is a symmetric shared secret with non-obvious coupling** — the Vercel copy is *forwarded* to the Supabase `check-scanner-health` function, so the Vercel and Supabase copies must be equal within an environment, and cron-job.org (external scheduler for the scanner + weekly digest) must send the same value. A partial rotation silently breaks a subset of jobs. Source of truth is LastPass (one entry per env; prod ≠ staging), never a deployment (Vercel sensitive = write-only, Supabase masked). Full topology, sync inventory, and the rotation procedure live in **`docs/cron-secret.md`**; rotate with `scripts/rotate-cron-secret.sh <prod|staging>`.
- **Scheduled Supabase Edge Functions must be deployed `--no-verify-jwt`** (like `check-scanner-health`, `send-email`, `unsubscribe-digest`, `send-weekly-digest`). Otherwise the API gateway requires a project API key *before* the handler runs, and an `x-cron-secret`-only caller is rejected with `401 UNAUTHORIZED_UNREGISTERED_API_KEY` (a gateway error, not the handler's `{"error":"Unauthorised"}`) — which also then breaks on any project API-key rotation.
- **`send-email` and its callers are a deploy-pair via `EMAIL_RELAY_SECRET`.** `send-email` gates on an `x-relay-secret` header; `send-weekly-digest` sends it. A 2026-07-05 security change added the gate and the header-sending together (commits `642e25f` + `20f6c82`). If you redeploy one of the two functions without the other, you split the pair — one enforces a header the other doesn't send (or vice versa). Deploy both together, or neither. (As of this writing production still runs pre-2026-07-05 copies of both — mutually consistent — so email works; the fix is deployed-consistent, not deployed.)

### Edge Function deploy flags
- Functions called from contexts with no Supabase Authorization header (e.g. links clicked from emails) must be deployed with JWT verification disabled: `supabase functions deploy <name> --no-verify-jwt`. Currently applies to `unsubscribe-digest`.
- Unsubscribe token pattern: `userId:HMAC-SHA256(userId, UNSUBSCRIBE_SECRET)`, hex-encoded. The `userId` is embedded so verification is O(1) — extract the prefix, recompute the HMAC for that user only, compare. The unsubscribe URL in emails routes through `APP_URL/api/unsubscribe` (a Vercel proxy) rather than the Supabase function URL directly, keeping the Supabase project ID out of emails.

### Security patterns for API endpoints
- **Cron-only endpoints** (`scan.js`, `classify.js`, `score.js`, `run-health-check.js`): check `x-cron-secret` header, return 401 on mismatch.
- **Client-callable endpoints** (`scrape.js`, `seed-onboarding.js`, `clone-sample-project.js`): require a Supabase Bearer token, verify with `supabase.auth.getUser(token)`, return 401 if invalid. `clone-sample-project.js` additionally derives `destWorkspaceId` server-side from the verified user (`workspaces.user_id = user.id`) rather than trusting a client-supplied workspace, and reads the source project id only from `SAMPLE_TEMPLATE_PROJECT_ID` — never the request body.
- **Dual-auth endpoints** (`trigger-score.js`): accept either `x-cron-secret` OR a valid Bearer token — used by both cron and the client (after project creation).
- **`api/scrape.js` SSRF protection**: validates URL is HTTPS, rejects private/loopback/IMDS IP ranges, caps response body at 512 KB.

### Vercel function-count limit (Hobby plan)
Vercel's zero-config Node builder treats **every** `.js`/`.ts` file under `api/` as its own serverless function — including helper files with no `handler` export, and files nested in subdirectories like `api/lib/`. The Hobby plan caps a deployment at 12 functions total. This is why shared server-side logic lives in a top-level `server-lib/` directory (outside `api/`) rather than `api/lib/` — files outside `api/` are never counted. Adding a new `api/*.js` endpoint that imports a new shared helper: put the helper in `server-lib/`, not `api/lib/`. Check the count before adding a new top-level `api/*.js` file: `find api -name "*.js" -o -name "*.ts" | wc -l` (currently 11 after `api/publish.js` — one slot of headroom left, so treat the last one carefully; the Publish serving route was folded into `api/publish.js` via a `?view` param + `/p/:slug` rewrite rather than spending a second slot).