Audit: Multiple System Maps per Project + System Analysis as Child Entity

1. Where a single System Map per project is assumed

Schema (this is the deepest lock-in):
- analyses.project_id has an isOneToOne: true FK to projects.id (per database.types.ts) — this is a DB-level uniqueness constraint, not just app convention. System Analysis is structurally 1:1 with project today, enforced by Postgres, not just by useAppState.js's .find().
- canvas_nodes (node x/y per cluster), canvas_text_nodes (free-text canvas annotations), and relationships (edges between clusters) are all keyed by project_id + workspace_id — none carry a map identifier. There is currently no system_maps table at all; "the map" is just "whatever canvas_nodes/relationships/canvas_text_nodes rows exist for this project_id."
- analyses.project_id is the only FK System Analysis has — no system_map_id column exists anywhere in the schema to relate it to a map.

App state (useAppState.js): canvasNodes, canvasTextNodes, relationships, analyses are all flat workspace-wide arrays fetched once, then filtered by project_id/projectId at the point of use (e.g. ScenarioCanvas.jsx:1824-1828, SystemAnalysisCanvas.jsx:238 uses .find() not .filter() — genuinely assumes ≤1 row).

Routing: No URL routing exists (state-driven nav per CLAUDE.md). activeScreen: "scenarios" → ScenarioCanvas.jsx and activeScreen: "analysis" → SystemAnalysisCanvas.jsx are fixed, parameterless destinations. There is no activeSystemMapId (or equivalent) anywhere in app state — introducing one is the structural equivalent of activeProjectId.

Sidebar/indicators (all singular, all binary):
- Sidebar.jsx:45-46 — "System Map" and "System Analysis" are two separate, parallel, project-level nav items, not parent/child. Making Analysis a child of Map is a bigger conceptual move than just "add multi-map" — it collapses today's 5-parallel-phase model (Scan/Cluster/System Map/System Analysis/Future Models) into a nested one for two of those five phases.
- ProjectOverview.jsx phase cards: "System Map" card (:407-425) and "System Analysis" card (:428-449) are likewise two separate cards, each with independent phaseStatusKey/resumeStage logic (latestMapTs, latestAnalysisTs, computed independently at :169,177).
- Dashboard.jsx:266-268,308-311 computes hasCanvas = canvasNodes.some(n => n.projectId === p.id) (workspace-wide project list) and pAnalyses = analyses.filter(a => a.project_id === p.id) as binary/count indicators per project.
- ExportModal.jsx:236 gates System Map export on activeScreen === "scenarios" (a fixed screen key); systemMapExportRef (useAppState.js:102) is a single singleton ref in app state assuming exactly one mounted canvas instance app-wide.

2. Cluster ownership: pool vs. map-owned

Clusters are unambiguously project pool, not map-owned:
- clusters table: project_id, workspace_id only — no map reference.
- canvas_nodes is effectively the join table between a map's canvas and the pool: (cluster_id, project_id, x, y). A cluster only appears "on the map" if a canvas_nodes row exists for it; not every project cluster necessarily has one (ScenarioCanvas.jsx:607-627 explicitly computes unaddedClusters = clusters.filter(cl => !nodeClusterIds.has(cl.id))).
- relationships (edges) reference from_cluster_id/to_cluster_id directly against the shared clusters table, scoped by project_id.
- Future Models (ScenarioForm.jsx:188) picks from clusters.filter(cl => cl.project_id === activeProjectId) — the whole pool, not anything canvas/map-specific. This means Future Models has no dependency on canvas_nodes/relationships and shouldn't need to change for multi-map support — worth confirming, but it looks like a natural boundary.

Implication for "cloning a map": cloning would need to copy canvas_nodes (positions), relationships (edges), canvas_text_nodes (annotations), and analyses (as new rows with new IDs) — but only reference clusters (same cluster rows, just placed onto a new canvas via new canvas_nodes rows pointing at the same cluster_ids). This mirrors the existing duplicate_input_to_cluster RPC pattern (new id, verified workspace ownership, SECURITY DEFINER) — see point 5.

Open question the audit surfaces but doesn't answer: if two maps both place the same cluster with different relationships, and a practitioner edits/deletes that cluster from one map's context, does it disappear from the other map too (since it's the same underlying row)? The product-level meaning of "delete cluster" vs. "remove cluster from this map" isn't distinguished anywhere in current code — deleteCluster unconditionally removes the pool row.

3. Resizable drawer/rail component reuse assessment

Correction to the premise: the resizable element only exists on the Cluster screen, not Scan. ProjectDetail.jsx (Scan) has no resize logic at all (grep for drawerHeight/resizeRef/row-resize returns zero hits there).

It's not a generic/extracted component — it's inline in ClusterScreen.jsx:
- Resize state (drawerHeight, resizing, resizeRef, mouse-move/up listeners, localStorage key "clusterDrawerHeight") lives directly in ClusterScreen.jsx:105-132.
- The rail's content (:382-450+) is hardcoded to inputs: "Inputs" label, a drop-zone with input-specific copy, FilterTabs for All/Unassigned/Clustered, an input search bar, and drag handlers (handleDrop, handleDropToNewCluster) that are cluster/input business logic passed in from the screen's own state.

Verdict: the mechanics (drag-to-resize height, min/max clamp, localStorage persistence) are trivially generic and worth extracting into a real shared component, but as it stands today there's nothing to "reuse" without that extraction — you'd be copy-pasting the resize plumbing into ScenarioCanvas.jsx/wherever a System-Map-hosting-System-Analysis drawer lives, then writing entirely new content (there's zero shared UI between an inputs rail and a System Analysis panel). This is genuinely new work, not a reuse.

4. Files touched by a system-maps-list screen sitting above System Map

Would need real changes:
- useAppState.js — new activeSystemMapId(or similar) state; new fetch/CRUD for a system_maps table; canvas_nodes/canvas_text_nodes/relationships/analyses fetch+filter logic all need a map-id dimension added; deleteSystemMap (currently project-scoped delete) needs to become map-scoped; new clone/list/create functions.
- App.jsx — new screen case(s), e.g. "system-maps-list", and "scenarios" (ScenarioCanvas) needs a map id passed through rather than being reachable directly from the sidebar.
- Sidebar.jsx:45 — "System Map" nav item currently routes straight to "scenarios"; needs to route to the new list screen instead (or conditionally, if only one map exists — a UX question, not just code).
- ScenarioCanvas.jsx — heaviest rework: every project_id/projectId filter (:1824-1828 and throughout) becomes a system_map_id filter instead/in addition; systemMapExportRef singleton likely fine as-is since only one instance mounts at a time, but worth re-checking once nested inside a list→detail flow.
- SystemAnalysisCanvas.jsx:238 — analyses.find(a => a.project_id === activeProjectId) becomes .find(a => a.system_map_id === activeSystemMapId); component currently expects to be reached directly, not nested under a map detail view.
- ProjectOverview.jsx — "System Map" and "System Analysis" phase cards (:407-449) currently show single-map/single-analysis aggregates; need redesigning for "N maps" and per-map analysis status, and resumeStage/latestMapTs/latestAnalysisTs computation logic.
- Dashboard.jsx:266-268,308-311 — hasCanvas boolean and analysis/scenario counts per project need to become map-aware (count of maps, or "has ≥1 map").
- ExportModal.jsx:190,236,257 — export gating (activeScreen === "scenarios") and markdown export need a specific map in context, not just a project.

Files that currently treat "the system map" as a fixed singular destination (i.e., assume no list/id ever needed): Sidebar.jsx PROJECT_ITEMS array, App.jsx switch statement, ProjectOverview.jsx phase card onClick={() => setActiveScreen("scenarios")}, Dashboard.jsx project-row navigation, ExportModal.jsx.

Likely untouched: ClusterScreen.jsx, ClustersPanel.jsx, ProjectDetail.jsx (Scan), FutureModels.jsx/ScenarioForm.jsx (Future Models draws from the project cluster pool, not the canvas — see point 2).

5. Existing precedent vs. genuinely new ground

Partial precedent:
- duplicate_input_to_cluster RPC (20260623_duplicate_input_to_cluster.sql) — the one existing "clone a record" pattern in the codebase: new UUID, created_at = now(), SECURITY DEFINER with explicit workspace-ownership check. This is the shape a "clone system map" RPC (bulk-copying canvas_nodes + relationships + canvas_text_nodes, and optionally analyses) would follow — but nothing today clones a set of related rows atomically, only a single row.
- deleteSystemMap/project-cascade delete (useAppState.js:1620-1656) already treats canvas_nodes/relationships/canvas_text_nodes as a coherent "reset" unit scoped by project_id — this logic maps directly onto "delete one map," just needs the scoping key swapped from project_id to a map id.

Genuinely new ground:
- No system_maps table, no clone-a-graph-of-related-rows operation, no list→detail navigation pattern anywhere in the app (all navigation today is flat: workspace-level list → single detail, never list → detail → sub-list → detail). The Dashboard→Project pattern is the closest analogue but Projects aren't cloneable either — there's no "duplicate project" feature to crib from.
- Nesting System Analysis under System Map (rather than as a sibling phase) has no precedent — it changes the phase model itself, which today is flat and parallel everywhere (sidebar order, phase cards, resumeStage computation all treat the 5 phases as siblings).
- Grants/RLS for a new system_maps table would need to follow the workspace_id-scoped get_workspace_id() pattern (per CLAUDE.md's documented convention) plus the explicit-grants requirement noted for tables created after the identified gap — routine, not risky, but is new migration work with no map-specific precedent to copy from.
