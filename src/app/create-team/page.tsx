"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { isTestModeEnabled } from "@/lib/test-mode";
import { playSound } from "@/lib/sound-manager";

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
      if (isTestModeEnabled()) {
        setCheckingAuth(false);
        return;
      }
      const { data } = await supabaseBrowser.auth.getSession();
      if (!data.session) {
        router.replace("/auth?redirect=/create-team");
        return;
      }

      const metadata = data.session.user.user_metadata ?? {};
      const suggestedLeaderName =
        typeof metadata.display_name === "string" && metadata.display_name.trim()
          ? metadata.display_name.trim()
          : typeof metadata.full_name === "string" && metadata.full_name.trim()
            ? metadata.full_name.trim()
            : typeof metadata.name === "string" && metadata.name.trim()
              ? metadata.name.trim()
              : "";

      if (suggestedLeaderName) {
        setLeaderName((previous) => (previous.trim() ? previous : suggestedLeaderName));
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

    if (isTestModeEnabled()) {
      localStorage.setItem("team_id", "test-team");
      localStorage.setItem("player_name", leaderName || "TEST_OPERATOR");
      localStorage.setItem("is_leader", "true");
      setLoading(false);
      router.push("/team");
      return;
    }

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
        maxMembers: memberNames.length + 1,
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
    void playSound("Gotin", { priority: "medium", bypassCooldown: true });
    setLoading(false);
    router.push("/team");
  };

  return (
    <main className="page-shell">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        <section className="md:col-span-5 space-y-4">
          <p className="section-tag">PHASE 01: FORMATION</p>
          <h1 className="font-headline text-5xl md:text-6xl font-black uppercase leading-[0.9]" style={{ letterSpacing: "-0.04em" }}>
            ESTABLISH / YOUR / COLLECTIVE
          </h1>
          <p className="text-sm md:text-base text-[var(--text-muted)]">
            Configure team identity, designate lead control, and lock unit capacity before mission start.
          </p>
          <div className="card py-4" style={{ borderLeft: "3px solid var(--accent)" }}>
            <p className="label">FORMATION_NOTE</p>
            <p className="text-sm text-[var(--text-muted)]">
              Leader device owns all in-round submissions and administrative team actions.
            </p>
          </div>
        </section>
        <section className="md:col-span-7 card space-y-6" style={{ background: "var(--bg-container)" }}>
          <div className="flex items-center justify-between">
            <p className="label">CREATE TEAM</p>
            <button type="button" className="button-muted text-xs" onClick={() => router.back()}>
              BACK
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <p className="label">01. TEAM DESIGNATION</p>
              <input
                id="team-name"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                className="input-field"
                placeholder="TEAM NAME"
                required
              />
            </div>
            <div>
              <p className="label">02. LEAD ARCHITECT</p>
              <input
                id="leader-name"
                value={leaderName}
                onChange={(event) => setLeaderName(event.target.value)}
                className="input-field"
                placeholder="LEADER NAME"
                required
              />
            </div>
            <div className="space-y-3">
              <p className="label">03. UNIT CAPACITY</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="card py-6 text-left"
                  style={{ borderColor: (memberNames.length + 1) === 3 ? "var(--accent)" : "rgba(66,74,53,0.3)" }}
                  onClick={() => setMemberNames(["", ""])}
                >
                  <span className="font-headline text-4xl font-black">03</span>
                  <span className="label">MINIMUM UNIT</span>
                </button>
                <button
                  type="button"
                  className="card py-6 text-left"
                  style={{ borderColor: (memberNames.length + 1) === 4 ? "var(--accent)" : "rgba(66,74,53,0.3)" }}
                  onClick={() => setMemberNames(["", "", ""])}
                >
                  <span className="font-headline text-4xl font-black">04</span>
                  <span className="label">MAXIMUM UNIT</span>
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <p className="label">OPTIONAL MEMBER NODES</p>
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
                  placeholder={`MEMBER ${index + 2}`}
                />
              ))}
            </div>
            {error && (
              <p className="text-sm" style={{ color: "var(--error)" }} role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="button-primary w-full" disabled={loading || checkingAuth}>
              {loading || checkingAuth ? "INITIALIZING..." : "INITIALIZE TEAM"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
