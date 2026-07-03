import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../src/types/database.types";
import { chromeLocalAuthStorage } from "./chromeAuthStorage.js";

export function createExtensionSupabase(supabaseUrl: string, supabaseAnonKey: string) {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: chromeLocalAuthStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
