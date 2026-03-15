import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { teamId } = body;
  if (!teamId) {
    return NextResponse.json({ error: "Team id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: teamRound, error: roundError } = await supabase
    .from("team_rounds")
    .select("*, round:round_id(*)")
    .eq("team_id", teamId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (roundError || !teamRound) {
    return NextResponse.json(
      { error: roundError?.message ?? "No active round for team" },
      { status: 400 },
    );
  }

  if (teamRound.started_at) {
    return NextResponse.json({ started_at: teamRound.started_at });
  }

  const startedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("team_rounds")
    .update({ started_at: startedAt, elapsed_seconds: 0 })
    .eq("id", teamRound.id)
    .select("started_at")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message ?? "Unable to start timer" },
      { status: 500 },
    );
  }

  await supabase.from("team_events").insert({
    team_id: teamId,
    event_type: "round",
    message: "Your game timer started.",
  });

  return NextResponse.json({ started_at: updated.started_at });
}
