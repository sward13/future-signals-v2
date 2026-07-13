#!/usr/bin/env node
// Standalone CLI runner for cloneProject (server-lib/clone-project.js).
// Not wired into onboarding — for testing the template-creation and
// per-user-clone cases directly against staging/production.
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
// (bare names, not VITE_-prefixed — see CLAUDE.md "Environment variable
// conventions"). Run with:
//   node --env-file=.env.local scripts/clone-project.js --source <uuid> --dest-workspace <uuid> [flags]
// or export the two vars in your shell first and drop --env-file.
//
// Usage:
//   node scripts/clone-project.js --source <projectId> --dest-workspace <workspaceId> \
//     [--include-sources] [--sample-template] [--source-template-id <projectId>]
//
// Examples:
//   # Template creation: John's project -> templates account workspace
//   node --env-file=.env.local scripts/clone-project.js \
//     --source <johns-project-id> --dest-workspace <templates-account-workspace-id> \
//     --include-sources --sample-template
//
//   # Per-user clone: templates account's project -> new user's workspace
//   node --env-file=.env.local scripts/clone-project.js \
//     --source <template-project-id> --dest-workspace <new-user-workspace-id> \
//     --source-template-id <template-project-id>

import { parseArgs } from 'node:util';
import { cloneProject } from '../server-lib/clone-project.js';

const { values } = parseArgs({
  options: {
    'source':             { type: 'string' },
    'dest-workspace':     { type: 'string' },
    'include-sources':    { type: 'boolean', default: false },
    'sample-template':    { type: 'boolean', default: false },
    'source-template-id': { type: 'string' },
  },
});

if (!values.source || !values['dest-workspace']) {
  console.error('Usage: node scripts/clone-project.js --source <projectId> --dest-workspace <workspaceId> [--include-sources] [--sample-template] [--source-template-id <projectId>]');
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. Run with --env-file=.env.local or export them first.');
  process.exit(1);
}

try {
  const result = await cloneProject(values.source, values['dest-workspace'], {
    includeProjectSources: values['include-sources'],
    isSampleTemplate: values['sample-template'],
    sourceTemplateId: values['source-template-id'],
  });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error('[clone-project] failed:', err.message);
  process.exit(1);
}
