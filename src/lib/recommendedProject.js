/**
 * getRecommendedProject — resolves the single project that the "Add" action
 * (and the "Best match" / suggested-project surfaces) should target.
 *
 * `inputs.metadata.suggested_projects` is persisted score-descending by
 * api/score.js. We still filter to live (non-deleted) projects and pick the
 * highest-scoring survivor — mirroring the computation Inbox.jsx used inline
 * (filter to live → sort by score desc → first) so a since-deleted top
 * suggestion falls through to the next surviving one rather than pointing at a
 * dead id.
 *
 * Returns the live project object (so callers get its *current* name + domain,
 * not the possibly-stale copy stored in metadata), or null when no suggestion
 * survives.
 *
 * @param {Array<{id: string, name?: string, score?: number}>|null|undefined} suggestedProjects
 * @param {Array<{id: string}>|null|undefined} projects  live (non-deleted) projects
 * @returns {object|null} the live project object, or null
 */
export function getRecommendedProject(suggestedProjects, projects) {
  if (!Array.isArray(suggestedProjects) || suggestedProjects.length === 0) return null;
  if (!Array.isArray(projects) || projects.length === 0) return null;

  const live = suggestedProjects
    .map((sp) => ({ score: sp?.score ?? 0, project: projects.find((p) => p.id === sp?.id) }))
    .filter((x) => x.project);

  if (live.length === 0) return null;

  live.sort((a, b) => b.score - a.score);
  return live[0].project;
}
