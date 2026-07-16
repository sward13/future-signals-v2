import { createClient } from "@supabase/supabase-js";
import { createPublishHandler } from "../server-lib/publish-handler.js";

// Publishing renders + uploads the whole project; give it the same headroom as
// the other project-graph endpoints (clone-sample-project.js, seed-onboarding.js).
export const config = { maxDuration: 60 };

// Service-role client: used to verify the caller (Bearer token) and, once
// ownership is confirmed, to run the publish/unpublish pipeline.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default createPublishHandler({ supabase });
