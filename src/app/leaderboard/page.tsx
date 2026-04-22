"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { playSound, playSoundAndWait } from "@/lib/sound-manager";

type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  correct_count?: number;
  wrong_count?: number;
  member_count?: number;
  max_members?: number;
};

type LeaderboardPayload = {
  entries: LeaderboardEntry[];
};



export default function LeaderboardPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedSession, setCheckedSession] = useState(false);
  const [round1Outcome, setRound1Outcome] = useState<"selected" | "eliminated" | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const leaderboardSoundPlayed = sessionStorage.getItem("leaderboard_sound_played");

      const postRound1Sound = sessionStorage.getItem("post_round1_result_sound");
      const postRound1Outcome = sessionStorage.getItem("post_round1_outcome");
      if (postRound1Outcome === "selected" || postRound1Outcome === "eliminated") {
        setRound1Outcome(postRound1Outcome);
        if (postRound1Sound === "win_r1" || postRound1Sound === "lose_r1") {
          sessionStorage.removeItem("post_round1_result_sound");
          await playSoundAndWait(postRound1Sound, 12000);
        }
        if (!cancelled && postRound1Outcome === "selected") {
          router.replace("/team");
        }
        return;
      }

      const cameFromDashboard = sessionStorage.getItem("dashboard_redirected") === "1";
      if (!cameFromDashboard) {
        playSound("leaderboard_open");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const updateLeaderboard = useCallback(async () => {
    setLoading(true);

    const response = await fetch("/api/leaderboard", { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as LeaderboardPayload | LeaderboardEntry[] | null;

    if (!response.ok || !data) {
      setLoading(false);
      return;
    }

    if (Array.isArray(data)) {
      setEntries(data);
      setLoading(false);
      return;
    }

    setEntries(Array.isArray(data.entries) ? data.entries : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      supabaseBrowser.auth.getSession().then(async ({ data }) => {
        if (!data.session) {
          router.replace("/auth?redirect=/leaderboard");
          return;
        }

        setCheckedSession(true);
        await updateLeaderboard();
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [updateLeaderboard, router]);

  useEffect(() => {
    const teamsChannel = supabaseBrowser
      .channel("leaderboard-teams")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, updateLeaderboard)
      .subscribe();

    const playersChannel = supabaseBrowser
      .channel("leaderboard-players")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, updateLeaderboard)
      .subscribe();

    const roundsChannel = supabaseBrowser
      .channel("leaderboard-rounds")
      .on("postgres_changes", { event: "*", schema: "public", table: "rounds" }, updateLeaderboard)
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(teamsChannel);
      supabaseBrowser.removeChannel(playersChannel);
      supabaseBrowser.removeChannel(roundsChannel);
    };
  }, [updateLeaderboard]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      updateLeaderboard();
    }, 4000);
    return () => window.clearInterval(intervalId);
  }, [updateLeaderboard]);

  if (!checkedSession) {
    return (
      <main className="page-shell">
        <div className="card">
          <p className="text-sm text-slate-300">Checking team session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="space-y-2">
        <p className="section-tag">LIVE_STANDINGS</p>
        <h1 className="font-headline text-6xl md:text-7xl font-black uppercase" style={{ letterSpacing: "-0.04em" }}>
          LEADERBOARD
        </h1>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-[var(--accent)]" style={{ animation: "pulse-dot 1.2s ease-in-out infinite" }} />
          <span className="label text-[var(--accent)]">STREAMING</span>
        </div>
      </div>

      {round1Outcome === "selected" && (
        <div className="banner paused">Congrats on passing Round 1. Auto redirecting to dashboard...</div>
      )}

      {round1Outcome === "eliminated" && (
        <div className="banner ended">
          Thanks for playing.
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="button-muted" onClick={() => router.push("/")}>CUT TO HOME</button>
            <button
              className="button-danger"
              onClick={async () => {
                await supabaseBrowser.auth.signOut();
                router.replace("/");
              }}
            >
              CUT SESSION
            </button>
          </div>
        </div>
      )}

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="label">Live leaderboard</p>
            <h1 className="text-3xl font-semibold">Top teams</h1>
            <span className="label text-[var(--text-muted)]">AUTO REFRESH: 4S</span>
          </div>
          <button className="button-secondary px-3 py-1 text-xs" onClick={() => router.back()}>
            BACK
          </button>
        </div>

        <div className="overflow-auto">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team Name</th>
                <th>Members</th>
                <th>Correct</th>
                <th>Wrong</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((team, index) => {
                const isEliminated = team.name.toLowerCase().includes("eliminated");
                const isSelected = index < 24;
                return (
                  <tr key={team.id} style={{ 
                    opacity: isEliminated ? 0.55 : 1,
                    backgroundColor: isSelected ? 'rgba(74, 222, 128, 0.1)' : 'rgba(239, 68, 68, 0.05)'
                  }}>
                    <td className="align-top">
                      <span className="font-mono" style={{ color: index < 3 ? "var(--accent)" : "var(--text-muted)" }}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </td>
                    <td>
                      <p className="font-semibold" style={{ 
                        color: isSelected ? 'var(--accent)' : "#fff", 
                        textDecoration: isEliminated ? "line-through" : "none" 
                       }}>
                        {team.name}
                        {isSelected && <span className="ml-2 text-[10px] bg-green-500/20 text-green-400 px-1 rounded">QUALIFIED</span>}
                        {!isSelected && !isEliminated && <span className="ml-2 text-[10px] bg-red-500/20 text-red-400 px-1 rounded">BELOW CUTOFF</span>}
                      </p>
                    </td>
                    <td>
                      {team.member_count ?? 0}
                      {team.max_members ? `/${team.max_members}` : ""}
                    </td>
                    <td>{team.correct_count ?? 0}</td>
                    <td>{team.wrong_count ?? 0}</td>
                    <td className="font-headline text-2xl font-black">{team.score ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {entries.length === 0 && !loading && (
            <p className="text-sm text-slate-300 py-4">No teams yet. Invite others to start solving mystery boxes.</p>
          )}
        </div>

        {entries.length > 0 && (
          <div className="pt-2 border-t border-[rgba(103,170,255,0.2)]">
            <p className="label text-[var(--accent)]">ROUND 2 QUALIFIED (TOP 24)</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {entries.slice(0, 24).map((team, idx) => (
                <div key={`qual-${team.id}`} className="battle-team">
                  <p className="label text-[var(--accent)]">#{idx + 1}</p>
                  <p className="font-semibold text-sm text-white">{team.name}</p>
                  <p className="text-xs text-slate-300">Score: {team.score ?? 0}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
