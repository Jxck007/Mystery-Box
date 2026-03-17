"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { getMiniGameConfig, MiniGameRenderer } from "@/app/team/game-panels";

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

  const QUESTIONS_PER_GAME = 5;
  const REQUIRED_CORRECT = 3;
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
    };
    load();
  }, [teamId, boxId]);

  useEffect(() => {
    if (!round?.started_at || !round?.duration_seconds) {
      setTimeLeft(null);
      return;
    }
    const startedAt = new Date(round.started_at).getTime();
    const durationMs = round.duration_seconds * 1000;
    const updateTimer = () => {
      const remaining = Math.max(0, startedAt + durationMs - Date.now());
      setTimeLeft(Math.ceil(remaining / 1000));
    };
    updateTimer();
    const id = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(id);
  }, [round?.started_at, round?.duration_seconds]);

  useEffect(() => {
    if (!timeLeft) return;
    if (timeLeft <= 0) {
      router.replace("/team");
    }
  }, [timeLeft, router]);

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
    <main className="page-shell game-shell game-page">
      <div className="game-brand">
        <img src="/Logo.jpg" alt="Mystery Box" />
      </div>
      <div className="game-header">
        <div>
          <p className="label">Round {round?.round_number ?? 1}</p>
          <h1 className="title">{game?.game_title ?? "Mission"}</h1>
        </div>
        <div className="game-timer">
          <span className="label">Time left</span>
          <div className="timer-number">
            {timeLeft ?? (totalSeconds ? `${totalSeconds}` : "--")}s
          </div>
          <div className="timer-bar">
            <div className="timer-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="game-surface space-y-4">
        <div className="game-warning">
          <p className="text-sm text-slate-300">
            Points stack on this round. Finish before time runs out.
          </p>
          {!warningShown && (
            <button
              className="button-muted text-xs"
              onClick={() => setWarningShown(true)}
            >
              Got it
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

        <div className="text-sm text-slate-300">
          Question {questionIndex + 1} of {QUESTIONS_PER_GAME}
        </div>

        {isRoundOne && miniGameConfig && open?.status === "pending" && (
          <MiniGameRenderer
            gameKey={miniGameConfig.key}
            seed={`${open?.id ?? "seed"}-${game?.id ?? ""}-${questionIndex}`}
            disabled={submitting}
            onComplete={async (result) => {
              if (!teamId || !game) return;
              const nextCorrect = correctCount + (result.success ? 1 : 0);
              const nextIndex = questionIndex + 1;
              setCorrectCount(nextCorrect);
              setFeedback(result.success ? "Correct." : "Not quite.");

              if (nextIndex < QUESTIONS_PER_GAME) {
                setQuestionIndex(nextIndex);
                return;
              }

              if (nextCorrect < REQUIRED_CORRECT) {
                setFeedback(
                  `You got ${nextCorrect}/${QUESTIONS_PER_GAME}. Try again.`,
                );
                setQuestionIndex(0);
                setCorrectCount(0);
                return;
              }

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
                  details: `${nextCorrect}/${QUESTIONS_PER_GAME} correct`,
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
            }}
          />
        )}

        {feedback && (
          <div className="game-feedback">{feedback}</div>
        )}
      </div>
    </main>
  );
}
