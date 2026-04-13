"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { GAME_CONFIGS } from "./game-panels";
import { getTestRoundNumber, isTestModeEnabled, setTestRoundNumber } from "@/lib/test-mode";
import { playSound } from "@/lib/sound-manager";

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
  is_active?: boolean;
  member_count?: number;
  max_members?: number;
  eliminated_at?: string | null;
  eliminated_round?: number | null;
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
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [briefingGame, setBriefingGame] = useState<GameRecord | null>(null);
  const [briefingOpenRecord, setBriefingOpenRecord] = useState<BoxOpen | null>(null);
  const [briefingBusy, setBriefingBusy] = useState(false);
  const [testRound, setTestRound] = useState(1);
  const [isOpening, setIsOpening] = useState(false);
  const [isOpened, setIsOpened] = useState(false);
  const [pendingBriefing, setPendingBriefing] = useState<{ game: GameRecord | null; open: BoxOpen | null } | null>(null);
  const boxOpenTimerRef = useRef<number | null>(null);
  const round1ResultPlayedRef = useRef(false);
  const testMode = isTestModeEnabled();

  const fetchBoxes = useCallback(async () => {
    if (!session) return;
    if (testMode) {
      const activeTestRound = getTestRoundNumber();
      setTestRound(activeTestRound);
      setCurrentGame({
        id: `test-box-${GAME_CONFIGS[0].key}`,
        game_title: GAME_CONFIGS[0].title,
        game_description: "Test mode mock game.",
        game_type: GAME_CONFIGS[0].key,
        points_value: 100,
        round_number: activeTestRound,
      });
      setCurrentOpen(null);
      setRound({
        id: "test-round",
        status: "active",
        round_number: activeTestRound,
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
      const activeTestRound = getTestRoundNumber();
      setTeam({
        id: "test-team",
        name: "TEST COLLECTIVE",
        leader_name: session.playerName,
        score: 0,
        member_count: 3,
        max_members: 4,
        round2_status: activeTestRound === 2 ? "pending" : null,
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
      fetchTeam();
      fetchMembers();
    }, 7000);
    return () => window.clearInterval(intervalId);
  }, [session, fetchBoxes, fetchTeam, fetchMembers]);

  useEffect(() => {
    return () => {
      if (boxOpenTimerRef.current) {
        window.clearTimeout(boxOpenTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (currentOpen || testMode) {
      setIsOpened(Boolean(currentOpen));
    }
  }, [currentOpen, testMode]);

  useEffect(() => {
    if (!isOpened || !pendingBriefing) return;
    openBriefing(pendingBriefing.game, pendingBriefing.open);
    setPendingBriefing(null);
  }, [isOpened, pendingBriefing]);

  useEffect(() => {
    if (round?.round_number !== 1 || round.status !== "ended") {
      round1ResultPlayedRef.current = false;
      return;
    }
    if (round1ResultPlayedRef.current) return;

    const eliminatedByEvent = events.some((event) => event.event_type === "elimination");
    const eliminatedRound1 = team?.eliminated_round === 1 || Boolean(team?.eliminated_at) || eliminatedByEvent;

    round1ResultPlayedRef.current = true;
    playSound(eliminatedRound1 ? "lose_r1" : "win_r1");
  }, [events, round, team?.eliminated_at, team?.eliminated_round]);

  const openBriefing = (game: GameRecord | null, openRecord: BoxOpen | null) => {
    if (!game || !openRecord) return;
    setBriefingGame(game);
    setBriefingOpenRecord(openRecord);
    setBriefingOpen(true);
  };

  const handleStartMission = async () => {
    if (!session || !briefingGame) return;
    setBriefingBusy(true);

    playSound("start_r1");

    if (!testMode) {
      await fetch("/api/boxes/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: session.teamId }),
      });
    }

    setBriefingBusy(false);
    setBriefingOpen(false);
    router.push(`/game/${briefingGame.id}`);
  };

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
    if (isOpening || isOpened || currentOpen) {
      return;
    }
    if (round && round.status !== "active") {
      return;
    }

    setIsOpening(true);
    setOpening(true);
    setModalError("");

    playSound("box_open");

    if (boxOpenTimerRef.current) {
      window.clearTimeout(boxOpenTimerRef.current);
    }

    boxOpenTimerRef.current = window.setTimeout(() => {
      setIsOpening(false);
      setIsOpened(true);
      setOpening(false);
    }, 2000);

    if (testMode) {
      const activeTestRound = getTestRoundNumber();
      const selectedConfig = GAME_CONFIGS[Math.floor(Math.random() * GAME_CONFIGS.length)];
      const testGame = {
        id: `test-box-${selectedConfig.key}-${Date.now()}`,
        game_title: selectedConfig.title,
        game_description: "Answer fast and build your streak. Wrong answers reduce your score input.",
        game_type: selectedConfig.key,
        points_value: 100,
        round_number: activeTestRound,
      };
      const testOpen = { id: `test-open-${Date.now()}`, box_id: "test-box", status: "pending" as const };
      setCurrentGame({
        ...testGame,
      });
      setCurrentOpen(testOpen);
      setPendingBriefing({ game: testGame, open: testOpen });
      return;
    }

    setLoading(true);
    const response = await fetch("/api/boxes/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: session.teamId }),
    });
    const payload = await response.json();
    if (response.ok) {
      const nextGame = payload.game ?? null;
      const nextOpen = payload.open ?? null;
      setCurrentGame(nextGame);
      setCurrentOpen(nextOpen);
      setPendingBriefing({ game: nextGame, open: nextOpen });
      setModalError("");
    } else {
      setModalError(payload.error ?? "Unable to open game");
      if (boxOpenTimerRef.current) {
        window.clearTimeout(boxOpenTimerRef.current);
        boxOpenTimerRef.current = null;
      }
      setIsOpening(false);
      setIsOpened(false);
      setOpening(false);
    }
    setLoading(false);
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
      : isOpening
      ? "opening"
      : isOpened || currentOpen
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

      {testMode && (
        <div className="card space-y-3">
          <p className="label">TEST MODE CONTROLS</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`button-secondary text-xs ${testRound === 1 ? "button-success" : ""}`}
              onClick={() => {
                setTestRoundNumber(1);
                setTestRound(1);
                fetchBoxes();
              }}
            >
              ROUND 1
            </button>
            <button
              type="button"
              className={`button-secondary text-xs ${testRound === 2 ? "button-success" : ""}`}
              onClick={() => {
                setTestRoundNumber(2);
                setTestRound(2);
                fetchBoxes();
                router.replace("/round2");
              }}
            >
              ROUND 2
            </button>
            <button
              type="button"
              className="button-secondary text-xs"
              onClick={() => router.push("/admin")}
            >
              ADMIN DASHBOARD
            </button>
          </div>
        </div>
      )}

      <div className="card space-y-4" style={{ borderTop: "3px solid var(--accent)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label text-(--accent)">TOTAL SCORE</p>
            <h2 className="font-headline text-7xl md:text-8xl font-black leading-none text-(--accent)" style={{ letterSpacing: "-0.04em", textShadow: "0 0 18px rgba(180,255,57,0.25)" }}>
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
                  </span>
                );
              })}
            </div>
          )}
          <p className="text-sm text-[var(--text-muted)]">
            Team member setup is handled on the team creation screen.
          </p>
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
          {boxStateClass === "locked" && (
            <p className="text-sm text-[var(--text-muted)] text-center">
              Waiting for admin to start the round.
            </p>
          )}
          <div className="mystery-box-scene">
            <div
              className={`mb2-box ${boxStateClass === "opening" ? "shake glow" : ""} ${boxStateClass === "opened" ? "open" : ""} ${boxStateClass === "locked" ? "locked" : ""}`}
              onClick={handleBoxClick}
              role="button"
              aria-label="Open mystery box"
            >
              <div className="mb2-lid" />
              <div className="mb2-reward">🎉 +{currentGame?.points_value ?? 50} pts</div>
            </div>
          </div>
        </div>
      )}

      {briefingOpen && briefingGame && (
        <div className="briefing-overlay" role="dialog" aria-modal="true" aria-label="Mission briefing">
          <div className="briefing-modal card space-y-4">
            <p className="section-tag">MISSION BRIEFING</p>
            <h2 className="font-headline text-3xl font-black uppercase briefing-title-tight">
              {briefingGame.game_title ?? "MYSTERY CHALLENGE"}
            </h2>
            <p className="text-sm text-(--text-muted)">
              {briefingGame.game_description ?? "Read the rules, then start the mission timer when your team is ready."}
            </p>
            <ul className="rule-list">
              <li>This game is capped at 180 seconds.</li>
              <li>Question count always starts from 1.</li>
              <li>Each question is randomized and timeout counts as skip (-3).</li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="button-primary"
                disabled={briefingBusy || !briefingOpenRecord}
                onClick={handleStartMission}
              >
                {briefingBusy ? "Starting..." : "START GAME"}
              </button>
              <button type="button" className="button-secondary" onClick={() => setBriefingOpen(false)}>
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
