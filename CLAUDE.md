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

1. **Zero required fields.** No entity creation form should block on an empty field. Every field must have a sensible default or be skippable.
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

Always use these exact values. Never introduce new colours or spacing scales without explicit instruction.

```js
const c = {
  // Surfaces
  bg:          "#F7F7F5",   // page background, sidebar
  white:       "#ffffff",   // main content area, cards
  surfaceAlt:  "#FAFAF8",   // input field backgrounds
  canvas:      "#F7F6F2",   // canvas backgrounds

  // Text
  ink:         "#1A1A1A",   // primary text
  muted:       "#6B7280",   // secondary text, nav items
  faint:       "#9CA3AF",   // tertiary text, placeholders, column headers

  // Borders
  border:      "rgba(0,0,0,0.09)",   // cards, dividers, table rows
  borderMid:   "rgba(0,0,0,0.16)",   // inputs, buttons, interactive borders

  // Brand — interactive primary
  brand:       "#3B82F6",   // primary CTAs, active nav, key question accent
  brandBg:     "#EFF6FF",   // active nav background, hover states
  brandDeep:   "#F0F7FF",   // key question block background
  brandBorder: "#BFDBFE",   // active filter pill border

  // Semantic — Signal Strength / Source Confidence badges
  // Strong / High
  confirmedBg:    "#D1FAE5", confirmedText:    "#065F46",
  // Moderate / Medium
  establishedBg:  "#DBEAFE", establishedText:  "#1E40AF",
  // Weak / Low
  emergingBg:     "#FEF3C7", emergingText:     "#92400E",

  // Semantic — Time horizons (H1/H2/H3)
  h1Bg: "#DCFCE7", h1Text: "#166534",
  h2Bg: "#DBEAFE", h2Text: "#1E40AF",
  h3Bg: "#FEF3C7", h3Text: "#92400E",

  // Semantic — Cluster subtypes
  driverBg:  "#EDE9FE", driverText:  "#5B21B6",
  trendBg:   "#EDE9FE", trendText:   "#5B21B6",
  tensionBg: "#FEF3C7", tensionText: "#92400E",

  // Semantic — System Map relationship edges
  edgeInhibits:  "#C2813A",
  edgeDrives:    "#3B82F6",
  edgeAccelerates:"#0D9488",
  edgeFeedback:  "#D97706",  // dashed

  // Semantic — status
  builtBg:    "#DCFCE7", builtText:    "#166534",
  notBuiltBg: "#FEF3C7", notBuiltText: "#92400E",

  // Alert
  alertBg:   "#FEE2E2", alertText: "#991B1B",  // Inbox unread badge
};
```

**Shared style primitives:**
```js
const inp   = { width:"100%", padding:"9px 11px", border:`1px solid ${c.borderMid}`, borderRadius:8, background:c.white, color:c.ink, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
const ta    = { ...inp, resize:"none", lineHeight:1.55 };
const sel   = { ...inp, appearance:"none" };

// Primary button — brand blue
const btnP  = { padding:"10px 22px", borderRadius:8, background:c.brand, color:c.white, border:"none", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" };
const btnSm = { padding:"7px 16px", borderRadius:7, background:c.brand, color:c.white, border:"none", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit" };

// Secondary / ghost buttons
const btnSec= { padding:"9px 18px", borderRadius:8, background:"transparent", color:c.muted, border:`1px solid ${c.borderMid}`, fontSize:13, cursor:"pointer", fontFamily:"inherit" };
const btnG  = { padding:"7px 12px", borderRadius:7, background:"transparent", color:c.muted, border:"none", fontSize:12, cursor:"pointer", fontFamily:"inherit" };

// Full-width right-panel CTA buttons
const btnFull = { width:"100%", padding:"7px 12px", borderRadius:6, background:"transparent", color:c.muted, border:`1px solid ${c.borderMid}`, fontSize:11.5, cursor:"pointer", fontFamily:"inherit", textAlign:"center" };

const fl    = { fontSize:12, fontWeight:500, color:c.ink, marginBottom:5, display:"flex", alignItems:"center", gap:6 };
const fh    = { fontSize:11, color:c.faint, marginBottom:6, fontStyle:"italic", lineHeight:1.45 };
const badg  = { fontSize:10, padding:"1px 6px", borderRadius:4, background:"#f0f0ee", color:c.faint };
```

---

## Styling: Tailwind CSS v4

### Setup

Tailwind CSS v4 is installed via the `@tailwindcss/vite` plugin. There is **no `tailwind.config.js`** — all theme customization lives in the `@theme` block at the top of `src/index.css`. The plugin is registered in `vite.config.js` alongside the React plugin.

### Color tokens

All 38 colors from the `c{}` object in `src/styles/tokens.js` are registered as `--color-*` custom properties. Each one generates `bg-{name}`, `text-{name}`, and `border-{name}` utility classes automatically.

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

### Border-radius: intentional two-tier design

The design system uses two distinct radius values:
- **8px (`rounded-lg`)** — containers, inputs, modals, drawers
- **7px (`rounded-[7px]`)** — compact interactive elements: toggle buttons, small action pills

`rounded-[7px]` is **not an inconsistency** — do not replace it with `rounded-lg`. When button components are migrated to Tailwind, add `--radius-btn: 7px` to `@theme` and replace all `rounded-[7px]` uses at that time — not before.

### 0.5px borders

Where a `0.5px` border is required (e.g. the sidebar border-right, panel dividers), use a border-width token (`border-[0.5px]` arbitrary value) rather than a raw inline style. Do not add a custom `--spacing` entry for sub-pixel values.

### Migration status and tokens.js

**`src/styles/tokens.js` is still the active design system** for any component not yet migrated to Tailwind classes. Do not remove or modify it until migration is complete.

- Components that **have not** been migrated: continue importing from `tokens.js` using inline styles as before.
- Components that **have** been migrated to Tailwind classes: must **not** import from `tokens.js`. The Tailwind classes and the `@theme` variables are the sole source of style for migrated components.
- The `@theme` block in `src/index.css` and `tokens.js` must stay in sync — if a token value changes, update both.

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
- Column headers: 10px / weight 500 / uppercase / letter-spacing 0.07em
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
- Inbox *(global, shows unread count badge in `alertBg/alertText`)*
- `0.5px` divider
- Inputs *(project-scoped, shows input count)*
- System Map *(project-scoped)*
- System Analysis *(project-scoped)*
- Future Models *(project-scoped)*
- Export *(project-scoped, last item, download icon)*

**Active state:** `background: c.brandBg`, `color: c.brand`, `border-left: 2px solid c.brand`, `font-weight: 500`
**Inactive state:** `color: c.muted`, no background

**Visibility rules:**
- Dashboard and Inbox are always visible.
- Divider and all project-scoped items (Inputs → Export) are only visible when `activeProjectId` is set.
- Navigating to Dashboard or Inbox clears the active project context.

---

## Page header — Inputs screen pattern

This pattern applies to all project-scoped screens.

```
breadcrumb        → "Projects › {project name}"  (11px, c.faint)
title row         → {Project name} (22px/500) + [Project settings ⚙] + [Domain tag] + CTAs (right-aligned)
key question block→ blue left-border card (see below)
time horizon bar  → proportional H1/H2/H3 bar with date labels
```

**Key question block:**
```js
{
  padding: "9px 14px",
  borderLeft: `2px solid ${c.brand}`,
  background: c.brandDeep,
  borderRadius: "0 6px 6px 0",
}
// Label: 9px, uppercase, tracked, c.brand — "KEY QUESTION"
// Body: 13px, italic, c.ink
```

**"Project settings" button** (not "Edit project") — opens the full project configuration panel (name, domain, key question, time horizons, focus, geography, stakeholders). Use a gear icon (⚙). Style as `btnSec`.

---

## Clusters panel — structure and rules

The 320px right-hand panel in the Inputs workspace. Replaces the old three-card sidebar (Clusters summary, System Map widget, Project Details). Those sections no longer exist on the Inputs screen — project metadata is in the page header; System Map status is visible via the nav item.

**Panel header (two rows):**
- Row 1: "Clusters" label (13px semibold) + "+ New cluster" button right-aligned (`c.brandBg` bg, `c.brand` text, `c.brandBorder` border). Visible in both modes.
- Row 2: Manual/Suggested mode toggle (left) + list/card view toggle (right, hidden in Suggested mode).

**Manual mode** (default):
- Drop zone strip below header — dashed border, `c.faint` text "⊕ Drop inputs here to create a new cluster". Highlights `c.brand` / `c.brandBg` on drag-over. Drop opens ClusterDrawer with inputs pre-selected.
- Scrollable cluster list — list view (compact rows: type badge · name · count) or card view (type + horizon + likelihood + name + description excerpt).
- Drag-and-drop targets: move (default) or copy (⌥ Option held). Drop target shows "Move"/"Copy" pill in `c.brand` / green.
- Cluster detail panel slides in from right on click (translateX, 220ms). Shows badges, name, description, linked inputs with ✕ remove per row, Delete button in footer. Closes on back-click, Escape, or clicking the inputs panel.

**Suggested mode:**
- Toolbar: sensitivity toggle (Tight / Balanced / Exploratory) + "✦ Suggest clustering" button.
- Calls `compute-cluster-suggestions` edge function. Requires `OPENAI_API_KEY` on the Supabase project.
- Section 1 "Add to existing clusters": assignment suggestion cards — Accept / Dismiss per card, Accept all header link, Remove per input row.
- Section 2 "New cluster suggestions": new cluster cards — Create cluster / Edit (inline) / Dismiss. Rationale expandable via "· Why this cluster?".
- Empty states: "No suggestions yet" before first run; "All suggestions resolved" after all acted on.

**Props ClustersPanel receives from ProjectDetail:**
`projectId`, `clusters`, `inputs`, `onNewCluster`, `removeInputFromCluster`, `deleteCluster`, `showToast`, `dragIds`, `dragIsCopy`, `onDrop`, `onDropToNewCluster`, `assignInputToCluster`, `addCluster`

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
- The Inbox's AI Suggested section has its own search/filter bar, including a Project filter (filters on `metadata.suggested_projects`). It defaults to "All projects" (no filter) on fresh page load and on first navigation to the Inbox. Within a session, the filter persists whatever the user last selected (including cleared).
- A project's "Review N suggestions" action (Project Detail) sets `appState.inboxProjectFilter` and navigates to the Inbox — the AI Suggested Project filter picks this up as its initial selection (deep-link), pre-filtering AI Suggested to that project on arrival.
- The System Map is project-scoped and only appears in the sidebar when a project is active. There is no separate Clustering screen — clustering is embedded inside the Inputs workspace (ProjectDetail) as the right-hand ClustersPanel.
- At workspace level (Dashboard, Inbox, no active project) the sidebar shows only: Dashboard, Inbox. No project-scoped items.
- Navigating to Dashboard or Inbox via the sidebar clears the active project context.
- The Dashboard stats strip shows workspace-level counts only: Projects and Inputs in Inbox. Per-project counts appear on each project card.
- There is always exactly one System Map per project (binary: built or not built). Never show a count.
- Workspace is 1:1 with user account in v2 — no team/org layer yet.

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
  activeScreen: 'dashboard',  // 'dashboard' | 'inbox' | 'project' | 'systemMap' | 'systemAnalysis' | 'futureModels'
                              // Note: 'clustering' still exists as a case in App.jsx but redirects to 'project' (ProjectDetail)
  drawer: null,               // null | { type: 'newInput' | 'newCluster' | 'inputDetail' | 'clusterDetail' | 'projectSettings', data: {} }
  toast: null,                // null | { message, type: 'success' | 'error' }
}
```

### Navigation
The sidebar drives all navigation. Clicking a sidebar item calls `setActiveScreen()`. No URL routing in v2 — navigation is state-driven via `setActiveScreen()`.

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
      ProjectDetail.jsx     ← Inputs workspace (inputs table + embedded ClustersPanel)
      Clustering.jsx        ← redirect only; case in App.jsx returns ProjectDetail
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
      ClusterAssignMenu.jsx ← portal-based cluster picker; used by all "Assign →" buttons
  data/
    seeds.js
  styles/
    tokens.js               ← c{} object and shared style primitives
  prototypes/
    future-signals-inputs-redesign_4.html   ← visual reference only
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
  key_question_embedding: number[]|null, // internal — cached embedding of `question` only; api/score.js builds a richer in-memory embedding (question + focus) at scoring time but never overwrites this cache
  created_at: string,
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
| `FutureSignals_Onboarding_ProgressiveDisclosure_Spec.md` | Any work touching the onboarding flow, project creation, or first-session experience |

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

### `database.types.ts` can lag behind `supabase/migrations/`
Regenerated 2026-06-14. **Known gap as of 2026-06-23:** `canvas_text_nodes` table (added in `20260624_canvas_text_nodes.sql`) is not yet in the generated types file — use raw Supabase queries or cast as needed until it's regenerated. `supabase migration list` shows local and remote in sync. **For schema questions, always treat `supabase/migrations/` (read chronologically, latest wins) as the source of truth, not `database.types.ts`** — this file will drift again after future migrations until it's regenerated.

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
- **Server-side (`api/*.js`, Supabase Edge Functions)**: bare names, never `VITE_`-prefixed — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`, `APP_URL`, `ADMIN_EMAIL`, `RESEND_API_KEY`, `UNSUBSCRIBE_SECRET`.

### Cron-triggered endpoints
- Both Vercel functions (`api/scan.js`, `api/score.js`) and Supabase Edge Functions (`check-scanner-health`, `send-weekly-digest`) that run on a schedule check an `x-cron-secret` header against `CRON_SECRET` (`process.env.CRON_SECRET` / `Deno.env.get("CRON_SECRET")`) and return 401 on mismatch. Use this pattern for any new cron-triggered endpoint.

### Edge Function deploy flags
- Functions called from contexts with no Supabase Authorization header (e.g. links clicked from emails) must be deployed with JWT verification disabled: `supabase functions deploy <name> --no-verify-jwt`. Currently applies to `unsubscribe-digest`.
- Unsubscribe token pattern: `userId:HMAC-SHA256(userId, UNSUBSCRIBE_SECRET)`, hex-encoded. The `userId` is embedded so verification is O(1) — extract the prefix, recompute the HMAC for that user only, compare. The unsubscribe URL in emails routes through `APP_URL/api/unsubscribe` (a Vercel proxy) rather than the Supabase function URL directly, keeping the Supabase project ID out of emails.

### Security patterns for API endpoints
- **Cron-only endpoints** (`scan.js`, `classify.js`, `score.js`, `run-health-check.js`): check `x-cron-secret` header, return 401 on mismatch.
- **Client-callable endpoints** (`scrape.js`, `seed-onboarding.js`): require a Supabase Bearer token, verify with `supabase.auth.getUser(token)`, return 401 if invalid.
- **Dual-auth endpoints** (`trigger-score.js`): accept either `x-cron-secret` OR a valid Bearer token — used by both cron and the client (after project creation).
- **`api/scrape.js` SSRF protection**: validates URL is HTTPS, rejects private/loopback/IMDS IP ranges, caps response body at 512 KB.