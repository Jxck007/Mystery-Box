"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function HomePage() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [hasTeam, setHasTeam] = useState(false);

  useEffect(() => {
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
    <main className="page-shell min-h-screen flex items-center justify-center">
      <div className="w-full max-w-3xl space-y-6">
        <div className="page-hero text-center items-center">
          <p className="label">Command deck</p>
          <h1 className="title">Mystery Box Event</h1>
          <p className="subtitle">
            Coordinate your crew, unlock the box, and complete live challenges
            under the clock.
          </p>
        </div>
        <div className="card text-center">
        <p className="label">Mission briefing</p>
        <h2 className="text-3xl font-semibold tracking-tight">
          Ready to play?
        </h2>
        <p className="text-lg text-slate-300">
          Build your team, unlock boxes, and complete tasks while the admin
          validates your progress.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          {!isAuthed && (
            <Link
              href="/auth"
              className="button-primary w-full sm:w-auto text-center"
            >
              Sign In
            </Link>
          )}
          {isAuthed && hasTeam && (
            <Link
              href="/team"
              className="button-primary w-full sm:w-auto text-center"
            >
              Go to Team Hub
            </Link>
          )}
          <Link
            href="/create-team"
            className="button-primary w-full sm:w-auto text-center"
          >
            Create Team
          </Link>
        </div>

        <Link href="/admin" className="text-sm text-sky-300 underline">
          Admin Panel
        </Link>
        </div>
      </div>
    </main>
  );
}
