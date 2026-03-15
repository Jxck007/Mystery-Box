import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { teamId } = body;

  if (!teamId) {
    return NextResponse.json(
      { error: "Team id is required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .maybeSingle();

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

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
    .eq("status", "active")
    .order("round_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (globalError) {
    return NextResponse.json({ error: globalError.message }, { status: 500 });
  }

  const roundRecord = teamOverride?.round ?? globalRound ?? null;

  if (!roundRecord) {
    return NextResponse.json(
      { error: "No active round available" },
      { status: 400 },
    );
  }

  const effectiveStatus = teamOverride?.status ?? roundRecord.status;
  const effectiveStart = teamOverride?.started_at ?? roundRecord.started_at;
  if (effectiveStatus === "paused") {
    return NextResponse.json(
      { error: "Round is paused for this team" },
      { status: 400 },
    );
  }

  if (effectiveStatus === "active" && effectiveStart) {
    const startedAt = new Date(effectiveStart).getTime();
    const elapsedSeconds = teamOverride
      ? teamOverride.elapsed_seconds ?? 0
      : roundRecord.elapsed_seconds ?? 0;
    const durationSeconds = roundRecord.duration_seconds ?? 0;
    const totalElapsed = elapsedSeconds + Math.floor((Date.now() - startedAt) / 1000);
    const remaining = durationSeconds - totalElapsed;
    if (durationSeconds > 0 && remaining <= 0) {
      await supabase
        .from("rounds")
        .update({ status: "ended", ended_at: new Date().toISOString(), ended_by: "auto" })
        .eq("id", roundRecord.id);
      return NextResponse.json(
        { error: "Round has ended" },
        { status: 400 },
      );
    }
  }

  const round = roundRecord as { id: string; round_number: number };

  const { data: pendingOpen } = await supabase
    .from("box_opens")
    .select("*")
    .eq("team_id", teamId)
    .eq("round_id", round.id)
    .eq("status", "pending")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingOpen?.box_id) {
    const { data: pendingGame, error: pendingGameError } = await supabase
      .from("mystery_boxes")
      .select("*")
      .eq("id", pendingOpen.box_id)
      .maybeSingle();

    if (pendingGameError) {
      return NextResponse.json({ error: pendingGameError.message }, { status: 500 });
    }

    return NextResponse.json({
      game: pendingGame,
      open: pendingOpen,
      round,
    });
  }

  const { data: usedGames, error: usedError } = await supabase
    .from("box_opens")
    .select("box_id")
    .eq("team_id", teamId)
    .eq("round_id", round.id);

  if (usedError) {
    return NextResponse.json({ error: usedError.message }, { status: 500 });
  }

  const usedIds = new Set((usedGames ?? []).map((entry) => entry.box_id));

  const { data: roundGames, error: gamesError } = await supabase
    .from("mystery_boxes")
    .select("*")
    .eq("round_number", round.round_number)
    .eq("is_locked", false);

  if (gamesError) {
    return NextResponse.json({ error: gamesError.message }, { status: 500 });
  }

  const availableGames = (roundGames ?? []).filter(
    (game) => !usedIds.has(game.id),
  );

  if (availableGames.length === 0) {
    return NextResponse.json(
      { error: "No available games left for this round" },
      { status: 400 },
    );
  }

  const selectedGame =
    availableGames[Math.floor(Math.random() * availableGames.length)];

  const { data: inserted, error: openError } = await supabase
    .from("box_opens")
    .insert({
      box_id: selectedGame.id,
      team_id: teamId,
      round_id: round.id,
      opened_at: new Date().toISOString(),
      status: "pending",
    })
    .select()
    .maybeSingle();

  if (openError || !inserted) {
    return NextResponse.json(
      { error: openError?.message ?? "Unable to open box" },
      { status: 500 },
    );
  }

  const { data: teamRound } = await supabase
    .from("team_rounds")
    .select("*")
    .eq("team_id", teamId)
    .eq("round_id", round.id)
    .maybeSingle();

  if (teamRound) {
    await supabase
      .from("team_rounds")
      .update({ boxes_opened: (teamRound.boxes_opened ?? 0) + 1 })
      .eq("id", teamRound.id);
  } else {
    await supabase.from("team_rounds").insert({
      team_id: teamId,
      round_id: round.id,
      boxes_opened: 1,
      score_this_round: 0,
      status: "active",
      started_at: null,
    });
  }

  return NextResponse.json({
    game: selectedGame,
    open: inserted,
    round,
  });
}
