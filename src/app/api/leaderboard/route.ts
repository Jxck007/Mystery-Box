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

  const { data: opens, error: opensError } = await supabase
    .from("box_opens")
    .select("team_id, box_id, status");

  if (opensError) {
    return NextResponse.json({ error: opensError.message }, { status: 500 });
  }

  const { data: boxes, error: boxError } = await supabase
    .from("mystery_boxes")
    .select("id, points_value");

  if (boxError) {
    return NextResponse.json({ error: boxError.message }, { status: 500 });
  }

  const boxPoints = new Map<string, number>((boxes ?? []).map((box) => [box.id, box.points_value ?? 0]));

  const memberCounts = players?.reduce<Record<string, number>>((acc, player) => {
    if (!player) return acc;
    const id = player.team_id;
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {}) ?? {};

  const teamStats = (opens ?? []).reduce<
    Record<string, { correct_count: number; wrong_count: number; calculated_score: number }>
  >((acc, open) => {
    if (!open?.team_id) return acc;
    const teamId = open.team_id;
    if (!acc[teamId]) {
      acc[teamId] = { correct_count: 0, wrong_count: 0, calculated_score: 0 };
    }

    const basePoints = boxPoints.get(open.box_id) ?? 0;
    if (open.status === "approved") {
      acc[teamId].correct_count += 1;
      acc[teamId].calculated_score += basePoints;
    } else if (open.status === "rejected") {
      acc[teamId].wrong_count += 1;
      acc[teamId].calculated_score -= Math.floor(basePoints / 4);
    }

    return acc;
  }, {});

  const enriched = (teams ?? []).map((team) => ({
    ...team,
    member_count: memberCounts[team.id] ?? 0,
    correct_count: teamStats[team.id]?.correct_count ?? 0,
    wrong_count: teamStats[team.id]?.wrong_count ?? 0,
    score: Math.max(0, teamStats[team.id]?.calculated_score ?? 0),
  }));

  const sorted = enriched.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return NextResponse.json(sorted);
}
