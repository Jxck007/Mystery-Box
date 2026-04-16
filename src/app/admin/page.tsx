"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { PairBattleBoard } from "@/app/components/pair-battle-board";
import { ROUND1_SURVIVOR_LIMIT, ROUND2_PAIR_COUNT } from "@/lib/pair-battle";

type TeamDetail = {
  id: string;
  name: string;
  leader_name: string;
  score: number;
  member_count?: number;
  max_members?: number;
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

type TeamEventLog = {
  id: string;
  team_id: string;
  team_name: string;
  event_type: string;
  message: string;
  created_at: string;
};

const ROUND2_QUALIFY_LIMIT = ROUND2_PAIR_COUNT;

export default function AdminDashboardPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(true);
  const [rounds, setRounds] = useState<RoundRecord[]>([]);
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
  const [eventLogs, setEventLogs] = useState<TeamEventLog[]>([]);
  const [expandedTeamLogs, setExpandedTeamLogs] = useState<Record<string, boolean>>({});
  const [adminTab, setAdminTab] = useState<"round1" | "round2">("round1");

  const getAdminHeaders = useCallback(async () => {
    const { data } = await supabaseBrowser.auth.getSession();
    if (!data.session?.access_token) {
      return null;
    }

    return {
      Authorization: `Bearer ${data.session.access_token}`,
    };
  }, []);

  const handleUnauthorized = useCallback(() => {
    setAuthorized(false);
    router.replace("/admin-entry");
  }, [router]);

  const handleAdminLocked = useCallback(() => {
    setAuthorized(false);
    router.replace("/admin-entry");
  }, [router]);

  const handleAdminAuthResponse = useCallback(
    (response: Response) => {
      if (response.status === 401) {
        handleUnauthorized();
        return true;
      }
      if (response.status === 403) {
        handleAdminLocked();
        return true;
      }
      return false;
    },
    [handleUnauthorized, handleAdminLocked],
  );

  const handleLockConsole = useCallback(async () => {
    await fetch("/api/admin/session", { method: "DELETE" }).catch(() => null);
    handleAdminLocked();
  }, [handleAdminLocked]);

  useEffect(() => {
    const verifyAdminUnlock = async () => {
      const response = await fetch("/api/admin/session", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.unlocked) {
        handleUnauthorized();
        return;
      }
    };
    verifyAdminUnlock();
  }, [handleUnauthorized]);

  const fetchRounds = useCallback(async () => {
    const adminHeaders = await getAdminHeaders();
    const response = await fetch("/api/admin/rounds/list", {
      headers: adminHeaders ?? undefined,
    });
    if (handleAdminAuthResponse(response)) {
      return;
    }
    const payload = await response.json();
    if (response.ok && Array.isArray(payload)) {
      setRounds(payload);
    }
  }, [getAdminHeaders, handleAdminAuthResponse]);

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

  const fetchEventLogs = useCallback(async () => {
    const adminHeaders = await getAdminHeaders();
    const response = await fetch("/api/admin/events", {
      headers: adminHeaders ?? undefined,
      cache: "no-store",
    });
    if (handleAdminAuthResponse(response)) {
      return;
    }
    const data = await response.json().catch(() => []);
    if (response.ok && Array.isArray(data)) {
      setEventLogs(data);
    }
  }, [getAdminHeaders, handleAdminAuthResponse]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchRounds(), fetchTeams(), fetchLeaderboard(), fetchEventLogs()]);
    setRefreshing(false);
  }, [fetchRounds, fetchTeams, fetchLeaderboard, fetchEventLogs]);

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

  const handleRoundAction = async (
    action: "start" | "end" | "pause_team" | "resume_team",
    roundNumber: number,
    teamId?: string,
    busyKey?: string,
  ) => {
    setStatusMessage("");
    if (busyKey) {
      setActionBusy((prev) => ({ ...prev, [busyKey]: true }));
      setStatusMessage("Syncing command...");
    }
    const payload: Record<string, unknown> = { action, roundNumber };
    if (teamId) {
      payload.teamId = teamId;
    }

    const adminHeaders = await getAdminHeaders();

    const response = await fetch("/api/admin/rounds/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(adminHeaders ?? {}) },
      body: JSON.stringify(payload),
    });
    if (handleAdminAuthResponse(response)) {
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


  const handleRemoveTeam = async (teamId: string, busyKey?: string) => {
    if (busyKey) {
      setActionBusy((prev) => ({ ...prev, [busyKey]: true }));
      setStatusMessage("Syncing command...");
    }
    const adminHeaders = await getAdminHeaders();

    const response = await fetch("/api/admin/teams/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(adminHeaders ?? {}) },
      body: JSON.stringify({ teamId }),
    });
    if (handleAdminAuthResponse(response)) {
      return;
    }
    setStatusMessage("Team removed.");
    await refreshAll();
    if (busyKey) {
      setActionBusy((prev) => ({ ...prev, [busyKey]: false }));
    }
  };


  const handleLoadDemoData = async (busyKey: string) => {
    setActionBusy((prev) => ({ ...prev, [busyKey]: true }));
    setStatusMessage("Seeding demo teams for admin testing...");

    const adminHeaders = await getAdminHeaders();
    const response = await fetch("/api/admin/pair-battle/demo-seed", {
      method: "POST",
      headers: adminHeaders ?? undefined,
    });

    if (handleAdminAuthResponse(response)) {
      return;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatusMessage(data.error ?? "Unable to seed demo data.");
      setActionBusy((prev) => ({ ...prev, [busyKey]: false }));
      return;
    }

    setStatusMessage(data.message ?? "Demo teams seeded for round panel testing.");
    await refreshAll();
    setActionBusy((prev) => ({ ...prev, [busyKey]: false }));
  };

  const handleApplyElimination = async (
    roundNumber: 1 | 2,
    busyKey: string,
  ) => {
    setActionBusy((prev) => ({ ...prev, [busyKey]: true }));
    setStatusMessage(
      roundNumber === 1
        ? `Applying Round 1 cut: top ${ROUND1_SURVIVOR_LIMIT} by score...`
        : `Applying Round 2 cut: first ${ROUND2_QUALIFY_LIMIT} solvers...`,
    );

    const adminHeaders = await getAdminHeaders();

    const response = await fetch("/api/admin/elimination/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(adminHeaders ?? {}) },
      body: JSON.stringify({ roundNumber }),
    });

    if (handleAdminAuthResponse(response)) {
      return;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatusMessage(data.error ?? "Unable to apply elimination.");
      setActionBusy((prev) => ({ ...prev, [busyKey]: false }));
      return;
    }

    setStatusMessage(
      roundNumber === 1
        ? `Round 1 elimination applied. Top ${ROUND1_SURVIVOR_LIMIT} remain active.`
        : `Round 2 elimination applied. First ${ROUND2_QUALIFY_LIMIT} solved teams qualified.`,
    );
    if (roundNumber === 1) {
      setAdminTab("round2");
      setSelectedRoundNumber(2);
    }
    await refreshAll();
    setActionBusy((prev) => ({ ...prev, [busyKey]: false }));
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

  const sortedLeaderboard = useMemo(() => {
    return [...leaderboard].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [leaderboard]);

  const sortedTeamsByScore = useMemo(() => {
    return [...teams].sort((a, b) => {
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
  }, [teams]);

  const sortedActiveTeamsByScore = useMemo(() => {
    return [...teams]
      .filter((team) => team.is_active !== false)
      .sort((a, b) => {
        const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        return (a.name ?? "").localeCompare(b.name ?? "");
      });
  }, [teams]);

  const projectedRound1SelectedIds = useMemo(() => {
    const cut = Math.min(sortedActiveTeamsByScore.length, ROUND1_SURVIVOR_LIMIT);
    return new Set(sortedActiveTeamsByScore.slice(0, cut).map((team) => team.id));
  }, [sortedActiveTeamsByScore]);

  const groupedTeamLogs = useMemo(() => {
    const grouped = new Map<string, { teamName: string; events: TeamEventLog[] }>();
    eventLogs.forEach((event) => {
      const existing = grouped.get(event.team_id);
      if (existing) {
        existing.events.push(event);
      } else {
        grouped.set(event.team_id, { teamName: event.team_name, events: [event] });
      }
    });

    return Array.from(grouped.entries())
      .map(([teamId, group]) => ({
        teamId,
        teamName: group.teamName,
        events: group.events.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      }))
      .sort((a, b) => {
        const aLast = a.events[0]?.created_at ?? "";
        const bLast = b.events[0]?.created_at ?? "";
        return new Date(bLast).getTime() - new Date(aLast).getTime();
      });
  }, [eventLogs]);

  const eliminationSummary = useMemo(() => {
    const totalTeams = sortedTeamsByScore.length;
    const activeTeams = sortedActiveTeamsByScore.length;
    const round1Cut = Math.min(activeTeams, ROUND1_SURVIVOR_LIMIT);
    const round2Cut = Math.min(round1Cut, ROUND2_QUALIFY_LIMIT);
    return { totalTeams, activeTeams, round1Cut, round2Cut };
  }, [sortedTeamsByScore, sortedActiveTeamsByScore]);

  const round2SolvedCount = useMemo(() => {
    return teams.filter((team) => Boolean(team.round2_solved_at)).length;
  }, [teams]);

  const round2QualifiedCount = useMemo(() => {
    return teams.filter((team) => team.round2_status === "qualified").length;
  }, [teams]);

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

  const round2TabUnlocked = useMemo(() => {
    const round1Ended = rounds.some((round) => (round.round_number ?? 0) === 1 && round.status === "ended");
    if (round1Ended) return true;
    if (eliminationStage >= 1) return true;
    const activeTeamCount = teams.filter((team) => team.is_active !== false).length;
    if (activeTeamCount > 0 && activeTeamCount <= ROUND1_SURVIVOR_LIMIT) return true;
    return teams.some(
      (team) =>
        team.eliminated_round === 1 ||
        team.round2_status === "pending" ||
        team.round2_status === "qualified",
    );
  }, [eliminationStage, rounds, teams]);

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

  const round2Round = useMemo(() => {
    return rounds.find((round) => (round.round_number ?? 0) === 2) ?? null;
  }, [rounds]);

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
    if (adminTab === "round2" && !round2TabUnlocked) {
      setAdminTab("round1");
    }
  }, [adminTab, round2TabUnlocked]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

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

  if (!authorized) return null;

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#fff", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>OPERATOR_MAIN</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.5 }}>V.2.0.4_STABLE</div>
        </div>
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {["ROUND CONTROL", "SCORES", "ELIMINATION", "PAIR BATTLE", "LIVE LOGS"].map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 700 }}>
              {item}
            </div>
          ))}
        </nav>
        <button className="button-primary" style={{ width: "100%", marginTop: "auto" }} onClick={handleLockConsole}>
          LOCK_CONSOLE
        </button>
      </aside>
      <div className="app-main">
        <main className="page-shell space-y-6">
          <div className="space-y-2">
            <button
              type="button"
              className="admin-toolbar-back"
              onClick={() => window.history.back()}
              aria-label="Go back"
            >
              ←
            </button>
            <p className="section-tag">COMMAND_CENTER</p>
            <h1 className="font-headline text-5xl md:text-6xl font-black uppercase" style={{ letterSpacing: "-0.04em" }}>
              CORE_SYSTEM
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              Launch rounds, monitor teams, and oversee the mission pipeline.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="label">ADMIN CONTROL PANEL</span>
              <button
                type="button"
                className={`button-neutral text-xs ${adminTab === "round1" ? "ring-2 ring-sky-400" : ""}`}
                onClick={() => setAdminTab("round1")}
              >
                Round 1
              </button>
              <button
                type="button"
                className={`button-neutral text-xs ${adminTab === "round2" ? "ring-2 ring-cyan-400" : ""}`}
                onClick={() => setAdminTab("round2")}
                disabled={!round2TabUnlocked}
              >
                Round 2
              </button>
              {!round2TabUnlocked && (
                <span className="label text-[var(--text-muted)]">Unlocks after Round 1 cut</span>
              )}
            </div>
          </div>

          <div className="min-h-6" aria-live="polite">
            {statusMessage && <p className="text-sm text-sky-300">{statusMessage}</p>}
          </div>

          {adminTab === "round1" && (
            <>
          <div className="card admin-section space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label">Round control</p>
            <h2 className="text-2xl font-semibold">Round control</h2>
            <p className="text-sm text-slate-300">
              Start a round for all teams, then pause or resume a single team
              if they need extra time after the real-world task.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {rounds.filter((round) => (round.round_number ?? 0) === 1).map((round) => {
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
                {roundNumber === 1 ? "Round 1 Control" : `Round ${roundNumber}`}
              </button>
            );
          })}
        </div>

        {rounds.length === 0 && (
          <p className="text-sm text-slate-300">
            No round records found yet. Seed round data to unlock Start Round 1 controls.
          </p>
        )}

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
                      ? "Syncing..."
                      : isActive
                      ? "End Round"
                      : "Start Round"}
                  </button>
                );
              })()}
            </div>
          </div>
        )}

        {selectedRound?.round_number === 1 && (
          <div className="rounded-2xl border border-emerald-500/30 p-4 bg-emerald-950/20 shadow-sm max-w-2xl">
            <p className="text-xs uppercase tracking-wide text-emerald-300">Round 1 Bulk Start</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-100">Start All Teams At Once</h3>
            <p className="mt-1 text-sm text-slate-300">
              Starts Round 1 for every team in one command from the admin panel.
            </p>
            <div className="mt-3">
              {(() => {
                const busyKey = "round1-start-all";
                const busy = actionBusy[busyKey];
                return (
                  <button
                    className="admin-action-button button-success"
                    onClick={() => handleRoundAction("start", 1, undefined, busyKey)}
                    disabled={busy}
                  >
                    {busy ? "Syncing..." : "Start All Teams"}
                  </button>
                );
              })()}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-cyan-500/30 p-4 bg-cyan-950/20 shadow-sm max-w-2xl">
          <p className="text-xs uppercase tracking-wide text-cyan-300">Demo Mode</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-100">Load Demo Data For Round Admin Testing</h3>
          <p className="mt-1 text-sm text-slate-300">
            Seeds up to 16 demo teams so you can test round start, score flow, and elimination behavior quickly.
          </p>
          <div className="mt-3">
            {(() => {
              const busyKey = "demo-seed-round-panel";
              const busy = actionBusy[busyKey];
              return (
                <button
                  className="admin-action-button button-neutral"
                  onClick={() => void handleLoadDemoData(busyKey)}
                  disabled={busy}
                >
                  {busy ? "Syncing..." : "Load Demo Teams"}
                </button>
              );
            })()}
          </div>
        </div>

        <div className="card admin-section space-y-4">
          <div>
            <p className="label">Live logs</p>
            <h2 className="text-2xl font-semibold">Team activity feed (grouped)</h2>
            <p className="text-sm text-slate-300">
              Click a team row to expand or collapse its activity history.
            </p>
          </div>
          <div className="space-y-2 max-h-72 overflow-auto">
            {groupedTeamLogs.length === 0 && (
              <p className="text-sm text-slate-400">No events yet.</p>
            )}
            {groupedTeamLogs.map((group) => {
              const expanded = Boolean(expandedTeamLogs[group.teamId]);
              const latest = group.events[0];
              return (
                <div key={group.teamId} className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-3">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() =>
                      setExpandedTeamLogs((prev) => ({
                        ...prev,
                        [group.teamId]: !expanded,
                      }))
                    }
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-100">{group.teamName}</p>
                      <p className="text-xs text-slate-400">
                        {group.events.length} event{group.events.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {latest && (
                      <p className="text-xs text-slate-400 mt-1">
                        Latest: {new Date(latest.created_at).toLocaleTimeString()} - {latest.message}
                      </p>
                    )}
                  </button>

                  {expanded && (
                    <div className="mt-3 space-y-2">
                      {group.events.map((event) => (
                        <div key={event.id} className="rounded-lg border border-slate-700/40 bg-slate-950/60 p-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs uppercase tracking-wide text-slate-500">{event.event_type}</p>
                            <p className="text-xs text-slate-400">
                              {new Date(event.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                          <p className="text-sm text-slate-200">{event.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>


          <div className="card admin-section space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label">Leaderboard</p>
            <h2 className="text-2xl font-semibold">Live standings</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Members</th>
                <th>Score</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <td>
                    <div className="font-semibold text-slate-100">{team.name}</div>
                    <div className="text-xs text-slate-400">
                      Leader: {team.leader_name ?? "-"}
                    </div>
                  </td>
                  <td className="text-sm text-slate-300">
                    {team.member_count ?? 0}/{team.max_members ?? "-"}
                  </td>
                  <td>{team.score ?? 0}</td>
                  <td>
                    <div className="text-xs text-slate-300">
                      {team.eliminated_at
                        ? `Eliminated (Round ${team.eliminated_round ?? "?"})`
                        : team.current_round_status === "paused"
                        ? "Suspended"
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
                    <div className="admin-action-grid">
                      {(() => {
                        const removeKey = `team-${team.id}-remove`;
                        const removeBusy = actionBusy[removeKey];
                        return (
                          <button
                            className="admin-action-button button-danger"
                            onClick={() => handleRemoveTeam(team.id, removeKey)}
                            disabled={removeBusy}
                          >
                            {removeBusy ? "Syncing..." : "Remove Team"}
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

          <div className="card admin-section space-y-4">
        <div>
          <p className="label">Tournament board</p>
          <h2 className="text-2xl font-semibold">Elimination tracker</h2>
              <p className="text-sm text-slate-300">
                Round 1 keeps top {ROUND1_SURVIVOR_LIMIT} teams by score. Round 2 keeps first {ROUND2_QUALIFY_LIMIT} teams to solve the code.
              </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-slate-300">
          <span>Active teams: {eliminationSummary.activeTeams}</span>
          <span>Round 1 cut: Top {eliminationSummary.round1Cut} active teams</span>
              <span>Round 2 cut: First {eliminationSummary.round2Cut} solves</span>
              <span>Round 2 solved: {round2SolvedCount}</span>
              <span>Round 2 qualified: {round2QualifiedCount}</span>
          <span>
            Status: {eliminationStage > 0
              ? `Round ${eliminationStage} officially ended`
              : "Waiting for official round end"}
          </span>
        </div>
            <div className="admin-action-grid">
              {(() => {
                const busyKey = "elimination-round1";
                const busy = actionBusy[busyKey];
                return (
                  <button
                    className="admin-action-button button-neutral"
                    onClick={() => handleApplyElimination(1, busyKey)}
                    disabled={busy}
                  >
                    {busy ? "Syncing..." : `Apply Round 1 Cut (Top ${ROUND1_SURVIVOR_LIMIT})`}
                  </button>
                );
              })()}
              <div className="rounded-lg border border-slate-700/50 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
                Round 2 elimination is automatic in pair battle mode.
              </div>
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
              {sortedTeamsByScore.map((team, index) => {
                const rank = index + 1;
                const isActuallyRound1Selected =
                  team.is_active !== false && team.eliminated_round !== 1;
                const isProjectedRound1Selected = projectedRound1SelectedIds.has(team.id);
                let statusLabel = "In play";
                if (eliminationStage >= 2) {
                  statusLabel =
                    team.round2_status === "qualified"
                      ? "Qualified"
                      : team.round2_solved_at
                      ? "Round 2 Out"
                      : team.eliminated_round === 1
                      ? "Not Selected"
                      : isActuallyRound1Selected
                      ? "Selected"
                      : team.eliminated_round === 1
                      ? "Not Selected"
                      : "Round 2 Out";
                } else if (eliminationStage >= 1) {
                  statusLabel = isActuallyRound1Selected ? "Selected" : "Not Selected";
                } else {
                  statusLabel = isProjectedRound1Selected ? "Projected Selected" : "Projected Out";
                }
                const rowClass =
                  statusLabel === "Winner"
                    ? "bg-emerald-500/10"
                    : statusLabel === "Qualified"
                    ? "bg-sky-500/10"
                    : statusLabel === "Selected"
                    ? "bg-lime-500/20"
                    : statusLabel === "Projected Selected"
                    ? "bg-lime-500/10"
                    : statusLabel === "Not Selected"
                    ? "bg-rose-600/20"
                    : statusLabel === "Projected Out"
                    ? "bg-rose-600/10"
                    : statusLabel === "Round 2 Out"
                    ? "bg-amber-600/15"
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
                            {removeBusy ? "Syncing..." : "Remove Team"}
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
      </>
      )}
      {adminTab === "round2" && round2TabUnlocked && round2Round && (
        <>
          <div className="card admin-section space-y-4">
            <div>
              <p className="label">Round 2 Control</p>
              <h2 className="text-2xl font-semibold">Start / End Round 2</h2>
              <p className="text-sm text-slate-300">
                Start Round 2 to unlock the keypad phase for teams. End it when the phase is complete.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <span>Status: {round2Round.status}</span>
              <span>Time left: {formatTime(getLiveRemaining(round2Round))}</span>
            </div>
            <div className="admin-action-grid">
              {(() => {
                const busyKey = "round2-toggle";
                const busy = actionBusy[busyKey];
                const isActive = round2Round.status === "active";
                return (
                  <button
                    className={`admin-action-button ${isActive ? "button-danger" : "button-success"}`}
                    onClick={() =>
                      handleRoundAction(isActive ? "end" : "start", 2, undefined, busyKey)
                    }
                    disabled={busy}
                  >
                    {busy ? "Syncing..." : isActive ? "End Round 2" : "Start Round 2"}
                  </button>
                );
              })()}
            </div>
          </div>

          <PairBattleBoard 
            roundId={round2Round.id} 
            onStatusChange={setStatusMessage} 
            getAdminHeaders={getAdminHeaders}
          />
        </>
      )}
      {adminTab === "round2" && (!round2TabUnlocked || !round2Round) && (
        <div className="card admin-section space-y-2">
          <p className="label">Round 2 Control Center</p>
          <h2 className="text-2xl font-semibold">Pair Battle Locked</h2>
          <p className="text-sm text-slate-300">
            {!round2TabUnlocked
              ? "Apply Round 1 elimination first to unlock Pair Battle setup."
              : "Round 2 record missing. Create Round 2 in round control first."}
          </p>
        </div>
      )}
          <div className="card">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: "NODE CONNECTIVITY", value: 92 },
                { label: "DB SYNC", value: 88 },
                { label: "PROXY INTEGRITY", value: 95 },
                { label: "THERMAL", value: 73 },
              ].map((metric) => (
                <div key={metric.label} className="space-y-2">
                  <p className="label">{metric.label}</p>
                  <div className="timer-bar w-full">
                    <div className="timer-fill" style={{ width: `${metric.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
