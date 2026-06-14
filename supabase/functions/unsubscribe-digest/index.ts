// unsubscribe-digest — one-click unsubscribe from the weekly signal digest.
// Linked directly from email clients (no Authorization header), so this
// function must be deployed with JWT verification disabled:
//   supabase functions deploy unsubscribe-digest --no-verify-jwt
//
// The token is HMAC-SHA256(user_id, UNSUBSCRIBE_SECRET) — it carries no user
// identity itself. The matching user is found by recomputing the signature
// for each user via admin.listUsers(), which is cheap at this user count.
//
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UNSUBSCRIBE_SECRET
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const LIST_USERS_PAGE_SIZE = 200;
const PLAIN = { "Content-Type": "text/plain; charset=utf-8" };

serve(async (req: Request) => {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return new Response("Missing unsubscribe token.", { status: 400, headers: PLAIN });
  }

  try {
    const userId = await findUserByToken(token);
    if (!userId) {
      return new Response("Invalid or expired unsubscribe link.", { status: 404, headers: PLAIN });
    }

    const { error } = await supabase
      .from("user_preferences")
      .upsert({ user_id: userId, digest_unsubscribed: true, updated_at: new Date().toISOString() });
    if (error) throw error;

    return new Response("You've been unsubscribed from the weekly signal digest.", { headers: PLAIN });
  } catch (err) {
    console.error("[unsubscribe-digest] failed:", err);
    return new Response("Something went wrong. Please try again later.", { status: 500, headers: PLAIN });
  }
});

async function findUserByToken(token: string): Promise<string | null> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(Deno.env.get("UNSUBSCRIBE_SECRET")!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: LIST_USERS_PAGE_SIZE });
    if (error) throw error;

    for (const user of data.users) {
      const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(user.id));
      const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
      if (hex === token) return user.id;
    }

    if (data.users.length < LIST_USERS_PAGE_SIZE) break;
    page++;
  }
  return null;
}
