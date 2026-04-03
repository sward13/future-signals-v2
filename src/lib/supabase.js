/**
 * Supabase client — initialised once and exported for use across the app.
 * Reads credentials from VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY env vars.
 * Falls back to placeholder values so the module loads safely in offline/prototype mode;
 * all API calls will simply fail gracefully in that case.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     || "https://placeholder.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
