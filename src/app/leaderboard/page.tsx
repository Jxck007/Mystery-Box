"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { isTestModeEnabled } from "@/lib/test-mode";
import { playSound, playSoundAndWait } from "@/lib/sound-manager";

type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  member_count?: number;
  max_members?: number;
};

type PairRow = {
  id: string;
  pair_number?: number | null;
  status: "waiting" | "ready" | "in_progress" | "completed";
  winner_id?: string | null;
  team_a_id?: string | null;
  team_b_id?: string | null;
  team_a_color?: string | null;
  team_b_color?: string | null;
  team_a_code?: string | null;
  team_b_code?: string | null;
  team_a_latest_attempt?: string | null;
  team_b_latest_attempt?: string | null;
  team_a_attempts?: number;
  team_b_attempts?: number;
  is_live?: boolean;
  team_a?: { id: string; name: string } | null;
  team_b?: { id: string; name: string } | null;
};

type Round2State = {
  id: string;
  round_number: number;
  status: "waiting" | "active" | "paused" | "ended";
};

type LeaderboardPayload = {
  entries: LeaderboardEntry[];
  round2: Round2State | null;
  activeRoundNumber?: number | null;
  pairings: PairRow[];
};

function getPairState(pair: PairRow) {
  if (pair.status === "completed") return "winner";
  if (pair.is_live) return "solving";
  if (pair.status === "in_progress") return "pending";
  if (pair.status === "ready") return "pending";
  return "pending";
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [pairings, setPairings] = useState<PairRow[]>([]);
  const [round2, setRound2] = useState<Round2State | null>(null);
  const [activeRoundNumber, setActiveRoundNumber] = useState<number | null>(null);
  const [selectedRoundTab, setSelectedRoundTab] = useState<"round1" | "round2">("round1");
  const [autoTabInitialized, setAutoTabInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkedSession, setCheckedSession] = useState(false);
  const [round1Outcome, setRound1Outcome] = useState<"selected" | "eliminated" | null>(null);
  const testMode = isTestModeEnabled();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const round2Result = sessionStorage.getItem("round2_result");
      const leaderboardSoundPlayed = sessionStorage.getItem("leaderboard_sound_played");
      if ((round2Result === "win_r2" || round2Result === "lose_r2") && leaderboardSoundPlayed !== "1") {
        void playSound(round2Result);
        window.sessionStorage.setItem("leaderboard_sound_played", "1");
        return;
      }

      const postRound1Sound = sessionStorage.getItem("post_round1_result_sound");
      const postRound1Outcome = sessionStorage.getItem("post_round1_outcome");
      if (postRound1Outcome === "selected" || postRound1Outcome === "eliminated") {
        setRound1Outcome(postRound1Outcome);
        if (postRound1Sound === "win_r1" || postRound1Sound === "lose_r1") {
          sessionStorage.removeItem("post_round1_result_sound");
          await playSoundAndWait(postRound1Sound, 12000);
        }
        if (!cancelled && postRound1Outcome === "selected") {
          router.replace("/team");
        }
        return;
      }

      playSound("leaderboard_open");
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    if (testMode) {
      setEntries([
        { id: "t1", name: "TEST COLLECTIVE", score: 2400, member_count: 3, max_members: 4 },
        { id: "t2", name: "NODE_02", score: 2100, member_count: 4, max_members: 4 },
        { id: "t3", name: "NODE_03", score: 1800, member_count: 3, max_members: 4 },
        { id: "t4", name: "SKULL RAIDERS", score: 1700, member_count: 4, max_members: 4 },
        { id: "t5", name: "BONE CIRCUIT", score: 1650, member_count: 4, max_members: 4 },
        { id: "t6", name: "PHANTOM LOGIC", score: 1625, member_count: 4, max_members: 4 },
      ]);
      setRound2({ id: "test-round2", round_number: 2, status: "active" });
      setActiveRoundNumber(2);
      if (!autoTabInitialized) {
        setSelectedRoundTab("round2");
        setAutoTabInitialized(true);
      }
      setPairings([
        {
          id: "p1",
          pair_number: 1,
          status: "in_progress",
          team_a_id: "t1",
          team_b_id: "t4",
          team_a_attempts: 2,
          team_b_attempts: 3,
          is_live: true,
          team_a: { id: "t1", name: "TEST COLLECTIVE" },
          team_b: { id: "t4", name: "SKULL RAIDERS" },
        },
        {
          id: "p2",
          pair_number: 2,
          status: "completed",
          winner_id: "t2",
          team_a_id: "t2",
          team_b_id: "t5",
          team_a_attempts: 1,
          team_b_attempts: 4,
          team_a: { id: "t2", name: "NODE_02" },
          team_b: { id: "t5", name: "BONE CIRCUIT" },
        },
        {
          id: "p3",
          pair_number: 3,
          status: "ready",
          team_a_id: "t3",
          team_b_id: "t6",
          team_a_attempts: 0,
          team_b_attempts: 0,
          team_a: { id: "t3", name: "NODE_03" },
          team_b: { id: "t6", name: "PHANTOM LOGIC" },
        },
      ]);
      setLoading(false);
      return;
    }

    const response = await fetch("/api/leaderboard?includeBattle=1", { cache: "no-store" });
    const data = (await response.json().catch(() => null)) as LeaderboardPayload | LeaderboardEntry[] | null;

    if (!response.ok || !data) {
      setLoading(false);
      return;
    }

    if (Array.isArray(data)) {
      setEntries(data);
      setPairings([]);
      setRound2(null);
      setActiveRoundNumber(null);
      setLoading(false);
      return;
    }

    setEntries(Array.isArray(data.entries) ? data.entries : []);
    setPairings(Array.isArray(data.pairings) ? data.pairings : []);
    setRound2(data.round2 ?? null);
    setActiveRoundNumber(typeof data.activeRoundNumber === "number" ? data.activeRoundNumber : null);
    if (!autoTabInitialized && typeof data.activeRoundNumber === "number") {
      setSelectedRoundTab(data.activeRoundNumber === 2 ? "round2" : "round1");
      setAutoTabInitialized(true);
    }
    setLoading(false);
  }, [autoTabInitialized, testMode]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (testMode) {
        localStorage.setItem("team_id", "test-team");
        localStorage.setItem("player_name", "TEST_OPERATOR");
        localStorage.setItem("is_leader", "true");
        setCheckedSession(true);
        fetchLeaderboard();
        return;
      }

      supabaseBrowser.auth.getSession().then(async ({ data }) => {
        if (!data.session) {
          router.replace("/auth?redirect=/leaderboard");
          return;
        }

        setCheckedSession(true);
        await fetchLeaderboard();
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [fetchLeaderboard, router, testMode]);

  useEffect(() => {
    if (testMode) return;

    const teamsChannel = supabaseBrowser
      .channel("leaderboard-teams")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, fetchLeaderboard)
      .subscribe();

    const playersChannel = supabaseBrowser
      .channel("leaderboard-players")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, fetchLeaderboard)
      .subscribe();

    const pairingsChannel = supabaseBrowser
      .channel("leaderboard-pair-pairings")
      .on("postgres_changes", { event: "*", schema: "public", table: "pair_pairings" }, fetchLeaderboard)
      .subscribe();

    const pairSubmissionsChannel = supabaseBrowser
      .channel("leaderboard-pair-submissions")
      .on("postgres_changes", { event: "*", schema: "public", table: "pair_submissions" }, fetchLeaderboard)
      .subscribe();

    const roundsChannel = supabaseBrowser
      .channel("leaderboard-rounds")
      .on("postgres_changes", { event: "*", schema: "public", table: "rounds" }, fetchLeaderboard)
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(teamsChannel);
      supabaseBrowser.removeChannel(playersChannel);
      supabaseBrowser.removeChannel(pairingsChannel);
      supabaseBrowser.removeChannel(pairSubmissionsChannel);
      supabaseBrowser.removeChannel(roundsChannel);
    };
  }, [fetchLeaderboard, testMode]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchLeaderboard();
    }, 4000);
    return () => window.clearInterval(intervalId);
  }, [fetchLeaderboard]);

  const showBattleView = useMemo(() => {
    const round2Available = Boolean(round2 && ["active", "paused", "ended"].includes(round2.status) && pairings.length > 0);
    return selectedRoundTab === "round2" && round2Available;
  }, [pairings.length, round2, selectedRoundTab]);

  const hasNoRoundStarted = useMemo(() => {
    if (loading || testMode) return false;
    return !activeRoundNumber && !round2;
  }, [activeRoundNumber, loading, round2, testMode]);

  if (!checkedSession) {
    return (
      <main className="page-shell">
        <div className="card">
          <p className="text-sm text-slate-300">Checking team session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="space-y-2">
        <p className="section-tag">LIVE_STANDINGS</p>
        <h1 className="font-headline text-6xl md:text-7xl font-black uppercase" style={{ letterSpacing: "-0.04em" }}>
          LEADERBOARD
        </h1>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-[var(--accent)]" style={{ animation: "pulse-dot 1.2s ease-in-out infinite" }} />
          <span className="label text-[var(--accent)]">STREAMING</span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            className={`button-neutral text-xs ${selectedRoundTab === "round1" ? "ring-2 ring-sky-400" : ""}`}
            onClick={() => setSelectedRoundTab("round1")}
          >
            Round 1
          </button>
          <button
            type="button"
            className={`button-neutral text-xs ${selectedRoundTab === "round2" ? "ring-2 ring-cyan-400" : ""}`}
            onClick={() => setSelectedRoundTab("round2")}
            disabled={!round2 || pairings.length === 0}
          >
            Round 2
          </button>
        </div>
      </div>

      {hasNoRoundStarted && (
        <section className="card text-center py-14">
          <p className="label">TOURNAMENT STANDBY</p>
          <h2 className="font-headline text-4xl font-black uppercase mt-2">No rounds have started yet</h2>
          <p className="text-sm text-slate-300 mt-3">Waiting for admin to initialize the event.</p>
        </section>
      )}

      {round1Outcome === "selected" && (
        <div className="banner paused">Congrats on passing Round 1. Auto redirecting to dashboard...</div>
      )}

      {round1Outcome === "eliminated" && (
        <div className="banner ended">
          Thanks for playing.
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="button-muted" onClick={() => router.push("/")}>CUT TO HOME</button>
            <button
              className="button-danger"
              onClick={async () => {
                await supabaseBrowser.auth.signOut();
                router.replace("/");
              }}
            >
              CUT SESSION
            </button>
          </div>
        </div>
      )}

      {!hasNoRoundStarted && showBattleView && (
        <section className="card space-y-4 round2-battle-board">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="label">ROUND 2 PAIR BATTLES</p>
              <h2 className="text-3xl font-semibold">Head to Head Elimination</h2>
            </div>
            <span className="label text-[var(--accent)]">LIVE BATTLE MODE</span>
          </div>

          <div className="battle-grid">
            {pairings.map((pair, index) => {
              const state = getPairState(pair);
              const aWon = pair.winner_id && pair.team_a_id === pair.winner_id;
              const bWon = pair.winner_id && pair.team_b_id === pair.winner_id;
              const label = pair.pair_number ?? index + 1;
              return (
                <article key={pair.id} className={`battle-card battle-${state}`}>
                  <header className="battle-header">
                    <span className="label">Pair {label}</span>
                    <span className="battle-state">{state === "winner" ? "WINNER FOUND" : state === "solving" ? "LIVE SOLVING" : "PENDING"}</span>
                  </header>

                  <div className="battle-matchup">
                    <div className={`battle-team ${aWon ? "battle-winner" : bWon ? "battle-loser" : ""}`}>
                      <div className="battle-team-name">{pair.team_a?.name ?? "Awaiting Team"}</div>
                      <div className="battle-team-meta">{pair.team_a_color ?? "Color pending"}</div>
                      <div className="battle-team-meta">Attempts: {pair.team_a_attempts ?? 0}</div>
                      <div className="battle-team-meta">Latest: {pair.team_a_latest_attempt ?? "--"}</div>
                      <div className="battle-team-meta">Code: {pair.team_a_code ?? "----"}</div>
                      {aWon && <div className="battle-badge">WON</div>}
                      {bWon && <div className="battle-badge lose">ELIMINATED</div>}
                    </div>

                    <div className="battle-vs">VS</div>

                    <div className={`battle-team ${bWon ? "battle-winner" : aWon ? "battle-loser" : ""}`}>
                      <div className="battle-team-name">{pair.team_b?.name ?? "Awaiting Team"}</div>
                      <div className="battle-team-meta">{pair.team_b_color ?? "Color pending"}</div>
                      <div className="battle-team-meta">Attempts: {pair.team_b_attempts ?? 0}</div>
                      <div className="battle-team-meta">Latest: {pair.team_b_latest_attempt ?? "--"}</div>
                      <div className="battle-team-meta">Code: {pair.team_b_code ?? "----"}</div>
                      {bWon && <div className="battle-badge">WON</div>}
                      {aWon && <div className="battle-badge lose">ELIMINATED</div>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {!hasNoRoundStarted && selectedRoundTab === "round1" && (
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="label">Live leaderboard</p>
            <h1 className="text-3xl font-semibold">Top teams</h1>
            <span className="label text-[var(--text-muted)]">AUTO REFRESH: 4S</span>
          </div>
          <button className="button-secondary px-3 py-1 text-xs" onClick={() => router.back()}>
            BACK
          </button>
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
              {entries.map((team, index) => {
                const isEliminated = team.name.toLowerCase().includes("eliminated");
                return (
                  <tr key={team.id} style={{ opacity: isEliminated ? 0.55 : 1 }}>
                    <td className="align-top">
                      <span className="font-mono" style={{ color: index < 3 ? "var(--accent)" : "var(--text-muted)" }}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </td>
                    <td>
                      <p className="font-semibold" style={{ color: "#fff", textDecoration: isEliminated ? "line-through" : "none" }}>
                        {team.name}
                      </p>
                    </td>
                    <td>
                      {team.member_count ?? 0}
                      {team.max_members ? `/${team.max_members}` : ""}
                    </td>
                    <td className="font-headline text-2xl font-black">{team.score ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {entries.length === 0 && !loading && (
            <p className="text-sm text-slate-300 py-4">No teams yet. Invite others to start solving mystery boxes.</p>
          )}
        </div>
      </div>
      )}

      {!hasNoRoundStarted && selectedRoundTab === "round2" && !showBattleView && (
        <section className="card text-center py-10">
          <p className="label">ROUND 2 VIEW</p>
          <p className="text-sm text-slate-300 mt-2">Round 2 battle board is not available yet.</p>
        </section>
      )}

      <style jsx>{`
        .round2-battle-board {
          border: 1px solid rgba(71, 192, 255, 0.35);
          box-shadow: 0 0 22px rgba(24, 122, 255, 0.2), inset 0 0 35px rgba(36, 53, 99, 0.18);
          background: radial-gradient(circle at 20% 0%, rgba(8, 27, 48, 0.82), #10162a 55%, #0b0f1f 100%);
        }
        .battle-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 0.8rem;
        }
        .battle-card {
          border-radius: 12px;
          border: 1px solid rgba(98, 139, 205, 0.35);
          padding: 0.8rem;
          background: linear-gradient(180deg, rgba(15, 21, 38, 0.95), rgba(10, 15, 27, 0.95));
        }
        .battle-pending { border-color: rgba(255, 214, 130, 0.5); }
        .battle-solving { border-color: rgba(103, 212, 255, 0.7); box-shadow: 0 0 18px rgba(62, 174, 255, 0.34); animation: solvingPulse 1.4s ease-in-out infinite; }
        .battle-winner { border-color: rgba(71, 224, 141, 0.65); box-shadow: 0 0 16px rgba(71, 224, 141, 0.2); }
        .battle-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.6rem;
        }
        .battle-state {
          font-family: var(--font-mono);
          font-size: 0.65rem;
          letter-spacing: 0.14em;
          color: #9ac9f4;
        }
        .battle-matchup {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 0.45rem;
          align-items: stretch;
        }
        .battle-team {
          border: 1px solid rgba(106, 140, 188, 0.35);
          border-radius: 10px;
          padding: 0.55rem;
          background: rgba(8, 12, 21, 0.82);
          position: relative;
        }
        .battle-team-name {
          font-weight: 700;
          color: #eff8ff;
          font-size: 0.83rem;
        }
        .battle-team-meta {
          font-size: 0.68rem;
          color: #8da8cb;
          margin-top: 0.15rem;
        }
        .battle-vs {
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-headline);
          font-size: 0.88rem;
          color: #7cd6ff;
        }
        .battle-winner {
          border-color: rgba(74, 220, 151, 0.7);
          box-shadow: inset 0 0 0 1px rgba(75, 235, 156, 0.25);
          background: rgba(10, 38, 25, 0.72);
        }
        .battle-loser {
          border-color: rgba(246, 112, 112, 0.62);
          background: rgba(45, 16, 20, 0.72);
        }
        .battle-badge {
          position: absolute;
          right: 0.4rem;
          top: 0.4rem;
          border-radius: 999px;
          font-size: 0.58rem;
          letter-spacing: 0.12em;
          padding: 0.1rem 0.38rem;
          background: rgba(61, 220, 145, 0.22);
          color: #74f0b2;
          font-family: var(--font-mono);
          font-weight: 700;
        }
        .battle-badge.lose {
          background: rgba(245, 87, 87, 0.2);
          color: #ff9d9d;
        }
        @keyframes solvingPulse {
          0%,
          100% { box-shadow: 0 0 10px rgba(62, 174, 255, 0.18); }
          50% { box-shadow: 0 0 22px rgba(62, 174, 255, 0.34); }
        }
      `}</style>
    </main>
  );
}
