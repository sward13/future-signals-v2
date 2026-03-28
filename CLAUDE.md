# Future Signals v2 — Claude Code Instructions

## Project overview

Future Signals v2 is a strategic foresight SPA built with React + Vite + Tailwind. It guides practitioners through a Signals → Clusters → Scenarios methodology. This is a pre-build prototype phase — we are building a navigable, stateful SPA prototype to validate UX before the real Supabase-backed build.

**Stack:** React 18, Vite, React Flow (`@xyflow/react`), inline styles (no Tailwind yet in the prototype phase — we use the design token system below)

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
| Inbox | Collection |
| Add an input | Add a signal |
| Systems | Scenarios (in all navigation, headings, labels, and empty states) |

**Note on Systems / scenario:** The nav label, sidebar item, page headings, tab labels, stat cards, and empty states all read **Systems**. The underlying data entity and all internal variable/prop names remain `scenario` / `scenarios` — this is a label change only, not a data model rename. Do not rename variables, keys, file names, or component names.

---

## Key product decision — Projects are mandatory

**Projects are mandatory. Clusters and Systems only exist within a Project.**

- The Inbox holds inputs that have not yet been assigned to a project (`project_id === null`). It is a workspace-level screen.
- Clustering and Systems/Relationship Canvas are project-scoped screens. They only appear in the sidebar when a project is active.
- The sidebar PROJECT section (label "PROJECT", items: Inputs / Clustering / Systems) is only visible when `activeProjectId` is set.
- At workspace level (Dashboard, Inbox, no active project) the sidebar shows only: Dashboard, Inbox, Projects. No Clustering. No Systems.
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
  activeScreen: 'dashboard',  // 'dashboard' | 'inbox' | 'project' | 'clustering' | 'canvas' | 'narrative'
  drawer: null,      // null | { type: 'newInput' | 'newCluster' | 'inputDetail' | 'clusterDetail', data: {} }
  toast: null,       // null | { message, type: 'success' | 'error' }
}
```

### Navigation
The sidebar drives all navigation. Clicking a sidebar item calls `setActiveScreen()`. No URL routing needed in the prototype — just state.

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
      Inbox.jsx           ← PRIORITY — this is Pass 1's main deliverable
      ProjectDetail.jsx
      Clustering.jsx
      ScenarioCanvas.jsx
      NarrativeCanvas.jsx
    inputs/
      InputCard.jsx       ← reusable input display card
      InputDrawer.jsx     ← new input / edit input form
      SeededSignalCard.jsx
    clusters/
      ClusterCard.jsx
      ClusterDrawer.jsx
    shared/
      Tag.jsx             ← StrengthDot, HorizTag, ArchTag, SubtypeTag
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
- **Typography** — use `-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif`. Avoid importing web fonts in the prototype.
- **Density** — information-dense but not cramped. 12–13px for body/labels, 10–11px for metadata, 18–22px for page headings.
- **No generic AI aesthetics** — no purple gradients, no rounded pill everything, no card shadows on every element.
- **Interactions** — hover states on all clickable elements, smooth drawer transitions (300ms ease), subtle border changes on focus.
- **Empty states** — every list/section needs a proper empty state with a clear CTA, not just blank space.

---

## Pass 1 scope — what to build first

**Goal:** Working navigation shell + Inbox + persistent state. Everything else is secondary.

**Must work in Pass 1:**
1. Sidebar with clickable nav items (Dashboard, Inbox, Projects)
2. App state that persists across screen changes (navigate away and back — data stays)
3. **Inbox screen** — shows seeded signals from onboarding domains + any manually added inputs; "Save to Project" and "Dismiss" actions work
4. **"+ New Input" drawer** — opens from a button in the Inbox header, form fields per schema, saving adds the input to the inputs list and shows a toast
5. **Dashboard screen** — simplified version showing stats and projects list; "+ New Project" button exists
6. Toast notification component working for all save actions

**Out of scope for Pass 1:**
- Onboarding flow (already exists in reference prototype, wire up later)
- Clustering screen
- Scenario canvas
- Narrative canvas
- Project creation modal (stub it — button exists but can show "coming soon")

---

## Reference files

- `src/reference-prototype.jsx` — the previous single-file prototype. Mine this for: design tokens, sample data (SEEDED_SIGNALS_POOL, DOMAIN_META, INPUTS, CLUSTERS, SCENARIOS, PROJECTS), Tag components, SeededSignalCard, and onboarding flow code.
- `prototype-v1-feedback.md` — feedback document summarising what to fix. Reference this when making design decisions.

---

## Code quality rules

- No `console.log` left in committed code
- No hardcoded pixel values that aren't in the token system
- Every component gets a JSDoc comment at the top describing its purpose and props
- Prop types are not required in the prototype but all props should be named clearly
- Prefer named exports for components, default export for screens

---

## Data model — entity schemas for Pass 1

These are the canonical field definitions. Always use these exact field names in state and components.

### Input
```js
{
  id: string,              // uuid
  name: string,            // required
  description: string,     // optional
  source_url: string,      // optional
  subtype: string,         // 'article' | 'report' | 'data' | 'observation' | 'other'
  steepled: string[],      // subset of ['Social','Technological','Economic','Environmental','Political','Legal','Ethical','Demographic']
  strength: string,        // 'Weak' | 'Moderate' | 'High' — user-assigned
  horizon: string,         // 'H1' | 'H2' | 'H3'
  project_id: string|null, // null = lives in Inbox
  created_at: string,      // ISO date
  is_seeded: boolean,      // true = came from onboarding cold-start pool
}
```

### Project
```js
{
  id: string,
  name: string,            // required
  domain: string,          // from DOMAINS list
  question: string,        // key inquiry question
  unit: string,            // unit of analysis
  geo: string,             // geographic scope
  mode: string,            // 'quick_scan' | 'deep_analysis'
  h1_start: string, h1_end: string,  // e.g. '2025', '2028'
  h2_start: string, h2_end: string,
  h3_start: string, h3_end: string,
  assumptions: string,
  stakeholders: string,
  created_at: string,
}
```

### Cluster (stub for Pass 1 — full implementation in Pass 2)
```js
{
  id: string,
  name: string,
  subtype: string,         // 'Trend' | 'Driver' | 'Tension'
  horizon: string,         // 'H1' | 'H2' | 'H3'
  description: string,
  project_id: string,
  input_ids: string[],     // inputs assigned to this cluster
  likelihood: string,      // 'Possible' | 'Plausible' | 'Probable'
  created_at: string,
}
```

### Scenario (stub only in Pass 1)
```js
{
  id: string,
  name: string,
  archetype: string,       // 'Continuation' | 'Collapse' | 'Constraint' | 'Transformation'
  horizon: string,
  narrative: string,
  cluster_ids: string[],
  project_id: string,
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

Key decisions already made that affect the prototype:
- Cluster subtypes: **Trend, Driver, Tension** (Enabler was removed)
- Scenario archetypes: **Continuation, Collapse, Constraint, Transformation** (not Growth/Discipline/Disarray)
- Inbox is the default container — `project_id: null` means "in Inbox"
- Workspace is 1:1 with user account in v2 — no team/org layer yet
- Real-time collaboration deferred to v3
- Slide deck generation explicitly out of scope (not a deferral)
- Chrome extension is a separate surface, not part of the main app build
