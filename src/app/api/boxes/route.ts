import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const teamId = request.url
    ? new URL(request.url).searchParams.get("teamId")
    : null;

  if (!teamId) {
    return NextResponse.json(
      { error: "Team id is required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: teamOverride, error: overrideError } = await supabase
    .from("team_rounds")
    .select("*, round:round_id(*)")
    .eq("team_id", teamId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (overrideError) {
    return NextResponse.json({ error: overrideError.message }, { status: 500 });
  }

  const { data: globalRound, error: globalError } = await supabase
    .from("rounds")
    .select("*")
    .in("status", ["active", "paused"])
    .order("round_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (globalError) {
    return NextResponse.json({ error: globalError.message }, { status: 500 });
  }

  const roundData = teamOverride?.round ?? globalRound ?? null;
  let roundPayload = roundData
    ? {
        ...roundData,
        status: teamOverride?.status ?? roundData.status,
        started_at: teamOverride?.started_at ?? roundData.started_at,
      }
    : null;

  if (roundPayload) {
    const durationSeconds = roundPayload.duration_seconds ?? 0;
    const overrideElapsed = teamOverride?.elapsed_seconds ?? 0;
    const globalElapsed = roundPayload.elapsed_seconds ?? 0;
    let remaining: number | null = null;

    if (roundPayload.status === "active") {
      if (roundPayload.started_at) {
        const startedAt = new Date(roundPayload.started_at).getTime();
        const elapsedBase = teamOverride ? overrideElapsed : globalElapsed;
        const totalElapsed = elapsedBase + Math.floor((Date.now() - startedAt) / 1000);
        remaining = Math.max(0, durationSeconds - totalElapsed);
      } else {
        const elapsedBase = teamOverride ? overrideElapsed : globalElapsed;
        remaining = Math.max(0, durationSeconds - elapsedBase);
      }
    }

    if (roundPayload.status === "paused") {
      const elapsedBase = teamOverride ? overrideElapsed : globalElapsed;
      remaining = Math.max(0, durationSeconds - elapsedBase);
    }

    if (remaining !== null) {
      roundPayload = {
        ...roundPayload,
        remaining_seconds: remaining,
      };
    }

    if (!teamOverride && roundPayload.status === "active" && durationSeconds > 0 && remaining !== null && remaining <= 0) {
      await supabase
        .from("rounds")
        .update({ status: "ended", ended_at: new Date().toISOString(), ended_by: "auto" })
        .eq("id", roundPayload.id);
      roundPayload = { ...roundPayload, status: "ended" };
    }
  }

  let openRecord: Record<string, unknown> | null = null;
  let gameRecord: Record<string, unknown> | null = null;

  const activeRoundId = teamOverride?.round_id ?? globalRound?.id ?? null;
  if (activeRoundId) {
    const { data: latestOpen, error: openError } = await supabase
      .from("box_opens")
      .select("*")
      .eq("team_id", teamId)
      .eq("round_id", activeRoundId)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openError) {
      return NextResponse.json({ error: openError.message }, { status: 500 });
    }

    openRecord = latestOpen ?? null;

    if (latestOpen?.box_id) {
      const { data: gameData, error: gameError } = await supabase
        .from("mystery_boxes")
        .select("*")
        .eq("id", latestOpen.box_id)
        .maybeSingle();

      if (gameError) {
        return NextResponse.json({ error: gameError.message }, { status: 500 });
      }

      gameRecord = gameData ?? null;
    }
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .maybeSingle();

  if (!team) {
    return NextResponse.json(
      { error: "Team not found", code: "TEAM_REMOVED" },
      { status: 404 },
    );
  }

  const { data: events } = await supabase
    .from("team_events")
    .select("id, event_type, message, created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(3);

  return NextResponse.json({
    round: roundPayload,
    open: openRecord,
    game: gameRecord,
    events: events ?? [],
  });
}
