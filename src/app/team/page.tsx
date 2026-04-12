"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { isTestModeEnabled } from "@/lib/test-mode";

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
  const [edgeToast, setEdgeToast] = useState<TeamEvent | null>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [modalError, setModalError] = useState("");
  const [removedNotice, setRemovedNotice] = useState("");
  const [members, setMembers] = useState<
    { id: string; display_name: string; joined_at: string }[]
  >([]);
  const testMode = isTestModeEnabled();

  const fetchBoxes = useCallback(async () => {
    if (!session) return;
    if (testMode) {
      setCurrentGame({
        id: "test-box",
        game_title: "Rapid Quiz",
        game_description: "Test mode mock game.",
        game_type: "quiz",
        points_value: 100,
        round_number: 1,
      });
      setCurrentOpen(null);
      setRound({
        id: "test-round",
        status: "active",
        round_number: 1,
        duration_seconds: 300,
        elapsed_seconds: 0,
        remaining_seconds: 300,
      });
      setEvents([]);
      setLoading(false);
      return;
    }
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
  }, [session, router, testMode]);

  const fetchTeam = useCallback(async () => {
    if (!session) return;
    if (testMode) {
      setTeam({
        id: "test-team",
        name: "TEST COLLECTIVE",
        leader_name: session.playerName,
        score: 2400,
        member_count: 3,
        max_members: 4,
      });
      return;
    }
    const response = await fetch("/api/teams/list?includeInactive=true");
    const data = await response.json();
    if (response.ok && Array.isArray(data)) {
      const matching = data.find((entry) => entry.id === session.teamId);
      if (matching) {
        setTeam(matching);
      }
    }
  }, [session, testMode]);

  const fetchMembers = useCallback(async () => {
    if (!session) return;
    if (testMode) {
      setMembers([
        { id: "m1", display_name: session.playerName, joined_at: new Date().toISOString() },
        { id: "m2", display_name: "NODE_02", joined_at: new Date().toISOString() },
        { id: "m3", display_name: "NODE_03", joined_at: new Date().toISOString() },
      ]);
      return;
    }
    const response = await fetch(`/api/teams/${session.teamId}/players`, {
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);
    if (response.ok && Array.isArray(data)) {
      setMembers(data);
      return;
    }
    setMembers([]);
  }, [session, testMode]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (testMode) {
        localStorage.setItem("team_id", "test-team");
        localStorage.setItem("player_name", "TEST_OPERATOR");
        localStorage.setItem("is_leader", "true");
        setSession({
          teamId: "test-team",
          playerName: "TEST_OPERATOR",
          isLeader: true,
        });
        return;
      }

      supabaseBrowser.auth.getSession().then(async ({ data }) => {
        if (!data.session) {
          router.replace("/auth?redirect=/team");
          return;
        }

        const response = await fetch("/api/players/me", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.team) {
          router.replace("/create-team");
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
    }, 0);
    return () => window.clearTimeout(id);
  }, [router, testMode]);

  useEffect(() => {
    if (testMode) {
      setAuthEmail("test.mode@local");
      return;
    }
    const readAuth = async () => {
      const { data } = await supabaseBrowser.auth.getUser();
      setAuthEmail(data.user?.email ?? null);
    };
    readAuth();
  }, [testMode]);

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
    if (events.length === 0) return;
    const latest = [...events]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )[0];
    if (!latest || latest.id === lastEventIdRef.current) return;
    lastEventIdRef.current = latest.id;
    setEdgeToast(latest);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setEdgeToast(null);
      toastTimerRef.current = null;
    }, 2000);
  }, [events]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

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
    if (testMode) {
      router.push("/game/test-box");
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

  const boxStateClass =
    round?.status !== "active"
      ? "locked"
      : opening
      ? "opening"
      : currentOpen
      ? "opened"
      : "idle";

  return (
    <main className="page-shell space-y-6">
      {edgeToast && (
        <div className="edge-toast" role="status" aria-live="polite">
          {edgeToast.message}
        </div>
      )}
      <div className="space-y-2">
        <p className="section-tag">TEAM_OPERATOR_CHANNEL</p>
        <h1 className="font-headline text-5xl md:text-6xl font-black uppercase" style={{ letterSpacing: "-0.04em" }}>
          MISSION / CONTROL / HUB
        </h1>
      </div>

      <div className="card space-y-4" style={{ borderTop: "3px solid var(--accent)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label">REAL_TIME_YIELD</p>
            <h2 className="font-headline text-6xl font-black leading-none" style={{ letterSpacing: "-0.04em" }}>
              {team?.score ?? 0}
            </h2>
          </div>
          <div className="text-right space-y-1">
            <p className="label text-[var(--accent)]">STREAK: {currentOpen ? "ACTIVE" : "0X"}</p>
            <p className="label">ALPHA_PHASE</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 text-sm text-[var(--text-muted)]">
            <p>Members: {(team?.member_count ?? 0)}/{team?.max_members ?? "-"}</p>
            <p>Leader: {team?.leader_name ?? session?.playerName ?? "-"}</p>
            <p>{authEmail ? `Signed in as ${authEmail}` : ""}</p>
          </div>
          {members.length > 0 && (
            <div className="flex flex-wrap gap-2">
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
                    {isLeader && <span className="role-pill role-leader">Leader</span>}
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
          <button className="button-primary w-full sm:w-auto" onClick={() => router.push("/leaderboard")}>
            VIEW LEADERBOARD
          </button>
        </div>

        {removedNotice && <div className="banner ended">{removedNotice}</div>}

        {roundBanner}

        {modalError && <div className="banner ended">{modalError}</div>}

        <div>
          <p className="label">Current round</p>
          <p className="text-sm text-slate-300">
            {round?.round_number
              ? `Round ${round.round_number}`
              : "Waiting for admin to start a round"}
          </p>
        </div>
      </div>

      {!round?.round_number && (
        <div className="card items-center text-center py-12" style={{ background: "var(--bg-container)" }}>
          <span className="inline-block w-2 h-2 bg-[var(--accent)] mb-2" style={{ animation: "pulse-dot 1.2s ease-in-out infinite" }} />
          <p className="label">STANDBY_MODE</p>
          <p className="font-mono text-sm text-[var(--text-muted)]">WAITING FOR ADMIN TO INITIALIZE A ROUND</p>
        </div>
      )}

      {round?.round_number === 1 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="label">MYSTERY_BOX</p>
              <h2 className="font-headline text-3xl font-black uppercase">OPEN THE BOX</h2>
            </div>
            {loading && (
              <p className="text-sm text-[var(--text-muted)]">REFRESHING BOXES...</p>
            )}
          </div>
          <div className="mystery-box-scene">
            <div
              className={`mystery-box-wrapper ${boxStateClass}`}
              onClick={handleBoxClick}
              aria-disabled={opening || (round?.status !== "active" && !currentOpen)}
            >
              <div className="mb-top">
                <div className="mb-lid">
                  <div className="mb-lid-shine" />
                  <div className="mb-lid-stripe" />
                </div>
              </div>
              <div className="mb-bottom">
                <div className="mb-body">
                  <div className="mb-body-stripe" />
                  <div className="mb-icons">
                    <span className="mb-icon mb-icon-1">?</span>
                    <span className="mb-icon mb-icon-2">?</span>
                    <span className="mb-icon mb-icon-3">?</span>
                  </div>
                </div>
              </div>
              <div className="mb-particles">
                <span className="mb-particle mb-p1" />
                <span className="mb-particle mb-p2" />
                <span className="mb-particle mb-p3" />
                <span className="mb-particle mb-p4" />
                <span className="mb-particle mb-p5" />
                <span className="mb-particle mb-p6" />
              </div>
              <div className="mb-rays">
                <span className="mb-ray mb-r1" />
                <span className="mb-ray mb-r2" />
                <span className="mb-ray mb-r3" />
                <span className="mb-ray mb-r4" />
              </div>
              <div className="mb-badge">
                {boxStateClass === "locked"
                  ? "LOCKED"
                  : boxStateClass === "idle"
                  ? "OPEN_NOW"
                  : boxStateClass === "opening"
                  ? "OPENING..."
                  : "OPENED"}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
