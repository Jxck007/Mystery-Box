"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function CreateTeamPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [leaderName, setLeaderName] = useState("");
  const [memberNames, setMemberNames] = useState(["", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  const cleanedMembers = useMemo(
    () => memberNames.map((name) => name.trim()).filter(Boolean),
    [memberNames],
  );

  useEffect(() => {
    const check = async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) {
        router.replace("/auth?redirect=/create-team");
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
        maxMembers: 4,
        memberNames: cleanedMembers,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Unable to create team");
      setLoading(false);
      return;
    }

    localStorage.setItem("team_id", payload.id);
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
          Add your team members and get ready for the mission.
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
            Add up to three teammate names. Only the leader signs in and plays.
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

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-200">
              Teammate names (optional)
            </p>
            {memberNames.map((name, index) => (
              <input
                key={`member-${index}`}
                value={name}
                onChange={(event) => {
                  const next = [...memberNames];
                  next[index] = event.target.value;
                  setMemberNames(next);
                }}
                className="input-field"
                placeholder={`Member ${index + 2} name`}
              />
            ))}
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
