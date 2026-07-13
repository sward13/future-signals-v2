export function requireExtensionEnv(): {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appOrigin: string;
} {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  const appOrigin = import.meta.env.VITE_APP_ORIGIN?.trim()?.replace(/\/$/, "");

  if (!supabaseUrl || !supabaseAnonKey || !appOrigin) {
    throw new Error(
      "Missing extension env vars. Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_APP_ORIGIN (see README).",
    );
  }

  return { supabaseUrl, supabaseAnonKey, appOrigin };
}
