import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { teamId, boxId, submission, isLeader } = body;
  const trimmedSubmission =
    typeof submission === "string" ? submission.trim() : "";

  if (!teamId || !boxId) {
    return NextResponse.json(
      { error: "Team and box ids are required" },
      { status: 400 },
    );
  }

  if (!trimmedSubmission) {
    return NextResponse.json(
      { error: "Please provide an answer or note" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, answer_mode")
    .eq("id", teamId)
    .maybeSingle();

  if (teamError || !team) {
    return NextResponse.json(
      { error: teamError?.message ?? "Team not found" },
      { status: 404 },
    );
  }

  if (team.answer_mode === "leader_only" && isLeader !== true) {
    return NextResponse.json(
      { error: "Only the team leader can submit answers." },
      { status: 403 },
    );
  }

  const { data: existing, error: openError } = await supabase
    .from("box_opens")
    .select("*")
    .eq("team_id", teamId)
    .eq("box_id", boxId)
    .maybeSingle();

  if (openError) {
    return NextResponse.json({ error: openError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json(
      { error: "Box must be opened before submitting" },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase
    .from("box_opens")
    .update({
      submitted_answer: trimmedSubmission,
      status: "pending",
      validated_by_admin: null,
    })
    .eq("id", existing.id);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
