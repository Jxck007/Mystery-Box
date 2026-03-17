import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/supabase-server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const auth = await requireUser(request);
  if (!auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 },
    );
  }

  const { teamId } = await params;
  if (!teamId) {
    return NextResponse.json({ error: "Team id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: player } = await supabase
    .from("players")
    .select("team_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!player || player.team_id !== teamId) {
    return NextResponse.json({ error: "Not on this team" }, { status: 403 });
  }

  const { data: teamRound, error: roundError } = await supabase
    .from("team_rounds")
    .select("*, round:round_id(duration_seconds)")
    .eq("team_id", teamId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (roundError || !teamRound) {
    return NextResponse.json(
      { error: roundError?.message ?? "No active round" },
      { status: 400 },
    );
  }

  const roundData = Array.isArray(teamRound.round) ? teamRound.round[0] : teamRound.round;
  const durationSeconds = roundData?.duration_seconds ?? 0;
  const startedAt = teamRound.started_at ? new Date(teamRound.started_at).getTime() : 0;
  const elapsedBase = teamRound.elapsed_seconds ?? 0;
  const elapsedLive = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  const remaining = Math.max(0, durationSeconds - (elapsedBase + elapsedLive));

  const { data: team } = await supabase
    .from("teams")
    .select("score")
    .eq("id", teamId)
    .maybeSingle();

  const nowIso = new Date().toISOString();

  await supabase
    .from("team_rounds")
    .update({
      status: "ended",
      ended_at: nowIso,
      penalty_remaining_seconds: remaining,
      penalty_team_score: team?.score ?? 0,
      penalty_round_score: teamRound.score_this_round ?? 0,
      penalty_applied_at: nowIso,
      score_this_round: 0,
    })
    .eq("id", teamRound.id);

  await supabase.from("teams").update({ score: 0 }).eq("id", teamId);

  await supabase.from("team_events").insert({
    team_id: teamId,
    event_type: "round",
    message: "Round ended due to leaving the game tab. Ask admin to restore.",
  });

  return NextResponse.json({ success: true });
}
