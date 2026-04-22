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
    .select("team_id, status, submitted_answer");

  if (opensError) {
    return NextResponse.json({ error: opensError.message }, { status: 500 });
  }

  const memberCounts = players?.reduce<Record<string, number>>((acc, player) => {
    if (!player) return acc;
    const id = player.team_id;
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {}) ?? {};

  const teamStats = (opens ?? []).reduce<Record<string, { correct_count: number; wrong_count: number }>>((acc, open) => {
    if (!open?.team_id) return acc;
    const teamId = open.team_id;
    if (!acc[teamId]) {
      acc[teamId] = { correct_count: 0, wrong_count: 0 };
    }

    // Prefer per-question stats stored in submitted_answer JSON (Round 1 auto scoring).
    if (typeof open.submitted_answer === "string" && open.submitted_answer.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(open.submitted_answer) as { correct?: unknown; wrong?: unknown };
        const parsedCorrect =
          typeof parsed.correct === "number" && Number.isFinite(parsed.correct)
            ? Math.max(0, Math.floor(parsed.correct))
            : 0;
        const parsedWrong =
          typeof parsed.wrong === "number" && Number.isFinite(parsed.wrong)
            ? Math.max(0, Math.floor(parsed.wrong))
            : 0;
        acc[teamId].correct_count += parsedCorrect;
        acc[teamId].wrong_count += parsedWrong;
        return acc;
      } catch {
        // fall back to status-based counts
      }
    }

    if (open.status === "approved") {
      acc[teamId].correct_count += 1;
    } else if (open.status === "rejected") {
      acc[teamId].wrong_count += 1;
    }

    return acc;
  }, {});

  const enriched = (teams ?? []).map((team) => ({
    ...team,
    member_count: memberCounts[team.id] ?? 0,
    correct_count: teamStats[team.id]?.correct_count ?? 0,
    wrong_count: teamStats[team.id]?.wrong_count ?? 0,
    score: Math.max(0, team.score ?? 0),
  }));

  const sorted = enriched.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return NextResponse.json(sorted);
}
