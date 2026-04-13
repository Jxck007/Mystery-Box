import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { teamId } = body;
  if (!teamId) {
    return NextResponse.json({ error: "Team id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const INDIVIDUAL_START_ROUNDS = new Set([1, 2]);

  const { data: teamRound, error: roundError } = await supabase
    .from("team_rounds")
    .select("*, round:round_id(*)")
    .eq("team_id", teamId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (roundError) {
    return NextResponse.json(
      { error: roundError.message },
      { status: 500 },
    );
  }

  const activeRound = Array.isArray(teamRound?.round)
    ? teamRound?.round[0]
    : teamRound?.round;

  if (teamRound?.started_at) {
    return NextResponse.json({ started_at: teamRound.started_at });
  }

  const { data: globalRound, error: globalError } = await supabase
    .from("rounds")
    .select("*")
    .eq("status", "active")
    .order("round_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (globalError) {
    return NextResponse.json({ error: globalError.message }, { status: 500 });
  }

  const roundNumber = activeRound?.round_number ?? globalRound?.round_number;
  const roundId = activeRound?.id ?? globalRound?.id;

  if (!roundNumber || !roundId) {
    return NextResponse.json(
      { error: "No active round for team" },
      { status: 400 },
    );
  }

  if (!INDIVIDUAL_START_ROUNDS.has(roundNumber)) {
    return NextResponse.json(
      { error: "This round uses global start." },
      { status: 400 },
    );
  }

  const startedAt = new Date().toISOString();

  if (teamRound) {
    const { data: updated, error: updateError } = await supabase
      .from("team_rounds")
      .update({ started_at: startedAt, elapsed_seconds: 0 })
      .eq("id", teamRound.id)
      .select("started_at")
      .maybeSingle();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message ?? "Unable to start timer" },
        { status: 500 },
      );
    }

    await supabase.from("team_events").insert({
      team_id: teamId,
      event_type: "round",
      message: `Team started gameplay timer for Round ${roundNumber}.`,
    });

    return NextResponse.json({ started_at: updated.started_at });
  }

  const { data: created, error: createError } = await supabase
    .from("team_rounds")
    .insert({
      team_id: teamId,
      round_id: roundId,
      boxes_opened: 0,
      score_this_round: 0,
      status: "active",
      started_at: startedAt,
      elapsed_seconds: 0,
    })
    .select("started_at")
    .maybeSingle();

  if (createError || !created) {
    return NextResponse.json(
      { error: createError?.message ?? "Unable to start timer" },
      { status: 500 },
    );
  }

  await supabase.from("team_events").insert({
    team_id: teamId,
    event_type: "round",
    message: `Team started gameplay timer for Round ${roundNumber}.`,
  });

  return NextResponse.json({ started_at: created.started_at });
}
