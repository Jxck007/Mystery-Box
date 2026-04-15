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

  // Get submission counts per pair for real-time status
  const { data: submissions } = await supabase
    .from("pair_submissions")
    .select("pair_id, team_id, is_correct");

  const submissionsByPair: Record<string, any[]> = {};
  if (submissions) {
    submissions.forEach((sub) => {
      if (!submissionsByPair[sub.pair_id]) {
        submissionsByPair[sub.pair_id] = [];
      }
      submissionsByPair[sub.pair_id].push(sub);
    });
  }

  // Enrich pairings with submission data
  const enriched = pairings?.map((p) => ({
    ...p,
    submissions: submissionsByPair[p.id] || [],
  })) || [];

  return NextResponse.json({
    roundId,
    totalPairs: enriched.length,
    completedPairs: enriched.filter((p) => p.status === "completed").length,
    pairings: enriched,
  });
}
