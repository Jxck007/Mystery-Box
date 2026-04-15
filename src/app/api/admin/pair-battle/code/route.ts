import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.pairingId !== "string" || typeof body.code !== "string") {
    return NextResponse.json({ error: "pairingId and code are required" }, { status: 400 });
  }

  const code = body.code.trim();
  if (!/^\d{4}$/.test(code)) {
    return NextResponse.json({ error: "Code must be 4 digits" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: pairing, error: pairingError } = await supabase
    .from("pair_pairings")
    .select("id, team_a_id, team_b_id")
    .eq("id", body.pairingId)
    .maybeSingle();

  if (pairingError || !pairing) {
    return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
  }

  if (!pairing.team_a_id || !pairing.team_b_id) {
    return NextResponse.json({ error: "Both teams must be assigned before setting pair code" }, { status: 400 });
  }

  const teamIds = [pairing.team_a_id, pairing.team_b_id];

  const { error: updateError } = await supabase
    .from("teams")
    .update({ round2_code: code, round2_lock_until: null })
    .in("id", teamIds);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await supabase.from("team_events").insert([
    {
      team_id: pairing.team_a_id,
      event_type: "round",
      message: `Pair code assigned.`,
    },
    {
      team_id: pairing.team_b_id,
      event_type: "round",
      message: `Pair code assigned.`,
    },
  ]);

  return NextResponse.json({ success: true, code });
}
