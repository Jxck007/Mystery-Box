"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { supabaseBrowser } from "@/lib/supabase-browser";

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "";

type TeamDetail = {
  id: string;
  name: string;
  code: string;
  leader_name: string;
  score: number;
  member_count?: number;
  max_members?: number;
  answer_mode: "leader_only" | "all_members";
  is_active?: boolean;
  current_round_status?: string | null;
  current_round_number?: number | null;
  current_round_title?: string | null;
  current_round_remaining_seconds?: number | null;
  eliminated_at?: string | null;
  eliminated_round?: number | null;
  eliminated_position?: number | null;
  round2_code?: string | null;
  round2_lock_until?: string | null;
  round2_solved_at?: string | null;
  round2_status?: string | null;
};

type RoundRecord = {
  id: string;
  round_number?: number | null;
  status: "waiting" | "active" | "paused" | "ended";
  started_at?: string | null;
  ended_at?: string | null;
  ended_by?: "auto" | "admin" | null;
  duration_seconds?: number | null;
  elapsed_seconds?: number | null;
  remaining_seconds?: number | null;
};

type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  member_count?: number;
  max_members?: number;
};

export default function AdminDashboardPage() {
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [rounds, setRounds] = useState<RoundRecord[]>([]);
  const [roundDurationInput, setRoundDurationInput] = useState<
    Record<number, number>
  >({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [teams, setTeams] = useState<TeamDetail[]>([]);
  const [membersCache, setMembersCache] = useState<
    Record<string, { id: string; display_name: string; joined_at: string }[]>
  >({});
  const [statusMessage, setStatusMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoundNumber, setSelectedRoundNumber] = useState<number>(1);
  const [nowTime, setNowTime] = useState(() => Date.now());
  const [leaderboardStatus, setLeaderboardStatus] = useState("");
  const [leaderboardRefreshing, setLeaderboardRefreshing] = useState(false);
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});
  const [rescueEmail, setRescueEmail] = useState("");
  const [rescueLink, setRescueLink] = useState("");
  const [rescueQr, setRescueQr] = useState("");
  const [rescueStatus, setRescueStatus] = useState("");
  const [rescueLoading, setRescueLoading] = useState(false);
  const [round2Inputs, setRound2Inputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const id = window.setTimeout(() => {
      const flag = sessionStorage.getItem("admin_access");
      if (flag === "true") {
        setAuthorized(true);
        setAuthError("");
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const getAdminHeaders = useCallback(() => {
    const stored = sessionStorage.getItem("admin_password") ?? "";
    return { "x-admin-password": stored };
  }, []);

  const handleUnauthorized = useCallback(() => {
    sessionStorage.removeItem("admin_access");
    sessionStorage.removeItem("admin_password");
    setAuthorized(false);
    setAuthError("Admin session expired. Re-enter the password.");
  }, []);

  const fetchRounds = useCallback(async () => {
    const response = await fetch("/api/admin/rounds/list", {
      headers: getAdminHeaders(),
    });
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    const payload = await response.json();
    if (response.ok && Array.isArray(payload)) {
      setRounds(payload);
      setRoundDurationInput((prev) => {
        const next = { ...prev };
        payload.forEach((round: RoundRecord) => {
          if (round.round_number && !next[round.round_number]) {
            next[round.round_number] = round.duration_seconds ?? 0;
          }
        });
        return next;
      });
    }
  }, [getAdminHeaders, handleUnauthorized]);

  const fetchLeaderboard = useCallback(async () => {
    const response = await fetch("/api/leaderboard");
    const payload = await response.json();
    if (response.ok && Array.isArray(payload)) {
      setLeaderboard(payload);
    }
  }, []);

  const fetchTeams = useCallback(async () => {
    const response = await fetch("/api/teams/list?includeInactive=true");
    const data = await response.json();
    if (response.ok && Array.isArray(data)) {
      setTeams(data);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchRounds(), fetchTeams(), fetchLeaderboard()]);
    setRefreshing(false);
  }, [fetchRounds, fetchTeams, fetchLeaderboard]);

  useEffect(() => {
    if (!authorized) {
      return;
    }
    const id = window.setTimeout(() => {
      refreshAll();
    }, 0);
    return () => window.clearTimeout(id);
  }, [authorized, refreshAll]);

  useEffect(() => {
    if (!authorized) {
      return;
    }
    fetchRounds();
  }, [authorized, fetchRounds]);

  useEffect(() => {
    if (!statusMessage) return;
    const id = window.setTimeout(() => {
      setStatusMessage("");
    }, 3000);
    return () => window.clearTimeout(id);
  }, [statusMessage]);

  useEffect(() => {
    if (!authorized) {
      return;
    }

    const roundsChannel = supabaseBrowser
      .channel("admin-rounds")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds" },
        refreshAll,
      )
      .subscribe();

    const opensChannel = supabaseBrowser
      .channel("admin-opens")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "box_opens" },
        refreshAll,
      )
      .subscribe();

    const teamsChannel = supabaseBrowser
      .channel("admin-teams")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        refreshAll,
      )
      .subscribe();

    const playersChannel = supabaseBrowser
      .channel("admin-players")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        refreshAll,
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(roundsChannel);
      supabaseBrowser.removeChannel(opensChannel);
      supabaseBrowser.removeChannel(teamsChannel);
      supabaseBrowser.removeChannel(playersChannel);
    };
  }, [authorized, refreshAll]);

  const handleGate = () => {
    if (!ADMIN_PASSWORD) {
      setAuthError("Admin password is not configured.");
      return;
    }
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem("admin_access", "true");
      sessionStorage.setItem("admin_password", password);
      setAuthorized(true);
      setAuthError("");
      setPassword("");
    } else {
      setAuthError("Incorrect password.");
    }
  };

  const handleRoundAction = async (
    action: "start" | "end" | "pause_team" | "resume_team",
    roundNumber: number,
    teamId?: string,
    busyKey?: string,
  ) => {
    setStatusMessage("");
    if (busyKey) {
      setActionBusy((prev) => ({ ...prev, [busyKey]: true }));
      setStatusMessage("Working...");
    }
    const payload: Record<string, unknown> = { action, roundNumber };
    if (teamId) {
      payload.teamId = teamId;
    }
    if (action === "start") {
      payload.durationSeconds = roundDurationInput[roundNumber] ?? 0;
    }

    const response = await fetch("/api/admin/rounds/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAdminHeaders() },
      body: JSON.stringify(payload),
    });
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    const data = await response.json();

    if (!response.ok) {
      setStatusMessage(data.error ?? "Unable to update round.");
      if (busyKey) {
        setActionBusy((prev) => ({ ...prev, [busyKey]: false }));
      }
      return;
    }

    setStatusMessage("Round updated.");
    await refreshAll();
    if (busyKey) {
      setActionBusy((prev) => ({ ...prev, [busyKey]: false }));
    }
  };

  const handleScoreAction = async (
    teamId: string,
    action: "add" | "deduct" | "reset",
    amount = 1,
    busyKey?: string,
  ) => {
    if (busyKey) {
      setActionBusy((prev) => ({ ...prev, [busyKey]: true }));
      setStatusMessage("Working...");
    }
    const payload: Record<string, unknown> = { teamId, action };
    if (action !== "reset") {
      payload.amount = Math.max(0, Math.floor(amount));
    }

    const response = await fetch("/api/admin/scores/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAdminHeaders() },
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      handleUnauthorized();
      return;
    }

    const data = await response.json();
    if (!response.ok) {
      setStatusMessage(data.error ?? "Unable to adjust score.");
      if (busyKey) {
        setActionBusy((prev) => ({ ...prev, [busyKey]: false }));
      }
      return;
    }

    setStatusMessage("Score updated.");
    await refreshAll();
    if (busyKey) {
      setActionBusy((prev) => ({ ...prev, [busyKey]: false }));
    }
  };

  const handleRemoveTeam = async (teamId: string, busyKey?: string) => {
    if (busyKey) {
      setActionBusy((prev) => ({ ...prev, [busyKey]: true }));
      setStatusMessage("Working...");
    }
    const response = await fetch("/api/admin/teams/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAdminHeaders() },
      body: JSON.stringify({ teamId }),
    });
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    setStatusMessage("Team removed.");
    await refreshAll();
    if (busyKey) {
      setActionBusy((prev) => ({ ...prev, [busyKey]: false }));
    }
  };

  const handleRestoreTeam = async (
    teamId: string,
    action: "restore_snapshot" | "restore_time",
    busyKey?: string,
  ) => {
    if (busyKey) {
      setActionBusy((prev) => ({ ...prev, [busyKey]: true }));
      setStatusMessage("Working...");
    }
    const response = await fetch("/api/admin/teams/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAdminHeaders() },
      body: JSON.stringify({ teamId, action }),
    });
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatusMessage(data.error ?? "Unable to restore team.");
      if (busyKey) {
        setActionBusy((prev) => ({ ...prev, [busyKey]: false }));
      }
      return;
    }
    setStatusMessage(
      action === "restore_snapshot"
        ? "Restored snapshot and score."
        : "Restored remaining time with score reset.",
    );
    await refreshAll();
    if (busyKey) {
      setActionBusy((prev) => ({ ...prev, [busyKey]: false }));
    }
  };

  const handleRound2Code = async (
    teamId: string,
    code: string,
    busyKey?: string,
  ) => {
    if (busyKey) {
      setActionBusy((prev) => ({ ...prev, [busyKey]: true }));
      setStatusMessage("Working...");
    }
    const response = await fetch("/api/admin/round2/code", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAdminHeaders() },
      body: JSON.stringify({ teamId, code }),
    });
    if (response.status === 401) {
      handleUnauthorized();
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatusMessage(data.error ?? "Unable to set code.");
      if (busyKey) {
        setActionBusy((prev) => ({ ...prev, [busyKey]: false }));
      }
      return;
    }
    setStatusMessage("Round 2 code saved.");
    await refreshAll();
    if (busyKey) {
      setActionBusy((prev) => ({ ...prev, [busyKey]: false }));
    }
  };

  useEffect(() => {
    if (!authorized || teams.length === 0) return;
    const missing = teams.filter((team) => !membersCache[team.id]);
    if (missing.length === 0) return;
    missing.forEach(async (team) => {
      const response = await fetch(`/api/teams/${team.id}/players`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (response.ok && Array.isArray(data)) {
        setMembersCache((prev) => ({ ...prev, [team.id]: data }));
        return;
      }
      setMembersCache((prev) => ({ ...prev, [team.id]: [] }));
    });
  }, [authorized, teams, membersCache]);

  useEffect(() => {
    if (!authorized || teams.length === 0) return;
    setRound2Inputs((prev) => {
      const next = { ...prev };
      teams.forEach((team) => {
        if (next[team.id] === undefined && team.round2_code) {
          next[team.id] = team.round2_code;
        }
      });
      return next;
    });
  }, [authorized, teams]);

  const sortedLeaderboard = useMemo(() => {
    return [...leaderboard].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [leaderboard]);

  const eliminationSummary = useMemo(() => {
    const totalTeams = sortedLeaderboard.length;
    const round1Cut = Math.max(1, Math.ceil(totalTeams * 0.6));
    const round2Cut = Math.max(1, Math.ceil(totalTeams * 0.4));
    return { totalTeams, round1Cut, round2Cut };
  }, [sortedLeaderboard]);

  const latestAutoEndedRound = useMemo(() => {
    const autoEnded = rounds.filter((round) => round.ended_by === "auto");
    if (autoEnded.length === 0) return null;
    return autoEnded.reduce((latest, round) => {
      if ((round.round_number ?? 0) > (latest.round_number ?? 0)) return round;
      return latest;
    });
  }, [rounds]);

  const eliminationStage = useMemo(() => {
    return latestAutoEndedRound?.round_number ?? 0;
  }, [latestAutoEndedRound]);

  const activeRoundNumber = useMemo(() => {
    const activeRound = rounds.find((round) => round.status === "active");
    if (activeRound?.round_number) return activeRound.round_number;
    const pausedRound = rounds.find((round) => round.status === "paused");
    if (pausedRound?.round_number) return pausedRound.round_number;
    const waitingRound = rounds.find((round) => round.status === "waiting");
    if (waitingRound?.round_number) return waitingRound.round_number;
    return rounds[0]?.round_number ?? 1;
  }, [rounds]);

  const roundOrder = useMemo(
    () => rounds.map((round) => round.round_number ?? 0).filter(Boolean),
    [rounds],
  );

  const availableRounds = useMemo(() => {
    if (roundOrder.length === 0) return [] as number[];
    const available: number[] = [];
    roundOrder.forEach((roundNumber, index) => {
      if (index === 0) {
        available.push(roundNumber);
        return;
      }
      const prevNumber = roundOrder[index - 1];
      const prevRound = rounds.find((round) => round.round_number === prevNumber);
      if (prevRound?.status === "ended") {
        available.push(roundNumber);
      }
    });
    return available;
  }, [roundOrder, rounds]);

  const selectedRound = useMemo(() => {
    return (
      rounds.find((round) => round.round_number === selectedRoundNumber) ??
      rounds.find((round) => round.round_number === activeRoundNumber) ??
      rounds[0] ??
      null
    );
  }, [rounds, selectedRoundNumber, activeRoundNumber]);

  const isSelectedRoundAvailable = useMemo(() => {
    if (!selectedRound?.round_number) return false;
    return availableRounds.includes(selectedRound.round_number);
  }, [selectedRound, availableRounds]);

  useEffect(() => {
    if (availableRounds.length === 0) return;
    if (!availableRounds.includes(selectedRoundNumber)) {
      setSelectedRoundNumber(availableRounds[0]);
    }
  }, [availableRounds, selectedRoundNumber]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!rescueLink) {
      setRescueQr("");
      return;
    }

    QRCode.toDataURL(rescueLink, {
      margin: 1,
      width: 220,
      color: { dark: "#0b1020", light: "#f8fafc" },
    })
      .then((url: string) => setRescueQr(url))
      .catch(() => setRescueQr(""));
  }, [rescueLink]);

  const formatTime = useCallback((seconds: number | null | undefined) => {
    if (seconds === null || seconds === undefined) return "--:--";
    const safe = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const getLiveRemaining = useCallback(
    (round: RoundRecord | null) => {
      if (!round || !round.duration_seconds) return null;
      if (round.status === "ended") return 0;
      if (round.status === "paused") {
        return Math.max(
          0,
          round.remaining_seconds ??
            round.duration_seconds - (round.elapsed_seconds ?? 0),
        );
      }
      if (round.status === "active" && round.started_at) {
        const startedAt = new Date(round.started_at).getTime();
        const elapsedBase = round.elapsed_seconds ?? 0;
        const elapsedLive = Math.floor((nowTime - startedAt) / 1000);
        const totalElapsed = elapsedBase + Math.max(0, elapsedLive);
        return Math.max(0, round.duration_seconds - totalElapsed);
      }
      return round.remaining_seconds ?? null;
    },
    [nowTime],
  );

  if (!authorized) {
    return (
      <main className="page-shell">
        <div className="page-hero">
          <p className="label">Restricted zone</p>
          <h1 className="title">Admin access</h1>
          <p className="subtitle">
            Authorized personnel only. Enter the access code to continue.
          </p>
        </div>
        <div className="card space-y-4 max-w-md mx-auto border border-red-500/30">
          <input
            type="password"
            className="input-field"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
          />
          {authError && (
            <p className="text-sm text-red-400" role="alert">
              {authError}
            </p>
          )}
          <button
            className="w-full rounded-md px-5 py-3 shadow bg-red-600 text-white hover:bg-red-700"
            onClick={handleGate}
          >
            Enter Restricted Area
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell space-y-6">
      <div className="page-hero">
        <p className="label">Command control</p>
        <h1 className="title">Admin operations</h1>
        <p className="subtitle">
          Launch rounds, monitor teams, and oversee the mission pipeline.
        </p>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label">Round control</p>
            <h2 className="text-2xl font-semibold">Global round settings</h2>
            <p className="text-sm text-slate-300">
              Start a round for all teams, then pause or resume a single team
              if they need extra time after the real-world task.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="button-neutral text-sm"
              onClick={() => window.history.back()}
            >
              Back
            </button>
          </div>
        </div>
        <div className="min-h-6" aria-live="polite">
          {statusMessage && (
            <p className="text-sm text-sky-300">{statusMessage}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {rounds.map((round) => {
            const roundNumber = round.round_number ?? 0;
            const isAvailable = availableRounds.includes(roundNumber);
            const isSelected = roundNumber === (selectedRound?.round_number ?? 0);
            return (
              <button
                key={round.id}
                type="button"
                className={`button-neutral text-sm ${
                  isSelected ? "ring-2 ring-sky-400" : ""
                }`}
                onClick={() => setSelectedRoundNumber(roundNumber)}
                disabled={!isAvailable}
              >
                Round {roundNumber}
              </button>
            );
          })}
        </div>

        {selectedRound && (
          <div className="rounded-2xl border border-slate-700/50 p-4 bg-slate-900/60 shadow-sm max-w-2xl">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Round {selectedRound.round_number}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-slate-300">Status: {selectedRound.status}</p>
              <p className="text-sm text-slate-300">
                Time left: {formatTime(getLiveRemaining(selectedRound))}
              </p>
            </div>
            <label
              className="text-xs text-slate-400"
              htmlFor={`round-duration-${selectedRound.id}`}
            >
              Duration (seconds)
            </label>
            <input
              id={`round-duration-${selectedRound.id}`}
              type="number"
              min={10}
              className="input-field text-sm"
              value={roundDurationInput[selectedRound.round_number ?? 0] ?? 0}
              onChange={(event) =>
                setRoundDurationInput((prev) => ({
                  ...prev,
                  [selectedRound.round_number ?? 0]: Number(event.target.value),
                }))
              }
              disabled={selectedRound.status === "active"}
              readOnly={selectedRound.status === "active"}
            />
            <div className="admin-action-grid mt-2">
              {(() => {
                const roundKey = `round-${selectedRound.round_number ?? 0}-toggle`;
                const roundBusy = actionBusy[roundKey];
                const isActive = selectedRound.status === "active";
                return (
                  <button
                    className={`admin-action-button ${
                      isActive ? "button-danger" : "button-success"
                    }`}
                    onClick={() =>
                      handleRoundAction(
                        isActive ? "end" : "start",
                        selectedRound.round_number ?? 1,
                        undefined,
                        roundKey,
                      )
                    }
                    disabled={!isSelectedRoundAvailable || roundBusy}
                  >
                    {roundBusy
                      ? "Working..."
                      : isActive
                      ? "End Round"
                      : "Start Round"}
                  </button>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <div>
          <p className="label">Rescue access</p>
          <h2 className="text-2xl font-semibold">Magic link fallback</h2>
          <p className="text-sm text-slate-300">
            Generate a one-time magic link if a player cannot receive email.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <label
              className="block text-sm font-semibold text-slate-200"
              htmlFor="rescue-email"
            >
              Player email
            </label>
            <input
              id="rescue-email"
              className="input-field"
              type="email"
              placeholder="player@example.com"
              value={rescueEmail}
              onChange={(event) => setRescueEmail(event.target.value)}
            />
          </div>
          <button
            className="button-neutral"
            type="button"
            disabled={rescueLoading}
            onClick={async () => {
              setRescueStatus("");
              setRescueLink("");
              setRescueQr("");
              setRescueLoading(true);
              const response = await fetch("/api/admin/auth/link", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAdminHeaders() },
                body: JSON.stringify({ email: rescueEmail, redirectTo: "/" }),
              });
              if (response.status === 401) {
                handleUnauthorized();
                return;
              }
              const data = await response.json();
              if (!response.ok) {
                setRescueStatus(data.error ?? "Unable to generate link");
                setRescueLoading(false);
                return;
              }
              setRescueLink(data.link ?? "");
              setRescueStatus("Link ready. Share it with the player.");
              setRescueLoading(false);
            }}
          >
            {rescueLoading ? "Generating..." : "Generate link"}
          </button>
        </div>
        {rescueStatus && <p className="text-sm text-slate-300">{rescueStatus}</p>}
        {rescueLink && (
          <div className="space-y-2">
            <label
              className="block text-sm font-semibold text-slate-200"
              htmlFor="rescue-link"
            >
              Rescue link
            </label>
            <textarea
              id="rescue-link"
              className="input-field h-24"
              readOnly
              value={rescueLink}
            />
            <button
              className="button-muted"
              type="button"
              onClick={() => navigator.clipboard.writeText(rescueLink)}
            >
              Copy link
            </button>
            {rescueQr && (
              <div className="rounded-xl border border-slate-700/50 bg-white p-3 inline-flex">
                <img src={rescueQr} alt="Rescue QR code" width={220} height={220} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label">Leaderboard</p>
            <h2 className="text-2xl font-semibold">Live standings</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="button-neutral text-sm"
              onClick={async () => {
                setLeaderboardRefreshing(true);
                setLeaderboardStatus("Refreshing...");
                await fetchLeaderboard();
                setLeaderboardRefreshing(false);
                setLeaderboardStatus("Up to date");
                window.setTimeout(() => setLeaderboardStatus(""), 2000);
              }}
              disabled={refreshing || leaderboardRefreshing}
            >
              {leaderboardRefreshing ? "Refreshing..." : "Refresh"}
            </button>
            {leaderboardStatus && (
              <span className="text-sm text-slate-300">{leaderboardStatus}</span>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Members</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((team, index) => (
                <tr key={team.id}>
                  <td>{index + 1}</td>
                  <td className="font-semibold text-slate-100">{team.name}</td>
                  <td>
                    {team.member_count ?? 0}
                    {team.max_members ? `/${team.max_members}` : ""}
                  </td>
                  <td>{team.score ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {leaderboard.length === 0 && (
            <p className="text-sm text-slate-300">No teams yet.</p>
          )}
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="label">Team manager</p>
            <h2 className="text-2xl font-semibold">Teams &amp; scores</h2>
          </div>
          <p className="text-sm text-slate-300">
            {teams.filter((team) => team.is_active).length} active teams
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Code</th>
                <th>Leader</th>
                <th>Members</th>
                <th>Score</th>
                <th>Access</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <td>
                    <p className="font-semibold text-slate-100">{team.name}</p>
                    {!team.is_active && (
                      <span className="text-xs text-red-400">Inactive</span>
                    )}
                  </td>
                  <td>{team.code}</td>
                  <td>{team.leader_name}</td>
                  <td>
                    <div className="text-sm text-slate-200">
                      {(team.member_count ?? 0)}/{team.max_members ?? "-"}
                    </div>
                    {membersCache[team.id] ? (
                      <div className="mt-1 text-xs text-slate-300">
                        {membersCache[team.id].length
                          ? membersCache[team.id]
                              .map((member) => member.display_name)
                              .join(", ")
                          : "No members yet"}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-slate-500">Loading members...</div>
                    )}
                  </td>
                  <td>{team.score ?? 0}</td>
                  <td>
                    <div className="text-xs text-slate-300">
                      {team.eliminated_at
                        ? `Eliminated (Round ${team.eliminated_round ?? "?"})`
                        : "Active"}
                    </div>
                    <div className="text-xs text-slate-400">
                      {team.eliminated_position
                        ? `Position: ${team.eliminated_position}`
                        : "Global rounds"}
                    </div>
                    {team.current_round_remaining_seconds !== null &&
                      team.current_round_remaining_seconds !== undefined && (
                        <div className="mt-1 text-xs text-slate-300">
                          Time left: {formatTime(team.current_round_remaining_seconds)}
                        </div>
                      )}
                  </td>
                  <td>
                    <div className="admin-action-grid mb-2">
                      {(() => {
                        const addKey = `score-${team.id}-add`;
                        const addBusy = actionBusy[addKey];
                        return (
                          <button
                            className="admin-action-button button-success"
                            onClick={() =>
                              handleScoreAction(team.id, "add", 1, addKey)
                            }
                            disabled={addBusy}
                          >
                            {addBusy ? "Working..." : "+1 Point"}
                          </button>
                        );
                      })()}
                      {(() => {
                        const deductKey = `score-${team.id}-deduct`;
                        const deductBusy = actionBusy[deductKey];
                        return (
                          <button
                            className="admin-action-button button-danger"
                            onClick={() =>
                              handleScoreAction(team.id, "deduct", 1, deductKey)
                            }
                            disabled={deductBusy}
                          >
                            {deductBusy ? "Working..." : "-1 Point"}
                          </button>
                        );
                      })()}
                    </div>
                    <div className="admin-action-grid">
                      {(() => {
                        const resetKey = `score-${team.id}-reset`;
                        const resetBusy = actionBusy[resetKey];
                        return (
                          <button
                            className="admin-action-button button-neutral"
                            onClick={() =>
                              handleScoreAction(team.id, "reset", 1, resetKey)
                            }
                            disabled={resetBusy}
                          >
                            {resetBusy ? "Working..." : "Reset Score"}
                          </button>
                        );
                      })()}
                      {(() => {
                        const removeKey = `team-${team.id}-remove`;
                        const removeBusy = actionBusy[removeKey];
                        return (
                          <button
                            className="admin-action-button button-danger"
                            onClick={() => handleRemoveTeam(team.id, removeKey)}
                            disabled={removeBusy}
                          >
                            {removeBusy ? "Working..." : "Remove Team"}
                          </button>
                        );
                      })()}
                    </div>
                    <div className="mt-2 admin-action-grid">
                      {(() => {
                        const teamRoundKey = `team-${team.id}-round`;
                        const teamRoundBusy = actionBusy[teamRoundKey];
                        const action =
                          team.current_round_status === "paused"
                            ? "resume_team"
                            : team.current_round_status === "active"
                            ? "pause_team"
                            : "start";
                        const label =
                          team.current_round_status === "paused"
                            ? "Resume Team"
                            : team.current_round_status === "active"
                            ? "Pause Team"
                            : "Start Team";
                        const tone =
                          team.current_round_status === "active"
                            ? "button-neutral"
                            : "button-success";
                        return (
                          <button
                            className={`admin-action-button ${tone}`}
                            onClick={() =>
                              handleRoundAction(
                                action,
                                activeRoundNumber,
                                team.id,
                                teamRoundKey,
                              )
                            }
                            disabled={teamRoundBusy}
                          >
                            {teamRoundBusy ? "Working..." : label}
                          </button>
                        );
                      })()}
                    </div>
                    <div className="mt-2 admin-action-grid">
                      {(() => {
                        const restoreKey = `team-${team.id}-restore`;
                        const restoreBusy = actionBusy[restoreKey];
                        return (
                          <button
                            className="admin-action-button button-success"
                            onClick={() =>
                              handleRestoreTeam(team.id, "restore_snapshot", restoreKey)
                            }
                            disabled={restoreBusy}
                          >
                            {restoreBusy ? "Working..." : "Restore Snapshot"}
                          </button>
                        );
                      })()}
                      {(() => {
                        const restoreTimeKey = `team-${team.id}-restore-time`;
                        const restoreTimeBusy = actionBusy[restoreTimeKey];
                        return (
                          <button
                            className="admin-action-button button-neutral"
                            onClick={() =>
                              handleRestoreTeam(team.id, "restore_time", restoreTimeKey)
                            }
                            disabled={restoreTimeBusy}
                          >
                            {restoreTimeBusy ? "Working..." : "Restore Time"}
                          </button>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card space-y-4">
        <div>
          <p className="label">Round 2 controls</p>
          <h2 className="text-2xl font-semibold">Per-team code keypad</h2>
          <p className="text-sm text-slate-300">
            Set the 4-digit code for each team. Codes unlock the Round 2 keypad.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {teams.map((team) => {
            const input = round2Inputs[team.id] ?? "";
            const lockUntil = team.round2_lock_until
              ? new Date(team.round2_lock_until).getTime()
              : null;
            const lockRemaining = lockUntil ? Math.ceil((lockUntil - Date.now()) / 1000) : 0;
            const lockLabel = lockRemaining > 0 ? `Locked ${lockRemaining}s` : "Unlocked";
            const statusLabel = team.round2_solved_at
              ? team.round2_status === "qualified"
                ? "Qualified"
                : "Eliminated"
              : team.round2_code
              ? "Code ready"
              : "Awaiting";
            const busyKey = `round2-${team.id}-code`;
            const busy = actionBusy[busyKey];
            return (
              <div
                key={team.id}
                className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{team.name}</p>
                    <p className="text-xs text-slate-400">Team code: {team.code}</p>
                  </div>
                  <div className="text-xs text-slate-300">{statusLabel}</div>
                </div>
                <div className="text-xs text-slate-400">Lock: {lockLabel}</div>
                <div className="text-xs text-slate-400">
                  Current code: {team.round2_code ?? "--"}
                </div>
                <div className="code-panel">
                  <div className="code-display">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <span key={index} className="code-slot">
                        {input[index] ?? "_"}
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
                            if (input.length < 4) {
                              setRound2Inputs((prev) => ({
                                ...prev,
                                [team.id]: `${input}${value}`,
                              }));
                            }
                          }}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="button-muted"
                      onClick={() =>
                        setRound2Inputs((prev) => ({ ...prev, [team.id]: "" }))
                      }
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => handleRound2Code(team.id, input, busyKey)}
                      disabled={input.length !== 4 || busy}
                    >
                      {busy ? "Saving..." : "Set Code"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card space-y-4">
        <div>
          <p className="label">Tournament board</p>
          <h2 className="text-2xl font-semibold">Elimination tracker</h2>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-slate-300">
          <span>Round 1 cut: Top {eliminationSummary.round1Cut}</span>
          <span>Round 2 cut: Top {eliminationSummary.round2Cut}</span>
          <span>
            Status: {eliminationStage > 0
              ? `Round ${eliminationStage} officially ended`
              : "Waiting for official round end"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Score</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedLeaderboard.map((team, index) => {
                const rank = index + 1;
                const round1Cut = eliminationSummary.round1Cut;
                const round2Cut = eliminationSummary.round2Cut;
                const isFinal = round2Cut === 1;
                let statusLabel = "In play";
                if (eliminationStage >= 2) {
                  statusLabel =
                    rank <= round2Cut
                      ? isFinal
                        ? "Winner"
                        : "Qualified"
                      : rank <= round1Cut
                      ? "Playoff"
                      : "Eliminated";
                } else if (eliminationStage >= 1) {
                  statusLabel =
                    rank <= round1Cut
                      ? "Playoff"
                      : "Eliminated";
                }
                const rowClass =
                  statusLabel === "Winner"
                    ? "bg-emerald-500/10"
                    : statusLabel === "Qualified"
                    ? "bg-sky-500/10"
                    : statusLabel === "Playoff"
                    ? "bg-amber-500/10"
                    : statusLabel === "Eliminated"
                    ? "bg-rose-500/10"
                    : "";

                return (
                  <tr key={team.id} className={rowClass}>
                    <td>{rank}</td>
                    <td className="font-semibold text-slate-100">{team.name}</td>
                    <td>{team.score ?? 0}</td>
                    <td>{statusLabel}</td>
                    <td>
                      {(() => {
                        const removeKey = `board-${team.id}-remove`;
                        const removeBusy = actionBusy[removeKey];
                        return (
                          <button
                            className="button-danger text-xs"
                            onClick={() => handleRemoveTeam(team.id, removeKey)}
                            disabled={removeBusy}
                          >
                            {removeBusy ? "Working..." : "Remove Team"}
                          </button>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
