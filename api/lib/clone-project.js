// Project clone utility — service-role only.
//
// Clones a project's full table graph into a new project in a (possibly
// different) workspace, generating a fresh UUID per row and remapping every
// FK reference to the new ids. This is the project-wide equivalent of the
// duplicate_input_to_cluster RPC (supabase/migrations/20260623_duplicate_input_to_cluster.sql,
// hardened 20260705090000_duplicate_input_dest_cluster_check.sql) — same
// approach (gen new id per row, remap references, no shared mutable state),
// applied across ~13 tables instead of one row.
//
// It does NOT reuse that RPC directly: it's single-row and scoped to a
// single workspace by design (checks workspaces.user_id = auth.uid()),
// which is the wrong shape here — this needs to read a source project in one
// workspace and write into a different one. RLS on every project-scoped
// table denies exactly that for a normal authenticated session (see
// supabase/migrations/20260705110000_scanner_tables_schema.sql's policies,
// and the standard workspace_id = get_workspace_id() pattern on the rest),
// so this runs as SUPABASE_SERVICE_ROLE_KEY, matching api/scan.js,
// api/score.js, and api/seed-onboarding.js. It cannot be a client-invoked
// RPC.
//
// sources and candidates (global, url-unique registries) are never cloned.
// project_sources / project_candidates are cloned only when
// options.includeProjectSources is true, and always point at the existing
// shared source_id / candidate_id — never new rows in those two tables.
//
// projects also carries an undocumented AFTER INSERT trigger,
// trg_auto_populate_project_sources (documented in
// 20260709140000_document_auto_populate_project_sources.sql), which
// auto-creates project_sources rows by domain match with opted_in hardcoded
// true — independent of and invisible to this file's own logic. Both branches
// of the project_sources/project_candidates step below account for it
// explicitly (purge-then-clone when includeProjectSources is true; a blanket
// neutralize when it's false) so scanning ends up off on every clone
// regardless of what the trigger did.

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Row-clone helper ──────────────────────────────────────────────────────
// Strips the old id, assigns a new one, applies overrides. When idMap is
// given, records old id -> new id so later tables can remap references to
// this row.
function cloneRow(row, idMap, overrides) {
  const newId = randomUUID();
  if (idMap) idMap.set(row.id, newId);
  const { id: _id, ...rest } = row;
  return { ...rest, id: newId, ...overrides };
}

// Remaps an array of ids (jsonb column or plain array column, neither
// FK-enforced) through idMap, dropping any id that doesn't resolve rather
// than erroring — matches the existing product convention of filtering
// stale references at read/write time instead of treating them as failures.
function remapIdArray(ids, idMap) {
  if (!Array.isArray(ids)) return ids;
  return ids.map((oldId) => idMap.get(oldId)).filter(Boolean);
}

async function insertMany(table, rows) {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw new Error(`[clone-project] insert into ${table} failed: ${error.message}`);
}

// Best-effort cleanup if a clone fails partway through — also reusable
// standalone to delete a completed clone (e.g. a failed test run), since a
// plain `DELETE FROM projects` would orphan its inputs instead of removing
// them. inputs.project_id is ON DELETE SET NULL (not CASCADE), so cloned
// inputs must be deleted explicitly — deleting them also cascades their
// cluster_inputs rows. Deleting the project cascades everything else
// (clusters, canvas nodes, relationships, scenarios, analyses,
// preferred_futures, strategic_options, cluster_suggestions,
// project_negative_pool, project_sources, project_candidates, and — via
// clusters/scenarios — scenario_clusters).
export async function rollback(newProjectId, clonedInputIds) {
  try {
    if (clonedInputIds.length > 0) {
      await supabase.from('inputs').delete().in('id', clonedInputIds);
    }
    await supabase.from('projects').delete().eq('id', newProjectId);
  } catch (cleanupErr) {
    console.error('[clone-project] rollback failed — manual cleanup needed for project', newProjectId, cleanupErr);
  }
}

/**
 * Clone a project's full table graph into a new project.
 *
 * @param {string} sourceProjectId - project to clone from
 * @param {string} destWorkspaceId - workspace to create the clone in
 * @param {object} [options]
 * @param {boolean} [options.includeProjectSources=false] - also clone
 *   project_sources and project_candidates, pointing at the existing shared
 *   source_id/candidate_id rows. Use for template creation; leave false for
 *   per-user clones (scanning is off on those regardless).
 * @param {boolean} [options.isSampleTemplate=false] - sets projects.is_sample_template
 *   on the clone. True only for the one-time John's-project -> templates-account copy.
 * @param {string|null} [options.sourceTemplateId=null] - sets projects.source_template_id
 *   on the clone. Set to the templates account's project id for a per-user
 *   clone; leave null for template creation.
 * @returns {Promise<{project: object, counts: object}>}
 */
export async function cloneProject(sourceProjectId, destWorkspaceId, options = {}) {
  const {
    includeProjectSources = false,
    isSampleTemplate = false,
    sourceTemplateId = null,
  } = options;

  const { data: destWorkspace, error: destWsError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', destWorkspaceId)
    .single();
  if (destWsError || !destWorkspace) {
    throw new Error(`[clone-project] destination workspace not found: ${destWorkspaceId}`);
  }

  const { data: sourceProject, error: sourceProjectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', sourceProjectId)
    .single();
  if (sourceProjectError || !sourceProject) {
    throw new Error(`[clone-project] source project not found: ${sourceProjectId}`);
  }

  const newProjectId = randomUUID();
  const clonedInputIds = []; // tracked separately for rollback (see note above)

  try {
    // ── 1. projects ──────────────────────────────────────────────────────
    const { id: _pid, workspace_id: _pws, created_at: _pcreated,
      last_reviewed_at: _lra, last_visited_at: _lva, scanning_enabled: _se,
      ...projectFields } = sourceProject;

    const newProject = {
      ...projectFields,
      id: newProjectId,
      workspace_id: destWorkspaceId,
      created_at: new Date().toISOString(),
      last_reviewed_at: null,
      last_visited_at: null,
      scanning_enabled: false, // always off on a clone — see PRD "Decisions made"
      is_sample_template: isSampleTemplate,
      source_template_id: sourceTemplateId,
    };

    const { data: insertedProject, error: projectInsertError } = await supabase
      .from('projects')
      .insert(newProject)
      .select()
      .single();
    if (projectInsertError) throw new Error(`[clone-project] insert into projects failed: ${projectInsertError.message}`);

    // ── 2. inputs ────────────────────────────────────────────────────────
    const inputIdMap = new Map();
    const { data: sourceInputs, error: inputsError } = await supabase
      .from('inputs')
      .select('*')
      .eq('project_id', sourceProjectId);
    if (inputsError) throw new Error(`[clone-project] read inputs failed: ${inputsError.message}`);

    const newInputs = (sourceInputs ?? []).map((row) =>
      cloneRow(row, inputIdMap, { workspace_id: destWorkspaceId, project_id: newProjectId })
    );
    await insertMany('inputs', newInputs);
    clonedInputIds.push(...newInputs.map((r) => r.id));

    // ── 3. clusters ──────────────────────────────────────────────────────
    const clusterIdMap = new Map();
    const { data: sourceClusters, error: clustersError } = await supabase
      .from('clusters')
      .select('*')
      .eq('project_id', sourceProjectId);
    if (clustersError) throw new Error(`[clone-project] read clusters failed: ${clustersError.message}`);

    const newClusters = (sourceClusters ?? []).map((row) =>
      cloneRow(row, clusterIdMap, { workspace_id: destWorkspaceId, project_id: newProjectId })
    );
    await insertMany('clusters', newClusters);

    // ── 4. cluster_inputs (transitive via cluster_id) ───────────────────
    const sourceClusterIds = (sourceClusters ?? []).map((c) => c.id);
    let newClusterInputs = [];
    if (sourceClusterIds.length > 0) {
      const { data: sourceClusterInputs, error: ciError } = await supabase
        .from('cluster_inputs')
        .select('*')
        .in('cluster_id', sourceClusterIds);
      if (ciError) throw new Error(`[clone-project] read cluster_inputs failed: ${ciError.message}`);

      newClusterInputs = (sourceClusterInputs ?? [])
        .filter((row) => clusterIdMap.has(row.cluster_id) && inputIdMap.has(row.input_id))
        .map((row) =>
          cloneRow(row, null, {
            workspace_id: destWorkspaceId,
            cluster_id: clusterIdMap.get(row.cluster_id),
            input_id: inputIdMap.get(row.input_id),
          })
        );
      await insertMany('cluster_inputs', newClusterInputs);
    }

    // ── 5. scenarios ─────────────────────────────────────────────────────
    const scenarioIdMap = new Map();
    const { data: sourceScenarios, error: scenariosError } = await supabase
      .from('scenarios')
      .select('*')
      .eq('project_id', sourceProjectId);
    if (scenariosError) throw new Error(`[clone-project] read scenarios failed: ${scenariosError.message}`);

    const newScenarios = (sourceScenarios ?? []).map((row) =>
      // cluster_ids intentionally left as-is: legacy column, superseded by
      // scenario_clusters, not read anywhere (see CLAUDE.md).
      cloneRow(row, scenarioIdMap, { workspace_id: destWorkspaceId, project_id: newProjectId })
    );
    await insertMany('scenarios', newScenarios);

    // ── 6. scenario_clusters (transitive via scenario_id/cluster_id) ────
    const sourceScenarioIds = (sourceScenarios ?? []).map((s) => s.id);
    let newScenarioClusters = [];
    if (sourceScenarioIds.length > 0) {
      const { data: sourceScenarioClusters, error: scError } = await supabase
        .from('scenario_clusters')
        .select('*')
        .in('scenario_id', sourceScenarioIds);
      if (scError) throw new Error(`[clone-project] read scenario_clusters failed: ${scError.message}`);

      newScenarioClusters = (sourceScenarioClusters ?? [])
        .filter((row) => scenarioIdMap.has(row.scenario_id) && clusterIdMap.has(row.cluster_id))
        .map((row) =>
          cloneRow(row, null, {
            workspace_id: destWorkspaceId,
            scenario_id: scenarioIdMap.get(row.scenario_id),
            cluster_id: clusterIdMap.get(row.cluster_id),
          })
        );
      await insertMany('scenario_clusters', newScenarioClusters);
    }

    // ── 7. relationships ─────────────────────────────────────────────────
    const { data: sourceRelationships, error: relError } = await supabase
      .from('relationships')
      .select('*')
      .eq('project_id', sourceProjectId);
    if (relError) throw new Error(`[clone-project] read relationships failed: ${relError.message}`);

    const newRelationships = (sourceRelationships ?? [])
      .filter((row) => clusterIdMap.has(row.from_cluster_id) && clusterIdMap.has(row.to_cluster_id))
      .map((row) =>
        cloneRow(row, null, {
          workspace_id: destWorkspaceId,
          project_id: newProjectId,
          from_cluster_id: clusterIdMap.get(row.from_cluster_id),
          to_cluster_id: clusterIdMap.get(row.to_cluster_id),
        })
      );
    await insertMany('relationships', newRelationships);

    // ── 8. canvas_nodes ──────────────────────────────────────────────────
    const { data: sourceCanvasNodes, error: cnError } = await supabase
      .from('canvas_nodes')
      .select('*')
      .eq('project_id', sourceProjectId);
    if (cnError) throw new Error(`[clone-project] read canvas_nodes failed: ${cnError.message}`);

    const newCanvasNodes = (sourceCanvasNodes ?? [])
      .filter((row) => clusterIdMap.has(row.cluster_id))
      .map((row) =>
        cloneRow(row, null, {
          workspace_id: destWorkspaceId,
          project_id: newProjectId,
          cluster_id: clusterIdMap.get(row.cluster_id),
        })
      );
    await insertMany('canvas_nodes', newCanvasNodes);

    // ── 9. canvas_text_nodes ─────────────────────────────────────────────
    const { data: sourceCanvasTextNodes, error: ctnError } = await supabase
      .from('canvas_text_nodes')
      .select('*')
      .eq('project_id', sourceProjectId);
    if (ctnError) throw new Error(`[clone-project] read canvas_text_nodes failed: ${ctnError.message}`);

    const newCanvasTextNodes = (sourceCanvasTextNodes ?? []).map((row) =>
      cloneRow(row, null, { workspace_id: destWorkspaceId, project_id: newProjectId })
    );
    await insertMany('canvas_text_nodes', newCanvasTextNodes);

    // ── 10. analyses (0 or 1 row — project_id is unique) ────────────────
    const { data: sourceAnalysis, error: analysisError } = await supabase
      .from('analyses')
      .select('*')
      .eq('project_id', sourceProjectId)
      .maybeSingle();
    if (analysisError) throw new Error(`[clone-project] read analyses failed: ${analysisError.message}`);

    const newAnalyses = sourceAnalysis
      ? [cloneRow(sourceAnalysis, null, { workspace_id: destWorkspaceId, project_id: newProjectId })]
      : [];
    await insertMany('analyses', newAnalyses);

    // ── 11. preferred_futures ────────────────────────────────────────────
    const { data: sourcePreferredFutures, error: pfError } = await supabase
      .from('preferred_futures')
      .select('*')
      .eq('project_id', sourceProjectId);
    if (pfError) throw new Error(`[clone-project] read preferred_futures failed: ${pfError.message}`);

    const newPreferredFutures = (sourcePreferredFutures ?? []).map((row) =>
      cloneRow(row, null, {
        workspace_id: destWorkspaceId,
        project_id: newProjectId,
        scenario_ids: remapIdArray(row.scenario_ids, scenarioIdMap),
      })
    );
    await insertMany('preferred_futures', newPreferredFutures);

    // ── 12. strategic_options ────────────────────────────────────────────
    const { data: sourceStrategicOptions, error: soError } = await supabase
      .from('strategic_options')
      .select('*')
      .eq('project_id', sourceProjectId);
    if (soError) throw new Error(`[clone-project] read strategic_options failed: ${soError.message}`);

    const newStrategicOptions = (sourceStrategicOptions ?? []).map((row) =>
      cloneRow(row, null, {
        workspace_id: destWorkspaceId,
        project_id: newProjectId,
        scenario_ids: remapIdArray(row.scenario_ids, scenarioIdMap),
      })
    );
    await insertMany('strategic_options', newStrategicOptions);

    // ── 13. cluster_suggestions ──────────────────────────────────────────
    const { data: sourceClusterSuggestions, error: csError } = await supabase
      .from('cluster_suggestions')
      .select('*')
      .eq('project_id', sourceProjectId);
    if (csError) throw new Error(`[clone-project] read cluster_suggestions failed: ${csError.message}`);

    const newClusterSuggestions = (sourceClusterSuggestions ?? []).map((row) =>
      cloneRow(row, null, {
        workspace_id: destWorkspaceId,
        project_id: newProjectId,
        input_ids: remapIdArray(row.input_ids, inputIdMap),
        target_cluster_id: row.target_cluster_id ? (clusterIdMap.get(row.target_cluster_id) ?? null) : null,
      })
    );
    await insertMany('cluster_suggestions', newClusterSuggestions);

    // ── 14. project_negative_pool (0 or 1 row — project_id is unique) ───
    const { data: sourceNegativePool, error: npError } = await supabase
      .from('project_negative_pool')
      .select('*')
      .eq('project_id', sourceProjectId)
      .maybeSingle();
    if (npError) throw new Error(`[clone-project] read project_negative_pool failed: ${npError.message}`);

    const newNegativePool = sourceNegativePool
      ? [cloneRow(sourceNegativePool, null, { project_id: newProjectId })]
      : [];
    await insertMany('project_negative_pool', newNegativePool);

    // ── 15/16. project_sources + project_candidates (opt-in) ────────────
    //
    // trg_auto_populate_project_sources (undocumented AFTER INSERT trigger on
    // projects — see 20260709140000_document_auto_populate_project_sources.sql)
    // already fired on the projects insert above and created its own
    // project_sources rows, matched by domain, with opted_in hardcoded true.
    // Both branches below have to account for that independently of anything
    // this function does on purpose.
    let newProjectSources = [];
    let newProjectCandidates = [];
    if (includeProjectSources) {
      // The trigger's guessed rows can collide on the (project_id, source_id)
      // unique constraint with the source project's real project_sources rows
      // we're about to clone — purge them first. End state should be an exact
      // structural copy of the source's project_sources, not a merge with
      // trigger-guessed rows.
      const { error: purgeError } = await supabase
        .from('project_sources')
        .delete()
        .eq('project_id', newProjectId);
      if (purgeError) throw new Error(`[clone-project] purge trigger-created project_sources failed: ${purgeError.message}`);

      const { data: sourceProjectSources, error: psError } = await supabase
        .from('project_sources')
        .select('*')
        .eq('project_id', sourceProjectId);
      if (psError) throw new Error(`[clone-project] read project_sources failed: ${psError.message}`);

      // source_id points at the existing shared row, never a new one.
      // opted_in forced false — scanning is off on every clone.
      newProjectSources = (sourceProjectSources ?? []).map((row) =>
        cloneRow(row, null, { project_id: newProjectId, opted_in: false })
      );
      await insertMany('project_sources', newProjectSources);

      const { data: sourceProjectCandidates, error: pcError } = await supabase
        .from('project_candidates')
        .select('*')
        .eq('project_id', sourceProjectId);
      if (pcError) throw new Error(`[clone-project] read project_candidates failed: ${pcError.message}`);

      // candidate_id points at the existing shared row, never a new one.
      newProjectCandidates = (sourceProjectCandidates ?? []).map((row) =>
        cloneRow(row, null, { project_id: newProjectId })
      );
      await insertMany('project_candidates', newProjectCandidates);
    } else {
      // Nothing else in this path touches project_sources, so a blanket
      // neutralize of whatever the trigger auto-created is safe — there's no
      // explicit clone to collide with here.
      const { error: neutralizeError } = await supabase
        .from('project_sources')
        .update({ opted_in: false })
        .eq('project_id', newProjectId);
      if (neutralizeError) throw new Error(`[clone-project] neutralize trigger-created project_sources failed: ${neutralizeError.message}`);
    }

    return {
      project: insertedProject,
      counts: {
        inputs: newInputs.length,
        clusters: newClusters.length,
        cluster_inputs: newClusterInputs.length,
        scenarios: newScenarios.length,
        scenario_clusters: newScenarioClusters.length,
        relationships: newRelationships.length,
        canvas_nodes: newCanvasNodes.length,
        canvas_text_nodes: newCanvasTextNodes.length,
        analyses: newAnalyses.length,
        preferred_futures: newPreferredFutures.length,
        strategic_options: newStrategicOptions.length,
        cluster_suggestions: newClusterSuggestions.length,
        project_negative_pool: newNegativePool.length,
        ...(includeProjectSources
          ? { project_sources: newProjectSources.length, project_candidates: newProjectCandidates.length }
          : {}),
      },
    };
  } catch (err) {
    await rollback(newProjectId, clonedInputIds);
    throw err;
  }
}
