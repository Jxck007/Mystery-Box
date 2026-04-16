"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { ROUND1_SURVIVOR_LIMIT } from "@/lib/pair-battle";

type TeamDetail = {
  id: string;
  name: string;
  leader_name: string;
  score: number;
  updated_at?: string | null;
  created_at?: string | null;
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
  const [nowTime, setNowTime] = useState(() => Date.now());
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});
  const [eventLogs, setEventLogs] = useState<TeamEventLog[]>([]);
  const [expandedTeamLogs, setExpandedTeamLogs] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    if (!authorized) return;
    const id = window.setInterval(() => {
      void refreshAll();
    }, 5000);
    return () => window.clearInterval(id);
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
    if (action === "start" && !teamId) {
       setRounds((prev) => prev.map(r => r.round_number === roundNumber ? { ...r, status: "active", started_at: new Date().toISOString(), elapsed_seconds: 0 } : r));
    }
    if (action === "end" && !teamId) {
       setRounds((prev) => prev.map(r => r.round_number === roundNumber ? { ...r, status: "ended", ended_at: new Date().toISOString() } : r));
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

  const sortedTeamsByScore = useMemo(() => {
    return [...teams].sort((a, b) => {
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      const aUpdated = a.updated_at ? new Date(a.updated_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bUpdated = b.updated_at ? new Date(b.updated_at).getTime() : Number.MAX_SAFE_INTEGER;
      if (aUpdated !== bUpdated) return aUpdated - bUpdated;
      const aCreated = a.created_at ? new Date(a.created_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bCreated = b.created_at ? new Date(b.created_at).getTime() : Number.MAX_SAFE_INTEGER;
      if (aCreated !== bCreated) return aCreated - bCreated;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
  }, [teams]);

  const sortedActiveTeamsByScore = useMemo(() => {
    return [...teams]
      .filter((team) => team.is_active !== false)
      .sort((a, b) => {
        const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        const aUpdated = a.updated_at ? new Date(a.updated_at).getTime() : Number.MAX_SAFE_INTEGER;
        const bUpdated = b.updated_at ? new Date(b.updated_at).getTime() : Number.MAX_SAFE_INTEGER;
        if (aUpdated !== bUpdated) return aUpdated - bUpdated;
        const aCreated = a.created_at ? new Date(a.created_at).getTime() : Number.MAX_SAFE_INTEGER;
        const bCreated = b.created_at ? new Date(b.created_at).getTime() : Number.MAX_SAFE_INTEGER;
        if (aCreated !== bCreated) return aCreated - bCreated;
        return (a.name ?? "").localeCompare(b.name ?? "");
      });
  }, [teams]);

  const topQualifiersLive = useMemo(() => {
    return sortedActiveTeamsByScore.slice(0, ROUND1_SURVIVOR_LIMIT);
  }, [sortedActiveTeamsByScore]);

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

  const round1Ended = useMemo(() => {
    return rounds.some((round) => (round.round_number ?? 0) === 1 && round.status === "ended");
  }, [rounds]);

  const round1Active = useMemo(() => {
    return rounds.some((round) => (round.round_number ?? 0) === 1 && round.status === "active");
  }, [rounds]);

  const eliminationRows = useMemo(() => {
    return round1Ended ? sortedTeamsByScore : sortedActiveTeamsByScore;
  }, [round1Ended, sortedTeamsByScore, sortedActiveTeamsByScore]);

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
      const duration = round?.duration_seconds ?? 180;
      if (!round) return duration;
      if (round.status === "ended") return 0;
      if (round.status === "waiting") return duration;
      if (round.status === "paused") {
        return Math.max(
          0,
          round.remaining_seconds ??
          duration - (round.elapsed_seconds ?? 0),
        );
      }
      if (round.status === "active") {
        if (!round.started_at) {
          return duration - (round.elapsed_seconds ?? 0);
        }
        const startedAt = new Date(round.started_at).getTime();
        const elapsedBase = round.elapsed_seconds ?? 0;
        const elapsedLive = Math.floor((nowTime - startedAt) / 1000);
        const totalElapsed = elapsedBase + Math.max(0, elapsedLive);
        return Math.max(0, duration - totalElapsed);
      }
      return round.remaining_seconds ?? null;
    },
    [nowTime],
  );

  useEffect(() => {
    if (!authorized) return;
    const activeRound = rounds.find((r) => r.status === "active");
    if (!activeRound) return;
    if ((activeRound.round_number ?? 0) !== 1) return;
  }, [authorized, rounds, getLiveRemaining, actionBusy, handleRoundAction]);

  if (!authorized) return null;

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#fff", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>OPERATOR_MAIN</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.5 }}>V.2.0.4_STABLE</div>
        </div>
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {["ROUND CONTROL", "SCORES", "ELIMINATION", "LIVE LOGS"].map((item) => (
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
                className="button-neutral text-xs ring-2 ring-sky-400"
              >
                Round 1
              </button>
            </div>
          </div>          <div className="min-h-6" aria-live="polite">
            {statusMessage && <p className="text-sm text-sky-300">{statusMessage}</p>}
          </div>

          <div className="card admin-section space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label">Mystery Box Phase</p>
                <h2 className="text-2xl font-semibold">Mission Control Center</h2>
                <p className="text-sm text-slate-300">
                  Manage Round 1 operations. The mission clock and team synchronization are fully automated.
                </p>
              </div>
            </div>
            {(() => {
              const r1 = rounds.find(r => (r.round_number ?? 0) === 1) || {
                round_number: 1,
                status: "waiting",
                duration_seconds: 180,
                elapsed_seconds: 0
              };
              const isActive = r1.status === "active";
              const isEnded = r1.status === "ended";
              const remaining = getLiveRemaining(r1 as RoundRecord);
              const total = r1.duration_seconds ?? 180;
              const pct = Math.max(0, (remaining ?? total) / total);
              const circumference = 2 * Math.PI * 24;
              const dashOffset = circumference * (1 - pct);
              const isDanger = remaining !== null && remaining <= 30 && isActive;

              const startKey = "round1-start";
              const endKey = "round1-end";
              const startBusy = actionBusy[startKey];
              const endBusy = actionBusy[endKey];

              return (
                <div className="round-card" data-active={isActive}>
                  <div className="round-card-header">
                    <span className="round-card-title">Round 1 (Mission Clock)</span>
                    <div className="live-status" data-status={
                      isActive ? "live"
                        : r1.status === "paused" ? "ongoing"
                          : isEnded ? "completed"
                            : "waiting"
                    }>
                      <span className="status-dot" />
                      {isActive ? "ACTIVE"
                        : r1.status === "paused" ? "PAUSED"
                          : isEnded ? "COMPLETED"
                            : "PENDING"}
                    </div>
                  </div>

                  <div className="admin-action-grid mt-6 gap-4">
                    <button
                      className="admin-action-button button-success cursor-pointer scale-105 shadow-emerald-500/20 shadow-lg"
                      style={{ background: "#10b981", color: "#062016", border: "none", fontWeight: 800 }}
                      onClick={() => handleRoundAction("start", 1, undefined, startKey)}
                      disabled={isActive || startBusy}
                    >
                      {startBusy ? "INITIALIZING..." : "▶ LAUNCH ROUND 1"}
                    </button>
                    <button
                      className="admin-action-button button-danger cursor-pointer scale-105 shadow-rose-500/20 shadow-lg"
                      style={{ background: "#ef4444", color: "#3e0a0a", border: "none", fontWeight: 800 }}
                      onClick={() => handleRoundAction("end", 1, undefined, endKey)}
                      disabled={!isActive || endBusy}
                    >
                      {endBusy ? "TERMINATING..." : "⏹ END ROUND 1"}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="card admin-section space-y-4">
            <div>
              <p className="label">Live logs</p>
              <h2 className="text-2xl font-semibold">Team Activity Feed</h2>
              <p className="text-sm text-slate-300">
                Monitor team interactions in real-time categorized by recent events.
              </p>
            </div>
            <div className="space-y-2 max-h-72 overflow-auto">
              {groupedTeamLogs.length === 0 && (
                <p className="text-sm text-slate-400">No events caught by interceptors...</p>
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
                          <div key={event.id} className="rounded-lg border border-slate-700/40 bg-slate-950/60 p-2 text-xs">
                            <span className="text-cyan-400">[{new Date(event.created_at).toLocaleTimeString()}]</span> {event.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card admin-section space-y-4">
            <div>
              <p className="label">Tournament Board</p>
              <h2 className="text-2xl font-semibold">Selection Pool</h2>
              <p className="text-sm text-slate-300">
                Ranked team standings based on Mission Score.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>Score</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {eliminationRows.map((team, index) => (
                    <tr key={team.id}>
                      <td className="w-16">{index + 1}</td>
                      <td>{team.name}</td>
                      <td className="w-24">{team.score ?? 0}</td>
                      <td className="w-32">
                        <button
                          className="button-danger text-xs scale-90"
                          onClick={() => handleRemoveTeam(team.id, `remove-${team.id}`)}
                          disabled={actionBusy[`remove-${team.id}`]}
                        >
                          {actionBusy[`remove-${team.id}`] ? "Removing..." : "Remove"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
