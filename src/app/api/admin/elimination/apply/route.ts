import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";
import { ROUND1_SURVIVOR_LIMIT, ROUND2_QUALIFIED_TEAM_LIMIT } from "@/lib/pair-battle";

const ROUND2_QUALIFY_LIMIT = ROUND2_QUALIFIED_TEAM_LIMIT;

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { roundNumber } = body;
  const parsedRound = Number(roundNumber);

  if (!parsedRound || Number.isNaN(parsedRound)) {
    return NextResponse.json({ error: "Round number is required" }, { status: 400 });
  }

  if (parsedRound !== 1) {
    return NextResponse.json({ error: "Round 2 winners are automatic in pair battle mode" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: activeTeams, error: teamError } = await supabase
    .from("teams")
    .select("id, name, score, created_at")
    .eq("is_active", true)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true });

  if (teamError) {
    return NextResponse.json({ error: teamError.message }, { status: 500 });
  }

  const survivors = activeTeams?.slice(0, ROUND1_SURVIVOR_LIMIT) ?? [];
  const eliminated = activeTeams?.slice(ROUND1_SURVIVOR_LIMIT) ?? [];

  if (survivors.length > 0) {
    const { error: survivorError } = await supabase
      .from("teams")
      .update({
        is_active: true,
        eliminated_at: null,
        eliminated_round: null,
        eliminated_position: null,
      })
      .in("id", survivors.map((team) => team.id));

    if (survivorError) {
      return NextResponse.json({ error: survivorError.message }, { status: 500 });
    }
  }

  if (eliminated.length > 0) {
    const nowIso = new Date().toISOString();
    const { error: eliminatedError } = await supabase
      .from("teams")
      .update({
        is_active: false,
        eliminated_at: nowIso,
        eliminated_round: 1,
      })
      .in("id", eliminated.map((team) => team.id));

    if (eliminatedError) {
      return NextResponse.json({ error: eliminatedError.message }, { status: 500 });
    }

    await Promise.all(
      eliminated.map((team, index) =>
        supabase
          .from("teams")
          .update({ eliminated_position: ROUND1_SURVIVOR_LIMIT + index + 1 })
          .eq("id", team.id),
      ),
    );

    await supabase.from("team_events").insert(
      eliminated.map((team, index) => ({
        team_id: team.id,
        event_type: "elimination",
        message: `Round 1 complete. Eliminated at rank ${ROUND1_SURVIVOR_LIMIT + index + 1}.`,
      })),
    );
  }

  await supabase
    .from("rounds")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      ended_by: "admin",
    })
    .eq("round_number", 1)
    .in("status", ["active", "paused", "waiting"]);

  // Ensure Round 2 exists after applying the Round 1 cut.
  const { data: existingRound2, error: round2LookupError } = await supabase
    .from("rounds")
    .select("id")
    .eq("round_number", 2)
    .maybeSingle();

  if (round2LookupError) {
    return NextResponse.json({ error: round2LookupError.message }, { status: 500 });
  }

  if (!existingRound2) {
    const { data: round1Config } = await supabase
      .from("rounds")
      .select("duration_seconds")
      .eq("round_number", 1)
      .maybeSingle();

    const fallbackDuration =
      typeof round1Config?.duration_seconds === "number" && round1Config.duration_seconds > 0
        ? round1Config.duration_seconds
        : 300;

    const { error: createRound2Error } = await supabase
      .from("rounds")
      .insert({
        round_number: 2,
        title: "Round 2",
        status: "waiting",
        duration_seconds: fallbackDuration,
        elapsed_seconds: 0,
      });

    if (createRound2Error) {
      return NextResponse.json({ error: createRound2Error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    roundNumber: 1,
    survivorLimit: ROUND1_SURVIVOR_LIMIT,
    qualifyLimit: ROUND2_QUALIFY_LIMIT,
    survivors,
    eliminated,
  });
}
