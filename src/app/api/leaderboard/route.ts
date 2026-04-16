import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const supabase = createAdminClient();
  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("*")
    .eq("is_active", true);

  if (teamError) {
    return NextResponse.json({ error: teamError.message }, { status: 500 });
  }

  const { data: players } = await supabase.from("players").select("team_id");

  const memberCounts = players?.reduce<Record<string, number>>((acc, player) => {
    if (!player) return acc;
    const id = player.team_id;
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {}) ?? {};

  const enriched = (teams ?? []).map((team) => ({
    ...team,
    member_count: memberCounts[team.id] ?? 0,
  }));

  const sorted = enriched.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return NextResponse.json(sorted);
}
