import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../src/types/database.types";

export async function fetchWorkspaceIdForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.id) return null;
  return data.id;
}

export type ProjectRow = Pick<Database["public"]["Tables"]["projects"]["Row"], "id" | "name">;

export async function fetchProjects(supabase: SupabaseClient<Database>, workspaceId: string): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (error || !data) return [];
  return data;
}
