"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { getMiniGameConfig, MiniGameRenderer } from "@/app/team/game-panels";
import { isTestModeEnabled } from "@/lib/test-mode";

type GameRecord = {
  id: string;
  game_title: string | null;
  game_description: string | null;
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
  const router = useRouter();
  const params = useParams();
  const boxId = typeof params?.boxId === "string" ? params.boxId : "";
  const [teamId, setTeamId] = useState<string | null>(null);
  const [game, setGame] = useState<GameRecord | null>(null);
  const [round, setRound] = useState<RoundRecord | null>(null);
  const [open, setOpen] = useState<BoxOpen | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [warningShown, setWarningShown] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const testMode = isTestModeEnabled();

  const totalSeconds = round?.duration_seconds ?? 0;
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
  const miniGameConfig = useMemo(
    () => getMiniGameConfig(game?.game_title ?? null),
    [game?.game_title],
  );

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
        game_title: "Rapid Quiz",
        game_description: "Test mode challenge prompt.",
        points_value: 100,
        round_number: 1,
      });
      setRound({
        status: "active",
        duration_seconds: 300,
        remaining_seconds: 300,
        round_number: 1,
      });
      setOpen({ id: "test-open", status: "pending" });
      setQuestionIndex(0);
      setCorrectCount(0);
      setFeedback(null);
      submittedRef.current = false;
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
      setFeedback(null);
      submittedRef.current = false;
    };
    load();
  }, [teamId, boxId, testMode]);

  useEffect(() => {
    if (!round?.duration_seconds) {
      setTimeLeft(null);
      return;
    }
    const startRemaining = round.remaining_seconds ?? round.duration_seconds;
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
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    if (!teamId || warningShown) return;
    const handleVisibility = async () => {
      if (document.visibilityState === "hidden") {
        setWarningShown(true);
        await fetch(`/api/teams/${teamId}/penalty`, { method: "POST" });
        router.replace("/team");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleVisibility);
    };
  }, [teamId, router, warningShown]);

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
          <div className="timer-bar">
            <div className="timer-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </header>

      <section className="card space-y-4">
        <div className="section-tag">GAME_TYPE: {miniGameConfig?.key ?? "QUIZ"}</div>
        <div className="game-warning">
          <p className="text-sm text-[var(--text-muted)]">
            Points stack on this round. Finish before time runs out.
          </p>
          {!warningShown && (
            <button
              className="button-secondary text-xs"
              onClick={() => setWarningShown(true)}
            >
              ACKNOWLEDGED
            </button>
          )}
        </div>

        <ul className="rule-list">
          {descriptionPoints.length > 0 ? (
            descriptionPoints.map((point) => <li key={point}>{point}</li>)
          ) : (
            <li>{game?.game_description ?? "Complete the challenge."}</li>
          )}
        </ul>

        <div className="text-sm text-[var(--text-muted)]">
          Question {questionIndex + 1}
        </div>

        {isRoundOne && miniGameConfig && open?.status === "pending" && (
          <MiniGameRenderer
            gameKey={miniGameConfig.key}
            seed={`${open?.id ?? "seed"}-${game?.id ?? ""}-${questionIndex}`}
            questionIndex={questionIndex}
            disabled={submitting}
            onComplete={(result) => {
              if (!teamId || !game) return;
              const nextCorrect = correctCount + (result.success ? 1 : 0);
              const nextIndex = questionIndex + 1;
              setCorrectCount(nextCorrect);
              setFeedback(result.success ? "Correct." : "Not quite.");
              setQuestionIndex(nextIndex);
            }}
          />
        )}

        {feedback && (
          <div className="game-feedback">{feedback}</div>
        )}
        <div className="flex flex-wrap gap-4 pt-2">
          <span className="label">SCORE_INPUT: {correctCount}</span>
          <span className="label">STREAK_LAYER: {correctCount > 0 ? `${correctCount}X` : "0X"}</span>
        </div>
      </section>
    </main>
  );
}
