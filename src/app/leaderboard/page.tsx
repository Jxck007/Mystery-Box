"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { isTestModeEnabled } from "@/lib/test-mode";
import { playSound, playSoundAndWait } from "@/lib/sound-manager";

type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  member_count?: number;
  max_members?: number;
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedSession, setCheckedSession] = useState(false);
  const [round1Outcome, setRound1Outcome] = useState<"selected" | "eliminated" | null>(null);
  const testMode = isTestModeEnabled();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const pendingResultSound = sessionStorage.getItem("post_round2_result_sound");
      if (pendingResultSound === "win_r2" || pendingResultSound === "lose_r2") {
        void playSound(pendingResultSound);
        sessionStorage.removeItem("post_round2_result_sound");
        return;
      }

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

      playSound("leaderboard_open");
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    if (testMode) {
      setEntries([
        { id: "t1", name: "TEST COLLECTIVE", score: 2400, member_count: 3, max_members: 4 },
        { id: "t2", name: "NODE_02", score: 2100, member_count: 4, max_members: 4 },
        { id: "t3", name: "NODE_03", score: 1800, member_count: 3, max_members: 4 },
      ]);
      setLoading(false);
      return;
    }
    const response = await fetch("/api/leaderboard");
    const data = await response.json();
    if (response.ok && Array.isArray(data)) {
      setEntries(data);
    }
    setLoading(false);
  }, [testMode]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (testMode) {
        localStorage.setItem("team_id", "test-team");
        localStorage.setItem("player_name", "TEST_OPERATOR");
        localStorage.setItem("is_leader", "true");
        setCheckedSession(true);
        fetchLeaderboard();
        return;
      }

      supabaseBrowser.auth.getSession().then(async ({ data }) => {
        if (!data.session) {
          router.replace("/auth?redirect=/leaderboard");
          return;
        }

        setCheckedSession(true);
        await fetchLeaderboard();
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [fetchLeaderboard, router, testMode]);

  useEffect(() => {
    if (testMode) return;
    const teamsChannel = supabaseBrowser
      .channel("leaderboard-teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        fetchLeaderboard,
      )
      .subscribe();

    const playersChannel = supabaseBrowser
      .channel("leaderboard-players")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        fetchLeaderboard,
      )
      .subscribe();

    const opensChannel = supabaseBrowser
      .channel("leaderboard-opens")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "box_opens" },
        fetchLeaderboard,
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(teamsChannel);
      supabaseBrowser.removeChannel(playersChannel);
      supabaseBrowser.removeChannel(opensChannel);
    };
  }, [fetchLeaderboard, testMode]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchLeaderboard();
    }, 8000);
    return () => window.clearInterval(intervalId);
  }, [fetchLeaderboard]);

  if (!checkedSession) {
    return (
      <main className="page-shell">
        <div className="card">
          <p className="text-sm text-slate-300">Checking team session…</p>
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
        <div className="banner paused">
          Congrats on passing Round 1. Auto redirecting to dashboard...
        </div>
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
            <span className="label text-[var(--text-muted)]">AUTO REFRESH: 8S</span>
          </div>
          <button
            className="button-secondary px-3 py-1 text-xs"
            onClick={() => router.back()}
          >
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
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((team, index) => {
                const isEliminated = team.name.toLowerCase().includes("eliminated");
                return (
                  <tr key={team.id} style={{ opacity: isEliminated ? 0.55 : 1 }}>
                    <td className="align-top">
                      <span
                        className="font-mono"
                        style={{ color: index < 3 ? "var(--accent)" : "var(--text-muted)" }}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </td>
                    <td>
                      <p
                        className="font-semibold"
                        style={{
                          color: "#fff",
                          textDecoration: isEliminated ? "line-through" : "none",
                        }}
                      >
                        {team.name}
                      </p>
                    </td>
                    <td>
                      {team.member_count ?? 0}
                      {team.max_members ? `/${team.max_members}` : ""}
                    </td>
                    <td className="font-headline text-2xl font-black">
                      {team.score ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {entries.length === 0 && !loading && (
            <p className="text-sm text-slate-300 py-4">
              No teams yet—invite others to start solving mystery boxes.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
