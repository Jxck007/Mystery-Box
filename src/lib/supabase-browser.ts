import { createClient } from "@supabase/supabase-js";

type BrowserRuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
};

declare global {
  interface Window {
    __MYSTERY_BOX_ENV__?: BrowserRuntimeEnv;
  }
}

function resolveBrowserConfig() {
  const runtimeEnv = typeof window !== "undefined" ? window.__MYSTERY_BOX_ENV__ : undefined;
  const supabaseUrl =
    runtimeEnv?.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const supabaseAnonKey =
    runtimeEnv?.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase config. Set SUPABASE_URL and SUPABASE_ANON_KEY in the server environment or expose NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

const { supabaseUrl, supabaseAnonKey } = resolveBrowserConfig();

export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, detectSessionInUrl: true },
});
