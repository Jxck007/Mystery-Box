"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { disableTestMode, enableTestMode, isTestModeEnabled } from "@/lib/test-mode";

export default function HomePage() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [hasTeam, setHasTeam] = useState(false);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
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
      setHasTeam(response.ok);
    };
    check();
  }, []);

  return (
    <main className="page-shell min-h-screen">
      <section className="max-w-5xl space-y-6">
        <div className="space-y-3">
          <p className="section-tag">ACCESS_PORTAL_INITIALIZED</p>
          <h1
            className="font-headline text-5xl md:text-7xl font-black uppercase"
            style={{ letterSpacing: "-0.04em", lineHeight: 0.9 }}
          >
            SELECT YOUR ENTRY 
          </h1>
          <p className="text-sm md:text-base text-[var(--text-muted)] max-w-2xl">
            Mission control for teams, secure login, and live event operations.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="entry-panel md:col-span-7">
            <span className="material-symbols-outlined text-3xl text-[var(--accent)]">groups</span>
            <p className="label">ID_TYPE: MULTI_USER</p>
            <h2 className="font-headline text-3xl md:text-4xl font-black tracking-tight">
              PARTICIPANT ENTRY
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              Initialize your team journey, join the active round flow, and complete each mission step with synchronized scoring.
            </p>
            {!isAuthed && !testMode && (
              <Link href="/auth" className="button-primary w-full sm:w-auto text-center">
                START ACCESS FLOW
              </Link>
            )}
            {(isAuthed && hasTeam) || testMode ? (
              <Link href="/team" className="button-primary w-full sm:w-auto text-center">
                GO TO TEAM CONSOLE
              </Link>
            ) : null}
            {isAuthed && !hasTeam && !testMode && (
              <Link href="/create-team" className="button-primary w-full sm:w-auto text-center">
                CREATE YOUR TEAM
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
                  disableTestMode();
                  setTestMode(false);
                  setIsAuthed(false);
                  setHasTeam(false);
                }}
              >
                DISABLE TEST MODE
              </button>
            )}
            {testMode && <span className="label text-[var(--accent)]">TEST MODE ACTIVE (AUTH BYPASS)</span>}
          </div>
        </div>
      </section>
    </main>
  );
}
