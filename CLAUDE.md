# Future Signals v2 — Claude Code Instructions

## Project overview

Future Signals v2 is a strategic foresight SPA built with React + Vite. It guides practitioners through a structured methodology: Inputs → Clusters → System Map → System Analysis → Future Models. The Vercel prototype phase is complete — we are now building the production app with Supabase (Postgres + pgvector + RLS) as the backend.

**Stack:** React 18, Vite, React Flow (`@xyflow/react`), Supabase (auth + database + storage), Vercel (hosting), inline styles using the design token system below.

**AI model stack:** OpenAI only — `text-embedding-3-small` for embeddings, `gpt-4o-mini` for classification/tagging, `gpt-4o` for enrichment and synthesis. Do NOT reference or use any Anthropic/Claude API in implementation.

**Key principle:** AI supports but does not replace practitioner thinking. The UI should feel like a professional tool, not a consumer app.

**Prototype reference:** `prototypes/future-signals-inputs-redesign_4.html` — use as a visual reference for the Inputs screen and shared layout. Do not copy its code directly.

---

## Design principles — read before any UX or form decision

**`docs/design-principles.md`** is the authoritative source for all design and UX decisions. Read it before making any decision involving forms, fields, AI outputs, nudges, navigation, or empty states.

Key rules extracted here for fast access — but the full document has the reasoning behind each one:

1. **Zero required fields.** No entity creation form should block on an empty field. Every field must have a sensible default or be skippable.
2. **Quick Start is the default.** Enhanced fields live behind a `+ Add more detail` toggle. Never open by default on first project creation.
3. **New fields are Enhanced unless proven otherwise.** When adding a field to any form, place it in Enhanced tier. Promotion to Quick Start requires explicit justification: "Does a practitioner need this field *before* they can get value from this entity?"
4. **AI outputs require a practitioner action before entering the record.** Pre-populate and suggest — never silently apply. The practitioner confirms, edits, or promotes.
5. **No gate between stages.** Practitioners can navigate to any project stage at any time, regardless of whether earlier stages are "complete." Never block navigation on prior completion.
6. **Nudges have lifespans.** Any nudge implementation must include suppression logic: if ignored twice, suppress for 30 days. Nudges are preferences, not defaults — practitioners opt in.
7. **Re-entry surfaces answer "where was I and what's new?" —** not "here is your progress toward completion." Dashboard and project headers are re-entry surfaces, not progress trackers.
8. **Terminology is locked.** Use the table in the Terminology section below and in `docs/design-principles.md`. No synonyms, no drift.

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

  // Semantic — Signal Quality badges
  confirmedBg:    "#D1FAE5", confirmedText:    "#065F46",
  establishedBg:  "#DBEAFE", establishedText:  "#1E40AF",
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
- Clusters *(project-scoped, shows cluster count)*
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

## Right panel — structure and rules

Width: `240px`. Contains three cards separated by `14px` gap.

**1. Clusters card**
- Title: "Clusters" + built count badge (`builtBg/builtText`)
- Full-width "Build a cluster" button (`btnFull`)
- Lists existing clusters (show up to 4, then "View all" affordance)
- Each cluster shows: subtype badge + horizon badge + input count + name

**2. System Map card**
- Title: "System Map" + binary status badge: "Built" (`builtBg/builtText`) or "Not built" (`notBuiltBg/notBuiltText`)
- No count — there is always exactly one System Map per project, or none
- If built: show canvas thumbnail (SVG/image snapshot), clickable → navigates to System Map. Footer strip shows node count + relationship count + "Open →"
- If not built: explanatory text + full-width "Go to System Map →" button (`btnFull`)

**3. Project details card**
- Title: "Project details" — no Edit button
- Read-only summary: Domain, Focus, Geography, Stakeholders
- Populated fields: `c.ink`, 11.5px
- Empty fields: italic, `c.faint` — "Not set"
- Editing is done via "Project settings" in the page header

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
**Signal Quality values:** `Emerging | Established | Confirmed`

---

## Key product decisions

**Projects are mandatory. Clusters and System Maps only exist within a Project.**

- The Inbox holds inputs that have not yet been assigned to a project (`project_id === null`). It is a workspace-level screen.
- Clustering and System Map are project-scoped screens. They only appear in the sidebar when a project is active.
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
  activeScreen: 'dashboard',  // 'dashboard' | 'inbox' | 'project' | 'clustering' | 'systemMap' | 'systemAnalysis' | 'futureModels'
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
      ProjectDetail.jsx     ← Inputs screen
      Clustering.jsx        ← Clusters screen
      SystemMap.jsx
      SystemAnalysis.jsx
      FutureModels.jsx
    inputs/
      InputCard.jsx
      InputDrawer.jsx
      SeededSignalCard.jsx
    clusters/
      ClusterCard.jsx
      ClusterDrawer.jsx
    shared/
      Tag.jsx               ← QualityBadge, HorizonTag, SubtypeTag
      EmptyState.jsx
      RightPanel.jsx        ← shared right panel (Clusters + SystemMap + ProjectDetails cards)
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
  signal_quality: string,    // 'Emerging' | 'Established' | 'Confirmed'
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
  input_ids: string[],
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
  cluster_ids: string[],
  created_at: string,
}
```

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
- Signal Quality: **Emerging, Established, Confirmed** — single field replacing Signal Strength + Source Confidence
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
| `docs/design-principles.md` | Before any UX, form, AI output, nudge, or navigation decision |
| `docs/signal-scanner-spec.md` | Any work touching the scanner, candidate ingestion, scoring, or onboarding seeding |
| `docs/onboarding-spec.md` | Any work touching the onboarding flow, project creation, or first-session experience |

---

## Known database gotchas

- `workspaces` table uses `user_id` not `owner_id` — check this on any new RLS policy or query touching workspaces
- pgvector columns do not support `.not('embedding', 'is', null)` via PostgREST — use a workaround
- Single `inputs` table with subtype column + JSONB metadata — do not create separate tables per subtype
- Canvas (React Flow) is a view over the data model, not the data store — relationships persist when a cluster is removed from the canvas
