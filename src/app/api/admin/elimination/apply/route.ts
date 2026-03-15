import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth) return auth;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { roundNumber, cutoffRank } = body;
  const parsedRound = Number(roundNumber);
  const parsedCutoff = Number(cutoffRank);

  if (!parsedRound || Number.isNaN(parsedRound)) {
    return NextResponse.json({ error: "Round number is required" }, { status: 400 });
  }

  if (!parsedCutoff || Number.isNaN(parsedCutoff)) {
    return NextResponse.json({ error: "Cutoff rank is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: teams, error: teamError } = await supabase
    .from("teams")
    .select("id, name, score")
    .order("score", { ascending: false })
    .order("created_at", { ascending: true });

  if (teamError) {
    return NextResponse.json({ error: teamError.message }, { status: 500 });
  }

  const eliminated = (teams ?? []).slice(parsedCutoff);
  if (eliminated.length === 0) {
    return NextResponse.json({ success: true, eliminated: [] });
  }

  const { error: updateError } = await supabase
    .from("teams")
    .update({
      eliminated_at: new Date().toISOString(),
      eliminated_round: parsedRound,
    })
    .in(
      "id",
      eliminated.map((team) => team.id),
    );

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const events = eliminated.map((team, index) => ({
    team_id: team.id,
    event_type: "elimination",
    message: `Better luck next time. You finished in position ${parsedCutoff + index + 1}.`,
  }));

  await supabase.from("team_events").insert(events);

  return NextResponse.json({ success: true, eliminated });
}
