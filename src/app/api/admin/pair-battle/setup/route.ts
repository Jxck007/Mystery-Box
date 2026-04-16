import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";
import { ROUND2_PAIR_COUNT } from "@/lib/pair-battle";

/**
 * POST /api/admin/pair-battle/setup
 * Creates 8 empty pair pairings for the pair battle mode
 * Body: { roundId: string } - identifies which round this is for
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.roundId !== "string") {
    return NextResponse.json(
      { error: "roundId required in body" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Keep existing assignments and only add missing skeleton rows up to ROUND2_PAIR_COUNT.
  const { data: existing, error: existingError } = await supabase
    .from("pair_pairings")
    .select("id, pair_number")
    .eq("round_id", body.roundId);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const existingCount = existing?.length ?? 0;
  const missingCount = Math.max(0, ROUND2_PAIR_COUNT - existingCount);
  const usedNumbers = new Set((existing ?? []).map((row) => row.pair_number).filter((value): value is number => typeof value === "number"));
  const missingRows: Array<{ round_id: string; status: "waiting"; pair_number: number }> = [];
  for (let pairNumber = 1; pairNumber <= ROUND2_PAIR_COUNT; pairNumber += 1) {
    if (usedNumbers.has(pairNumber)) continue;
    missingRows.push({
      round_id: body.roundId,
      status: "waiting",
      pair_number: pairNumber,
    });
    if (missingRows.length >= missingCount) break;
  }

  if (missingRows.length > 0) {
    const { error: insertError } = await supabase
      .from("pair_pairings")
      .insert(missingRows);

    if (insertError) {
      // Compatibility fallback: some schemas enforce unique pair_number globally.
      // In that case, recycle existing rows by pair_number into the current round.
      const missingNumbers = missingRows.map((row) => row.pair_number);
      const { data: recyclableRows, error: recyclableError } = await supabase
        .from("pair_pairings")
        .select("id, pair_number")
        .in("pair_number", missingNumbers)
        .order("created_at", { ascending: false });

      if (recyclableError || !recyclableRows || recyclableRows.length === 0) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      for (const row of recyclableRows) {
        await supabase
          .from("pair_pairings")
          .update({
            round_id: body.roundId,
            status: "waiting",
            team_a_id: null,
            team_b_id: null,
            winner_id: null,
            started_at: null,
          })
          .eq("id", row.id);
      }
    }
  }

  const { data, error } = await supabase
    .from("pair_pairings")
    .select("*")
    .eq("round_id", body.roundId)
    .order("pair_number", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(ROUND2_PAIR_COUNT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    pairings: data,
    message: `${ROUND2_PAIR_COUNT} pair slots are ready. Existing assignments were kept.`,
  });
}
