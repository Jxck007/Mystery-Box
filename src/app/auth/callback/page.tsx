"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/";

  useEffect(() => {
    const finalize = async () => {
      await supabaseBrowser.auth.getSession();
      router.replace(redirectTo);
    };
    finalize();
  }, [redirectTo, router]);

  return (
    <div className="card space-y-2 max-w-lg">
      <p className="label">Signing in</p>
      <h1 className="text-2xl font-semibold">Finishing your login...</h1>
      <p className="text-sm text-slate-300">You can close this tab once redirected.</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <main className="page-shell">
      <Suspense fallback={
        <div className="card space-y-2 max-w-lg">
          <p className="label">Signing in</p>
          <h1 className="text-2xl font-semibold">Preparing your login...</h1>
          <p className="text-sm text-slate-300">Please wait.</p>
        </div>
      }
      >
        <AuthCallbackContent />
      </Suspense>
    </main>
  );
}
