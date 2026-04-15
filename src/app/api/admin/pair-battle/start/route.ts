import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

/**
 * POST /api/admin/pair-battle/start
 * Marks all ready pairs as "in_progress" and enables pair battle mode
 * Body: { roundId: string }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.roundId !== "string") {
    return NextResponse.json(
      { error: "roundId required in body" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Get all pairings for this round
  const { data: pairings, error: pairingsError } = await supabase
    .from("pair_pairings")
    .select("*")
    .eq("round_id", body.roundId);

  if (pairingsError) {
    return NextResponse.json({
      error: pairingsError.message,
    }, { status: 500 });
  }

  if (!pairings || pairings.length === 0) {
    return NextResponse.json({
      error: "No pairings found for this round",
    }, { status: 404 });
  }

  // Check if all pairs are complete
  const incomplete = pairings.filter((p) => !p.team_a_id || !p.team_b_id);
  if (incomplete.length > 0) {
    return NextResponse.json({
      error: `${incomplete.length} pairs are incomplete. All 6 pairs must have 2 teams.`,
    }, { status: 400 });
  }

  // Update all pairings to "in_progress" with current timestamp
  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("pair_pairings")
    .update({ status: "in_progress", started_at: now })
    .eq("round_id", body.roundId)
    .select();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Enable pair battle on all teams in these pairings
  const allTeamIds: string[] = [];
  pairings.forEach((p) => {
    if (p.team_a_id) allTeamIds.push(p.team_a_id);
    if (p.team_b_id) allTeamIds.push(p.team_b_id);
  });

  const { error: enableError } = await supabase
    .from("teams")
    .update({ pair_battle_enabled: true })
    .in("id", allTeamIds);

  if (enableError) {
    return NextResponse.json({ error: enableError.message }, { status: 500 });
  }

  const { data: round2 } = await supabase
    .from("rounds")
    .select("id")
    .eq("round_number", 2)
    .maybeSingle();

  if (round2?.id) {
    await supabase
      .from("rounds")
      .update({ status: "ended" })
      .neq("id", round2.id)
      .in("status", ["active", "paused"]);

    await supabase
      .from("rounds")
      .update({
        status: "active",
        started_at: null,
        elapsed_seconds: 0,
        paused_at: null,
        ended_by: null,
      })
      .eq("id", round2.id);
  }

  if (allTeamIds.length > 0) {
    await supabase.from("team_events").insert(
      allTeamIds.map((teamId) => ({
        team_id: teamId,
        event_type: "round",
        message: "Congrats on passing Round 1. Round 2 has started.",
      })),
    );
  }

  return NextResponse.json({
    success: true,
    pairings: updated,
    message: "Pair battle started. All 6 pairs in progress.",
  });
}
