#!/usr/bin/env node
// Standalone CLI runner for publishProject (server-lib/publish-project.js).
// Not wired into the product yet — the section-picker UI / Publish button is a
// follow-up. This is the "invocable without new UI" entry point.
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
// (bare names, not VITE_-prefixed — see CLAUDE.md "Environment variable
// conventions"). Run with:
//   node --env-file=.env.local scripts/publish-project.js --project <projectId>
// or export the two vars in your shell first and drop --env-file.

import { parseArgs } from "node:util";
import { publishProject } from "../server-lib/publish-project.js";

const { values } = parseArgs({
  options: {
    project: { type: "string" },
  },
});

if (!values.project) {
  console.error("Usage: node scripts/publish-project.js --project <projectId>");
  process.exit(1);
}

try {
  const result = await publishProject(values.project);
  console.log(result.isRepublish ? "Republished." : "Published.");
  console.log(`  slug:        ${result.slug}`);
  console.log(`  storagePath: ${result.storagePath}`);
  if (result.publicUrl) console.log(`  publicUrl:   ${result.publicUrl}`);
} catch (err) {
  console.error(`Publish failed: ${err.message}`);
  process.exit(1);
}
