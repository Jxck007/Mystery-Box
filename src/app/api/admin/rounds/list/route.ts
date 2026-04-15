import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  const supabase = createAdminClient();
  const GLOBAL_START_ROUNDS = new Set([3]);
  const { data, error } = await supabase
    .from("rounds")
    .select("*")
    .order("round_number", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = Date.now();
  const updated = (data ?? []).map((round) => {
    if (!GLOBAL_START_ROUNDS.has(round.round_number ?? 0)) {
      return round;
    }
    if (round.status === "active" && round.started_at && round.duration_seconds) {
      const startedAt = new Date(round.started_at).getTime();
      const elapsed = (round.elapsed_seconds ?? 0) * 1000;
      const remainingMs = startedAt + round.duration_seconds * 1000 - elapsed - now;
      if (remainingMs <= 0) {
        return { ...round, status: "ended", remaining_seconds: 0 };
      }
      return { ...round, remaining_seconds: Math.ceil(remainingMs / 1000) };
    }
    if (round.duration_seconds) {
      const remainingSeconds = Math.max(
        0,
        round.duration_seconds - (round.elapsed_seconds ?? 0),
      );
      return { ...round, remaining_seconds: remainingSeconds };
    }
    return round;
  });

  const endedIds = updated
    .filter((round) =>
      GLOBAL_START_ROUNDS.has(round.round_number ?? 0) &&
      round.status === "ended",
    )
    .map((round) => round.id);

  if (endedIds.length > 0) {
    await supabase
      .from("rounds")
      .update({ status: "ended", ended_at: new Date().toISOString(), ended_by: "auto" })
      .in("id", endedIds);
  }

  return NextResponse.json(updated);
}
