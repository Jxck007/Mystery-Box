"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { GAME_CONFIGS, getMiniGameConfig, MiniGameRenderer } from "@/app/team/game-panels";
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
  box_id?: string;
  status: "pending" | "approved" | "rejected";
  opened_at?: string | null;
};

type GameStatus = "idle" | "running" | "ended";

export default function GamePage({ boxId: overrideBoxId, onGameComplete, embedded = false }: { boxId?: string; onGameComplete?: () => void; embedded?: boolean }) {
  const GAME_CAP_SECONDS = 180;
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const boxId = overrideBoxId || (typeof params?.boxId === "string" ? params.boxId : "");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [game, setGame] = useState<GameRecord | null>(null);
  const [round, setRound] = useState<RoundRecord | null>(null);
  const [open, setOpen] = useState<BoxOpen | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(GAME_CAP_SECONDS);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [gameStatus, setGameStatus] = useState<GameStatus>("idle");
  const gameStatusRef = useRef<GameStatus>("idle");
  const timerIdRef = useRef<number | null>(null);
  const timeLeftRef = useRef(GAME_CAP_SECONDS);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [scoreInput, setScoreInput] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [questionSeedBase, setQuestionSeedBase] = useState("seed");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [leaveWarning, setLeaveWarning] = useState(false);
  const submittedRef = useRef(false);
  const answeredRef = useRef(false);
  const streakRef = useRef(0);
  const scoreRef = useRef(0);
  const leavePenaltyRef = useRef(false);
  const startedOpenIdRef = useRef<string | null>(null);
  const startRequestConsumedRef = useRef(false);
  const startRetryCountRef = useRef(0);


  const progressStorageKey = useMemo(() => {
    if (!teamId || !boxId) return null;
    return `game-progress:${teamId}:${boxId}`;
  }, [teamId, boxId]);

  const clearProgressSnapshot = () => {
    if (!progressStorageKey) return;
    localStorage.removeItem(progressStorageKey);
  };

  const formatTime = useCallback((seconds: number | null | undefined) => {
    if (seconds === null || seconds === undefined) return "--:--";
    const safe = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const restoreProgressSnapshot = (openId?: string | null, gameId?: string | null) => {
    if (!progressStorageKey || !openId || !gameId) return false;
    const raw = localStorage.getItem(progressStorageKey);
    if (!raw) return false;

    try {
      const parsed = JSON.parse(raw) as {
        openId?: string;
        gameId?: string;
        questionIndex?: number;
        correctCount?: number;
        wrongCount?: number;
        scoreInput?: number;
        streakCount?: number;
        questionSeedBase?: string;
      };

      if (parsed.openId !== openId || parsed.gameId !== gameId) {
        return false;
      }

      setQuestionIndex(typeof parsed.questionIndex === "number" ? parsed.questionIndex : 0);
      setCorrectCount(typeof parsed.correctCount === "number" ? parsed.correctCount : 0);
      setWrongCount(typeof parsed.wrongCount === "number" ? parsed.wrongCount : 0);
      setScoreInput(typeof parsed.scoreInput === "number" ? parsed.scoreInput : 0);
      setStreakCount(typeof parsed.streakCount === "number" ? parsed.streakCount : 0);
      setQuestionSeedBase(
        typeof parsed.questionSeedBase === "string" && parsed.questionSeedBase
          ? parsed.questionSeedBase
          : `${Date.now()}-${Math.random()}`,
      );
      setFeedback(null);
      submittedRef.current = false;
      answeredRef.current = false;
      return true;
    } catch {
      return false;
    }
  };


  const totalSeconds = GAME_CAP_SECONDS;
  const safeTimeLeft = timeLeft;
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
  const showGameScreen = gameStatus === "running" || gameStatus === "ended";

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

  useEffect(() => {
    streakRef.current = streakCount;
  }, [streakCount]);

  useEffect(() => {
    gameStatusRef.current = gameStatus;
  }, [gameStatus]);

  const handleAnswer = (isCorrect: boolean, details: string) => {
    if (gameStatus !== "running") return;
    if (answeredRef.current) return;
    answeredRef.current = true;

    if (isCorrect) {
      playSound("correct_r1");
      const nextStreak = streakRef.current + 1;
      const bonus = Math.min(nextStreak * 10, 30);
      setCorrectCount((prev) => prev + 1);
      setStreakCount(nextStreak);
      streakRef.current = nextStreak;
      scoreRef.current += bonus;
      setScoreInput(scoreRef.current);
      setFeedback(`Correct +${bonus}`);
    } else {
      const hadMajorStreak = streakRef.current >= 3;
      playSound("wrong_r1");
      if (hadMajorStreak) {
        window.setTimeout(() => playSound("round1_streak_defeated"), 100);
      }
      const penalty = 3;
      streakRef.current = 0;
      setStreakCount(0);
      setWrongCount((prev) => prev + 1);
      scoreRef.current -= penalty;
      setScoreInput(scoreRef.current);
      setFeedback(
        hadMajorStreak
          ? details === "skipped"
            ? "Streak defeated (skip) -3"
            : "Streak defeated -3"
          : details === "skipped"
            ? "Skipped -3"
            : "Wrong -3",
      );
    }

    setAnswers((prev) => [...prev, isCorrect]);
    setQuestionIndex((prev) => prev + 1);
    console.log("Actual Score:", scoreRef.current, "Streak:", streakRef.current);
  };

  useEffect(() => {
    const storedTeamId = localStorage.getItem("team_id");
    if (!storedTeamId) {
      router.replace("/auth");
      return;
    }
    setTeamId(storedTeamId);
  }, [router]);

  const stopTimer = useCallback(() => {
    if (timerIdRef.current) {
      window.clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
  }, []);

  const endGame = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    stopTimer();
    gameStatusRef.current = "ended";
    setGameStatus("ended");
    setSubmitting(true);

    if (!teamId || !game?.id) {
      setSubmitting(false);
      clearProgressSnapshot();
      router.replace("/leaderboard");
      return;
    }

    try {
      let sessionResponse = await supabaseBrowser.auth.getSession();
      if (!sessionResponse.data.session) {
        await supabaseBrowser.auth.refreshSession();
        sessionResponse = await supabaseBrowser.auth.getSession();
      }

      if (!sessionResponse.data.session) {
        setSubmitting(false);
        router.replace("/auth?redirect=/leaderboard");
        return;
      }

      await fetch("/api/boxes/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionResponse.data.session.access_token}`,
        },
        body: JSON.stringify({
          teamId,
          boxId: game.id,
          correctCount,
          wrongCount,
          scoreInput: scoreRef.current,
          answers,
          details: `${correctCount} correct, ${wrongCount} wrong`,
        }),
      });
    } catch {
      // Best effort; still proceed to leaderboard.
    }

    setSubmitting(false);
    clearProgressSnapshot();
    router.replace("/leaderboard");
  }, [answers, clearProgressSnapshot, correctCount, game?.id, router, scoreInput, stopTimer, teamId, wrongCount]);

  const startTimer = useCallback(() => {
    if (timerIdRef.current) {
      window.clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
    timeLeftRef.current = 180;
    setTimeLeft(180);
    console.log("Timer started");
    console.log("Timer reset to:", timeLeftRef.current);
    timerIdRef.current = window.setInterval(() => {
      timeLeftRef.current = Math.max(0, timeLeftRef.current - 1);
      console.log("Time running:", timeLeftRef.current);
      console.log("Timer:", timeLeftRef.current);
      setTimeLeft(timeLeftRef.current);

      if (timeLeftRef.current <= 0) {
        if (timerIdRef.current) {
          window.clearInterval(timerIdRef.current);
          timerIdRef.current = null;
        }
        window.setTimeout(() => {
          void endGame();
        }, 0);
      }
    }, 1000);
  }, [endGame]);

  const startGame = useCallback((openId: string) => {
    if (startedOpenIdRef.current && startedOpenIdRef.current === openId) {
      return;
    }
    stopTimer();
    console.log("Game started");
    gameStatusRef.current = "running";
    setGameStatus("running");
    setQuestionIndex(0);
    setCorrectCount(0);
    setWrongCount(0);
    scoreRef.current = 0;
    streakRef.current = 0;
    setScoreInput(0);
    setStreakCount(0);
    setAnswers([]);
    console.log("Actual Score:", scoreRef.current);
    setQuestionSeedBase(`${Date.now()}-${Math.random()}`);
    setFeedback(null);
    submittedRef.current = false;
    answeredRef.current = false;
    startedOpenIdRef.current = openId;
    startTimer();
  }, [startTimer, stopTimer]);

  useEffect(() => {
    if (!teamId) return;
    const load = async () => {
      const response = await fetch(`/api/boxes?teamId=${teamId}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Unable to load game");
        clearProgressSnapshot();
        return;
      }
      if (!payload.game || payload.game.id !== boxId) {
        setError("This game is no longer active.");
        clearProgressSnapshot();
        return;
      }
      setGame(payload.game);
      setRound(payload.round ?? null);
      setOpen(payload.open ?? null);

      // Hard guard: never reset timer/UI while a game is already running.
      // Backend refreshes can briefly return transitional payloads that should
      // not interrupt an active local countdown.
      if (gameStatusRef.current === "running") {
        return;
      }

      const incomingOpenId = payload.open?.id ?? null;
      const runningSameOpen =
        gameStatusRef.current === "running" &&
        Boolean(incomingOpenId) &&
        startedOpenIdRef.current === incomingOpenId;

      if (runningSameOpen) {
        return;
      }

      const startRequested = searchParams?.get("start") === "1";
      if (startRequested && !payload.open?.id && startRetryCountRef.current < 8) {
        startRetryCountRef.current += 1;
        window.setTimeout(() => {
          void load();
        }, 300);
        return;
      }

      const canStartFromStartButton =
        startRequested &&
        !startRequestConsumedRef.current &&
        Boolean(payload.open?.id);

      console.log("Start gate:", {
        startRequested,
        consumed: startRequestConsumedRef.current,
        roundStatus: payload.round?.status ?? null,
        openStatus: payload.open?.status ?? null,
        openId: payload.open?.id ?? null,
      });

      if (canStartFromStartButton && payload.open) {
        startRequestConsumedRef.current = true;
        startRetryCountRef.current = 0;
        startGame(payload.open.id);
        // Consume the one-time start signal to avoid re-trigger on remount.
        router.replace(`/game/${encodeURIComponent(boxId)}`);
        return;
      }

      stopTimer();
      gameStatusRef.current = "idle";
      setGameStatus("idle");
      startedOpenIdRef.current = null;
    };
    load();
  }, [teamId, boxId, progressStorageKey, router, searchParams, startGame, stopTimer]);

  useEffect(() => {
    if (!progressStorageKey || !open?.id || !game?.id) return;
    if (round?.status !== "active" || open.status !== "pending") return;
    localStorage.setItem(
      progressStorageKey,
      JSON.stringify({
        openId: open.id,
        gameId: game.id,
        questionIndex,
        correctCount,
        wrongCount,
        scoreInput,
        streakCount,
        answers,
        questionSeedBase,
      }),
    );
  }, [
    progressStorageKey,
    open?.id,
    open?.status,
    game?.id,
    round?.status,
    questionIndex,
    correctCount,
    wrongCount,
    scoreInput,
    streakCount,
    answers,
    questionSeedBase,
  ]);

  useEffect(() => {
    playSound("reset_streak");
  }, [game?.id]);

  useEffect(() => {
    if (gameStatus !== "running") return;
    answeredRef.current = false;
  }, [questionIndex, gameStatus]);

  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, [stopTimer]);

  useEffect(() => {
    // Monitoring disabled for unhindered production experience.
  }, [teamId, progressStorageKey]);

  if (error) {
    return (
      <main className={embedded ? "w-full" : "page-shell"}>
        <div className="card space-y-3">
          <p className="label">Game status</p>
          <p className="text-sm text-red-400">{error}</p>
          <button className="button-primary" onClick={() => onGameComplete ? onGameComplete() : router.push("/team")}>
            RETURN TO CONSOLE
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={embedded ? "w-full flex-1" : "page-shell min-h-screen"}>
      {gameStatus === "ended" && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6" style={{ backgroundColor: "rgba(0,0,0,0.92)" }}>
          <div className="card max-w-lg w-full text-center space-y-3">
            <p className="label">GAME OVER</p>
            <p className="text-sm text-slate-300">Time expired. Redirecting to leaderboard...</p>
          </div>
        </div>
      )}
      {leaveWarning && (
        <div className="banner ended">
          Leaving the game suspended your team. Only an admin can resume it.
        </div>
      )}
      {showGameScreen && (
      <header className="card flex-row items-start justify-between gap-4">
        <div className="space-y-2">
          {!embedded && (
            <button className="button-muted text-xs" onClick={() => onGameComplete ? onGameComplete() : router.push("/team")}>
              ← RETURN
            </button>
          )}
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
          <div className="timer-bar">
            <div className="timer-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </header>
      )}

      {!showGameScreen && (
        <section className="card space-y-3">
          <p className="label">GAME_READY</p>
          <p className="text-sm text-slate-300">Waiting for Start button confirmation...</p>
          <div id="gameScreen" style={{ display: "none" }} />
        </section>
      )}
      {showGameScreen && (
      <section className="card space-y-4" id="gameScreen">
        <div className="section-tag">GAME_TYPE: {miniGameConfig?.key ?? "QUIZ"}</div>
        <div className="game-warning">
          <p className="text-sm text-[var(--text-muted)]">
            MISSION TIMER: 180s HARD CAP. SKIP APPLIES -3 PENALTY.
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

        {isRoundOne && miniGameConfig && open?.status === "pending" && gameStatus === "running" && (
          <MiniGameRenderer
            gameKey={resolvedGameKey}
            seed={`${questionSeedBase}-${open?.id ?? "seed"}-${game?.id ?? ""}`}
            questionIndex={questionIndex}
            disabled={submitting || answeredRef.current}
            onComplete={(result) => {
              if (!teamId || !game) return;
              handleAnswer(result.success, result.details);
            }}
          />
        )}

        {!submitting && gameStatus === "running" && round?.status === "active" && open?.status === "pending" && (
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
              handleAnswer(false, "skipped");
            }}
          >
            SKIP INPUT (-3)
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
      )}
    </main>
  );
}

