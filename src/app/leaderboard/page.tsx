"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  member_count?: number;
  max_members?: number;
};

const medalIcons = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedSession, setCheckedSession] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/leaderboard");
    const data = await response.json();
    if (response.ok && Array.isArray(data)) {
      setEntries(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const teamId = localStorage.getItem("team_id");
      const playerName = localStorage.getItem("player_name");

      if (!teamId || !playerName) {
        router.push("/");
        return;
      }

      setCheckedSession(true);
      fetchLeaderboard();
    }, 0);
    return () => window.clearTimeout(id);
  }, [fetchLeaderboard, router]);

  useEffect(() => {
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
      <div className="page-hero">
        <p className="label">Standings</p>
        <h1 className="title">Leaderboard</h1>
        <p className="subtitle">
          Live rankings update as teams solve challenges.
        </p>
      </div>
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="label">Live leaderboard</p>
            <h1 className="text-3xl font-semibold">Top teams</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="button-muted px-3 py-1 text-sm"
              onClick={() => router.back()}
            >
              Back
            </button>
            <button
              className="button-muted px-3 py-1 text-sm"
              onClick={fetchLeaderboard}
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
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
              {entries.map((team, index) => (
                <tr key={team.id} className="group hover:bg-slate-900/60">
                  <td className="align-top">
                    <span className="flex items-center gap-1">
                      {index < 3 ? medalIcons[index] : index + 1}
                    </span>
                  </td>
                  <td>
                    <p className="font-semibold text-slate-100">{team.name}</p>
                  </td>
                  <td>
                    {team.member_count ?? 0}
                    {team.max_members ? `/${team.max_members}` : ""}
                  </td>
                  <td>{team.score ?? 0}</td>
                </tr>
              ))}
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
