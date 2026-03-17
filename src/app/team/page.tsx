"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type GameRecord = {
  id: string;
  game_title: string | null;
  game_description: string | null;
  game_type: string | null;
  points_value: number | null;
  round_number?: number | null;
};

type BoxOpen = {
  id: string;
  box_id: string;
  status: "pending" | "approved" | "rejected";
  submitted_answer?: string | null;
  opened_at?: string | null;
};

type RoundRecord = {
  id: string;
  title?: string | null;
  status: "waiting" | "active" | "paused" | "ended";
  started_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number | null;
  round_number?: number | null;
  elapsed_seconds?: number | null;
  remaining_seconds?: number | null;
};

type TeamEvent = {
  id: string;
  event_type: string;
  message: string;
  created_at: string;
};

type TeamDetail = {
  id: string;
  name: string;
  leader_name: string;
  score: number;
  member_count?: number;
  max_members?: number;
  round2_code?: string | null;
  round2_lock_until?: string | null;
  round2_solved_at?: string | null;
  round2_status?: string | null;
};

type SessionData = {
  teamId: string;
  playerName: string;
  isLeader: boolean;
};

export default function TeamDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [currentGame, setCurrentGame] = useState<GameRecord | null>(null);
  const [currentOpen, setCurrentOpen] = useState<BoxOpen | null>(null);
  const [round, setRound] = useState<RoundRecord | null>(null);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [visibleEvents, setVisibleEvents] = useState<TeamEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [modalError, setModalError] = useState("");
  const [removedNotice, setRemovedNotice] = useState("");
  const [members, setMembers] = useState<
    { id: string; display_name: string; joined_at: string }[]
  >([]);

  const fetchBoxes = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const response = await fetch(`/api/boxes?teamId=${session.teamId}`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (response.ok) {
      setCurrentGame(payload.game ?? null);
      setCurrentOpen(payload.open ?? null);
      setRound(payload.round ?? null);
      setEvents(payload.events ?? []);
      setRemovedNotice("");
    } else if (payload.code === "TEAM_REMOVED") {
      setRemovedNotice("Your team was removed by the admin.");
      localStorage.removeItem("team_id");
      localStorage.removeItem("player_name");
      localStorage.removeItem("is_leader");
      router.push("/");
    }
    setLoading(false);
  }, [session, router]);

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

  const fetchMembers = useCallback(async () => {
    if (!session) return;
    const response = await fetch(`/api/teams/${session.teamId}/players`, {
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);
    if (response.ok && Array.isArray(data)) {
      setMembers(data);
      return;
    }
    setMembers([]);
  }, [session]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const storedTeamId = localStorage.getItem("team_id");
      const storedPlayer = localStorage.getItem("player_name");
      const leaderFlag = localStorage.getItem("is_leader");

      if (!storedTeamId || !storedPlayer) {
        supabaseBrowser.auth.getSession().then(async ({ data }) => {
          if (!data.session) {
            router.push("/");
            return;
          }
          const response = await fetch("/api/players/me", {
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok || !payload?.team) {
            router.push("/create-team");
            return;
          }
          localStorage.setItem("team_id", payload.team.id);
          localStorage.setItem("player_name", payload.display_name);
          localStorage.setItem(
            "is_leader",
            payload.team.leader_name === payload.display_name ? "true" : "false",
          );
          setSession({
            teamId: payload.team.id,
            playerName: payload.display_name,
            isLeader: payload.team.leader_name === payload.display_name,
          });
        });
        return;
      }

      setSession({
        teamId: storedTeamId,
        playerName: storedPlayer,
        isLeader: leaderFlag === "true",
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [router]);

  useEffect(() => {
    const readAuth = async () => {
      const { data } = await supabaseBrowser.auth.getUser();
      setAuthEmail(data.user?.email ?? null);
    };
    readAuth();
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    const id = window.setTimeout(() => {
      fetchBoxes();
      fetchTeam();
      fetchMembers();
    }, 0);
    return () => window.clearTimeout(id);
  }, [session, fetchBoxes, fetchTeam, fetchMembers]);

  useEffect(() => {
    if (!round || round.status !== "active") return;
    if (round.round_number === 2) {
      router.replace("/round2");
    } else if (round.round_number === 3) {
      router.replace("/leaderboard");
    }
  }, [round, router]);

  useEffect(() => {
    if (!session) return;
    const intervalId = window.setInterval(() => {
      fetchBoxes();
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [session, fetchBoxes]);

  useEffect(() => {
    if (!session) return;
    const opensChannel = supabaseBrowser
      .channel(`opens-${session.teamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "box_opens",
          filter: `team_id=eq.${session.teamId}`,
        },
        fetchBoxes,
      )
      .subscribe();

    const roundsChannel = supabaseBrowser
      .channel("rounds-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds" },
        fetchBoxes,
      )
      .subscribe();

    const eventsChannel = supabaseBrowser
      .channel(`events-${session.teamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "team_events",
          filter: `team_id=eq.${session.teamId}`,
        },
        fetchBoxes,
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(opensChannel);
      supabaseBrowser.removeChannel(roundsChannel);
      supabaseBrowser.removeChannel(eventsChannel);
    };
  }, [session, fetchBoxes]);

  const handleBoxClick = async () => {
    if (!session) {
      return;
    }
    if (currentOpen && currentGame) {
      router.push(`/game/${currentGame.id}`);
      return;
    }

    if (round && round.status !== "active") {
      return;
    }

    setLoading(true);
    setOpening(true);
    const response = await fetch("/api/boxes/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: session.teamId }),
    });
    const payload = await response.json();
    if (response.ok) {
      setCurrentGame(payload.game ?? null);
      setCurrentOpen(payload.open ?? null);
      if (payload.game?.id) {
        router.push(`/game/${payload.game.id}`);
      }
      setModalError("");
    } else {
      setModalError(payload.error ?? "Unable to open game");
    }
    setLoading(false);
    setOpening(false);
  };

  useEffect(() => {
    if (events.length === 0) {
      setVisibleEvents([]);
      return;
    }
    setVisibleEvents(events.slice(0, 1));
    const id = window.setTimeout(() => {
      setVisibleEvents([]);
    }, 3000);
    return () => window.clearTimeout(id);
  }, [events]);

  const roundBanner = useMemo(() => {
    if (!round) {
      return null;
    }
    if (round.status === "paused") {
      return (
        <div className="banner paused">
          The round has been paused. Please wait for admin to resume.
        </div>
      );
    }
    if (round.status === "ended") {
      return (
        <div className="banner ended">The round has ended. Thanks for playing.</div>
      );
    }
    return null;
  }, [round]);

  return (
    <main className="page-shell space-y-6">
      <div className="app-bar">
        <div className="app-bar-left">
          <img className="app-bar-logo" src="/Logo.jpg" alt="Mystery Box" />
          <span className="app-bar-title">Mystery Box</span>
        </div>
        <div className="app-bar-right">
          <span className="label">Team hub</span>
        </div>
      </div>
      <div className="page-hero">
        <p className="label">Team hub</p>
        <h1 className="title">Welcome back</h1>
        <p className="subtitle">
          Lead your crew through each round. Only the leader device is required.
        </p>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label">Account</p>
            <h2 className="text-2xl font-semibold">Team dashboard</h2>
          </div>
          <div className="text-sm text-slate-300">
            {authEmail ? `Signed in as ${authEmail}` : ""}
          </div>
        </div>

        <details className="team-details" open>
          <summary className="team-summary">
            <div>
              <p className="label">Team</p>
              <h2 className="text-2xl font-semibold">{team?.name ?? "--"}</h2>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="uppercase tracking-wide text-slate-400">Score</span>
              <span className="text-4xl font-bold text-sky-300">
                {team?.score ?? 0}
              </span>
            </div>
          </summary>
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-4 text-sm text-slate-300">
              <p>
                Members: {(team?.member_count ?? 0)}/{team?.max_members ?? "-"}
              </p>
              <p>
                Leader: {team?.leader_name ?? session?.playerName ?? "-"}
              </p>
            </div>
            {members.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                {members.map((member) => {
                  const isYou =
                    member.display_name.toLowerCase() ===
                    (session?.playerName ?? "").toLowerCase();
                  const isLeader =
                    member.display_name.toLowerCase() ===
                    (team?.leader_name ?? "").toLowerCase();
                  return (
                    <span key={member.id} className="member-pill">
                      <span className="member-name">{member.display_name}</span>
                      {isLeader && (
                        <span className="role-pill role-leader">Leader</span>
                      )}
                      {isYou && <span className="role-pill role-you">You</span>}
                      {session?.isLeader && !isLeader && (
                        <button
                          type="button"
                          className="role-pill role-kick"
                          onClick={async () => {
                            const { data } = await supabaseBrowser.auth.getSession();
                            if (!data.session) return;
                            await fetch(
                              `/api/teams/${session.teamId}/players/remove`,
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${data.session.access_token}`,
                                },
                                body: JSON.stringify({ playerId: member.id }),
                              },
                            );
                            fetchMembers();
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                className="button-primary"
                onClick={() => router.push("/leaderboard")}
              >
                View Leaderboard
              </button>
            </div>
          </div>
        </details>

        {removedNotice && <div className="banner ended">{removedNotice}</div>}

        {roundBanner}

        {modalError && <div className="banner ended">{modalError}</div>}

        {visibleEvents.length > 0 && (
          <div className="space-y-2">
            {visibleEvents.map((event) => (
              <div key={event.id} className="banner paused">
                {event.message}
              </div>
            ))}
          </div>
        )}

        <div>
          <p className="label">Current round</p>
          <p className="text-sm text-slate-300">
            {round?.round_number
              ? `Round ${round.round_number}`
              : "Waiting for admin to start a round"}
          </p>
        </div>
      </div>

      {round?.round_number === 1 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="label">Mystery box</p>
              <h2 className="text-2xl font-semibold">Open the box</h2>
            </div>
            {loading && (
              <p className="text-sm text-slate-300">Refreshing boxes...</p>
            )}
          </div>

          <div className="mystery-grid">
            <button
              type="button"
              className={`mystery-box ${
                round?.status !== "active" ? "locked" : currentOpen ? "opened" : ""
              } ${opening ? "opening" : ""}`}
              onClick={handleBoxClick}
              disabled={opening || (round?.status !== "active" && !currentOpen)}
            >
              <div className="mystery-icon">?</div>
              <div className="mystery-icon">?</div>
              <div className="mystery-icon">?</div>
              <span className="box-badge">
                {round?.status !== "active" ? "Locked" : currentOpen ? "Opened" : "Open"}
              </span>
              {opening && (
                <span className="text-xs uppercase tracking-wide text-sky-300">
                  Opening...
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}