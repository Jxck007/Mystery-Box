"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

const answerOptions = [
  { label: "Leader Only", value: "leader_only" },
  { label: "All Members", value: "all_members" },
];

export default function CreateTeamPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [leaderName, setLeaderName] = useState("");
  const [maxMembers, setMaxMembers] = useState(5);
  const [answerMode, setAnswerMode] = useState("leader_only");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) {
        router.replace("/auth?redirect=/create-team");
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
      router.replace("/auth?redirect=/create-team");
      return;
    }

    const response = await fetch("/api/teams/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({
        teamName,
        leaderName,
        maxMembers,
        answerMode,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to create team");
      setLoading(false);
      return;
    }

    localStorage.setItem("team_id", payload.id);
    localStorage.setItem("team_code", payload.code);
    localStorage.setItem("player_name", payload.leader_name);
    localStorage.setItem("is_leader", "true");
    setLoading(false);
    router.push("/team");
  };

  return (
    <main className="page-shell">
      <div className="page-hero">
        <p className="label">Team setup</p>
        <h1 className="title">Assemble your squad</h1>
        <p className="subtitle">
          Set the mission rules, choose answer access, and prepare for the round.
        </p>
      </div>
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <p className="label">Create your team</p>
          <button
            type="button"
            className="button-muted text-sm"
            onClick={() => router.back()}
          >
            Back
          </button>
        </div>
        <div>
          <h1 className="text-3xl font-semibold">Lead the mission</h1>
          <p className="text-slate-300">
            Set up your team, choose how submissions should be made, and open
            mystery boxes once the round starts.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="block text-sm font-semibold text-slate-200"
              htmlFor="team-name"
            >
              Team Name
            </label>
            <input
              id="team-name"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              className="input-field"
              placeholder="Enter team name"
              required
            />
          </div>

          <div>
            <label
              className="block text-sm font-semibold text-slate-200"
              htmlFor="leader-name"
            >
              Leader Name
            </label>
            <input
              id="leader-name"
              value={leaderName}
              onChange={(event) => setLeaderName(event.target.value)}
              className="input-field"
              placeholder="Enter leader name"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className="block text-sm font-semibold text-slate-200"
                htmlFor="max-members"
              >
                Max Members
              </label>
              <input
                id="max-members"
                type="number"
                min={2}
                max={12}
                value={maxMembers}
                onChange={(event) => setMaxMembers(Number(event.target.value))}
                className="input-field"
                placeholder="2-12"
                required
              />
            </div>

            <div>
              <label
                className="block text-sm font-semibold text-slate-200"
                htmlFor="answer-mode"
              >
                Answer Mode
              </label>
              <select
                id="answer-mode"
                className="input-field"
                value={answerMode}
                onChange={(event) => setAnswerMode(event.target.value)}
              >
                {answerOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
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
            {loading || checkingAuth ? "Creating…" : "Create Team"}
          </button>
        </form>
      </div>
    </main>
  );
}
