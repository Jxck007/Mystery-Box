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

  const { boxOpenId, status } = body;
  if (!boxOpenId) {
    return NextResponse.json({ error: "Submission id is required" }, { status: 400 });
  }

  if (!["approved", "rejected", "pending"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: openRecord, error: openError } = await supabase
    .from("box_opens")
    .select("*")
    .eq("id", boxOpenId)
    .maybeSingle();

  if (openError) {
    return NextResponse.json({ error: openError.message }, { status: 500 });
  }

  if (!openRecord) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (openRecord.status === status) {
    return NextResponse.json({ success: true });
  }

  const { data: box } = await supabase
    .from("mystery_boxes")
    .select("*")
    .eq("id", openRecord.box_id)
    .maybeSingle();

  const { data: roundData } = await supabase
    .from("rounds")
    .select("*")
    .eq("id", openRecord.round_id)
    .maybeSingle();

  const { error: updateError } = await supabase
    .from("box_opens")
    .update({
      status,
      validated_by_admin: new Date().toISOString(),
    })
    .eq("id", boxOpenId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 },
    );
  }

  if (!openRecord.team_id) {
    return NextResponse.json({ success: true });
  }

  const { data: team } = await supabase
    .from("teams")
    .select("score, consecutive_correct")
    .eq("id", openRecord.team_id)
    .maybeSingle();

  const currentScore = team?.score ?? 0;

  const parseSubmitted = (raw: unknown): { points: number; hasComputedPoints: boolean } => {
    if (typeof raw !== "string") return { points: 0, hasComputedPoints: false };
    const trimmed = raw.trim();
    if (!trimmed.startsWith("{")) return { points: 0, hasComputedPoints: false };
    try {
      const parsed = JSON.parse(trimmed) as { points?: unknown; answers?: unknown };

      if (typeof parsed.points === "number" && Number.isFinite(parsed.points)) {
        return { points: parsed.points, hasComputedPoints: true };
      }

      if (Array.isArray(parsed.answers)) {
        const safeAnswers = parsed.answers
          .filter((value: unknown): value is boolean => typeof value === "boolean")
          .slice(0, 200);
        let points = 0;
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
        return { points, hasComputedPoints: true };
      }

      return { points: 0, hasComputedPoints: false };
    } catch {
      return { points: 0, hasComputedPoints: false };
    }
  };

  const computed = parseSubmitted(openRecord.submitted_answer);

  if (status === "approved") {
    const pointsAwarded = computed.hasComputedPoints ? computed.points : 0;
    const updatedScore = Math.max(0, currentScore + pointsAwarded);

    await supabase
      .from("teams")
      .update({
        score: updatedScore,
        consecutive_correct: 0,
      })
      .eq("id", openRecord.team_id);

    if (openRecord.round_id) {
      const { data: teamRound } = await supabase
        .from("team_rounds")
        .select("*")
        .eq("team_id", openRecord.team_id)
        .eq("round_id", openRecord.round_id)
        .maybeSingle();

      if (teamRound) {
        await supabase
          .from("team_rounds")
          .update({
            score_this_round: Math.max(0, (teamRound.score_this_round ?? 0) + pointsAwarded),
          })
          .eq("id", teamRound.id);
      }
    }
  }

  if (status === "rejected") {
    // No automatic point deductions; rejection only resets any legacy streak counter.
    await supabase
      .from("teams")
      .update({ consecutive_correct: 0 })
      .eq("id", openRecord.team_id);
  }

  return NextResponse.json({ success: true });
}
