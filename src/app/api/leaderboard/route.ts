import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { decodeRound2ColorEvent } from "@/lib/pair-battle";

type PairTeam = {
  id: string;
  name: string;
  round2_code?: string | null;
  round2_solved_at?: string | null;
  round2_status?: string | null;
};

const normalizePairTeam = (value: PairTeam | PairTeam[] | null | undefined): PairTeam | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

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
        team_a:team_a_id(id, name, round2_code, round2_solved_at, round2_status),
        team_b:team_b_id(id, name, round2_code, round2_solved_at, round2_status)
      `,
      )
      .eq("round_id", round2.id)
      .order("created_at", { ascending: true });

    const pairIds = (pairingRows ?? []).map((pairing) => pairing.id);
    const teamIds = Array.from(
      new Set(
        (pairingRows ?? []).flatMap((pairing) => [pairing.team_a_id, pairing.team_b_id].filter(Boolean) as string[]),
      ),
    );

    const { data: teamEvents } = teamIds.length > 0
      ? await supabase
          .from("team_events")
          .select("id, team_id, event_type, message, created_at")
          .in("team_id", teamIds)
          .order("created_at", { ascending: false })
      : { data: [] };

    const latestResetAt = (teamEvents ?? []).find((event) => event.event_type === "round2_color_reset")?.created_at ?? null;
    const teamColorMap: Record<string, { color: string; code: string }> = {};

    (teamEvents ?? []).forEach((event) => {
      if (latestResetAt && new Date(event.created_at).getTime() <= new Date(latestResetAt).getTime()) {
        return;
      }
      if (event.event_type !== "round2_color") return;
      const parsed = decodeRound2ColorEvent(event.message);
      if (!parsed || teamColorMap[event.team_id]) return;
      teamColorMap[event.team_id] = { color: parsed.color, code: parsed.code };
    });

    const submissions = pairIds.length > 0
      ? (
          await supabase
            .from("pair_submissions")
            .select("pair_id, team_id, code_attempt, is_correct, submitted_at")
            .in("pair_id", pairIds)
            .order("submitted_at", { ascending: true })
        ).data ?? []
      : [];

    const byPair = submissions.reduce<Record<string, Array<{ pair_id: string; team_id: string; is_correct: boolean; submitted_at: string }>>>((acc, sub) => {
      if (!acc[sub.pair_id]) acc[sub.pair_id] = [];
      acc[sub.pair_id].push(sub);
      return acc;
    }, {});

    const latestAttemptByTeam = submissions.reduce<Record<string, { code_attempt?: string | null; submitted_at: string; is_correct: boolean }>>((acc, sub) => {
      const current = acc[sub.team_id];
      if (!current || new Date(sub.submitted_at).getTime() > new Date(current.submitted_at).getTime()) {
        acc[sub.team_id] = {
          code_attempt: sub.code_attempt ?? null,
          submitted_at: sub.submitted_at,
          is_correct: sub.is_correct,
        };
      }
      return acc;
    }, {});

    pairings = (pairingRows ?? []).map((pairing) => {
      const teamA = normalizePairTeam(pairing.team_a as PairTeam | PairTeam[] | null | undefined);
      const teamB = normalizePairTeam(pairing.team_b as PairTeam | PairTeam[] | null | undefined);
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
        team_a: teamA,
        team_b: teamB,
        team_a_color: pairing.team_a_id ? teamColorMap[pairing.team_a_id]?.color ?? null : null,
        team_b_color: pairing.team_b_id ? teamColorMap[pairing.team_b_id]?.color ?? null : null,
        team_a_code: pairing.team_a_id ? teamColorMap[pairing.team_a_id]?.code ?? teamA?.round2_code ?? null : null,
        team_b_code: pairing.team_b_id ? teamColorMap[pairing.team_b_id]?.code ?? teamB?.round2_code ?? null : null,
        team_a_latest_attempt: pairing.team_a_id ? latestAttemptByTeam[pairing.team_a_id]?.code_attempt ?? null : null,
        team_b_latest_attempt: pairing.team_b_id ? latestAttemptByTeam[pairing.team_b_id]?.code_attempt ?? null : null,
        team_a_latest_attempt_at: pairing.team_a_id ? latestAttemptByTeam[pairing.team_a_id]?.submitted_at ?? null : null,
        team_b_latest_attempt_at: pairing.team_b_id ? latestAttemptByTeam[pairing.team_b_id]?.submitted_at ?? null : null,
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
