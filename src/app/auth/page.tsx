"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { playSound } from "@/lib/sound-manager";

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setStatus("");
    setOauthLoading(true);
    const callbackUrl = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`;
    const { error } = await supabaseBrowser.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
      },
    });

    if (error) {
      setStatus(error.message);
      setOauthLoading(false);
    }
  };

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

      if (data.session) {
        await supabaseBrowser.auth.signOut();
      }

      setMode("signin");
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setStatus("Account created. Confirm your email, then sign in to continue.");
      setLoading(false);
      return;
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
      void playSound("Gotin", { bypassCooldown: true });
      router.replace("/team");
      return;
    }
    void playSound("Gotin", { bypassCooldown: true });
    router.replace(redirectTo);
  };

  return (
    <>
      <div className="w-full max-w-xl card relative auth-card-glow">
        <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-(--accent)" />
        <p className="label flex items-center gap-2 text-(--accent)">
          IDENTITY CHECKPOINT
          <span className="inline-block w-1.5 h-1.5 bg-(--accent) auth-pulse-dot" />
        </p>
        <h1 className="font-headline text-4xl md:text-5xl font-black uppercase leading-tight auth-title-tight">
          {mode === "signup" ? "CREATE / YOUR / PLAYER / ACCOUNT" : "SIGN IN / TO / MISSION / CONTROL"}
        </h1>
        <p className="label auth-center-label">use email and password</p>
        <div className="auth-flow-switch" aria-label="Authentication mode">
          <button
            type="button"
            className={`auth-flow-tab ${mode === "signin" ? "is-active" : ""}`}
            onClick={() => setMode("signin")}
          >
            01 SIGN IN
          </button>
          <button
            type="button"
            className={`auth-flow-tab ${mode === "signup" ? "is-active" : ""}`}
            onClick={() => setMode("signup")}
          >
            02 CREATE ACCOUNT
          </button>
        </div>
        <form onSubmit={handleAuth} className="space-y-5">
          {mode === "signup" && (
            <div className="space-y-2">
              <label htmlFor="auth-display-name" className="auth-label">Display name</label>
              <input
                id="auth-display-name"
                type="text"
                className="input-field input-field-sensitive"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Enter your display name"
                required
                autoComplete="nickname"
              />
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="auth-email" className="auth-label">Email address</label>
            <input
              id="auth-email"
              type="email"
              className="input-field input-field-sensitive"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="auth-password" className="auth-label">Password</label>
            <div className="auth-password-wrap">
              {mode === "signup" ? (
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  className="input-field input-field-sensitive"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              ) : (
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  className="input-field input-field-sensitive"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  autoComplete="current-password"
                />
              )}
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {mode === "signup" && (
            <div className="space-y-2">
              <label htmlFor="auth-confirm-password" className="auth-label">Confirm password</label>
              <div className="auth-password-wrap">
                <input
                  id="auth-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  className="input-field input-field-sensitive"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          )}
          {status && <p className="text-sm text-(--text-muted)">{status}</p>}
          <button className="button-primary w-full" type="submit" disabled={loading}>
            {loading ? "Securing your session..." : mode === "signup" ? "Create account" : "Enter dashboard"}
          </button>
          <button
            type="button"
            className="button-secondary w-full"
            onClick={handleGoogleSignIn}
            disabled={oauthLoading || loading}
          >
            {oauthLoading ? "Redirecting to Google..." : "Continue with Google"}
          </button>
        </form>
        <Link href="/" className="label text-(--text-muted)">
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
            <p className="label">IDENTITY CHECKPOINT</p>
            <h1 className="text-2xl font-semibold">Preparing login...</h1>
            <p className="text-sm text-(--text-muted)">Please wait.</p>
          </div>
        }
      >
        <AuthContent />
      </Suspense>
    </main>
  );
}
