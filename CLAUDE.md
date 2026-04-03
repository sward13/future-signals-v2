# Future Signals v2 — Claude Code Instructions

## Project overview

Future Signals v2 is a strategic foresight SPA built with React + Vite. It guides practitioners through a Signals → Clusters → Scenarios methodology. The Vercel prototype phase is complete — we are now building the production app with Supabase (Postgres + pgvector + RLS) as the backend.

**Stack:** React 18, Vite, React Flow (`@xyflow/react`), Supabase (auth + database + storage), Vercel (hosting), inline styles using the design token system below.

**Key principle:** AI supports but does not replace practitioner thinking. The UI should feel like a professional tool, not a consumer app.

---

## Design system — tokens and primitives

Always use these exact values. Never introduce new colours or spacing scales without explicit instruction.

```js
const c = {
  bg:"#f5f4f0", white:"#ffffff", ink:"#111111",
  muted:"#666666", faint:"#aaaaaa", hint:"#c4c3bc",
  border:"rgba(0,0,0,0.09)", borderMid:"rgba(0,0,0,0.18)",
  surfaceAlt:"#f9f9f7", fieldBg:"#fafaf8", canvas:"#f7f6f2",
  green50:"#EAF3DE", green700:"#3B6D11", greenBorder:"#C0DD97",
  blue50:"#E6F1FB",  blue700:"#185FA5",  blueBorder:"#B5D4F4",
  amber50:"#FAEEDA", amber700:"#854F0B", amberBorder:"#FAC775",
  violet50:"#F0EAFA",violet700:"#5B21B6",violetBorder:"#C4B5FD",
  cyan50:"#E0F9F9",  cyan700:"#0E7490",  cyanBorder:"#A5F3FC",
  red50:"#FCEBEB",   red800:"#791F1F",   redBorder:"#F7C1C1",
  teal50:"#E6FFFA",  teal700:"#0F766E",  tealBorder:"#5EEAD4",
};
```

**Shared style primitives:**
```js
const inp   = { width:"100%", padding:"9px 11px", border:`1px solid ${c.borderMid}`, borderRadius:8, background:c.white, color:c.ink, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
const ta    = { ...inp, resize:"none", lineHeight:1.55 };
const sel   = { ...inp, appearance:"none" };
const btnP  = { padding:"10px 22px", borderRadius:8, background:c.ink, color:c.white, border:"none", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" };
const btnSm = { padding:"7px 16px", borderRadius:7, background:c.ink, color:c.white, border:"none", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit" };
const btnSec= { padding:"9px 18px", borderRadius:8, background:"transparent", color:c.muted, border:`1px solid ${c.borderMid}`, fontSize:13, cursor:"pointer", fontFamily:"inherit" };
const btnG  = { padding:"7px 12px", borderRadius:7, background:"transparent", color:c.muted, border:"none", fontSize:12, cursor:"pointer", fontFamily:"inherit" };
const fl    = { fontSize:12, fontWeight:500, color:c.ink, marginBottom:5, display:"flex", alignItems:"center", gap:6 };
const fh    = { fontSize:11, color:c.hint, marginBottom:6, fontStyle:"italic", lineHeight:1.45 };
const badg  = { fontSize:10, padding:"1px 6px", borderRadius:4, background:"#f0f0ee", color:c.faint };
```

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
| Add an input | Add a signal |

**Nav labels, headings, sidebar items, empty states, and stat cards always use the left-hand column.** Internal variable names, prop names, file names, and database column names use whatever is most stable — do not rename existing code constructs just to match display labels.

**Cluster subtypes:** `Trend | Driver | Tension`
**Scenario archetypes:** `Continuation | Collapse | Constraint | Transformation`
**Input subtypes:** `Signal | Issue | Projection | Plan | Obstacle`
**Signal Quality values:** `Emerging | Established | Confirmed`

---

## Key product decision — Projects are mandatory

**Projects are mandatory. Clusters and System Maps only exist within a Project.**

- The Inbox holds inputs that have not yet been assigned to a project (`project_id === null`). It is a workspace-level screen.
- Clustering and System Map are project-scoped screens. They only appear in the sidebar when a project is active.
- The sidebar PROJECT section (label "PROJECT", items: Inputs / Clustering / System Map) is only visible when `activeProjectId` is set.
- At workspace level (Dashboard, Inbox, no active project) the sidebar shows only: Dashboard, Inbox, Projects. No Clustering. No System Map.
- Navigating to Dashboard or Inbox via the sidebar clears the active project context.
- The Dashboard stats strip shows workspace-level counts only: Projects and Inputs in Inbox. Per-project cluster/system counts appear on each project card, not in the global strip.

---

## App architecture — how the SPA must be structured

### State
All app state lives in a single `useAppState` hook (or context) at the root level. Never use prop drilling more than 2 levels deep. State shape:

```js
{
  user: { name, email, level, domains, purpose },
  inputs: [],        // all inputs across all projects
  clusters: [],      // all clusters
  scenarios: [],     // all scenarios
  projects: [],      // all projects
  activeProjectId: null,
  activeScreen: 'dashboard',  // 'dashboard' | 'inbox' | 'project' | 'clustering' | 'canvas'
  drawer: null,      // null | { type: 'newInput' | 'newCluster' | 'inputDetail' | 'clusterDetail', data: {} }
  toast: null,       // null | { message, type: 'success' | 'error' }
}
```

### Navigation
The sidebar drives all navigation. Clicking a sidebar item calls `setActiveScreen()`. No URL routing in v2 — navigation is state-driven via setActiveScreen().

### Drawers
Input creation, cluster creation, and detail views all open as slide-over drawers from the right. Never navigate to a separate page for these. The drawer overlays the current content with a semi-transparent backdrop.

### Toast notifications
Every save/create/delete action shows a brief toast (2 seconds, bottom-right). Use a single `Toast` component driven by `appState.toast`.

---

## Component file structure

```
src/
  main.jsx
  App.jsx                 ← root, holds all state, renders layout
  hooks/
    useAppState.js        ← all state logic
  components/
    layout/
      Sidebar.jsx         ← working navigation
      AppShell.jsx        ← sidebar + main content wrapper
      Drawer.jsx          ← slide-over drawer shell
      Toast.jsx           ← success/error notification
    screens/
      Dashboard.jsx
      Inbox.jsx
      ProjectDetail.jsx
      Clustering.jsx
      SystemMap.jsx
    inputs/
      InputCard.jsx       ← reusable input display card
      InputDrawer.jsx     ← new input / edit input form
      SeededSignalCard.jsx
    clusters/
      ClusterCard.jsx
      ClusterDrawer.jsx
    shared/
      Tag.jsx             ← QualityDot, HorizTag, ArchTag, SubtypeTag
      EmptyState.jsx
  data/
    seeds.js              ← SEEDED_SIGNALS_POOL, DOMAIN_META, sample INPUTS/CLUSTERS/SCENARIOS/PROJECTS
  styles/
    tokens.js             ← c{} object and shared style primitives
```

---

## Frontend design principles

When building UI, always:

- **Commit to the established aesthetic** — warm off-white backgrounds (`#f5f4f0`), ink black (`#111111`), subtle borders. This is a refined minimal tool, not a consumer app.
- **Typography** — use `-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif`. Avoid importing web fonts.
- **Density** — information-dense but not cramped. 12–13px for body/labels, 10–11px for metadata, 18–22px for page headings.
- **No generic AI aesthetics** — no purple gradients, no rounded pill everything, no card shadows on every element.
- **Interactions** — hover states on all clickable elements, smooth drawer transitions (300ms ease), subtle border changes on focus.
- **Empty states** — every list/section needs a proper empty state with a clear CTA, not just blank space.

---

## What is deferred to v3

The following are explicitly out of scope for v2. Do not scaffold, stub, or reference these in v2 code:

- Preferred Futures screen
- Strategic Options screen
- Scenario Narrative screen / Narrative Canvas
- Real-time collaboration
- Corpus ingestion
- Explore / social layer
- Slide deck generation (explicitly out of scope — not a deferral)

The Chrome extension is a separate surface and is handled independently of the main app build.

---

## Data model — entity schemas

These are the canonical field definitions. Always use these exact field names in state, components, and Supabase columns.

All tables carry `workspace_id` and (where applicable) `project_id` as a dual-key structure. `workspace_id` is 1:1 with the user account in v2 — there is no team/org layer yet.

### Input
```js
{
  id: string,              // uuid
  workspace_id: string,    // uuid — always present
  project_id: string|null, // null = lives in Inbox
  name: string,            // required
  description: string,     // optional
  source_url: string,      // optional
  subtype: string,         // 'Signal' | 'Issue' | 'Projection' | 'Plan' | 'Obstacle'
  steepled: string[],      // subset of ['Social','Technological','Economic','Environmental','Political','Legal','Ethical','Demographic']
  signal_quality: string,  // 'Emerging' | 'Established' | 'Confirmed'
  horizon: string,         // 'H1' | 'H2' | 'H3'
  metadata: object,        // JSONB — subtype-specific fields
  created_at: string,      // ISO date
  is_seeded: boolean,      // true = came from onboarding cold-start pool
}
```

### Project
```js
{
  id: string,
  workspace_id: string,    // uuid — always present
  name: string,            // required
  domain: string,          // from DOMAINS list
  question: string,        // key inquiry question
  focus: string,           // focus of analysis (formerly 'unit')
  geo: string,             // geographic scope
  h1_start: string, h1_end: string,  // e.g. '2025', '2028'
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
  workspace_id: string,    // uuid — always present
  project_id: string,
  name: string,
  subtype: string,         // 'Trend' | 'Driver' | 'Tension'
  horizon: string,         // 'H1' | 'H2' | 'H3'
  description: string,
  input_ids: string[],     // inputs assigned to this cluster
  likelihood: string,      // 'Possible' | 'Plausible' | 'Probable'
  created_at: string,
}
```

### Scenario
```js
{
  id: string,
  workspace_id: string,    // uuid — always present
  project_id: string,
  name: string,
  archetype: string,       // 'Continuation' | 'Collapse' | 'Constraint' | 'Transformation'
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
- Cluster subtypes: **Trend, Driver, Tension** (Enabler was removed)
- Scenario archetypes: **Continuation, Collapse, Constraint, Transformation**
- Signal Quality: **Emerging, Established, Confirmed** — a single field replacing the previous separate Signal Strength and Source Confidence fields
- Inbox is the default container — `project_id: null` means "in Inbox"
- Workspace is 1:1 with user account in v2 — no team/org layer yet
- Real-time collaboration deferred to v3
- Analysis mode (Quick Scan / Deep Analysis toggle) removed entirely — do not reference `mode` on Projects
- Slide deck generation explicitly out of scope (not a deferral)
- Chrome extension is a separate surface, not part of the main app build