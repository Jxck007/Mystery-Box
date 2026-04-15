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
};

type TeamDetail = {
  id: string;
  name: string;
  leader_name: string;
  round2_code?: string | null;
  round2_solved_at?: string | null;
  round2_status?: string | null;
};

type SessionData = {
  teamId: string;
  playerName: string;
  isLeader: boolean;
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
  const [loading, setLoading] = useState(false);
  const [round2StartPlayed, setRound2StartPlayed] = useState(false);
  const round2ResultPlayedRef = useRef(false);
  const testMode = isTestModeEnabled();

  const playRound2Result = useCallback((qualified: boolean) => {
    // Mark as played immediately to prevent duplicate playback on subsequent state refresh.
    round2ResultPlayedRef.current = true;
    playSound("correct_r2");
    window.setTimeout(() => {
      playSound(qualified ? "win_r2" : "lose_r2");
    }, 650);
  }, []);

  const fetchRound = useCallback(async () => {
    if (!session) return;
    if (testMode) {
      setRound({ id: "test-round2", status: "active", round_number: 2 });
      setLoading(false);
      return;
    }
    setLoading(true);
    const response = await fetch(`/api/boxes?teamId=${session.teamId}`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (response.ok) {
      setRound(payload.round ?? null);
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
    fetchRound();
    fetchTeam();
  }, [session, fetchRound, fetchTeam]);

  useEffect(() => {
    if (!round) return;
    if (round.status !== "active" || round.round_number !== 2) {
      router.replace("/team");
    }
  }, [round, router]);

  useEffect(() => {
    if (round2StartPlayed) return;
    if (round?.status !== "active" || round.round_number !== 2) return;
    playSound("start_r2");
    setRound2StartPlayed(true);
  }, [round, round2StartPlayed]);

  useEffect(() => {
    if (!team?.round2_solved_at || !team.round2_status) {
      round2ResultPlayedRef.current = false;
      return;
    }
    if (round2ResultPlayedRef.current) return;
    round2ResultPlayedRef.current = true;
    playSound(team.round2_status === "qualified" ? "win_r2" : "lose_r2");
  }, [team?.round2_solved_at, team?.round2_status]);

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
          {!team?.round2_code ? (
            <div className="banner paused">
              AWAITING INPUT: ADMIN CODE NOT ASSIGNED.
            </div>
          ) : team?.round2_solved_at ? (
            <div className="banner paused">
              SESSION TERMINATED. {team.round2_status === "qualified"
                ? "OBJECTIVE COMPLETE: ROUND 3 ACCESS GRANTED."
                : "OBJECTIVE COMPLETE: QUALIFICATION CAP REACHED."}
            </div>
          ) : (
            <div className="space-y-4">
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
                        setRound2Code("");
                      } else {
                        playRound2Result(true);
                      }
                      setRound2Status(
                        round2Code === "1234"
                          ? "Code accepted. You qualified for Round 3."
                          : "Invalid code in test mode (use 1234).",
                      );
                      return;
                    }
                    setRound2Status("");
                    const { data } = await supabaseBrowser.auth.getSession();
                    if (!data.session) {
                      setRound2Status("Please sign in again.");
                      return;
                    }
                    const response = await fetch("/api/round2/submit", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${data.session.access_token}`,
                      },
                      body: JSON.stringify({ code: round2Code }),
                    });
                    const payload = await response.json();
                    if (!response.ok) {
                      playSound("wrong_r2");
                      setRound2Code("");
                      if (typeof payload.attempt === "number") {
                        setAttemptCount(payload.attempt);
                      }
                      if (typeof payload.lockSeconds === "number") {
                        setLastLockSeconds(payload.lockSeconds);
                      } else {
                        setLastLockSeconds(0);
                      }
                      setRound2Status(payload.error ?? "Unable to submit code");
                      return;
                    }
                    playRound2Result(Boolean(payload.qualified));
                    setRound2Status(
                      payload.qualified
                        ? "Code accepted. You qualified for Round 3."
                        : "Code accepted, but slots are full.",
                    );
                  }}
                  disabled={round2Code.length !== 4}
                >
                  INITIALIZE
                </button>
              </div>
              {round2Status && (
                <p className="text-sm text-[var(--text-muted)]">{round2Status}</p>
              )}
            </div>
          )}
          {loading && (
            <p className="text-sm text-[var(--text-muted)]">Refreshing round status...</p>
          )}
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
                <p className="label">TEAM STATUS</p>
                <p className="font-mono text-xs">
                  {team?.round2_solved_at
                    ? team.round2_status === "qualified"
                      ? "QUALIFIED"
                      : "SOLVED / FULL"
                    : team?.round2_code
                      ? "CODE ASSIGNED"
                      : "WAITING"}
                </p>
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
                  ? "ENTER 4-DIGIT CODE. FIRST QUALIFIED UNITS ADVANCE."
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
            <button className="button-secondary" onClick={() => router.push("/leaderboard")}>
              VIEW LEADERBOARD
            </button>
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
