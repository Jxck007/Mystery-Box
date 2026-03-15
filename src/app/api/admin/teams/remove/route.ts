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

  const { teamId } = body;
  if (!teamId) {
    return NextResponse.json({ error: "Team id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error: playersError } = await supabase
    .from("players")
    .delete()
    .eq("team_id", teamId);

  if (playersError) {
    return NextResponse.json({ error: playersError.message }, { status: 500 });
  }

  const { error: opensError } = await supabase
    .from("box_opens")
    .delete()
    .eq("team_id", teamId);

  if (opensError) {
    return NextResponse.json({ error: opensError.message }, { status: 500 });
  }

  const { error: roundsError } = await supabase
    .from("team_rounds")
    .delete()
    .eq("team_id", teamId);

  if (roundsError) {
    return NextResponse.json({ error: roundsError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("teams")
    .delete()
    .eq("id", teamId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? null);
}
