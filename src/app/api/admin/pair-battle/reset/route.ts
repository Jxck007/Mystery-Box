import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

/**
 * POST /api/admin/pair-battle/reset
 * Clears all pairings for a round and disables pair battle mode
 * Body: { roundId: string, pairingId?: string }
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

  // Get all pairings for this round to find teams
  const { data: pairings } = await supabase
    .from("pair_pairings")
    .select("*")
    .eq("round_id", body.roundId);

  if (body.pairingId && typeof body.pairingId === "string") {
    const target = (pairings ?? []).find((pairing) => pairing.id === body.pairingId);
    if (!target) {
      return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
    }

    await supabase
      .from("pair_submissions")
      .delete()
      .eq("pair_id", target.id);

    await supabase
      .from("pair_pairings")
      .update({ status: "ready", winner_id: null, started_at: null })
      .eq("id", target.id);

    return NextResponse.json({
      success: true,
      message: "Pair reset and ready for replay.",
    });
  }

  // Disable pair battle on all teams
  if (pairings && pairings.length > 0) {
    const allTeamIds: string[] = [];
    pairings.forEach((p) => {
      if (p.team_a_id) allTeamIds.push(p.team_a_id);
      if (p.team_b_id) allTeamIds.push(p.team_b_id);
    });

    await supabase
      .from("teams")
      .update({ pair_battle_enabled: false })
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
