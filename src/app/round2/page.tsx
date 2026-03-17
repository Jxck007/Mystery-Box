"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

type RoundRecord = {
  id: string;
  status: "waiting" | "active" | "paused" | "ended";
  round_number?: number | null;
};

type TeamDetail = {
  id: string;
  name: string;
  leader_name: string;
  round2_code?: string | null;
  round2_solved_at?: string | null;
  round2_status?: string | null;
};

type SessionData = {
  teamId: string;
  playerName: string;
  isLeader: boolean;
};

export default function Round2Page() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [round, setRound] = useState<RoundRecord | null>(null);
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [round2Code, setRound2Code] = useState("");
  const [round2Status, setRound2Status] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchRound = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const response = await fetch(`/api/boxes?teamId=${session.teamId}`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (response.ok) {
      setRound(payload.round ?? null);
    }
    setLoading(false);
  }, [session]);

  const fetchTeam = useCallback(async () => {
    if (!session) return;
    const response = await fetch("/api/teams/list?includeInactive=true");
    const data = await response.json();
    if (response.ok && Array.isArray(data)) {
      const matching = data.find((entry) => entry.id === session.teamId);
      if (matching) {
        setTeam(matching);
      }
    }
  }, [session]);

  useEffect(() => {
    const storedTeamId = localStorage.getItem("team_id");
    const storedPlayer = localStorage.getItem("player_name");
    const leaderFlag = localStorage.getItem("is_leader");
    if (!storedTeamId || !storedPlayer) {
      router.replace("/");
      return;
    }
    setSession({
      teamId: storedTeamId,
      playerName: storedPlayer,
      isLeader: leaderFlag === "true",
    });
  }, [router]);

  useEffect(() => {
    if (!session) return;
    fetchRound();
    fetchTeam();
  }, [session, fetchRound, fetchTeam]);

  useEffect(() => {
    if (!round) return;
    if (round.status !== "active" || round.round_number !== 2) {
      router.replace("/team");
    }
  }, [round, router]);

  return (
    <main className="page-shell round2-page">
      <div className="round2-card">
        <div className="round2-header">
          <div>
            <p className="label">Round 2 access</p>
            <h1 className="title">Enter the 4-digit code</h1>
            <p className="subtitle">
              Code entry is only active while Round 2 is running.
            </p>
          </div>
          <button
            className="button-muted"
            onClick={() => router.push("/leaderboard")}
          >
            View Leaderboard
          </button>
        </div>

        {!team?.round2_code ? (
          <div className="banner paused">
            Waiting for the admin to set your Round 2 code.
          </div>
        ) : team?.round2_solved_at ? (
          <div className="banner paused">
            Code solved. {team.round2_status === "qualified"
              ? "You qualified for Round 3."
              : "Slots were full."}
          </div>
        ) : (
          <div className="code-panel">
            <div className="code-display">
              {Array.from({ length: 4 }).map((_, index) => (
                <span key={index} className="code-slot">
                  {round2Code[index] ?? "_"}
                </span>
              ))}
            </div>
            <div className="code-keypad">
              {Array.from({ length: 10 }).map((_, index) => {
                const value = (index + 1) % 10;
                return (
                  <button
                    key={value}
                    type="button"
                    className="button-muted"
                    onClick={() => {
                      if (round2Code.length < 4) {
                        setRound2Code(`${round2Code}${value}`);
                      }
                    }}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="button-muted"
                onClick={() => setRound2Code("")}
              >
                Clear
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={async () => {
                  setRound2Status("");
                  const { data } = await supabaseBrowser.auth.getSession();
                  if (!data.session) {
                    setRound2Status("Please sign in again.");
                    return;
                  }
                  const response = await fetch("/api/round2/submit", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${data.session.access_token}`,
                    },
                    body: JSON.stringify({ code: round2Code }),
                  });
                  const payload = await response.json();
                  if (!response.ok) {
                    setRound2Status(payload.error ?? "Unable to submit code");
                    return;
                  }
                  setRound2Status(
                    payload.qualified
                      ? "Code accepted. You qualified for Round 3."
                      : "Code accepted, but slots are full.",
                  );
                }}
                disabled={round2Code.length !== 4}
              >
                Submit Code
              </button>
            </div>
            {round2Status && (
              <p className="text-sm text-slate-300">{round2Status}</p>
            )}
          </div>
        )}

        {loading && (
          <p className="text-sm text-slate-300">Refreshing round status...</p>
        )}
      </div>
    </main>
  );
}
