import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { teamId, action } = body;
  if (!teamId || !["restore_snapshot", "restore_time"].includes(action)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: teamRound, error: roundError } = await supabase
    .from("team_rounds")
    .select("*, round:round_id(duration_seconds)")
    .eq("team_id", teamId)
    .not("penalty_applied_at", "is", null)
    .order("penalty_applied_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (roundError || !teamRound) {
    return NextResponse.json(
      { error: roundError?.message ?? "No penalty snapshot" },
      { status: 404 },
    );
  }

  const roundData = Array.isArray(teamRound.round) ? teamRound.round[0] : teamRound.round;
  const durationSeconds = roundData?.duration_seconds ?? 0;
  const remaining = teamRound.penalty_remaining_seconds ?? 0;
  const elapsedSeconds = Math.max(0, durationSeconds - remaining);

  await supabase
    .from("team_rounds")
    .update({
      status: "active",
      started_at: new Date().toISOString(),
      elapsed_seconds: elapsedSeconds,
      ended_at: null,
      score_this_round: action === "restore_snapshot" ? teamRound.penalty_round_score ?? 0 : 0,
    })
    .eq("id", teamRound.id);

  await supabase
    .from("teams")
    .update({
      score: action === "restore_snapshot" ? teamRound.penalty_team_score ?? 0 : 0,
    })
    .eq("id", teamId);

  await supabase.from("team_events").insert({
    team_id: teamId,
    event_type: "round",
    message: action === "restore_snapshot"
      ? "Admin restored your round and score."
      : "Admin restored your remaining time with score reset.",
  });

  return NextResponse.json({ success: true });
}
