import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const includeBattle = url.searchParams.get("includeBattle") === "1";

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

  if (!includeBattle) {
    return NextResponse.json(sorted);
  }

  const { data: round2 } = await supabase
    .from("rounds")
    .select("id, round_number, status")
    .eq("round_number", 2)
    .maybeSingle();

  let pairings: unknown[] = [];
  if (round2?.id) {
    const { data: pairingRows } = await supabase
      .from("pair_pairings")
      .select(
        `
        id,
        pair_number,
        status,
        winner_id,
        started_at,
        team_a_id,
        team_b_id,
        team_a:team_a_id(id, name),
        team_b:team_b_id(id, name)
      `,
      )
      .eq("round_id", round2.id)
      .order("created_at", { ascending: true });

    const pairIds = (pairingRows ?? []).map((pairing) => pairing.id);
    const submissions = pairIds.length > 0
      ? (
          await supabase
            .from("pair_submissions")
            .select("pair_id, team_id, is_correct, submitted_at")
            .in("pair_id", pairIds)
            .order("submitted_at", { ascending: true })
        ).data ?? []
      : [];

    const byPair = submissions.reduce<Record<string, Array<{ pair_id: string; team_id: string; is_correct: boolean; submitted_at: string }>>>((acc, sub) => {
      if (!acc[sub.pair_id]) acc[sub.pair_id] = [];
      acc[sub.pair_id].push(sub);
      return acc;
    }, {});

    pairings = (pairingRows ?? []).map((pairing) => {
      const subs = byPair[pairing.id] ?? [];
      const attempts = subs.reduce<Record<string, number>>((acc, sub) => {
        acc[sub.team_id] = (acc[sub.team_id] ?? 0) + 1;
        return acc;
      }, {});
      const hasCorrect = subs.some((sub) => sub.is_correct);
      const isLive = pairing.status === "in_progress" && subs.length > 0 && !hasCorrect;
      const battleState = pairing.status === "completed"
        ? "winner_found"
        : isLive
        ? "solving"
        : pairing.status === "in_progress" || pairing.status === "ready"
        ? "pending"
        : "waiting";
      return {
        ...pairing,
        team_a_attempts: pairing.team_a_id ? (attempts[pairing.team_a_id] ?? 0) : 0,
        team_b_attempts: pairing.team_b_id ? (attempts[pairing.team_b_id] ?? 0) : 0,
        is_live: isLive,
        battle_state: battleState,
      };
    });
  }

  return NextResponse.json({
    entries: sorted,
    round2,
    pairings,
  });
}
