import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";
import { ROUND2_QUALIFIED_TEAM_LIMIT } from "@/lib/pair-battle";

/**
 * GET /api/admin/pair-battle/qualified-teams
 * Returns the 16 teams qualified for Round 2 (top by score)
 * Ready to be assigned to pair battle pairings
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  const supabase = createAdminClient();

  // Prefer explicit Round 2 selection written during Round 1 elimination sync.
  const { data: pendingTeams, error: pendingError } = await supabase
    .from("teams")
    .select("id, name, leader_name, score, is_active, eliminated_round, round2_status, updated_at, created_at")
    .eq("round2_status", "pending")
    .order("score", { ascending: false })
    .order("updated_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(ROUND2_QUALIFIED_TEAM_LIMIT);

  if (pendingError) {
    return NextResponse.json({ error: pendingError.message }, { status: 500 });
  }

  if ((pendingTeams?.length ?? 0) > 0) {
    return NextResponse.json(pendingTeams ?? []);
  }

  // Backward compatibility fallback: derive from active survivors.
  const { data: teams, error } = await supabase
    .from("teams")
    .select("id, name, leader_name, score, is_active, eliminated_round, updated_at, created_at")
    .eq("is_active", true)
    .is("eliminated_round", null)
    .order("score", { ascending: false })
    .order("updated_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(ROUND2_QUALIFIED_TEAM_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(teams || []);
}
