import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

/**
 * POST /api/admin/pair-battle/reset
 * Clears all pairings for a round and disables pair battle mode
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

  const pairingId = typeof body.pairingId === "string" ? body.pairingId : null;

  if (pairingId) {
    const { data: pairing, error: pairingError } = await supabase
      .from("pair_pairings")
      .select("id, team_a_id, team_b_id")
      .eq("id", pairingId)
      .eq("round_id", body.roundId)
      .maybeSingle();

    if (pairingError || !pairing) {
      return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
    }

    const teamIds = [pairing.team_a_id, pairing.team_b_id].filter(Boolean) as string[];

    if (teamIds.length > 0) {
      await supabase
        .from("teams")
        .update({
          pair_battle_enabled: true,
          round2_code: null,
          round2_lock_until: null,
          round2_solved_at: null,
          round2_status: "pending",
          eliminated_at: null,
          eliminated_round: null,
          eliminated_position: null,
          is_active: true,
        })
        .in("id", teamIds);
    }

    await supabase
      .from("pair_submissions")
      .delete()
      .eq("pair_id", pairingId);

    await supabase
      .from("pair_pairings")
      .update({
        team_a_id: null,
        team_b_id: null,
        status: "waiting",
        winner_id: null,
        started_at: null,
      })
      .eq("id", pairingId);

    return NextResponse.json({
      success: true,
      message: "Pair reset. Teams returned to pending state.",
    });
  }

  // Get all pairings for this round to find teams
  const { data: pairings } = await supabase
    .from("pair_pairings")
    .select("*")
    .eq("round_id", body.roundId);

  // Disable pair battle on all teams
  if (pairings && pairings.length > 0) {
    const allTeamIds: string[] = [];
    pairings.forEach((p) => {
      if (p.team_a_id) allTeamIds.push(p.team_a_id);
      if (p.team_b_id) allTeamIds.push(p.team_b_id);
    });

    await supabase
      .from("teams")
      .update({
        pair_battle_enabled: false,
        round2_code: null,
        round2_lock_until: null,
      })
      .in("id", allTeamIds);
  }

  // Delete all pairings and submissions for this round
  await supabase
    .from("pair_submissions")
    .delete()
    .in(
      "pair_id",
      pairings?.map((p) => p.id) || []
    );

  await supabase
    .from("pair_pairings")
    .delete()
    .eq("round_id", body.roundId);

  return NextResponse.json({
    success: true,
    message: "Pair pairings reset. Pair battle mode disabled.",
  });
}
