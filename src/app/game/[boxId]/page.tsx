"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { GAME_CONFIGS, getMiniGameConfig, MiniGameRenderer } from "@/app/team/game-panels";
import { isTestModeEnabled } from "@/lib/test-mode";
import { playSound } from "@/lib/sound-manager";

type GameRecord = {
  id: string;
  game_title: string | null;
  game_description: string | null;
  game_type?: string | null;
  points_value: number | null;
  round_number?: number | null;
};

type RoundRecord = {
  status: "waiting" | "active" | "paused" | "ended";
  duration_seconds?: number | null;
  started_at?: string | null;
  remaining_seconds?: number | null;
  round_number?: number | null;
};

type BoxOpen = {
  id: string;
  status: "pending" | "approved" | "rejected";
};

export default function GamePage() {
  const GAME_CAP_SECONDS = 180;
  const router = useRouter();
  const params = useParams();
  const boxId = typeof params?.boxId === "string" ? params.boxId : "";
  const [teamId, setTeamId] = useState<string | null>(null);
  const [game, setGame] = useState<GameRecord | null>(null);
  const [round, setRound] = useState<RoundRecord | null>(null);
  const [open, setOpen] = useState<BoxOpen | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [scoreInput, setScoreInput] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [questionSeedBase, setQuestionSeedBase] = useState("seed");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [leaveWarning, setLeaveWarning] = useState(false);
  const submittedRef = useRef(false);
  const answeredRef = useRef(false);
  const streakRef = useRef(0);
  const leavePenaltyRef = useRef(false);
  const timeoutDispatchRef = useRef<number | null>(null);
  const questionCycleRef = useRef(0);
  const testMode = isTestModeEnabled();
  const inferredTestConfig = useMemo(() => {
    const match = GAME_CONFIGS.find((config) => boxId.includes(config.key));
    return match ?? GAME_CONFIGS[0];
  }, [boxId]);

  const totalSeconds = Math.min(round?.duration_seconds ?? GAME_CAP_SECONDS, GAME_CAP_SECONDS);
  const safeTimeLeft = timeLeft ?? totalSeconds;
  const progressPercent = totalSeconds
    ? Math.max(0, Math.min(100, (safeTimeLeft / totalSeconds) * 100))
    : 0;

  const descriptionPoints = useMemo(() => {
    const raw = game?.game_description ?? "";
    return raw
      .split(".")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => `${part}.`);
  }, [game?.game_description]);

  const isRoundOne = round?.round_number === 1;

  const resolvedGameKey = useMemo(() => {
    const allowed = new Set([
      "rapid-quiz",
      "fast-trivia",
      "true-false",
      "odd-one-out",
      "number-sequence",
      "quick-math",
      "object-count",
      "word-scramble",
      "missing-letter",
      "quick-arrange",
    ]);

    const normalizedType = (game?.game_type ?? "").trim().toLowerCase();
    if (allowed.has(normalizedType)) return normalizedType;

    const fromTitle = getMiniGameConfig(game?.game_title ?? null)?.key;
    if (fromTitle && allowed.has(fromTitle)) return fromTitle;

    const cycle = Array.from(allowed);
    const seed = (game?.id ?? boxId ?? "rapid-quiz").split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return cycle[seed % cycle.length];
  }, [game?.game_type, game?.game_title, game?.id, boxId]);

  const miniGameConfig = useMemo(
    () => getMiniGameConfig(game?.game_title ?? null) ?? { key: resolvedGameKey, title: "Challenge", description: "", questionCount: 0 },
    [game?.game_title, resolvedGameKey],
  );

  const questionDuration = 10;

  useEffect(() => {
    streakRef.current = streakCount;
  }, [streakCount]);

  const handleAnswer = (result: { success: boolean; details: string }) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    if (timeoutDispatchRef.current !== null) {
      window.clearTimeout(timeoutDispatchRef.current);
      timeoutDispatchRef.current = null;
    }
    if (result.success) {
      playSound("correct_r1");
      const nextStreak = streakRef.current + 1;
      const multiplier = Math.min(3, nextStreak);
      const gained = 10 * multiplier;
      setCorrectCount((prev) => prev + 1);
      setStreakCount(nextStreak);
      setScoreInput((prev) => prev + gained);
      setFeedback(`Correct +${gained}`);
    } else {
      playSound("wrong_r1");
      const penalty = 3;
      setStreakCount(0);
      setScoreInput((prev) => prev - penalty);
      setFeedback(
        result.details === "skipped"
          ? "Skipped -3"
          : result.details === "timeout"
            ? "Time out -3"
            : "Wrong -3",
      );
    }
    setQuestionIndex((prev) => prev + 1);
  };

  useEffect(() => {
    const storedTeamId = localStorage.getItem("team_id");
    if (!storedTeamId) {
      if (testMode) {
        localStorage.setItem("team_id", "test-team");
        localStorage.setItem("player_name", "TEST_OPERATOR");
        localStorage.setItem("is_leader", "true");
        setTeamId("test-team");
        return;
      }
      router.replace("/auth");
      return;
    }
    setTeamId(storedTeamId);
  }, [router, testMode]);

  useEffect(() => {
    if (!teamId) return;
    if (testMode) {
      setGame({
        id: boxId || "test-box",
        game_title: inferredTestConfig.title,
        game_description: "Test mode challenge prompt.",
        game_type: inferredTestConfig.key,
        points_value: 100,
        round_number: 1,
      });
      setRound({
        status: "active",
        duration_seconds: GAME_CAP_SECONDS,
        remaining_seconds: GAME_CAP_SECONDS,
        round_number: 1,
      });
      setOpen({ id: "test-open", status: "pending" });
      setQuestionIndex(0);
      setCorrectCount(0);
      setScoreInput(0);
      setStreakCount(0);
      setQuestionTimeLeft(null);
      setQuestionSeedBase(`${Date.now()}-${Math.random()}`);
      setFeedback(null);
      submittedRef.current = false;
      answeredRef.current = false;
      return;
    }
    const load = async () => {
      const response = await fetch(`/api/boxes?teamId=${teamId}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Unable to load game");
        return;
      }
      if (!payload.game || payload.game.id !== boxId) {
        setError("This game is no longer active.");
        return;
      }
      setGame(payload.game);
      setRound(payload.round ?? null);
      setOpen(payload.open ?? null);
      setQuestionIndex(0);
      setCorrectCount(0);
      setScoreInput(0);
      setStreakCount(0);
      setQuestionTimeLeft(null);
      setQuestionSeedBase(`${Date.now()}-${Math.random()}`);
      setFeedback(null);
      submittedRef.current = false;
      answeredRef.current = false;
    };
    load();
  }, [teamId, boxId, testMode, questionDuration, inferredTestConfig.key, inferredTestConfig.title]);

  useEffect(() => {
    playSound("reset_streak");
  }, [game?.id]);

  useEffect(() => {
    if (round?.status !== "active" || open?.status !== "pending") return;
    questionCycleRef.current += 1;
    if (timeoutDispatchRef.current !== null) {
      window.clearTimeout(timeoutDispatchRef.current);
      timeoutDispatchRef.current = null;
    }
    setQuestionTimeLeft(questionDuration);
    answeredRef.current = false;
  }, [questionIndex, questionDuration, round?.status, open?.id, open?.status]);

  useEffect(() => {
    if (round?.status !== "active" || open?.status !== "pending") return;
    if (submitting || answeredRef.current) return;
    if (questionTimeLeft === null) return;

    const id = window.setInterval(() => {
      setQuestionTimeLeft((prev) => {
        const current = prev ?? questionDuration;
        const next = Math.max(0, current - 1);

        if (next === 0 && current > 0 && !answeredRef.current) {
          const cycleAtTimeout = questionCycleRef.current;
          answeredRef.current = true;
          timeoutDispatchRef.current = window.setTimeout(() => {
            timeoutDispatchRef.current = null;
            if (questionCycleRef.current !== cycleAtTimeout) return;
            handleAnswer({ success: false, details: "timeout" });
          }, 0);
        }

        return next;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [questionIndex, questionTimeLeft, questionDuration, round?.status, open?.status, open?.id, submitting]);

  useEffect(() => {
    return () => {
      if (timeoutDispatchRef.current !== null) {
        window.clearTimeout(timeoutDispatchRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!round?.duration_seconds) {
      setTimeLeft(null);
      return;
    }
    const startRemaining = Math.min(round.remaining_seconds ?? round.duration_seconds, GAME_CAP_SECONDS);
    setTimeLeft(startRemaining);
    const id = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return prev;
        return Math.max(0, prev - 1);
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [round?.duration_seconds, round?.remaining_seconds]);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft > 0) return;
    if (submittedRef.current || !teamId || !game) {
      router.replace("/team");
      return;
    }
    const submitOnTimeout = async () => {
      submittedRef.current = true;
      setSubmitting(true);
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) {
        setError("Please sign in again.");
        setSubmitting(false);
        return;
      }
      const response = await fetch("/api/boxes/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({
          teamId,
          boxId: game.id,
          details: `${correctCount} correct`,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Unable to submit score");
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      router.replace("/team");
    };
    submitOnTimeout();
  }, [timeLeft, teamId, game, correctCount, router]);

  useEffect(() => {
    if (!teamId) return;
    const handleVisibility = async () => {
      if (document.visibilityState === "hidden" && !leavePenaltyRef.current) {
        leavePenaltyRef.current = true;
        setLeaveWarning(true);
        await fetch(`/api/teams/${teamId}/penalty`, { method: "POST" }).catch(() => null);
        router.replace("/team");
      }
    };
    const handleBeforeUnload = () => {
      if (leavePenaltyRef.current) return;
      leavePenaltyRef.current = true;
      setLeaveWarning(true);
      void fetch(`/api/teams/${teamId}/penalty`, { method: "POST" }).catch(() => null);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [teamId, router]);

  if (error) {
    return (
      <main className="page-shell">
        <div className="card space-y-3">
          <p className="label">Game status</p>
          <p className="text-sm text-red-400">{error}</p>
          <button className="button-primary" onClick={() => router.push("/team")}>
            Back to team hub
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell min-h-screen">
      {leaveWarning && (
        <div className="banner ended">
          Leaving the game suspended your team. Only an admin can resume it.
        </div>
      )}
      <header className="card flex-row items-start justify-between gap-4">
        <div className="space-y-2">
          <button className="button-muted text-xs" onClick={() => router.push("/team")}>
            ← BACK
          </button>
          <p className="label">BOX_MISSION_01</p>
          <h1 className="font-headline text-4xl font-black uppercase" style={{ letterSpacing: "-0.04em" }}>
            {game?.game_title ?? "MISSION"}
          </h1>
          <p className="section-tag">GAME_TYPE: {miniGameConfig?.key ?? "QUIZ"}</p>
        </div>
        <div className="game-timer">
          <span className={`timer-pill ${safeTimeLeft <= 20 ? "timer-danger" : ""}`}>TIME LEFT</span>
          <div className="timer-number">
            {timeLeft ?? (totalSeconds ? `${totalSeconds}` : "--")}s
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.15em" }}>
            Q: {questionIndex + 1}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: (questionTimeLeft ?? questionDuration) <= 2 ? "var(--error)" : "var(--text-muted)", letterSpacing: "0.15em" }}>
            THIS Q: {questionTimeLeft ?? questionDuration}s
          </span>
          <div className="timer-bar">
            <div className="timer-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </header>

      <section className="card space-y-4">
        <div className="section-tag">GAME_TYPE: {miniGameConfig?.key ?? "QUIZ"}</div>
        <div className="game-warning">
          <p className="text-sm text-[var(--text-muted)]">
            Points stack on this round. Each game is capped at 180 seconds and timeout counts as skip (-3).
          </p>
        </div>

        <ul className="rule-list">
          {descriptionPoints.length > 0 ? (
            descriptionPoints.map((point) => <li key={point}>{point} </li>)
          ) : (
            <li>{game?.game_description ?? "Complete the challenge."}</li>
          )}
        </ul>

        <div className="text-sm text-[var(--text-muted)]">
          Question {questionIndex + 1}
        </div>

        {isRoundOne && miniGameConfig && open?.status === "pending" && (
          <MiniGameRenderer
            gameKey={resolvedGameKey}
            seed={`${questionSeedBase}-${open?.id ?? "seed"}-${game?.id ?? ""}`}
            questionIndex={questionIndex}
            disabled={submitting || answeredRef.current}
            onComplete={(result) => {
              if (!teamId || !game) return;
              handleAnswer(result);
            }}
          />
        )}

        {!submitting && round?.status === "active" && open?.status === "pending" && (
          <button
            className="button-secondary"
            style={{
              marginTop: 8,
              width: "100%",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.15em",
              opacity: 0.7,
            }}
            onClick={() => {
              handleAnswer({ success: false, details: "skipped" });
            }}
          >
            SKIP (-3 pts)
          </button>
        )}

        {feedback && (
          <div className="game-feedback">{feedback}</div>
        )}
        <div className="flex flex-wrap gap-4 pt-2">
          <span className="label">SCORE_INPUT: {scoreInput}</span>
          <span className="label">STREAK_LAYER: {streakCount > 0 ? `${streakCount}X` : "0X"}</span>
          <span className="label">CORRECT: {correctCount}</span>
        </div>
      </section>
    </main>
  );
}
