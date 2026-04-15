import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

/**
 * POST /api/admin/pair-battle/assign
 * Assigns a team to a pair (team A or team B)
 * Body: { pairingId: string, teamId: string, slot: "a" | "b" }
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

  const teamId = typeof body.teamId === "string" && body.teamId.trim().length > 0
    ? body.teamId.trim()
    : null;

  // Get the target pairing first.
  const { data: targetPairing, error: pairingError } = await supabase
    .from("pair_pairings")
    .select("*")
    .eq("id", body.pairingId)
    .maybeSingle();

  if (pairingError || !targetPairing) {
    return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
  }

  const slotKey = body.slot === "a" ? "team_a_id" : "team_b_id";
  const otherSlotKey = body.slot === "a" ? "team_b_id" : "team_a_id";
  const occupiedTeamId = targetPairing[slotKey] as string | null;

  const { data: roundPairings, error: roundPairingsError } = await supabase
    .from("pair_pairings")
    .select("*")
    .eq("round_id", targetPairing.round_id);

  if (roundPairingsError || !roundPairings) {
    return NextResponse.json({ error: roundPairingsError?.message ?? "Unable to load pairings" }, { status: 500 });
  }

  const updates: Array<{ id: string; payload: Record<string, string | null> }> = [];

  const computeStatus = (teamA: string | null, teamB: string | null) =>
    teamA && teamB ? "ready" : "waiting";

  if (!teamId) {
    const nextTeamA = slotKey === "team_a_id" ? null : (targetPairing.team_a_id as string | null);
    const nextTeamB = slotKey === "team_b_id" ? null : (targetPairing.team_b_id as string | null);
    updates.push({
      id: targetPairing.id,
      payload: {
        [slotKey]: null,
        status: computeStatus(nextTeamA, nextTeamB),
      },
    });
  } else {
    const { data: candidateTeam, error: candidateTeamError } = await supabase
      .from("teams")
      .select("id, is_active")
      .eq("id", teamId)
      .maybeSingle();

    if (candidateTeamError || !candidateTeam) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    if (!candidateTeam.is_active) {
      return NextResponse.json({ error: "Only active qualified teams can be assigned" }, { status: 400 });
    }

    const sourcePairing = roundPairings.find(
      (entry) => entry.team_a_id === teamId || entry.team_b_id === teamId,
    );

    if (sourcePairing?.id === targetPairing.id && sourcePairing[slotKey] === teamId) {
      return NextResponse.json({ success: true, message: "No changes applied" });
    }

    // If target slot is occupied and dragged team came from another slot, swap teams.
    let backfillId: string | null = null;
    let sourceSlotKey: "team_a_id" | "team_b_id" | null = null;

    if (sourcePairing) {
      sourceSlotKey = sourcePairing.team_a_id === teamId ? "team_a_id" : "team_b_id";
      backfillId = occupiedTeamId;

      const sourceTeamA = sourceSlotKey === "team_a_id"
        ? backfillId
        : (sourcePairing.team_a_id as string | null);
      const sourceTeamB = sourceSlotKey === "team_b_id"
        ? backfillId
        : (sourcePairing.team_b_id as string | null);

      updates.push({
        id: sourcePairing.id,
        payload: {
          [sourceSlotKey]: backfillId,
          status: computeStatus(sourceTeamA, sourceTeamB),
        },
      });
    }

    const targetTeamA = slotKey === "team_a_id" ? teamId : (targetPairing.team_a_id as string | null);
    const targetTeamB = slotKey === "team_b_id" ? teamId : (targetPairing.team_b_id as string | null);
    updates.push({
      id: targetPairing.id,
      payload: {
        [slotKey]: teamId,
        status: computeStatus(targetTeamA, targetTeamB),
      },
    });
  }

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from("pair_pairings")
      .update(update.payload)
      .eq("id", update.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  const { data: refreshedPairings, error: refreshError } = await supabase
    .from("pair_pairings")
    .select("*")
    .eq("round_id", targetPairing.round_id)
    .order("created_at", { ascending: true });

  if (refreshError) {
    return NextResponse.json({ error: refreshError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    pairings: refreshedPairings,
    message: teamId ? `Team assigned to slot ${body.slot}` : `Slot ${body.slot} cleared`,
  });
}
