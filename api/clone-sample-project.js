import { createClient } from '@supabase/supabase-js';
import { cloneProject } from '../server-lib/clone-project.js';

// Cloning a full project graph (inputs, clusters, scenarios, etc.) can take
// longer than the default timeout — matches api/seed-onboarding.js.
export const config = { maxDuration: 60 };

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Per-user clone: templates account's sample project -> the caller's own
// workspace, at onboarding completion. Same auth pattern as
// api/seed-onboarding.js — Bearer token verified server-side, destination
// workspace derived from the verified user, never from the request. The
// source project is fixed via env var, never client-supplied: a client
// should never be able to specify which project gets cloned.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  const token = authHeader.slice(7);

  const sourceProjectId = process.env.SAMPLE_TEMPLATE_PROJECT_ID;
  if (!sourceProjectId) {
    console.error('[clone-sample-project] SAMPLE_TEMPLATE_PROJECT_ID not configured');
    return res.status(500).json({ error: 'Sample template not configured' });
  }

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorised' });

    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (wsError || !workspace) return res.status(401).json({ error: 'Workspace not found' });

    const { project } = await cloneProject(sourceProjectId, workspace.id, {
      includeProjectSources: false,
      isSampleTemplate: false,
      sourceTemplateId: sourceProjectId,
    });

    return res.status(200).json({ success: true, projectId: project.id });
  } catch (error) {
    console.error('[clone-sample-project]', error);
    return res.status(500).json({ error: error.message });
  }
}
