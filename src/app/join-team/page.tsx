"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function JoinTeamPage() {
  const router = useRouter();
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

  return (
    <main className="page-shell">
      <div className="page-hero">
        <p className="label">Team access</p>
        <h1 className="title">Leader-only setup</h1>
        <p className="subtitle">
          Teams are created by the leader on a single device. Add member names
          during setup.
        </p>
      </div>
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <p className="label">Create team</p>
          <button
            type="button"
            className="button-muted text-sm"
            onClick={() => router.back()}
          >
            Back
          </button>
        </div>
        <div>
          <h1 className="text-3xl font-semibold">Create your team</h1>
          <p className="text-slate-300">
            Leaders should create a team and enter all member names there.
          </p>
        </div>
        <button
          type="button"
          className="button-primary w-full"
          disabled={checkingAuth}
          onClick={() => router.push("/create-team")}
        >
          {checkingAuth ? "Checking..." : "Go to Create Team"}
        </button>
      </div>

    </main>
  );
}
