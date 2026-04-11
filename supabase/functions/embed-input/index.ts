/**
 * embed-input — generates and stores an OpenAI embedding for a single input.
 * Also supports a batch mode (pass `batch: true`) that processes up to 50 inputs
 * with null embeddings — used for backfilling existing inputs.
 *
 * Required env vars: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });

  try {
    const body = await req.json();
    const { input_id, batch } = body;

    // ── Batch / backfill mode ──────────────────────────────────────────────────
    if (batch) {
      const { data: inputs, error } = await supabase
        .from("inputs")
        .select("id, name, description")
        .is("embedding", null)
        .limit(50);

      if (error) throw error;
      if (!inputs || inputs.length === 0) {
        return respond({ processed: 0 });
      }

      let processed = 0;
      for (const input of inputs) {
        await embedAndStore(supabase, openai, input);
        processed++;
      }
      return respond({ processed });
    }

    // ── Single input mode ──────────────────────────────────────────────────────
    if (!input_id) {
      return respond({ error: "input_id required" }, 400);
    }

    const { data: input, error } = await supabase
      .from("inputs")
      .select("id, name, description")
      .eq("id", input_id)
      .single();

    if (error || !input) {
      return respond({ error: "Input not found" }, 404);
    }

    await embedAndStore(supabase, openai, input);
    return respond({ ok: true });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return respond({ error: message }, 500);
  }
});

async function embedAndStore(
  supabase: ReturnType<typeof createClient>,
  openai: OpenAI,
  input: { id: string; name: string; description: string | null },
) {
  const text = [input.name, input.description].filter(Boolean).join(". ");
  if (!text.trim()) return;

  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  const embedding = res.data[0].embedding;

  const { error } = await supabase
    .from("inputs")
    .update({ embedding })
    .eq("id", input.id);

  if (error) throw error;
}

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
