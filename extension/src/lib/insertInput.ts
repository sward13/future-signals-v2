import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../src/types/database.types";
import { cleanUrl } from "../utils/cleanUrl.js";
import type { InputSubtypeId, SignalStrengthId, SourceConfidenceId } from "../constants.js";

export type InsertInputParams = {
  workspaceId: string;
  name: string;
  description: string;
  sourceUrlRaw: string;
  subtype: InputSubtypeId;
  /** null → Inbox */
  projectId: string | null;
  /** Optional practitioner-set fields — no default, null means unset. */
  signalStrength: SignalStrengthId | null;
  sourceConfidence: SourceConfidenceId | null;
  metadata: Record<string, unknown>;
};

/**
 * Inserts an input row, then requests embedding in the background.
 * Embedding errors are swallowed so the user still sees a successful save.
 */
export async function insertInputAndRequestEmbed(
  supabase: SupabaseClient<Database>,
  params: InsertInputParams,
): Promise<{ ok: true; inputId: string } | { ok: false; message: string }> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const cleaned = cleanUrl(params.sourceUrlRaw);

  const row: Database["public"]["Tables"]["inputs"]["Insert"] = {
    id,
    workspace_id: params.workspaceId,
    name: params.name.trim(),
    description: params.description.trim() || "",
    source_url: cleaned || null,
    subtype: params.subtype,
    steepled: [],
    horizon: null,
    project_id: params.projectId,
    is_seeded: false,
    signal_strength: params.signalStrength,
    source_confidence: params.sourceConfidence,
    metadata: params.metadata,
    created_at: now,
  };

  const { error } = await supabase.from("inputs").insert(row);
  if (error) {
    return { ok: false, message: error.message || "Failed to save input." };
  }

  void supabase.functions.invoke("embed-input", { body: { input_id: id } }).catch(() => {});

  return { ok: true, inputId: id };
}
