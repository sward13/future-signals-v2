/**
 * promotion-dedup — decides whether a scored candidate is already present in
 * the destination workspace, so api/score.js doesn't promote a duplicate into
 * its Inbox.
 *
 * Replaces a check that (a) searched `inputs` by source_url across EVERY
 * workspace and (b) used `.single()`, which errors on 2+ rows and was read as
 * "not found". Together these meant:
 *   - an article any other user already had was never promoted to you, and
 *   - an article you'd already added during onboarding was promoted AGAIN
 *     once a second copy existed anywhere (2 rows → .single() error → insert).
 *
 * A candidate counts as "already present" if the workspace has an input with
 * the same source_url OR the same metadata.candidate_id (onboarding stores the
 * candidate id; manually-added inputs only share the URL).
 *
 * Fails closed: a query error throws, so the caller skips the promotion rather
 * than risking a duplicate.
 */

/**
 * @param {object} supabase  service-role client (injectable for tests)
 * @param {{ workspaceId: string, sourceUrl?: string|null, candidateId?: string|null }} args
 * @returns {Promise<boolean>} true when the workspace already has this candidate
 */
export async function workspaceHasCandidate(supabase, { workspaceId, sourceUrl, candidateId }) {
  if (!workspaceId) throw new Error('workspaceHasCandidate: workspaceId is required');

  // Two separate equality queries rather than one `.or()` filter: source URLs
  // routinely contain commas/parentheses (e.g. Lancet PII URLs), which break
  // PostgREST's or() syntax.
  const checks = [];
  if (sourceUrl)   checks.push(['source_url', sourceUrl]);
  if (candidateId) checks.push(['metadata->>candidate_id', candidateId]);

  for (const [column, value] of checks) {
    const { data, error } = await supabase
      .from('inputs')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq(column, value)
      .limit(1);

    if (error) throw new Error(`dedup check on ${column} failed: ${error.message}`);
    if (data && data.length > 0) return true;
  }

  return false;
}
