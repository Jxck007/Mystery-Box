"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

function AuthContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/";
  const [email, setEmail] = useState("");
  const [rescueLink, setRescueLink] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const callbackUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const origin = window.location.origin;
    const target = encodeURIComponent(redirectTo);
    return `${origin}/auth/callback?redirect=${target}`;
  }, [redirectTo]);

  const handleMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("");
    setLoading(true);

    const { error } = await supabaseBrowser.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl },
    });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    setStatus("Magic link sent. Check your email.");
    setLoading(false);
  };

  return (
    <>
      <div className="page-hero">
        <p className="label">Secure access</p>
        <h1 className="title">Sign in with email</h1>
        <p className="subtitle">
          Use a magic link to unlock team creation and joining.
        </p>
      </div>

      <div className="card space-y-4 max-w-lg">
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-200" htmlFor="auth-email">
              Email address
            </label>
            <input
              id="auth-email"
              type="email"
              className="input-field"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          {status && <p className="text-sm text-slate-300">{status}</p>}

          <button className="button-primary w-full" type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send magic link"}
          </button>
        </form>

        <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 space-y-3">
          <p className="text-sm text-slate-300">
            If email fails, ask the admin for a rescue link and open it below.
          </p>
          <input
            className="input-field"
            value={rescueLink}
            onChange={(event) => setRescueLink(event.target.value)}
            placeholder="Paste rescue link"
          />
          <a
            className="button-muted inline-flex items-center justify-center"
            href={rescueLink || "#"}
            onClick={(event) => {
              if (!rescueLink) {
                event.preventDefault();
              }
            }}
          >
            Open rescue link
          </a>
        </div>
      </div>
    </>
  );
}

export default function AuthPage() {
  return (
    <main className="page-shell">
      <Suspense
        fallback={
          <div className="card space-y-2 max-w-lg">
            <p className="label">Secure access</p>
            <h1 className="text-2xl font-semibold">Preparing login...</h1>
            <p className="text-sm text-slate-300">Please wait.</p>
          </div>
        }
      >
        <AuthContent />
      </Suspense>
    </main>
  );
}
