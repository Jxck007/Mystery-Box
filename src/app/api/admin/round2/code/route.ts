import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth) return auth;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { teamId, code } = body;
  const trimmed = typeof code === "string" ? code.trim() : "";

  if (!teamId || !/^\d{4}$/.test(trimmed)) {
    return NextResponse.json({ error: "Code must be 4 digits" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("teams")
    .update({ round2_code: trimmed, round2_lock_until: null })
    .eq("id", teamId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("team_events").insert({
    team_id: teamId,
    event_type: "round",
    message: "Round 2 code is ready. Enter the 4-digit code.",
  });

  await supabase.from("team_events").insert({
    team_id: teamId,
    event_type: "round2_reset",
    message: "Round 2 attempts reset for this team.",
  });

  return NextResponse.json({ success: true });
}
