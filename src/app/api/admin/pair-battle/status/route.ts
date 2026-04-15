import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/supabase-server";

/**
 * GET /api/admin/pair-battle/status
 * Returns current status of all pair pairings for a round
 * Query: ?roundId=<roundId>
 */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  let roundId = request.nextUrl.searchParams.get("roundId");

  const supabase = createAdminClient();

  if (!roundId) {
    const { data: round2, error: round2Error } = await supabase
      .from("rounds")
      .select("id")
      .eq("round_number", 2)
      .maybeSingle();

    if (round2Error || !round2?.id) {
      return NextResponse.json(
        { error: round2Error?.message ?? "Round 2 not found" },
        { status: 404 }
      );
    }

    roundId = round2.id;
  }

  // Get all pairings with team details
  const { data: pairings, error } = await supabase.from("pair_pairings").select(
    `
    *,
    team_a:team_a_id(id, name, leader_name, score),
    team_b:team_b_id(id, name, leader_name, score)
    `
  ).eq("round_id", roundId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pairIds = (pairings ?? []).map((pairing) => pairing.id);

  // Get round-scoped submissions for these pairs.
  const submissions = pairIds.length > 0
    ? (
        await supabase
          .from("pair_submissions")
          .select("pair_id, team_id, is_correct, submitted_at")
          .in("pair_id", pairIds)
          .order("submitted_at", { ascending: true })
      ).data ?? []
    : [];

  const submissionsByPair: Record<string, Array<{ pair_id: string; team_id: string; is_correct: boolean; submitted_at: string }>> = {};
  if (submissions) {
    submissions.forEach((sub) => {
      if (!submissionsByPair[sub.pair_id]) {
        submissionsByPair[sub.pair_id] = [];
      }
      submissionsByPair[sub.pair_id].push(sub);
    });
  }

  const now = Date.now();

  const enriched = pairings?.map((pairing) => {
    const pairSubs = submissionsByPair[pairing.id] || [];
    const attemptsByTeam = pairSubs.reduce<Record<string, number>>((acc, submission) => {
      acc[submission.team_id] = (acc[submission.team_id] ?? 0) + 1;
      return acc;
    }, {});

    const correctSubmission = pairSubs.find((submission) => submission.is_correct);
    const teamAAttempts = pairing.team_a_id ? (attemptsByTeam[pairing.team_a_id] ?? 0) : 0;
    const teamBAttempts = pairing.team_b_id ? (attemptsByTeam[pairing.team_b_id] ?? 0) : 0;

    const elapsedSeconds = pairing.started_at
      ? Math.max(0, Math.floor((now - new Date(pairing.started_at).getTime()) / 1000))
      : 0;
    const solvedElapsedSeconds = pairing.started_at && correctSubmission?.submitted_at
      ? Math.max(
          0,
          Math.floor(
            (new Date(correctSubmission.submitted_at).getTime() - new Date(pairing.started_at).getTime()) / 1000,
          ),
        )
      : null;

    const hasActivity = pairSubs.length > 0;
    const computedState = pairing.status === "completed"
      ? "winner_found"
      : pairing.status === "in_progress"
      ? hasActivity
        ? "solving"
        : "pending"
      : pairing.status === "ready"
      ? "ready"
      : "waiting";

    return {
      ...pairing,
      submissions: pairSubs,
      battle_state: computedState,
      team_a_attempts: teamAAttempts,
      team_b_attempts: teamBAttempts,
      has_activity: hasActivity,
      correct_at: correctSubmission?.submitted_at ?? null,
      elapsed_seconds: elapsedSeconds,
      solved_elapsed_seconds: solvedElapsedSeconds,
    };
  }) || [];

  return NextResponse.json({
    roundId,
    totalPairs: enriched.length,
    completedPairs: enriched.filter((p) => p.status === "completed").length,
    pairings: enriched,
  });
}
