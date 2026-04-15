import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";
import { ROUND1_SURVIVOR_LIMIT } from "@/lib/pair-battle";

const ROUND2_QUALIFY_LIMIT = 8;

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

  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("id, name, score")
    .order("score", { ascending: false })
    .order("created_at", { ascending: true });

  if (teamError) {
    return NextResponse.json({ error: teamError.message }, { status: 500 });
  }

  const survivors = teams?.slice(0, ROUND1_SURVIVOR_LIMIT) ?? [];
  const eliminated = teams?.slice(ROUND1_SURVIVOR_LIMIT) ?? [];

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

    await supabase.from("team_events").insert(
      eliminated.map((team, index) => ({
        team_id: team.id,
        event_type: "elimination",
        message: `Round 1 complete. Eliminated at rank ${ROUND1_SURVIVOR_LIMIT + index + 1}.`,
      })),
    );
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
