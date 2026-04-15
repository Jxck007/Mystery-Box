import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

function resolveServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    ""
  );
}

export function createAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("Admin client must run on the server");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = resolveServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase URL (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL) or Supabase server key (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY / SUPABASE_SECRET_KEY)",
    );
  }

  if (serviceRoleKey.startsWith("sb_publishable_")) {
    throw new Error(
      "Invalid Supabase server key: publishable/anon key was provided where a service role/secret key is required",
    );
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  return cachedClient;
}
