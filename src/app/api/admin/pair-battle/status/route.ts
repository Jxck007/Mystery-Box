import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/supabase-server";
import { decodeRound2ColorEvent } from "@/lib/pair-battle";

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

  const roundId = request.nextUrl.searchParams.get("roundId");
  if (!roundId) {
    return NextResponse.json(
      { error: "roundId query parameter required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

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
  const teamIds = Array.from(
    new Set(
      (pairings ?? []).flatMap((pairing) => [pairing.team_a_id, pairing.team_b_id].filter(Boolean) as string[]),
    ),
  );

  const { data: submissions } = pairIds.length > 0
    ? await supabase
        .from("pair_submissions")
        .select("pair_id, team_id, code_attempt, is_correct, submitted_at")
        .in("pair_id", pairIds)
        .order("submitted_at", { ascending: true })
    : { data: [] };

  const { data: teamEvents } = teamIds.length > 0
    ? await supabase
        .from("team_events")
        .select("team_id, event_type, message, created_at")
        .in("team_id", teamIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const teamColorMap: Record<string, { color: string; code: string }> = {};
  (teamEvents ?? []).forEach((event) => {
    if (event.event_type !== "round2_color") return;
    const parsed = decodeRound2ColorEvent(event.message);
    if (!parsed || teamColorMap[event.team_id]) return;
    teamColorMap[event.team_id] = { color: parsed.color, code: parsed.code };
  });

  const submissionsByPair: Record<string, any[]> = {};
  const latestAttemptByTeam: Record<string, { code_attempt?: string | null; submitted_at: string; is_correct: boolean }> = {};
  if (submissions) {
    submissions.forEach((sub) => {
      if (!submissionsByPair[sub.pair_id]) {
        submissionsByPair[sub.pair_id] = [];
      }
      submissionsByPair[sub.pair_id].push(sub);

      const current = latestAttemptByTeam[sub.team_id];
      if (!current || new Date(sub.submitted_at).getTime() > new Date(current.submitted_at).getTime()) {
        latestAttemptByTeam[sub.team_id] = {
          code_attempt: sub.code_attempt ?? null,
          submitted_at: sub.submitted_at,
          is_correct: sub.is_correct,
        };
      }
    });
  }

  // Enrich pairings with submission data
  const enriched = pairings?.map((pairing) => {
    const pairSubmissions = submissionsByPair[pairing.id] || [];
    const attempts = pairSubmissions.reduce<Record<string, number>>((acc, sub) => {
      acc[sub.team_id] = (acc[sub.team_id] ?? 0) + 1;
      return acc;
    }, {});
    const hasCorrect = pairSubmissions.some((sub) => sub.is_correct);
    const isLive = pairing.status === "in_progress" && pairSubmissions.length > 0 && !hasCorrect;
    const battleState = pairing.status === "completed"
      ? "winner_found"
      : isLive
      ? "solving"
      : pairing.status === "in_progress" || pairing.status === "ready"
      ? "pending"
      : "waiting";

    return {
      ...pairing,
      submissions: pairSubmissions,
      team_a_color: pairing.team_a_id ? teamColorMap[pairing.team_a_id]?.color ?? null : null,
      team_b_color: pairing.team_b_id ? teamColorMap[pairing.team_b_id]?.color ?? null : null,
      team_a_code: pairing.team_a_id ? teamColorMap[pairing.team_a_id]?.code ?? null : null,
      team_b_code: pairing.team_b_id ? teamColorMap[pairing.team_b_id]?.code ?? null : null,
      team_a_latest_attempt: pairing.team_a_id ? latestAttemptByTeam[pairing.team_a_id]?.code_attempt ?? null : null,
      team_b_latest_attempt: pairing.team_b_id ? latestAttemptByTeam[pairing.team_b_id]?.code_attempt ?? null : null,
      team_a_attempts: pairing.team_a_id ? (attempts[pairing.team_a_id] ?? 0) : 0,
      team_b_attempts: pairing.team_b_id ? (attempts[pairing.team_b_id] ?? 0) : 0,
      is_live: isLive,
      battle_state: battleState,
    };
  }) || [];

  return NextResponse.json({
    roundId,
    totalPairs: enriched.length,
    completedPairs: enriched.filter((p) => p.status === "completed").length,
    pairings: enriched,
  });
}
