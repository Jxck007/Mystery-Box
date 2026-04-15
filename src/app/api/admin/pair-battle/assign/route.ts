import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

/**
 * POST /api/admin/pair-battle/assign
 * Assigns a team to a pair (team A or team B)
 * Body: { pairingId: string, teamId?: string | null, slot: "a" | "b" }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  const body = await request.json().catch(() => null);
  if (!body || !body.pairingId || !body.slot) {
    return NextResponse.json(
      { error: "pairingId and slot required" },
      { status: 400 }
    );
  }

  if (body.slot !== "a" && body.slot !== "b") {
    return NextResponse.json(
      { error: "slot must be 'a' or 'b'" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Get the pairing to check current state
  const { data: pairing, error: pairingError } = await supabase
    .from("pair_pairings")
    .select("*")
    .eq("id", body.pairingId)
    .maybeSingle();

  if (pairingError || !pairing) {
    return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
  }

  const slotKey = body.slot === "a" ? "team_a_id" : "team_b_id";
  const otherSlotKey = body.slot === "a" ? "team_b_id" : "team_a_id";

  const incomingTeamId = typeof body.teamId === "string" && body.teamId.trim().length > 0
    ? body.teamId.trim()
    : null;

  if (incomingTeamId) {
    const { data: occupiedRows, error: occupiedError } = await supabase
      .from("pair_pairings")
      .select("id, team_a_id, team_b_id")
      .eq("round_id", pairing.round_id)
      .or(`team_a_id.eq.${incomingTeamId},team_b_id.eq.${incomingTeamId}`);

    if (occupiedError) {
      return NextResponse.json({ error: occupiedError.message }, { status: 500 });
    }

    const occupiedElsewhere = (occupiedRows ?? []).find((row) => row.id !== pairing.id);
    if (occupiedElsewhere) {
      return NextResponse.json(
        { error: "Team already assigned in another pair. Remove or swap first." },
        { status: 400 },
      );
    }
  }

  // Update the pairing
  const updateData: Record<string, string | null> = {
    [slotKey]: incomingTeamId,
  };

  const nextTeamA = slotKey === "team_a_id" ? incomingTeamId : pairing.team_a_id;
  const nextTeamB = slotKey === "team_b_id" ? incomingTeamId : pairing.team_b_id;
  updateData.status = nextTeamA && nextTeamB ? "ready" : "waiting";

  const { data: updated, error: updateError } = await supabase
    .from("pair_pairings")
    .update(updateData)
    .eq("id", body.pairingId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    pairing: updated,
    message: incomingTeamId ? `Team assigned to slot ${body.slot}` : `Slot ${body.slot} cleared`,
  });
}
