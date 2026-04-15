import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/supabase-server";
import { ROUND2_QUALIFIED_TEAM_LIMIT } from "@/lib/pair-battle";

/**
 * GET /api/admin/pair-battle/qualified-teams
 * Returns the 16 teams qualified for Round 2 (top by score)
 * Ready to be assigned to pair battle pairings
 */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const supabase = createAdminClient();

  // Get top teams by score (Round 1 survivors)
  const { data: teams, error } = await supabase
    .from("teams")
    .select("id, name, leader_name, score, is_active")
    .eq("is_active", true)
    .order("score", { ascending: false })
    .limit(ROUND2_QUALIFIED_TEAM_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(teams || []);
}
