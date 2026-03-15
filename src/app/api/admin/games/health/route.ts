import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

export async function GET(request: Request) {
  const auth = requireAdmin(request);
  if (auth) return auth;

  const supabase = createAdminClient();
  const { data: games, error } = await supabase
    .from("mystery_boxes")
    .select("id, round_number, game_title, game_description, is_locked");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summary = {
    total: games?.length ?? 0,
    missing_round: 0,
    missing_title: 0,
    missing_description: 0,
    locked: 0,
    by_round: { 1: 0, 2: 0, 3: 0 } as Record<number, number>,
  };

  (games ?? []).forEach((game) => {
    if (!game.round_number) summary.missing_round += 1;
    if (!game.game_title) summary.missing_title += 1;
    if (!game.game_description) summary.missing_description += 1;
    if (game.is_locked) summary.locked += 1;
    if (game.round_number && summary.by_round[game.round_number] !== undefined) {
      summary.by_round[game.round_number] += 1;
    }
  });

  const expected = { 1: 15, 2: 10, 3: 5 };
  const ready =
    summary.total === 30 &&
    summary.missing_round === 0 &&
    summary.missing_title === 0 &&
    summary.missing_description === 0 &&
    summary.by_round[1] === expected[1] &&
    summary.by_round[2] === expected[2] &&
    summary.by_round[3] === expected[3];

  return NextResponse.json({ summary, ready });
}
