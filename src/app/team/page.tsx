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
  is_locked: boolean;
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
  code: string;
  leader_name: string;
  score: number;
  member_count?: number;
  max_members?: number;
  answer_mode: "leader_only" | "all_members";
};

type SessionData = {
  teamId: string;
  teamCode: string;
  playerName: string;
  isLeader: boolean;
};

const statusStyles: Record<string, string> = {
  pending: "status-pill status-pending",
  approved: "status-pill status-approved",
  rejected: "status-pill status-rejected",
};

export default function TeamDashboardPage() {
  const router = useRouter();
  const INDIVIDUAL_START_ROUNDS = useMemo(() => new Set([1, 2]), []);
  const [session, setSession] = useState<SessionData | null>(null);
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [currentGame, setCurrentGame] = useState<GameRecord | null>(null);
  const [currentOpen, setCurrentOpen] = useState<BoxOpen | null>(null);
  const [round, setRound] = useState<RoundRecord | null>(null);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [visibleEvents, setVisibleEvents] = useState<TeamEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameRecord | null>(null);
  const [modalAnswer, setModalAnswer] = useState("");
  const [modalError, setModalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [removedNotice, setRemovedNotice] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [gameStartAt, setGameStartAt] = useState<number | null>(null);
  const [members, setMembers] = useState<
    { id: string; display_name: string; joined_at: string }[]
  >([]);

  const fetchBoxes = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const response = await fetch(`/api/boxes?teamId=${session.teamId}`);
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
      localStorage.removeItem("team_code");
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
      const storedTeamCode = localStorage.getItem("team_code");
      const storedPlayer = localStorage.getItem("player_name");
      const leaderFlag = localStorage.getItem("is_leader");

      if (!storedTeamId || !storedTeamCode || !storedPlayer) {
        router.push("/");
        return;
      }

      setSession({
        teamId: storedTeamId,
        teamCode: storedTeamCode,
        playerName: storedPlayer,
        isLeader: leaderFlag === "true",
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [router]);

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
      setSelectedGame(currentGame);
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
      setSelectedGame(payload.game ?? null);
      setModalError("");
      if (INDIVIDUAL_START_ROUNDS.has(round?.round_number ?? 0)) {
        setGameStarted(false);
        setGameStartAt(null);
      }
    } else {
      setModalError(payload.error ?? "Unable to open game");
    }
    setLoading(false);
    setOpening(false);
  };

  const handleSubmit = async () => {
    if (!selectedGame || !session) return;
    if (!modalAnswer.trim()) {
      setModalError("Please describe what you completed.");
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/boxes/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId: session.teamId,
        boxId: selectedGame.id,
        submission: modalAnswer,
        isLeader: session.isLeader,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setModalError(payload.error ?? "Unable to submit answer");
      setSubmitting(false);
      return;
    }

    setModalError("");
    await fetchBoxes();
    setSubmitting(false);
  };

  useEffect(() => {
    if (!selectedGame) {
      const id = window.setTimeout(() => {
        setModalAnswer("");
        setModalError("");
      }, 0);
      return () => window.clearTimeout(id);
    }

    const id = window.setTimeout(() => {
      setModalAnswer(currentOpen?.submitted_answer ?? "");
    }, 0);
    return () => window.clearTimeout(id);
  }, [selectedGame, currentOpen]);

  useEffect(() => {
    if (events.length === 0) {
      setVisibleEvents([]);
      return;
    }
    setVisibleEvents(events);
    const id = window.setTimeout(() => {
      setVisibleEvents([]);
    }, 5000);
    return () => window.clearTimeout(id);
  }, [events]);

  const modalOpen = selectedGame ? currentOpen : null;

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

  const canSubmit =
    round?.status === "active" &&
    gameStarted &&
    (team?.answer_mode === "all_members" || session?.isLeader);

  const isIndividualStartRound = INDIVIDUAL_START_ROUNDS.has(
    round?.round_number ?? 0,
  );

  useEffect(() => {
    if (!gameStarted || !gameStartAt || !round?.duration_seconds) {
      setTimeLeft(null);
      return;
    }

    const openedAt = gameStartAt;
    const durationMs = round.duration_seconds * 1000;

    const updateTimer = () => {
      if (round.status === "paused") {
        return;
      }
      const remaining = Math.max(0, openedAt + durationMs - Date.now());
      setTimeLeft(Math.ceil(remaining / 1000));
    };

    updateTimer();
    const intervalId = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(intervalId);
  }, [gameStarted, gameStartAt, round]);

  useEffect(() => {
    if (!round?.started_at) {
      setGameStarted(false);
      setGameStartAt(null);
      return;
    }

    setGameStarted(true);
    setGameStartAt(new Date(round.started_at).getTime());
  }, [round?.started_at]);

  return (
    <main className="page-shell">
      <div className="page-hero">
        <p className="label">Mission hub</p>
        <h1 className="title">Team control center</h1>
        <p className="subtitle">
          Track your score, review the mission details, and launch the next box
          when your crew is ready.
        </p>
      </div>
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <p className="label">Team dashboard</p>
          <button
            type="button"
            className="button-muted text-sm"
            onClick={() => router.back()}
          >
            Back
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm uppercase text-slate-400">Team</p>
              <h1 className="text-3xl font-semibold">{team?.name ?? "Team"}</h1>
              <p className="text-sm text-slate-300">
                Code: {team?.code ?? session?.teamCode}
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="uppercase tracking-wide text-slate-400">Score</span>
              <span className="text-4xl font-bold text-sky-300">
                {team?.score ?? 0}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-300">
            <p>
              Members: {(team?.member_count ?? 0)}/{team?.max_members ?? "–"}
            </p>
            <p>
              Leader: {team?.leader_name ?? session?.playerName ?? "–"}
            </p>
            <p>
              Answer Mode: {team?.answer_mode === "leader_only" ? "Leader only" : "All members"}
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
                  </span>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              className="button-muted inline-flex items-center"
              onClick={() => {
                if (team?.code) {
                  navigator.clipboard.writeText(team.code);
                }
              }}
            >
              Copy Team Code
            </button>
            <button
              className="button-primary"
              onClick={() => router.push("/leaderboard")}
            >
              View Leaderboard
            </button>
          </div>
        </div>

        {removedNotice && (
          <div className="banner ended">{removedNotice}</div>
        )}

        {roundBanner}

        {modalError && !selectedGame && (
          <div className="banner ended">{modalError}</div>
        )}

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

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="label">Mystery box</p>
            <h2 className="text-2xl font-semibold">Open the box</h2>
          </div>
          {loading && (
            <p className="text-sm text-slate-300">Refreshing boxes…</p>
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
            <span className="text-5xl">
              {round?.status !== "active" ? "🔒" : currentOpen ? "✅" : "🎁"}
            </span>
            <span className="text-lg font-semibold">Mystery Box</span>
            {opening && (
              <span className="text-xs uppercase tracking-wide text-sky-300">
                Opening...
              </span>
            )}
            {currentOpen && (
              <span className={statusStyles[currentOpen.status] ?? "status-pill"}>
                {currentOpen.status}
              </span>
            )}
            {gameStarted && timeLeft !== null && (
              <span
                className={`timer-pill ${timeLeft <= 10 ? "timer-danger" : ""}`}
              >
                Time left: {timeLeft}s
              </span>
            )}
            <p className="text-xs text-slate-400">
              {currentGame?.game_title ?? (currentOpen ? "Mystery game" : "Hidden game")}
            </p>
          </button>
        </div>
      </div>

      {selectedGame && (
        <div className="modal-overlay" onClick={() => setSelectedGame(null)}>
          <div
            className="modal-card reveal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">
                  Mystery Box
                </p>
                <h3 className="text-2xl font-semibold text-slate-900">
                  {selectedGame.game_title ?? "Mystery Game"}
                </h3>
              </div>
              {modalOpen && (
                <span
                  className={
                    statusStyles[modalOpen.status] ?? "status-pill status-pending"
                  }
                >
                  {modalOpen.status}
                </span>
              )}
            </div>

            <p className="text-gray-600">{selectedGame.game_description}</p>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-gray-500">
                Points: {selectedGame.points_value ?? 0}
              </span>
              <span className="text-sm uppercase tracking-wide text-blue-600">
                {selectedGame.game_type ?? "task"}
              </span>
              <span className="timer-pill">
                Round time: {round?.duration_seconds ?? 0}s
              </span>
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-semibold text-gray-700"
                htmlFor="team-submit-answer"
              >
                Submit Answer
              </label>
              <textarea
                id="team-submit-answer"
                className="input-field h-32 resize-none"
                value={modalAnswer}
                onChange={(event) => setModalAnswer(event.target.value)}
                disabled={!canSubmit}
                placeholder="Describe what you completed"
              />
              {!canSubmit && (
                <p className="text-xs text-gray-500">
                  {round?.status !== "active"
                    ? "Boxes cannot be submitted while the round is paused or ended."
                    : !gameStarted
                    ? session?.isLeader
                      ? "Start the game to begin the team timer."
                      : "Waiting for the team leader to start the game."
                    : team?.answer_mode === "leader_only" &&
                      !session?.isLeader
                    ? "Only the team leader can submit answers in this mode."
                    : ""}
                </p>
              )}
            </div>

            {modalError && (
              <p className="text-sm text-red-600" role="alert">
                {modalError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
              {!gameStarted && session?.isLeader && isIndividualStartRound && (
                <button
                  type="button"
                  className="button-primary"
                  onClick={async () => {
                    if (!session) return;
                    const response = await fetch("/api/boxes/start", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ teamId: session.teamId }),
                    });
                    const payload = await response.json();
                    if (!response.ok) {
                      setModalError(payload.error ?? "Unable to start timer");
                      return;
                    }
                    setGameStarted(true);
                    setGameStartAt(new Date(payload.started_at).getTime());
                    setSelectedGame(null);
                  }}
                >
                  Start Game
                </button>
              )}
              {gameStarted && (
                <>
                  <button
                    type="button"
                    className="button-muted"
                    onClick={() => setSelectedGame(null)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="button-primary"
                    disabled={!canSubmit || submitting}
                    onClick={handleSubmit}
                  >
                    {submitting ? "Submitting…" : "Submit for Validation"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
