import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../src/types/database.types";
import { chromeLocalAuthStorage } from "./chromeAuthStorage.js";

export function createExtensionSupabase(supabaseUrl: string, supabaseAnonKey: string) {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: chromeLocalAuthStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Required so the Supabase client picks up the recovery token that
      // arrives in the URL when a "reset your password" email link opens
      // this side panel (chrome-extension://<id>/sidepanel.html#access_token=...&type=recovery).
      // Without this, the client ignores the token and getSession() just
      // returns null — the password-reset flow never completes. This only
      // ever matters on that one redirect path: opening the panel normally
      // (toolbar click) has no URL params for it to detect.
      detectSessionInUrl: true,
    },
  });
}
