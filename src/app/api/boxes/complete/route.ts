import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { teamId, boxId, details } = body;
  if (!teamId || !boxId) {
    return NextResponse.json(
      { error: "Team and box ids are required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data: openRecord, error: openError } = await supabase
    .from("box_opens")
    .select("*", { count: "exact" })
    .eq("team_id", teamId)
    .eq("box_id", boxId)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openError || !openRecord) {
    return NextResponse.json(
      { error: openError?.message ?? "Box not opened" },
      { status: 404 },
    );
  }

  if (openRecord.status === "approved") {
    return NextResponse.json({ success: true, alreadyApproved: true });
  }

  const { data: box, error: boxError } = await supabase
    .from("mystery_boxes")
    .select("points_value, round_number")
    .eq("id", boxId)
    .maybeSingle();

  if (boxError || !box) {
    return NextResponse.json(
      { error: boxError?.message ?? "Box not found" },
      { status: 404 },
    );
  }

  if (box.round_number !== 1) {
    return NextResponse.json(
      { error: "Auto scoring is only enabled for Round 1." },
      { status: 400 },
    );
  }

  const points = box.points_value ?? 0;

  const { error: updateOpenError } = await supabase
    .from("box_opens")
    .update({
      status: "approved",
      submitted_answer: `Auto complete: ${details ?? "success"}`,
      validated_by_admin: new Date().toISOString(),
    })
    .eq("id", openRecord.id);

  if (updateOpenError) {
    return NextResponse.json(
      { error: updateOpenError.message },
      { status: 500 },
    );
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("score")
    .eq("id", teamId)
    .maybeSingle();

  if (teamError || !team) {
    return NextResponse.json(
      { error: teamError?.message ?? "Team not found" },
      { status: 404 },
    );
  }

  const { error: scoreError } = await supabase
    .from("teams")
    .update({ score: (team.score ?? 0) + points })
    .eq("id", teamId);

  if (scoreError) {
    return NextResponse.json({ error: scoreError.message }, { status: 500 });
  }

  const { data: teamRound } = await supabase
    .from("team_rounds")
    .select("id, score_this_round")
    .eq("team_id", teamId)
    .eq("round_id", openRecord.round_id)
    .maybeSingle();

  if (teamRound) {
    await supabase
      .from("team_rounds")
      .update({ score_this_round: (teamRound.score_this_round ?? 0) + points })
      .eq("id", teamRound.id);
  }

  await supabase.from("team_events").insert({
    team_id: teamId,
    event_type: "score",
    message: `Auto-approved +${points} points.`,
  });

  return NextResponse.json({ success: true, points });
}
