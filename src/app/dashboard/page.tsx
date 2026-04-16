"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [round1Score, setRound1Score] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const rawScore = sessionStorage.getItem("round1_score");
    const parsedScore = rawScore ? Number(rawScore) : NaN;
    setRound1Score(Number.isFinite(parsedScore) ? parsedScore : 0);
  }, []);

  useEffect(() => {
    const dashboardRedirected = sessionStorage.getItem("dashboard_redirected");
    if (dashboardRedirected === "1") {
      router.replace("/leaderboard");
      return;
    }

    const redirectTimer = window.setTimeout(() => {
      sessionStorage.setItem("dashboard_redirected", "1");
      router.replace("/leaderboard");
    }, 10000);

    const tickTimer = window.setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      window.clearTimeout(redirectTimer);
      window.clearInterval(tickTimer);
    };
  }, [router]);

  return (
    <main className="page-shell">
      <section className="card space-y-3">
        <p className="label">ROUND 1 COMPLETE</p>
        <h1 className="font-headline text-4xl font-black uppercase">Dashboard</h1>
        <p className="text-sm text-slate-300">
          Your Round 1 score:{" "}
          <span className="font-headline text-2xl text-[var(--accent)]">{round1Score ?? "--"}</span>
        </p>
        <p className="text-sm text-slate-300">Redirecting to leaderboard in {countdown}s...</p>
      </section>
    </main>
  );
}
