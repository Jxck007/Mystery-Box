import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/supabase-server";

/**
 * POST /api/admin/pair-battle/assign
 * Assigns a team to a pair (team A or team B)
 * Body: { pairingId: string, teamId: string, slot: "a" | "b" }
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.pairingId || !body.teamId || !body.slot) {
    return NextResponse.json(
      { error: "pairingId, teamId, and slot required" },
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

  // Check if the pairing is already full
  const slotKey = body.slot === "a" ? "team_a_id" : "team_b_id";
  const otherSlotKey = body.slot === "a" ? "team_b_id" : "team_a_id";

  if (pairing[slotKey]) {
    return NextResponse.json(
      { error: `Slot ${body.slot} is already occupied` },
      { status: 400 }
    );
  }

  // Update the pairing
  const updateData: Record<string, string | null> = {
    [slotKey]: body.teamId,
  };

  // If both slots are filled, set status to "ready"
  if (pairing[otherSlotKey]) {
    updateData.status = "ready";
  }

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
    message: `Team assigned to slot ${body.slot}`,
  });
}
