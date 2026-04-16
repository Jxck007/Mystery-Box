"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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
  status: "pending" | "approved" | "rejected";
};

export default function GamePage({ boxId: overrideBoxId, onGameComplete, embedded = false }: { boxId?: string; onGameComplete?: () => void; embedded?: boolean }) {
  const GAME_CAP_SECONDS = 180;
  const router = useRouter();
  const params = useParams();
  const boxId = overrideBoxId || (typeof params?.boxId === "string" ? params.boxId : "");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [game, setGame] = useState<GameRecord | null>(null);
  const [round, setRound] = useState<RoundRecord | null>(null);
  const [open, setOpen] = useState<BoxOpen | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
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
        scoreInput?: number;
        streakCount?: number;
        questionSeedBase?: string;
      };

      if (parsed.openId !== openId || parsed.gameId !== gameId) {
        return false;
      }

      setQuestionIndex(typeof parsed.questionIndex === "number" ? parsed.questionIndex : 0);
      setCorrectCount(typeof parsed.correctCount === "number" ? parsed.correctCount : 0);
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

  useEffect(() => {
    streakRef.current = streakCount;
  }, [streakCount]);

  const handleAnswer = (result: { success: boolean; details: string }) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
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
      const hadMajorStreak = streakRef.current >= 3;
      playSound("wrong_r1");
      if (hadMajorStreak) {
        window.setTimeout(() => playSound("round1_streak_defeated"), 100);
      }
      const penalty = 3;
      setStreakCount(0);
      setScoreInput((prev) => prev - penalty);
      setFeedback(
        hadMajorStreak
          ? result.details === "skipped"
            ? "Streak defeated (skip) -3"
            : "Streak defeated -3"
          : result.details === "skipped"
            ? "Skipped -3"
            : "Wrong -3",
      );
    }
    setQuestionIndex((prev) => prev + 1);
  };

  useEffect(() => {
    const storedTeamId = localStorage.getItem("team_id");
    if (!storedTeamId) {
      router.replace("/auth");
      return;
    }
    setTeamId(storedTeamId);
  }, [router]);

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
      const restored = restoreProgressSnapshot(payload.open?.id, payload.game.id);
      if (!restored) {
        setQuestionIndex(0);
        setCorrectCount(0);
        setScoreInput(0);
        setStreakCount(0);
        setQuestionSeedBase(`${Date.now()}-${Math.random()}`);
        setFeedback(null);
        submittedRef.current = false;
        answeredRef.current = false;
      }
    };
    load();
  }, [teamId, boxId, progressStorageKey]);

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
        scoreInput,
        streakCount,
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
    scoreInput,
    streakCount,
    questionSeedBase,
  ]);

  useEffect(() => {
    playSound("reset_streak");
  }, [game?.id]);

  useEffect(() => {
    if (round?.status !== "active" || open?.status !== "pending") return;
    answeredRef.current = false;
  }, [questionIndex, round?.status, open?.id, open?.status]);

  const [nowTime, setNowTime] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowTime(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const getLiveRemaining = useCallback(() => {
    const duration = round?.duration_seconds ?? GAME_CAP_SECONDS;
    if (!round) return duration;
    if (round.status === "ended") return 0;
    if (round.status === "active") {
      if (!round.started_at) return duration;
      const startedAt = new Date(round.started_at).getTime();
      const elapsedLive = Math.floor((nowTime - startedAt) / 1000);
      return Math.max(0, duration - elapsedLive);
    }
    return duration;
  }, [round, nowTime]);

  useEffect(() => {
    const remaining = getLiveRemaining();
    setTimeLeft(remaining);
  }, [getLiveRemaining]);

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
      clearProgressSnapshot();
      setSubmitting(false);
      router.replace("/team");
    };
    submitOnTimeout();
  }, [timeLeft, teamId, game, correctCount, router]);

  useEffect(() => {
    if (!teamId) return;
    const penaltyUrl = `/api/teams/${teamId}/penalty`;

    const dispatchPenalty = (reason: string) => {
      if (leavePenaltyRef.current) return;
      leavePenaltyRef.current = true;
      setLeaveWarning(true);
      if (progressStorageKey) {
        localStorage.removeItem(progressStorageKey);
      }

      const payload = JSON.stringify({ reason });
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        try {
          navigator.sendBeacon(penaltyUrl, new Blob([payload], { type: "application/json" }));
        } catch {
          // Ignore beacon transport failures and still attempt fetch.
        }
      }

      void fetch(penaltyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
        cache: "no-store",
      }).catch(() => null);

      router.replace("/team");
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        dispatchPenalty("visibility_hidden");
      }
    };
    const handleBlur = () => dispatchPenalty("window_blur");
    const handlePageHide = () => dispatchPenalty("pagehide");
    const handleBeforeUnload = () => dispatchPenalty("beforeunload");
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "PrintScreen") {
        dispatchPenalty("printscreen");
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "s") {
        dispatchPenalty("screenshot_shortcut");
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [teamId, router, progressStorageKey]);

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
      {leaveWarning && (
        <div className="banner ended">
          Leaving the game suspended your team. Only an admin can resume it.
        </div>
      )}
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

      <section className="card space-y-4">
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
    </main>
  );
}

