"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { playSound } from "@/lib/sound-manager";

export default function AdminEntryPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const verify = async () => {
      const response = await fetch("/api/admin/session", { cache: "no-store" });
      const data = await response.json().catch(() => null);

      if (response.ok && data?.unlocked) {
        router.replace("/admin");
        return;
      }

      if (data.configured === false) {
        setStatus("Admin password is not configured on the server.");
      }

      setChecking(false);
    };

    verify();
  }, [router]);

  const handleUnlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    playSound("button_press");
    setStatus("");
    setLoading(true);

    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setStatus(data.error ?? "Unable to unlock admin console.");
      return;
    }

    playSound("auth_success");
    router.replace("/admin");
  };

  if (checking) {
    return (
      <main className="page-shell min-h-screen flex items-center justify-center">
        <div className="card max-w-lg w-full space-y-2">
          <p className="label">ADMIN CHECKPOINT</p>
          <h1 className="text-2xl font-semibold">Preparing secure console...</h1>
          <p className="text-sm text-(--text-muted)">Please wait.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell min-h-screen flex items-center justify-center">
      <div className="w-full max-w-xl card relative auth-card-glow">
        <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-(--accent)" />
        <p className="label flex items-center gap-2 text-(--accent)">
          ADMIN CHECKPOINT
          <span className="inline-block w-1.5 h-1.5 bg-(--accent) auth-pulse-dot" />
        </p>
        <h1 className="font-headline text-4xl md:text-5xl font-black uppercase leading-tight auth-title-tight">
          UNLOCK / ADMIN / CONSOLE
        </h1>
        <p className="label auth-center-label">ADMIN PASSWORD REQUIRED</p>

        <form onSubmit={handleUnlock} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="admin-password" className="auth-label">
              Admin password
            </label>
            <div className="auth-password-wrap">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                className="input-field input-field-sensitive"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter admin password"
                required
                autoComplete="current-password"
              />
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

          {status && <p className="text-sm text-(--text-muted)">{status}</p>}

          <button className="button-primary w-full" type="submit" disabled={loading}>
            {loading ? "VERIFYING ACCESS..." : "ENTER ADMIN CONSOLE"}
          </button>
        </form>
      </div>
    </main>
  );
}
