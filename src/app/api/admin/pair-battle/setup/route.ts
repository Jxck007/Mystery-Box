import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/supabase-server";

/**
 * POST /api/admin/pair-battle/setup
 * Creates 6 empty pair pairings for the pair battle mode
 * Body: { roundId: string } - identifies which round this is for
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.roundId !== "string") {
    return NextResponse.json(
      { error: "roundId required in body" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Keep existing assignments and only add missing skeleton rows up to 6.
  const { data: existing, error: existingError } = await supabase
    .from("pair_pairings")
    .select("id")
    .eq("round_id", body.roundId);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const existingCount = existing?.length ?? 0;
  const missingCount = Math.max(0, 6 - existingCount);
  const missingRows = Array.from({ length: missingCount }, () => ({
    round_id: body.roundId,
    status: "waiting" as const,
  }));

  if (missingRows.length > 0) {
    const { error: insertError } = await supabase
      .from("pair_pairings")
      .insert(missingRows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("pair_pairings")
    .select("*")
    .eq("round_id", body.roundId)
    .order("created_at", { ascending: true })
    .limit(6);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    pairings: data,
    message: "6 pair slots are ready. Existing assignments were kept.",
  });
}
