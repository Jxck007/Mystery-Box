"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/create-team";
  const modeParam = searchParams.get("mode") ?? "signin";
  const [mode, setMode] = useState<"signin" | "signup">(
    modeParam === "signup" ? "signup" : "signin",
  );
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("");
    setLoading(true);

    if (mode === "signup") {
      if (!displayName.trim()) {
        setStatus("Please enter your display name.");
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setStatus("Passwords do not match.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabaseBrowser.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName.trim(),
          },
        },
      });

      if (error) {
        setStatus(error.message);
        setLoading(false);
        return;
      }

      if (!data.session) {
        setStatus("Check your email to confirm your account, then sign in.");
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabaseBrowser.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setStatus(error.message);
        setLoading(false);
        return;
      }
    }

    const { data } = await supabaseBrowser.auth.getSession();
    if (!data.session) {
      setStatus("Unable to start session. Try again.");
      setLoading(false);
      return;
    }
    const response = await fetch("/api/players/me", {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    setLoading(false);
    if (response.ok) {
      router.replace("/team");
      return;
    }
    router.replace(redirectTo);
  };

  return (
    <>
      <div
        className="w-full max-w-xl card relative"
        style={{
          background:
            "radial-gradient(circle, rgba(180,255,57,0.05), transparent 60%), var(--bg-container)",
        }}
      >
        <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-[var(--accent)]" />
        <p className="label flex items-center gap-2 text-[var(--accent)]">
          ENCRYPTED GATEWAY
          <span className="inline-block w-1.5 h-1.5 bg-[var(--accent)]" style={{ animation: "pulse-dot 1s ease-in-out infinite" }} />
        </p>
        <h1 className="font-headline text-4xl md:text-5xl font-black uppercase leading-tight" style={{ letterSpacing: "-0.04em" }}>
          {mode === "signup" ? "CREATE / YOUR / ACCESS / PROFILE" : "ENTER / YOUR / ACCESS / LINK"}
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`button-secondary text-xs ${mode === "signin" ? "border-[var(--accent)] text-[var(--accent)]" : ""}`}
            onClick={() => setMode("signin")}
          >
            SIGN IN
          </button>
          <button
            type="button"
            className={`button-secondary text-xs ${mode === "signup" ? "border-[var(--accent)] text-[var(--accent)]" : ""}`}
            onClick={() => setMode("signup")}
          >
            SIGN UP
          </button>
        </div>
        <form onSubmit={handleAuth} className="space-y-5">
          {mode === "signup" && (
            <input
              id="auth-display-name"
              type="text"
              className="input-field"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="DISPLAY NAME"
              required
            />
          )}
          <input
            id="auth-email"
            type="email"
            className="input-field"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="EMAIL"
            required
          />
          <input
            id="auth-password"
            type="password"
            className="input-field"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="PASSWORD"
            required
            minLength={6}
          />
          {mode === "signup" && (
            <input
              id="auth-confirm-password"
              type="password"
              className="input-field"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="CONFIRM PASSWORD"
              required
              minLength={6}
            />
          )}
          {status && <p className="text-sm text-[var(--text-muted)]">{status}</p>}
          <button className="button-primary w-full" type="submit" disabled={loading}>
            {loading ? "WORKING..." : mode === "signup" ? "CREATE_ACCOUNT" : "SIGN_IN"}
          </button>
        </form>
        <Link href="/" className="label text-[var(--text-muted)]">
          ← RETURN TO PUBLIC INTERFACE
        </Link>
      </div>
    </>
  );
}

export default function AuthPage() {
  return (
    <main className="page-shell min-h-screen flex items-center justify-center">
      <Suspense
        fallback={
          <div className="card space-y-2 max-w-lg w-full">
            <p className="label">ENCRYPTED GATEWAY</p>
            <h1 className="text-2xl font-semibold">Preparing login...</h1>
            <p className="text-sm text-[var(--text-muted)]">Please wait.</p>
          </div>
        }
      >
        <AuthContent />
      </Suspense>
    </main>
  );
}
