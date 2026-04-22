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

  const { teamId, boxId, details, correctCount, wrongCount, answers } = body;
  if (!teamId || !boxId) {
    return NextResponse.json(
      { error: "Team and box ids are required" },
      { status: 400 },
    );
  }

  const safeAnswers: boolean[] | null = Array.isArray(answers)
    ? (answers
        .filter((value: unknown): value is boolean => typeof value === "boolean")
        .slice(0, 200))
    : null;

  const safeCorrect =
    typeof correctCount === "number" && Number.isFinite(correctCount)
      ? Math.max(0, Math.floor(correctCount))
      : 0;
  const safeWrong =
    typeof wrongCount === "number" && Number.isFinite(wrongCount)
      ? Math.max(0, Math.floor(wrongCount))
      : 0;

  const derivedCorrect = safeAnswers ? safeAnswers.filter(Boolean).length : safeCorrect;
  const derivedWrong = safeAnswers ? safeAnswers.filter((value) => !value).length : safeWrong;

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
    .select("round_number")
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

  // Round 1 scoring:
  // - Correct: streak++ => add min(streak * 10, 30)
  // - Wrong/Skip: -3 and streak resets to 0
  // If answer history is unavailable, fall back to correct/wrong counts without streak.
  let points = 0;
  if (safeAnswers) {
    let streak = 0;
    for (const isCorrect of safeAnswers) {
      if (isCorrect) {
        streak += 1;
        points += Math.min(streak * 10, 30);
      } else {
        points -= 3;
        streak = 0;
      }
    }
  } else {
    points = safeCorrect * 10 - safeWrong * 3;
  }

  const { error: updateOpenError } = await supabase
    .from("box_opens")
    .update({
      status: "approved",
      submitted_answer: JSON.stringify({
        kind: "round1_auto_complete",
        correct: derivedCorrect,
        wrong: derivedWrong,
        points,
        streak_scoring: Boolean(safeAnswers),
        details: details ?? null,
      }),
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

  const updatedTeamScore = Math.max(0, (team.score ?? 0) + points);

  const { error: scoreError } = await supabase
    .from("teams")
    .update({ score: updatedTeamScore })
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
    const updatedRoundScore = Math.max(0, (teamRound.score_this_round ?? 0) + points);
    await supabase
      .from("team_rounds")
      .update({ score_this_round: updatedRoundScore })
      .eq("id", teamRound.id);
  }

  await supabase.from("team_events").insert({
    team_id: teamId,
    event_type: "score",
    message: `Round 1 auto-score: ${derivedCorrect} correct, ${derivedWrong} wrong => ${points >= 0 ? "+" : ""}${points} points.`,
  });

  return NextResponse.json({ success: true, points });
}
