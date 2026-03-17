"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { getMiniGameConfig } from "@/app/team/game-panels";

type GameRecord = {
  id: string;
  game_title: string | null;
  game_description: string | null;
  game_type: string | null;
  points_value: number | null;
                  setRound2Status(
                    payload.qualified
                      ? "Code accepted. You qualified for Round 3."
                      : "Code accepted, but slots are full.",
                  );
  id: string;
  box_id: string;
  status: "pending" | "approved" | "rejected";
  submitted_answer?: string | null;
  opened_at?: string | null;
};

type RoundRecord = {
  id: string;
  title?: string | null;
  status: "waiting" | "active" | "paused" | "ended";
  started_at?: string | null;
  ended_at?: string | null;
      {round?.round_number === 1 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="label">Mystery box</p>
              <h2 className="text-2xl font-semibold">Open the box</h2>
            </div>
            {loading && (
              <p className="text-sm text-slate-300">Refreshing boxes…</p>
            )}
          </div>

          <div className="mystery-grid">
            <button
              type="button"
              className={`mystery-box ${
                round?.status !== "active" ? "locked" : currentOpen ? "opened" : ""
              } ${opening ? "opening" : ""}`}
              onClick={handleBoxClick}
              disabled={opening || (round?.status !== "active" && !currentOpen)}
            >
              <div className="mystery-icon">381</div>
              <span className="box-badge">
                {round?.status !== "active" ? "Locked" : currentOpen ? "Opened" : "Open"}
              </span>
              {opening && (
                <span className="text-xs uppercase tracking-wide text-sky-300">
                  Opening...
                </span>
              )}
            </button>
          </div>
        </div>
      )}
  isLeader: boolean;
};

const statusStyles: Record<string, string> = {
  pending: "status-pill status-pending",
  approved: "status-pill status-approved",
  rejected: "status-pill status-rejected",
};

export default function TeamDashboardPage() {
  const router = useRouter();
  const INDIVIDUAL_START_ROUNDS = useMemo(() => new Set([1, 2]), []);
  const [session, setSession] = useState<SessionData | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [currentGame, setCurrentGame] = useState<GameRecord | null>(null);
  const [currentOpen, setCurrentOpen] = useState<BoxOpen | null>(null);
  const [round, setRound] = useState<RoundRecord | null>(null);
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [visibleEvents, setVisibleEvents] = useState<TeamEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameRecord | null>(null);
  const [modalError, setModalError] = useState("");
  const [round2Code, setRound2Code] = useState("");
  const [round2Status, setRound2Status] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [removedNotice, setRemovedNotice] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [gameStartAt, setGameStartAt] = useState<number | null>(null);
  const [members, setMembers] = useState<
    { id: string; display_name: string; joined_at: string }[]
  >([]);

  const fetchBoxes = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const response = await fetch(`/api/boxes?teamId=${session.teamId}`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (response.ok) {
      setCurrentGame(payload.game ?? null);
      setCurrentOpen(payload.open ?? null);
      setRound(payload.round ?? null);
      setEvents(payload.events ?? []);
      setRemovedNotice("");
    } else if (payload.code === "TEAM_REMOVED") {
      setRemovedNotice("Your team was removed by the admin.");
      localStorage.removeItem("team_id");
      localStorage.removeItem("team_code");
      localStorage.removeItem("player_name");
      localStorage.removeItem("is_leader");
      router.push("/");
    }
    setLoading(false);
  }, [session, router]);

  const fetchTeam = useCallback(async () => {
    if (!session) return;
    const response = await fetch("/api/teams/list?includeInactive=true");
    const data = await response.json();
    if (response.ok && Array.isArray(data)) {
      const matching = data.find((entry) => entry.id === session.teamId);
      if (matching) {
        setTeam(matching);
      }
    }
  }, [session]);

  const fetchMembers = useCallback(async () => {
    if (!session) return;
    const response = await fetch(`/api/teams/${session.teamId}/players`, {
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);
    if (response.ok && Array.isArray(data)) {
      setMembers(data);
      return;
    }
    setMembers([]);
  }, [session]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const storedTeamId = localStorage.getItem("team_id");
      const storedTeamCode = localStorage.getItem("team_code");
      const storedPlayer = localStorage.getItem("player_name");
      const leaderFlag = localStorage.getItem("is_leader");

      if (!storedTeamId || !storedTeamCode || !storedPlayer) {
        supabaseBrowser.auth.getSession().then(async ({ data }) => {
          if (!data.session) {
            router.push("/");
            return;
          }
          const response = await fetch("/api/players/me", {
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok || !payload?.team) {
            router.push("/create-team");
            return;
          }
          localStorage.setItem("team_id", payload.team.id);
          localStorage.setItem("team_code", payload.team.code);
          localStorage.setItem("player_name", payload.display_name);
          localStorage.setItem(
            "is_leader",
            payload.team.leader_name === payload.display_name ? "true" : "false",
          );
          setSession({
            teamId: payload.team.id,
            teamCode: payload.team.code,
            playerName: payload.display_name,
            isLeader: payload.team.leader_name === payload.display_name,
          });
        });
        return;
      }

      setSession({
        teamId: storedTeamId,
        teamCode: storedTeamCode,
        playerName: storedPlayer,
        isLeader: leaderFlag === "true",
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [router]);

  useEffect(() => {
    const readAuth = async () => {
      const { data } = await supabaseBrowser.auth.getUser();
      setAuthEmail(data.user?.email ?? null);
    };
    readAuth();
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    const id = window.setTimeout(() => {
      fetchBoxes();
      fetchTeam();
      fetchMembers();
    }, 0);
    return () => window.clearTimeout(id);
  }, [session, fetchBoxes, fetchTeam, fetchMembers]);

  useEffect(() => {
    if (!session) return;
    const intervalId = window.setInterval(() => {
      fetchBoxes();
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [session, fetchBoxes]);

  useEffect(() => {
    if (!session) return;
    const opensChannel = supabaseBrowser
      .channel(`opens-${session.teamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "box_opens",
          filter: `team_id=eq.${session.teamId}`,
        },
        fetchBoxes,
      )
      .subscribe();

    const roundsChannel = supabaseBrowser
      .channel("rounds-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds" },
        fetchBoxes,
      )
      .subscribe();

    const eventsChannel = supabaseBrowser
      .channel(`events-${session.teamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "team_events",
          filter: `team_id=eq.${session.teamId}`,
        },
        fetchBoxes,
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(opensChannel);
      supabaseBrowser.removeChannel(roundsChannel);
      supabaseBrowser.removeChannel(eventsChannel);
    };
  }, [session, fetchBoxes]);

  const handleBoxClick = async () => {
    if (!session) {
      return;
    }
    if (currentOpen && currentGame) {
      router.push(`/game/${currentGame.id}`);
      return;
    }

    if (round && round.status !== "active") {
      return;
    }

    setLoading(true);
    setOpening(true);
    const response = await fetch("/api/boxes/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: session.teamId }),
    });
    const payload = await response.json();
    if (response.ok) {
      setCurrentGame(payload.game ?? null);
      setCurrentOpen(payload.open ?? null);
      setSelectedGame(payload.game ?? null);
      if (payload.game?.id) {
        router.push(`/game/${payload.game.id}`);
      }
      setModalError("");
      if (INDIVIDUAL_START_ROUNDS.has(round?.round_number ?? 0)) {
        setGameStarted(false);
        setGameStartAt(null);
      }
    } else {
      setModalError(payload.error ?? "Unable to open game");
    }
    setLoading(false);
    setOpening(false);
  };

  const handleSubmit = async () => {
    if (!selectedGame || !session) return;
    const safeAnswer = "Completed";

    setSubmitting(true);
    const response = await fetch("/api/boxes/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId: session.teamId,
        boxId: selectedGame.id,
        submission: safeAnswer,
        isLeader: session.isLeader,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setModalError(payload.error ?? "Unable to submit answer");
      setSubmitting(false);
      return;
    }

    setModalError("");
    await fetchBoxes();
    setSubmitting(false);
  };

  useEffect(() => {
    if (!selectedGame) {
      const id = window.setTimeout(() => {
        setModalError("");
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [selectedGame]);

  useEffect(() => {
    if (events.length === 0) {
      setVisibleEvents([]);
      return;
    }
    const repeats = events.flatMap((event) =>
      [0, 1, 2].map((index) => ({
        ...event,
        id: `${event.id}-${index}`,
      })),
    );
    setVisibleEvents(repeats);
    const id = window.setTimeout(() => {
      setVisibleEvents([]);
    }, 3000);
    return () => window.clearTimeout(id);
  }, [events]);

  const modalOpen = selectedGame ? currentOpen : null;

  const roundBanner = useMemo(() => {
    if (!round) {
      return null;
    }
    if (round.status === "paused") {
      return (
        <div className="banner paused">
          The round has been paused. Please wait for admin to resume.
        </div>
      );
    }
    if (round.status === "ended") {
      return (
        <div className="banner ended">The round has ended. Thanks for playing.</div>
      );
    }
    return null;
  }, [round]);

  const canSubmit =
    round?.status === "active" &&
    gameStarted &&
    (team?.answer_mode === "all_members" || session?.isLeader);

  const isIndividualStartRound = INDIVIDUAL_START_ROUNDS.has(
      {round?.round_number === 2 && round?.status === "active" && (
  );

  const descriptionPoints = useMemo(() => {
    const raw = selectedGame?.game_description ?? "";
    return raw
      .split(".")
      .map((part) => part.trim())
          {!team?.round2_code ? (
            <div className="banner paused">
              Waiting for the admin to set your Round 2 code.
            </div>
          ) : team?.round2_solved_at ? (
            <div className="banner paused">
              Code solved. {team.round2_status === "qualified"
                ? "You qualified for Round 3."
                : "Slots were full."}
            </div>
          ) : (
            <div className="code-panel">
              <div className="code-display">
                {Array.from({ length: 4 }).map((_, index) => (
                  <span key={index} className="code-slot">
                    {round2Code[index] ?? "_"}
                  </span>
                ))}
              </div>
              <div className="code-keypad">
                {Array.from({ length: 10 }).map((_, index) => {
                  const value = (index + 1) % 10;
                  return (
                    <button
                      key={value}
                      type="button"
                      className="button-muted"
                      onClick={() => {
                        if (round2Code.length < 4) {
                          setRound2Code(`${round2Code}${value}`);
                        }
                      }}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="button-muted"
                  onClick={() => setRound2Code("")}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="button-primary"
                  onClick={async () => {
                    setRound2Status("");
                    const { data } = await supabaseBrowser.auth.getSession();
                    if (!data.session) {
                      setRound2Status("Please sign in again.");
                      return;
                    }
                    const response = await fetch("/api/round2/submit", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${data.session.access_token}`,
                      },
                      body: JSON.stringify({ code: round2Code }),
                    });
                    const payload = await response.json();
                    if (!response.ok) {
                      setRound2Status(payload.error ?? "Unable to submit code");
                      return;
                    }
                    setRound2Status(
                      payload.qualified
                        ? "Code accepted. You qualified for Round 3."
                        : "Code accepted, but slots are full.",
                    );
                  }}
                  disabled={round2Code.length !== 4}
                >
                  Submit Code
                </button>
              </div>
              {round2Status && (
                <p className="text-sm text-slate-300">{round2Status}</p>
              )}
            </div>
          )}
            <div className="flex items-center gap-3 text-sm">
              <span className="uppercase tracking-wide text-slate-400">Score</span>
              <span className="text-4xl font-bold text-sky-300">
      {round?.round_number !== 2 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="label">Mystery box</p>
              <h2 className="text-2xl font-semibold">Open the box</h2>
            </div>
            {loading && (
              <p className="text-sm text-slate-300">Refreshing boxes…</p>
            )}
          </div>

          <div className="mystery-grid">
            <button
              type="button"
              className={`mystery-box ${
                round?.status !== "active" ? "locked" : currentOpen ? "opened" : ""
              } ${opening ? "opening" : ""}`}
              onClick={handleBoxClick}
              disabled={opening || (round?.status !== "active" && !currentOpen)}
            >
              <div className="mystery-icon">381</div>
              <span className="box-badge">
                {round?.status !== "active" ? "Locked" : currentOpen ? "Opened" : "Open"}
              </span>
              {opening && (
                <span className="text-xs uppercase tracking-wide text-sky-300">
                  Opening...
                </span>
              )}
            </button>
          </div>
        </div>
      )}
            <div className="flex flex-wrap gap-4 text-sm text-slate-300">
              <p>
                Members: {(team?.member_count ?? 0)}/{team?.max_members ?? "–"}
              </p>
              <p>
                Leader: {team?.leader_name ?? session?.playerName ?? "–"}
              </p>
            </div>
            {members.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                {members.map((member) => {
                  const isYou =
                    member.display_name.toLowerCase() ===
                    (session?.playerName ?? "").toLowerCase();
                  const isLeader =
                    member.display_name.toLowerCase() ===
                    (team?.leader_name ?? "").toLowerCase();
                  return (
                    <span key={member.id} className="member-pill">
                      <span className="member-name">{member.display_name}</span>
                      {isLeader && (
                        <span className="role-pill role-leader">Leader</span>
                      )}
                      {isYou && <span className="role-pill role-you">You</span>}
                      {session?.isLeader && !isLeader && (
                        <button
                          type="button"
                          className="role-pill role-kick"
                          onClick={async () => {
                            const { data } = await supabaseBrowser.auth.getSession();
                            if (!data.session) return;
                            await fetch(`/api/teams/${session.teamId}/players/remove`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${data.session.access_token}`,
                              },
                              body: JSON.stringify({ playerId: member.id }),
                            });
                            fetchMembers();
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                className="button-muted inline-flex items-center"
                onClick={() => {
                  if (team?.code) {
                    navigator.clipboard.writeText(team.code);
                  }
                }}
              >
                Copy Team Code
              </button>
              <button
                className="button-primary"
                onClick={() => router.push("/leaderboard")}
              >
                View Leaderboard
              </button>
            </div>
          </div>
        </details>

        {removedNotice && (
          <div className="banner ended">{removedNotice}</div>
        )}

        {roundBanner}

        {modalError && !selectedGame && (
          <div className="banner ended">{modalError}</div>
        )}

        {visibleEvents.length > 0 && (
          <div className="space-y-2">
            {visibleEvents.map((event) => (
              <div key={event.id} className="banner paused">
                {event.message}
              </div>
            ))}
          </div>
        )}

        <div>
          <p className="label">Current round</p>
          <p className="text-sm text-slate-300">
            {round?.round_number
              ? `Round ${round.round_number}`
              : "Waiting for admin to start a round"}
          </p>
        </div>
      </div>

      {round?.round_number === 2 && round?.status === "active" && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="label">Round 2 access</p>
              <h2 className="text-2xl font-semibold">Enter the 4-digit code</h2>
            </div>
          </div>
          <div className="code-panel">
            <div className="code-display">
              {Array.from({ length: 4 }).map((_, index) => (
                <span key={index} className="code-slot">
                  {round2Code[index] ?? "_"}
                </span>
              ))}
            </div>
            <div className="code-keypad">
              {Array.from({ length: 10 }).map((_, index) => {
                const value = (index + 1) % 10;
                return (
                  <button
                    key={value}
                    type="button"
                    className="button-muted"
                    onClick={() => {
                      if (round2Code.length < 4) {
                        setRound2Code(`${round2Code}${value}`);
                      }
                    }}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="button-muted"
                onClick={() => setRound2Code("")}
              >
                Clear
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={async () => {
                  setRound2Status("");
                  const { data } = await supabaseBrowser.auth.getSession();
                  if (!data.session) {
                    setRound2Status("Please sign in again.");
                    return;
                  }
                  const response = await fetch("/api/round2/submit", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${data.session.access_token}`,
                    },
                    body: JSON.stringify({ code: round2Code }),
                  });
                  const payload = await response.json();
                  if (!response.ok) {
                    setRound2Status(payload.error ?? "Unable to submit code");
                    return;
                  }
                  setRound2Status(
                    payload.qualified
                      ? "Code accepted. You qualified for Round 2."
                      : "Code accepted, but slots are full.",
                  );
                }}
                disabled={round2Code.length !== 4}
              >
                Submit Code
              </button>
            </div>
            {round2Status && (
              <p className="text-sm text-slate-300">{round2Status}</p>
            )}
          </div>
        </div>
      )}

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="label">Mystery box</p>
            <h2 className="text-2xl font-semibold">Open the box</h2>
          </div>
          {loading && (
            <p className="text-sm text-slate-300">Refreshing boxes…</p>
          )}
        </div>

        <div className="mystery-grid">
          <button
            type="button"
            className={`mystery-box ${
              round?.status !== "active" ? "locked" : currentOpen ? "opened" : ""
            } ${opening ? "opening" : ""}`}
            onClick={handleBoxClick}
            disabled={opening || (round?.status !== "active" && !currentOpen)}
          >
            <div className="mystery-icon">\ud83c\udf81</div>
            <span className="box-badge">
              {round?.status !== "active" ? "Locked" : currentOpen ? "Opened" : "Open"}
            </span>
            {opening && (
              <span className="text-xs uppercase tracking-wide text-sky-300">
                Opening...
              </span>
            )}
          </button>
        </div>
      </div>

      {selectedGame && modalOpen && (
        <div className="banner paused">
          Game loaded. Redirecting to play surface...
        </div>
      )}
    </main>
  );
}
