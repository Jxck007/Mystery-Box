"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { GAME_CONFIGS } from "./game-panels";
import { playSound } from "@/lib/sound-manager";
import { MysteryBox } from "./components/mystery-box";

import { UnlockVideoOverlay } from "./components/unlock-video-overlay";
import { RewardReveal } from "./components/reward-reveal";

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

type UnlockFlow = "locked" | "unlocked" | "preparing" | "playingVideo" | "revealReward" | "playingGame";

const UNLOCK_VIDEO_SRC = "/unlock-sequence.mp4";
const PUBLIC_GAME_LABEL = "MYSTERY GAMES";
const UNLOCK_RULES = [
  "This game is capped at 180 seconds.",
  "Question count always starts from 1.",
  "Each question is randomized and timeout counts as skip (-3).",
];

const wait = (ms: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, ms);
});

export default function TeamDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [currentGame, setCurrentGame] = useState<GameRecord | null>(null);
  const [currentOpen, setCurrentOpen] = useState<BoxOpen | null>(null);
  const [round, setRound] = useState<RoundRecord | null>(null);
  const [boxes, setBoxes] = useState<GameRecord[]>([]);
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (round?.round_number === 1 && round?.status === "active" && boxes.length > 0 && !redirectingRef.current) {
      redirectingRef.current = true;
      router.push(`/game/${boxes[0].id}`);
    }
  }, [round?.status, round?.round_number, boxes, router]);

  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [edgeToast, setEdgeToast] = useState<TeamEvent | null>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [removedNotice, setRemovedNotice] = useState("");
  const [members, setMembers] = useState<
    { id: string; display_name: string; joined_at: string }[]
  >([]);
  const [revealedGame, setRevealedGame] = useState<GameRecord | null>(null);
  const [revealedOpenRecord, setRevealedOpenRecord] = useState<BoxOpen | null>(null);
  const [briefingBusy, setBriefingBusy] = useState(false);
  const [unlockFlow, setUnlockFlow] = useState<UnlockFlow>("locked");
  const [showUnlockVideo, setShowUnlockVideo] = useState(false);
  const [dismissedRevealOpenId, setDismissedRevealOpenId] = useState<string | null>(null);

  const visibilityLeaveTimeRef = useRef<number | null>(null);
  const blurTimeRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number | null>(null);

  const [nowTime, setNowTime] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowTime(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const getLiveRemaining = useCallback(
    (r: RoundRecord | null) => {
      const duration = r?.duration_seconds ?? 180;
      if (!r) return duration;
      if (r.status === "ended") return 0;
      if (r.status === "waiting") return duration;
      if (r.status === "active") {
        if (!r.started_at) return duration;
        const startedAt = new Date(r.started_at).getTime();
        const elapsedLive = Math.floor((nowTime - startedAt) / 1000);
        return Math.max(0, duration - elapsedLive);
      }
      return duration;
    },
    [nowTime],
  );

  useEffect(() => {
    const preloadLink = document.createElement("link");
    preloadLink.rel = "preload";
    preloadLink.as = "video";
    preloadLink.href = UNLOCK_VIDEO_SRC;
    document.head.appendChild(preloadLink);

    return () => {
      if (preloadLink.parentNode) {
        preloadLink.parentNode.removeChild(preloadLink);
      }
    };
  }, []);

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
  }, [router]);

  useEffect(() => {
    const readAuth = async () => {
      const { data } = await supabaseBrowser.auth.getUser();
      setAuthEmail(data.user?.email ?? null);
    };
    readAuth();
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchBoxes();
    fetchTeam();
    fetchMembers();
  }, [session, fetchBoxes, fetchTeam, fetchMembers]);

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
    if (!session) return;
    const intervalId = window.setInterval(() => {
      fetchBoxes();
      fetchTeam();
      fetchMembers();
    }, 7000);
    return () => window.clearInterval(intervalId);
  }, [session, fetchBoxes, fetchTeam, fetchMembers]);

  useEffect(() => {
    const isRoundOneUnlocked = round?.round_number === 1 && round?.status === "active";
    if (!isRoundOneUnlocked) {
      setShowUnlockVideo(false);
      setUnlockFlow("locked");
      return;
    }

    if (unlockFlow === "locked") {
      setUnlockFlow("unlocked");
    }
  }, [round, unlockFlow]);



  const handleStartMission = async () => {
    if (!session || !revealedGame) return;
    setBriefingBusy(true);

    playSound("start_r1");

    fetch("/api/boxes/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: session.teamId }),
    }).catch((err) => {
      console.error("Box start error:", err);
    });

    setBriefingBusy(false);
    setUnlockFlow("unlocked");
    const id = encodeURIComponent(revealedGame.id);
    router.push(`/game/${id}`);
  };

  const formatTime = useCallback((seconds: number | null | undefined) => {
    if (seconds === null || seconds === undefined) return "--:--";
    const safe = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }, []);

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
    if (unlockFlow !== "unlocked" || currentOpen) {
      return;
    }
    if (round && round.status !== "active") {
      return;
    }

  setUnlockFlow("preparing");
    setModalError("");

    setLoading(true);

    const openRequest = async (): Promise<{ game: GameRecord | null; open: BoxOpen | null } | null> => {
      const response = await fetch("/api/boxes/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: session.teamId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setModalError(payload.error ?? "Unable to open game");
        return null;
      }
      return { game: payload.game ?? null, open: payload.open ?? null };
    };

    const [openResult] = await Promise.all([openRequest(), wait(950)]);

    if (!openResult?.game || !openResult.open) {
      setUnlockFlow("unlocked");
      setLoading(false);
      return;
    }

    setCurrentGame(openResult.game);
    setCurrentOpen(openResult.open);
    setDismissedRevealOpenId(null);
    setRevealedGame(openResult.game);
    setRevealedOpenRecord(openResult.open);
    setUnlockFlow("playingVideo");
    setShowUnlockVideo(true);

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

  const cinematicTransitionActive = unlockFlow === "preparing" || unlockFlow === "playingVideo"
  const hideDashboard = false;
  const isEliminated = Boolean(team?.eliminated_at);

  useEffect(() => {
    if (!team) return;
    if (round?.round_number !== 1 || round.status !== "ended") return;

    const alreadyRedirected = sessionStorage.getItem("round1_dashboard_redirected");
    if (alreadyRedirected === "1") return;

    sessionStorage.setItem("round1_score", String(team.score ?? 0));
    sessionStorage.removeItem("dashboard_redirected");
    sessionStorage.removeItem("leaderboard_sound_played");
    sessionStorage.removeItem("leaderboard_round2_redirected");
    sessionStorage.setItem("round1_dashboard_redirected", "1");
    router.replace("/dashboard");
  }, [round, router, team]);

  return (
    <main
      className="page-shell space-y-6"
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >

      <AnimatePresence>
        {!hideDashboard && (
          <motion.div
            key="team-dashboard-content"
            className="space-y-6"
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -48, filter: "blur(8px)" }}
            transition={{ duration: 0.55, ease: "easeInOut" }}
          >
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

        {isEliminated && (
          <div className="banner ended">
            Your team has been eliminated. You can still view final standings.
            <div className="mt-3">
              <button className="button-secondary" onClick={() => router.push("/leaderboard")}>
                VIEW LEADERBOARD
              </button>
            </div>
          </div>
        )}



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

            {round?.round_number === 1 && round?.status === "active" && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="label">MYSTERY_BOX</p>
              <h2 className="font-headline text-3xl font-black uppercase">OPEN THE BOX</h2>
            </div>
            <div className="text-right">
              <p className="label text-emerald-400">MISSION CLOCK</p>
              <p className="font-headline text-3xl font-black text-emerald-400">
                {formatTime(getLiveRemaining(round))}
              </p>
            </div>
          </div>

          {unlockFlow === "locked" && (
            <p className="text-sm text-[var(--text-muted)] text-center">
              Waiting for admin to start the round.
            </p>
          )}
            <div className="mystery-box-scene" style={{ overflow: "hidden" }}>
              <MysteryBox
                disabled={unlockFlow !== "unlocked"}
                isClicked={unlockFlow !== "unlocked"}
                videoPreviewSrc={UNLOCK_VIDEO_SRC}
                isPlaying={showUnlockVideo || unlockFlow === "revealReward"}
                gameTitle={PUBLIC_GAME_LABEL}
                onEnded={() => {

                  setUnlockFlow("revealReward");
                }}
                onOpen={() => {
                  void handleBoxClick();
                }}
              >
                <AnimatePresence>
                  {unlockFlow === "revealReward" && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.7, delay: 0.8 }}
                      className="absolute inset-x-0 bottom-3 sm:bottom-6 z-50 flex flex-col items-center justify-end pointer-events-none"
                    >
                      <button
                        type="button"
                        className="button-primary scale-110 shadow-[0_0_40px_rgba(180,255,57,0.4)] pointer-events-auto"
                        style={{ border: "2px solid rgba(180,255,57,0.7)" }}
                        onClick={() => void handleStartMission()}
                        disabled={briefingBusy}
                      >
                        {briefingBusy ? "STARTING..." : "START"}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </MysteryBox>
            </div>
        </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}


