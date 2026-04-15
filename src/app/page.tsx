"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { disableTestMode, enableTestMode, isTestModeEnabled } from "@/lib/test-mode";
import { playSound } from "@/lib/sound-manager";

export default function HomePage() {
  const TEMP_SITE_PASSWORD = "jack123";
  const [isAuthed, setIsAuthed] = useState(false);
  const [hasTeam, setHasTeam] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [unlockChecked, setUnlockChecked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [unlockError, setUnlockError] = useState("");

  useEffect(() => {
    const isUnlocked = localStorage.getItem("site-unlocked") === "true";
    setUnlocked(isUnlocked);
    setUnlockChecked(true);
  }, []);

  useEffect(() => {
    if (!unlockChecked || !unlocked) return;
    const localTest = isTestModeEnabled();
    setTestMode(localTest);
    if (localTest) {
      setIsAuthed(true);
      setHasTeam(true);
      return;
    }
    const check = async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) {
        setIsAuthed(false);
        setHasTeam(false);
        return;
      }
      setIsAuthed(true);
      const response = await fetch("/api/players/me", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      const payload = await response.json().catch(() => null);
      setHasTeam(Boolean(response.ok && payload?.team));
    };
    check();
  }, [unlockChecked, unlocked]);

  if (!unlockChecked || !unlocked) {
    return (
      <main className="page-shell min-h-screen flex items-center justify-center lock-shell">
        <section className="card w-full max-w-md space-y-4 lock-card">
          <p className="section-tag">SITE_LOCKED</p>
          <h1 className="font-headline text-3xl font-black uppercase title-tight">
            ACCESS LOCK
          </h1>
          <p className="text-sm text-(--text-muted)">
            AUTHORIZATION REQUIRED. ENTER ACCESS KEY.
          </p>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (passwordInput === TEMP_SITE_PASSWORD) {
                localStorage.setItem("site-unlocked", "true");
                setUnlocked(true);
                setUnlockError("");
                setPasswordInput("");
                return;
              }
              setUnlockError("Incorrect password.");
            }}
          >
            <input
              type="password"
              value={passwordInput}
              onChange={(event) => {
                setPasswordInput(event.target.value);
                if (unlockError) setUnlockError("");
              }}
              className="input-field"
              placeholder="Enter password"
              autoComplete="off"
              required
            />
            <button type="submit" className="button-primary w-full">
              BEGIN
            </button>
          </form>
          {unlockError && <p className="text-sm text-(--error)">INVALID ACCESS KEY.</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell min-h-screen">
      <section className="max-w-5xl space-y-6">
        <div className="space-y-3">
          <p className="section-tag">ACCESS_PORTAL_INITIALIZED</p>
          <h1
            className="font-headline text-5xl md:text-7xl font-black uppercase home-hero-title"
          >
            SELECT ACCESS CHANNEL
          </h1>
          <p className="text-sm md:text-base text-(--text-muted) max-w-2xl">
            COMMAND INTERFACE FOR TEAM OPS, LIVE ROUNDS, AND SECURED ACCESS.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="entry-panel md:col-span-7">
            <span className="material-symbols-outlined text-3xl text-(--accent)">groups</span>
            <p className="label">ID_TYPE: MULTI_USER</p>
            <h2 className="font-headline text-3xl md:text-4xl font-black tracking-tight">
              PARTICIPANT ENTRY
            </h2>
            <p className="text-sm text-(--text-muted)">
              INITIALIZE UNIT ACCESS, ENTER ACTIVE ROUND FLOW, AND EXECUTE OBJECTIVES.
            </p>
            {!isAuthed && !testMode && (
              <Link
                href="/auth?mode=signup"
                className="button-primary w-full sm:w-auto text-center"
                onClick={() => playSound("button_press")}
              >
                BEGIN ACCESS FLOW
              </Link>
            )}
            {(isAuthed && hasTeam) || testMode ? (
              <Link href="/team" className="button-primary w-full sm:w-auto text-center" onClick={() => playSound("button_press")}>
                OPEN TEAM CONSOLE
              </Link>
            ) : null}
            {isAuthed && !hasTeam && !testMode && (
              <Link href="/create-team" className="button-primary w-full sm:w-auto text-center" onClick={() => playSound("button_press")}>
                INITIALIZE TEAM UNIT
              </Link>
            )}
          </div>
        </div>

        <div className="card py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <span className="label">NODE: INITIAL_ACCESS_GRID</span>
            <span className="label">LATENCY: 0.002MS</span>
            <span className="label">REGION: SECTOR_07</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {!testMode ? (
              <button
                className="button-secondary text-xs"
                onClick={() => {
                  playSound("button_press");
                  enableTestMode();
                  setTestMode(true);
                  setIsAuthed(true);
                  setHasTeam(true);
                }}
              >
                ENABLE TEST MODE
              </button>
            ) : (
              <button
                className="button-danger text-xs"
                onClick={() => {
                  playSound("button_press");
                  disableTestMode();
                  setTestMode(false);
                  setIsAuthed(false);
                  setHasTeam(false);
                }}
              >
                DISABLE TEST MODE
              </button>
            )}
            {testMode && <span className="label text-(--accent)">TEST MODE ACTIVE (AUTH BYPASS)</span>}
          </div>
        </div>
      </section>
    </main>
  );
}
