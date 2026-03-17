"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function JoinTeamPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) {
        router.replace("/auth?redirect=/join-team");
        return;
      }
      const response = await fetch("/api/players/me", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      if (response.ok) {
        router.replace("/team");
        return;
      }
      setCheckingAuth(false);
    };
    check();
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { data } = await supabaseBrowser.auth.getSession();
    if (!data.session) {
      router.replace("/auth?redirect=/join-team");
      return;
    }

    const response = await fetch("/api/teams/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({
        displayName,
        teamCode: teamCode.toUpperCase(),
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to join team");
      setLoading(false);
      return;
    }

    localStorage.setItem("team_id", payload.id);
    localStorage.setItem("team_code", payload.code);
    localStorage.setItem("player_name", displayName);
    localStorage.setItem("is_leader", "false");
    setLoading(false);
    router.push("/team");
  };

  return (
    <main className="page-shell">
      <div className="page-hero">
        <p className="label">Team access</p>
        <h1 className="title">Join the crew</h1>
        <p className="subtitle">
          Enter the team code or pick an open slot from the roster below.
        </p>
      </div>
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <p className="label">Join a team</p>
          <button
            type="button"
            className="button-muted text-sm"
            onClick={() => router.back()}
          >
            Back
          </button>
        </div>
        <div>
          <h1 className="text-3xl font-semibold">Jump into the adventure</h1>
          <p className="text-slate-300">
            Connect with your teammates using the team code provided by the leader.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="block text-sm font-semibold text-slate-200"
              htmlFor="display-name"
            >
              Display Name
            </label>
            <input
              id="display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="input-field"
              placeholder="Your name"
              required
            />
          </div>

          <div>
            <label
              className="block text-sm font-semibold text-slate-200"
              htmlFor="team-code"
            >
              Team Code
            </label>
            <input
              id="team-code"
              value={teamCode}
              onChange={(event) => setTeamCode(event.target.value.toUpperCase())}
              className="input-field"
              placeholder="Enter team code"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="button-primary w-full"
            disabled={loading || checkingAuth}
          >
            {loading || checkingAuth ? "Joining..." : "Join Team"}
          </button>
        </form>
      </div>

    </main>
  );
}
