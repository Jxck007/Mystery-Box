import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

const ROUND1_SURVIVOR_LIMIT = 12;
const ROUND2_QUALIFY_LIMIT = 6;

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

  if (![1, 2].includes(parsedRound)) {
    return NextResponse.json({ error: "Only round 1 or round 2 elimination can be applied" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (parsedRound === 1) {
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
      survivors,
      eliminated,
    });
  }

  const { data: solvedTeams, error: solvedError } = await supabase
    .from("teams")
    .select("id, name, round2_solved_at")
    .not("round2_solved_at", "is", null)
    .order("round2_solved_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (solvedError) {
    return NextResponse.json({ error: solvedError.message }, { status: 500 });
  }

  const qualified = solvedTeams?.slice(0, ROUND2_QUALIFY_LIMIT) ?? [];
  const eliminated = solvedTeams?.slice(ROUND2_QUALIFY_LIMIT) ?? [];

  if (qualified.length > 0) {
    const { error: qualifiedError } = await supabase
      .from("teams")
      .update({
        round2_status: "qualified",
        is_active: true,
        eliminated_at: null,
        eliminated_round: null,
      })
      .in("id", qualified.map((team) => team.id));

    if (qualifiedError) {
      return NextResponse.json({ error: qualifiedError.message }, { status: 500 });
    }
  }

  if (eliminated.length > 0) {
    const nowIso = new Date().toISOString();
    const { error: round2EliminatedError } = await supabase
      .from("teams")
      .update({
        round2_status: "eliminated",
        is_active: false,
        eliminated_at: nowIso,
        eliminated_round: 2,
      })
      .in("id", eliminated.map((team) => team.id));

    if (round2EliminatedError) {
      return NextResponse.json({ error: round2EliminatedError.message }, { status: 500 });
    }

    await supabase.from("team_events").insert(
      eliminated.map((team, index) => ({
        team_id: team.id,
        event_type: "elimination",
        message: `Round 2 complete. First ${ROUND2_QUALIFY_LIMIT} solved teams qualified. Your solve order: ${ROUND2_QUALIFY_LIMIT + index + 1}.`,
      })),
    );
  }

  return NextResponse.json({
    success: true,
    roundNumber: 2,
    qualifyLimit: ROUND2_QUALIFY_LIMIT,
    qualified,
    eliminated,
  });
}
