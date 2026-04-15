"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { isTestModeEnabled } from "@/lib/test-mode";
import { playSound } from "@/lib/sound-manager";

type RoundRecord = {
  id: string;
  status: "waiting" | "active" | "paused" | "ended";
  round_number?: number | null;
  remaining_seconds?: number | null;
  duration_seconds?: number | null;
};

type TeamDetail = {
  id: string;
  name: string;
  leader_name: string;
  round2_code?: string | null;
  round2_lock_until?: string | null;
  round2_solved_at?: string | null;
  round2_status?: string | null;
  pair_battle_enabled?: boolean | null;
};

type SessionData = {
  teamId: string;
  playerName: string;
  isLeader: boolean;
};

type PairingStatusRecord = {
  id: string;
  status?: string | null;
  pair_number?: number | null;
  winner_id?: string | null;
  team_a_id?: string | null;
  team_b_id?: string | null;
  team_a?: { id: string; name: string; leader_name?: string | null } | null;
  team_b?: { id: string; name: string; leader_name?: string | null } | null;
};

const TEST_OPPONENT_TEAM = {
  id: "test-team-rival",
  name: "SKULL RAIDERS",
  leader_name: "RIVAL_01",
};

export default function Round2Page() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [round, setRound] = useState<RoundRecord | null>(null);
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [round2Code, setRound2Code] = useState("");
  const [round2Status, setRound2Status] = useState("");
  const [attemptCount, setAttemptCount] = useState(0);
  const [lastLockSeconds, setLastLockSeconds] = useState(10);
  const [lockRemaining, setLockRemaining] = useState(0);
  const [activePairingId, setActivePairingId] = useState<string | null>(null);
  const [activePairing, setActivePairing] = useState<PairingStatusRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [startPlayed, setStartPlayed] = useState(false);
  const resultPlayedRef = useRef(false);
  const redirectTimeoutRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState(0);
  const testMode = isTestModeEnabled();

  const playRound2Result = useCallback((qualified: boolean) => {
    resultPlayedRef.current = true;
    playSound("correct_r2");
    window.sessionStorage.setItem("round2_result", qualified ? "win_r2" : "lose_r2");
    window.sessionStorage.setItem("leaderboard_sound_played", "0");

    // Start countdown
    setRedirectCountdown(10);
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
    }
    countdownIntervalRef.current = window.setInterval(() => {
      setRedirectCountdown(prev => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            window.clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    if (redirectTimeoutRef.current) {
      window.clearTimeout(redirectTimeoutRef.current);
    }

    redirectTimeoutRef.current = window.setTimeout(() => {
      redirectTimeoutRef.current = null;
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      router.replace("/leaderboard");
    }, 10000);
  }, [router]);

  const fetchRound = useCallback(async () => {
    if (!session) return;
    if (testMode) {
      setRound({ id: "test-round2", status: "active", round_number: 2, duration_seconds: 180, remaining_seconds: 147 });
      setLoading(false);
      return;
    }

    setLoading(true);
    const response = await fetch(`/api/boxes?teamId=${session.teamId}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (response.ok) {
      setRound(payload?.round ?? null);
    }
    setLoading(false);
  }, [session, testMode]);

  const fetchTeam = useCallback(async () => {
    if (!session) return;
    if (testMode) {
      setTeam({
        id: "test-team",
        name: "TEST COLLECTIVE",
        leader_name: "TEST_OPERATOR",
        round2_code: "1234",
        round2_status: "pending",
        pair_battle_enabled: true,
      });
      return;
    }

    const response = await fetch("/api/teams/list?includeInactive=true");
    const data = await response.json().catch(() => null);
    if (response.ok && Array.isArray(data)) {
      const matching = data.find((entry) => entry.id === session.teamId);
      if (matching) {
        setTeam(matching);
      }
    }
  }, [session, testMode]);

  const fetchActivePairing = useCallback(async () => {
    if (!session || !round?.id || !team?.pair_battle_enabled) {
      setActivePairing(null);
      setActivePairingId(null);
      return;
    }

    if (testMode) {
      const demoPairing: PairingStatusRecord = {
        id: "test-pair-1",
        status: "in_progress",
        pair_number: 1,
        winner_id: null,
        team_a_id: session.teamId,
        team_b_id: TEST_OPPONENT_TEAM.id,
        team_a: { id: session.teamId, name: team?.name ?? "TEST COLLECTIVE", leader_name: team?.leader_name ?? "TEST_OPERATOR" },
        team_b: TEST_OPPONENT_TEAM,
      };
      setActivePairing(demoPairing);
      setActivePairingId(demoPairing.id);
      return;
    }

    const { data } = await supabaseBrowser.auth.getSession();
    if (!data.session) {
      setActivePairing(null);
      setActivePairingId(null);
      return;
    }

    const response = await fetch(`/api/admin/pair-battle/status?roundId=${round.id}`, {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      setActivePairing(null);
      setActivePairingId(null);
      return;
    }

    const payload = await response.json().catch(() => null);
    const pairings: PairingStatusRecord[] = Array.isArray(payload?.pairings)
      ? (payload.pairings as PairingStatusRecord[])
      : [];

    const teamPair = pairings.find((pairing) =>
      pairing.team_a_id === session.teamId || pairing.team_b_id === session.teamId,
    ) ?? null;

    setActivePairing(teamPair);
    setActivePairingId(teamPair?.id ?? null);
  }, [round?.id, session, team?.leader_name, team?.name, team?.pair_battle_enabled, testMode]);

  useEffect(() => {
    const storedTeamId = localStorage.getItem("team_id");
    const storedPlayer = localStorage.getItem("player_name");
    const leaderFlag = localStorage.getItem("is_leader");

    if (!storedTeamId || !storedPlayer) {
      if (testMode) {
        localStorage.setItem("team_id", "test-team");
        localStorage.setItem("player_name", "TEST_OPERATOR");
        localStorage.setItem("is_leader", "true");
        setSession({ teamId: "test-team", playerName: "TEST_OPERATOR", isLeader: true });
        return;
      }
      router.replace("/");
      return;
    }

    setSession({
      teamId: storedTeamId,
      playerName: storedPlayer,
      isLeader: leaderFlag === "true",
    });
  }, [router, testMode]);

  useEffect(() => {
    if (!session) return;
    void fetchRound();
    void fetchTeam();
  }, [fetchRound, fetchTeam, session]);

  useEffect(() => {
    void fetchActivePairing();
  }, [fetchActivePairing]);

  useEffect(() => {
    if (lockRemaining <= 0) return;
    const id = window.setInterval(() => {
      setLockRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [lockRemaining]);

  useEffect(() => {
    if (!round) return;
    const hasResult = Boolean(team?.round2_solved_at && team?.round2_status);
    if (!hasResult && (round.status !== "active" || round.round_number !== 2)) {
      router.replace("/team");
    }
  }, [round, router, team?.round2_solved_at, team?.round2_status]);

  useEffect(() => {
    if (!round || round.status !== "active" || round.round_number !== 2) return;
    if (team?.round2_solved_at) return;

    const round2Started = window.sessionStorage.getItem("round2_started");
    if (round2Started === round.id) {
      setStartPlayed(true);
      return;
    }

    playSound("reset_streak");
    playSound("start_r2");
    window.sessionStorage.setItem("round2_started", round.id);
    setStartPlayed(true);
  }, [round, team?.round2_solved_at]);

  useEffect(() => {
    if (!team?.round2_lock_until) return;

    const lockUntilMs = new Date(team.round2_lock_until).getTime();
    if (!Number.isFinite(lockUntilMs)) return;

    const remaining = Math.max(0, Math.ceil((lockUntilMs - Date.now()) / 1000));
    if (remaining > 0) {
      setLockRemaining((prev) => (prev > remaining ? prev : remaining));
      setLastLockSeconds(remaining);
      setRound2Status((prev) => prev || `Locked. Try again in ${remaining}s.`);
    }
  }, [team?.round2_lock_until]);

  useEffect(() => {
    if (!team?.round2_solved_at || !team.round2_status) {
      resultPlayedRef.current = false;
      return;
    }

    if (resultPlayedRef.current) return;
    resultPlayedRef.current = true;

    const qualified = team.round2_status === "qualified";
    window.sessionStorage.setItem("round2_result", qualified ? "win_r2" : "lose_r2");
    window.sessionStorage.setItem("leaderboard_sound_played", "0");
    router.replace("/leaderboard");
  }, [router, team?.round2_solved_at, team?.round2_status]);

  // Cleanup countdown interval on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
      }
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, []);

  const opponentName = (() => {
    if (!activePairing || !session) return null;
    if (activePairing.team_a_id === session.teamId) return activePairing.team_b?.name ?? "Unknown";
    if (activePairing.team_b_id === session.teamId) return activePairing.team_a?.name ?? "Unknown";
    return null;
  })();

  const pairLabel = activePairing?.pair_number ?? null;
  const solvedQualified = Boolean(team?.round2_solved_at && team.round2_status === "qualified");
  const solvedEliminated = Boolean(team?.round2_solved_at && team.round2_status !== "qualified");

  return (
    <main className="page-shell min-h-screen">
      <div className="space-y-2">
        <p className="section-tag">PHASE_02_ACTIVE</p>
        <h1 className="font-headline text-5xl md:text-6xl font-black uppercase" style={{ letterSpacing: "-0.04em" }}>
          CRACK / THE / CODE
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <section className="md:col-span-7 card space-y-5">
          <div className="card py-4" style={{ borderLeft: "3px solid var(--accent)" }}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--accent)]">key</span>
              <p className="label">CLUE RECEIVED</p>
            </div>
            <p className="font-mono text-sm text-[var(--text-muted)]">
              ENTER THE ADMIN-ASSIGNED 4-DIGIT AUTHORIZATION SEQUENCE.
            </p>
          </div>

          {solvedQualified ? (
            <div className="banner paused">
              <p className="font-semibold">Victory confirmed. You cracked before your archenemy.</p>
              <p className="mt-2">Qualified for next stage.</p>
              <button className="button-secondary mt-3" onClick={() => router.push("/team")}>Continue</button>
            </div>
          ) : solvedEliminated ? (
            <div className="banner ended">
              <p className="font-semibold">Your Archenemy Cracked Before You</p>
              <p className="mt-2">You have been eliminated from Round 2.</p>
              <button className="button-danger mt-3" onClick={() => router.push("/leaderboard")}>Return To Leaderboard</button>
            </div>
          ) : !team?.round2_code ? (
            <div className="banner paused">AWAITING INPUT: ADMIN CODE NOT ASSIGNED.</div>
          ) : (
            <div className="space-y-4">
              <div className="card py-3" style={{ border: "1px solid rgba(88,175,255,0.35)" }}>
                <p className="label">BATTLE BRIEF</p>
                <p className="font-mono text-sm">Your Archenemy Is: {opponentName ?? "Awaiting pairing"}</p>
                <p className="font-mono text-xs text-[var(--text-muted)] mt-1">
                  {pairLabel ? `Battle Pair ${pairLabel}` : "Pair assignment pending"} / Crack the code before them.
                </p>
              </div>

              <div className="flex gap-3 justify-start">
                {Array.from({ length: 4 }).map((_, index) => (
                  <span key={index} className={`code-slot ${round2Code[index] ? "" : "empty"}`}>
                    {round2Code[index] ?? "_"}
                  </span>
                ))}
              </div>

              <div className="code-keypad">
                {Array.from({ length: 9 }).map((_, index) => {
                  const value = index + 1;
                  return (
                    <button
                      key={value}
                      type="button"
                      className="keypad-btn"
                      onClick={() => {
                        if (round2Code.length < 4) setRound2Code(`${round2Code}${value}`);
                      }}
                    >
                      {value}
                    </button>
                  );
                })}

                <button type="button" className="keypad-btn clear" onClick={() => setRound2Code("")}>CLEAR</button>
                <button
                  type="button"
                  className="keypad-btn"
                  onClick={() => {
                    if (round2Code.length < 4) setRound2Code(`${round2Code}0`);
                  }}
                >
                  0
                </button>
                <button
                  type="button"
                  className="keypad-btn submit"
                  onClick={async () => {
                    if (testMode) {
                      if (round2Code !== "1234") {
                        playSound("wrong_r2");
                        const nextAttempt = attemptCount + 1;
                        setAttemptCount(nextAttempt);
                        if (nextAttempt % 3 === 0) {
                          const lockSeconds = nextAttempt === 3 ? 10 : nextAttempt === 6 ? 30 : 50;
                          setLastLockSeconds(lockSeconds);
                          setLockRemaining(lockSeconds);
                          setRound2Status("Access denied, Attempts Locked");
                        } else {
                          setRound2Status(`OOPS!! Access Denied, Invalid Code - Attempt ${nextAttempt}`);
                        }
                        setRound2Code("");
                      } else {
                        playRound2Result(true);
                        // Status will be updated by the countdown display
                      }
                      return;
                    }

                    setRound2Status("");
                    const { data } = await supabaseBrowser.auth.getSession();
                    if (!data.session) {
                      setRound2Status("Please sign in again.");
                      return;
                    }

                    const usePairBattleSubmit = Boolean(team?.pair_battle_enabled && activePairingId);
                    const response = await fetch(
                      usePairBattleSubmit ? "/api/round2/pair-submit" : "/api/round2/submit",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${data.session.access_token}`,
                        },
                        body: JSON.stringify(
                          usePairBattleSubmit
                            ? { code: round2Code, pairingId: activePairingId }
                            : { code: round2Code },
                        ),
                      },
                    );

                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) {
                      playSound(typeof payload.lockSeconds === "number" ? "round2_lockout" : "wrong_r2");
                      setRound2Code("");
                      if (typeof payload.attempt === "number") {
                        setAttemptCount(payload.attempt);
                      }
                      if (typeof payload.lockSeconds === "number") {
                        setLastLockSeconds(payload.lockSeconds);
                        setLockRemaining(payload.lockSeconds);
                      } else {
                        setLastLockSeconds(0);
                        setLockRemaining(0);
                      }
                      setRound2Status(payload.error ?? "Unable to submit code");
                      await fetchTeam();
                      return;
                    }

                    setLockRemaining(0);
                    const isWin = payload.result === "win" || payload.qualified === true;
                    playRound2Result(isWin);
                    setRound2Status(payload.message ?? (isWin ? "Code accepted. You won this battle." : "Code accepted."));
                    await fetchTeam();
                    await fetchActivePairing();
                  }}
                  disabled={round2Code.length !== 4 || lockRemaining > 0}
                >
                  {lockRemaining > 0 ? `LOCKED ${lockRemaining}s` : "INITIALIZE"}
                </button>
              </div>

              {redirectCountdown > 0 && (
                <p className="text-sm text-green-400 font-semibold animate-pulse">
                  You cracked the code! Redirecting to the Leaderboard in {redirectCountdown}s...
                </p>
              )}
              {round2Status && redirectCountdown === 0 && <p className="text-sm text-[var(--text-muted)]">{round2Status}</p>}
            </div>
          )}

          {loading && <p className="text-sm text-[var(--text-muted)]">Refreshing round status...</p>}
        </section>

        <aside className="md:col-span-5 space-y-4">
          <div className="card space-y-4" style={{ background: "var(--bg-high)" }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="label">LIVE_FEED</p>
                <p className="font-mono text-xs text-[var(--text-muted)]">ROUND 2 STATUS</p>
              </div>
              <span className="label text-(--accent)">
                {round?.status === "active" ? "ONLINE" : round?.status?.toUpperCase() ?? "IDLE"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="label">ROUND</p>
                <p className="font-mono text-xs">{round?.round_number ?? 2}</p>
              </div>
              <div>
                <p className="label">COUNTDOWN</p>
                <p className="font-mono text-xs">
                  {typeof round?.remaining_seconds === "number"
                    ? `${Math.floor(Math.max(0, round.remaining_seconds) / 60)}:${String(Math.max(0, round.remaining_seconds) % 60).padStart(2, "0")}`
                    : "DISABLED"}
                </p>
              </div>
              <div>
                <p className="label">TEAM STATUS</p>
                <p className="font-mono text-xs">
                  {team?.round2_solved_at
                    ? team.round2_status === "qualified"
                      ? "WINNER"
                      : "ELIMINATED"
                    : team?.round2_code
                    ? "CODE ASSIGNED"
                    : "WAITING"}
                </p>
              </div>
              <div>
                <p className="label">PAIR</p>
                <p className="font-mono text-xs">{pairLabel ? `#${pairLabel}` : "PENDING"}</p>
              </div>
              <div>
                <p className="label">ARCHENEMY</p>
                <p className="font-mono text-xs">{opponentName ?? "PENDING"}</p>
              </div>
              <div>
                <p className="label">CODE SLOTS</p>
                <p className="font-mono text-xs">{round2Code.length}/4 ENTERED</p>
              </div>
              <div>
                <p className="label">LOCK</p>
                <p className="font-mono text-xs">
                  {attemptCount > 0
                    ? lastLockSeconds > 0
                      ? `${lastLockSeconds}s / ATTEMPT ${attemptCount}`
                      : `NONE / ATTEMPT ${attemptCount}`
                    : "NONE"}
                </p>
              </div>
            </div>

            <div className="banner paused">
              {team?.round2_solved_at
                ? "ROUND 2 SUBMISSION LOCKED FOR THIS UNIT."
                : team?.round2_code
                ? "ENTER 4-DIGIT CODE. FIRST TEAM TO CRACK WINS THE PAIR."
                : "AWAITING INPUT: ADMIN CODE NOT ASSIGNED."}
            </div>
          </div>

          <div className="card space-y-3">
            <div>
              <p className="label">CRACK PROGRESS</p>
              <div className="timer-bar w-full">
                <div className="timer-fill" style={{ width: `${Math.min(100, (round2Code.length / 4) * 100)}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><p className="label">STRENGTH</p><p className="font-mono text-xs">MAX</p></div>
              <div><p className="label">LATENCY</p><p className="font-mono text-xs">0.002MS</p></div>
              <div><p className="label">ENCRYPTION</p><p className="font-mono text-xs">QUAD_PIN</p></div>
            </div>
            <div className="banner ended">
              {attemptCount === 0
                ? "Lock applies every 3 wrong attempts: 10s, then 30s, then 50s, and so on."
                : lastLockSeconds > 0
                ? `Attempt ${attemptCount}. Current lock: ${lastLockSeconds}s.`
                : `Attempt ${attemptCount}. No active lock.`}
            </div>
            <button className="button-secondary" onClick={() => router.push("/leaderboard")}>VIEW LEADERBOARD</button>
          </div>
        </aside>
      </div>

      <footer className="card py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-block w-2 h-2 bg-[var(--accent)]" style={{ animation: "pulse-dot 1.2s ease-in-out infinite" }} />
          <span className="label">CONNECTION_STABLE</span>
          <span className="label">NODE: HK_77_A</span>
        </div>
      </footer>
    </main>
  );
}
