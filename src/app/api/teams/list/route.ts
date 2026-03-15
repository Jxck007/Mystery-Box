import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("includeInactive") === "true";
  const supabase = createAdminClient();
  let query = supabase
    .from("teams")
    .select("*")
    .order("created_at", { ascending: false });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data: teams, error: teamError } = await query;

  if (teamError) {
    return NextResponse.json({ error: teamError.message }, { status: 500 });
  }

  const { data: players } = await supabase.from("players").select("team_id");
  const { data: teamRounds } = await supabase
    .from("team_rounds")
    .select(
      "team_id, status, started_at, elapsed_seconds, round:round_id(round_number, title, duration_seconds)",
    )
    .order("started_at", { ascending: false });
  const counts = players?.reduce<Record<string, number>>((acc, player) => {
    if (!player) {
      return acc;
    }
    const teamId = player.team_id;
    acc[teamId] = (acc[teamId] ?? 0) + 1;
    return acc;
  }, {}) ?? {};

  const now = Date.now();
  const roundMap = (teamRounds ?? []).reduce<
    Record<
      string,
      {
        status?: string | null;
        round_number?: number | null;
        title?: string | null;
        remaining_seconds?: number | null;
      }
    >
  >((acc, entry) => {
    if (!entry || acc[entry.team_id]) {
      return acc;
    }
    const roundData = Array.isArray(entry.round) ? entry.round[0] : entry.round;
    const durationSeconds = roundData?.duration_seconds ?? 0;
    let remaining: number | null = null;
    if (durationSeconds > 0) {
      if (entry.status === "active" && entry.started_at) {
        const startedAt = new Date(entry.started_at).getTime();
        const elapsedBase = entry.elapsed_seconds ?? 0;
        const elapsedLive = Math.floor((now - startedAt) / 1000);
        const totalElapsed = elapsedBase + Math.max(0, elapsedLive);
        remaining = Math.max(0, durationSeconds - totalElapsed);
      } else if (entry.status === "paused") {
        const elapsedBase = entry.elapsed_seconds ?? 0;
        remaining = Math.max(0, durationSeconds - elapsedBase);
      } else if (entry.status === "ended") {
        remaining = 0;
      }
    }
    acc[entry.team_id] = {
      status: entry.status ?? null,
      round_number: roundData?.round_number ?? null,
      title: roundData?.title ?? null,
      remaining_seconds: remaining,
    };
    return acc;
  }, {});

  const enriched = (teams ?? []).map((team) => ({
    ...team,
    member_count: counts[team.id] ?? 0,
    current_round_status: roundMap[team.id]?.status ?? null,
    current_round_number: roundMap[team.id]?.round_number ?? null,
    current_round_title: roundMap[team.id]?.title ?? null,
    current_round_remaining_seconds:
      roundMap[team.id]?.remaining_seconds ?? null,
  }));

  return NextResponse.json(enriched);
}
