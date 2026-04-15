import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { teamId, action, amount } = body;
  if (!teamId) {
    return NextResponse.json({ error: "Team id is required" }, { status: 400 });
  }

  if (!["add", "deduct", "reset"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: team, error: loadError } = await supabase
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .maybeSingle();

  if (loadError || !team) {
    return NextResponse.json(
      { error: loadError?.message ?? "Team not found" },
      { status: 404 },
    );
  }

  let updatedScore = team.score ?? 0;
  const numericAmount =
    typeof amount === "number" ? amount : Number(amount ?? 0);

  if (action === "add") {
    updatedScore += numericAmount;
  }

  if (action === "deduct") {
    updatedScore -= numericAmount;
  }

  if (action === "reset") {
    updatedScore = 0;
  }

  const { data, error } = await supabase
    .from("teams")
    .update({ score: updatedScore })
    .eq("id", teamId)
    .select()
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to adjust score" },
      { status: 500 },
    );
  }

  const actionLabel =
    action === "add"
      ? `Points added: +${numericAmount}`
      : action === "deduct"
      ? `Points deducted: -${numericAmount}`
      : "Score reset by admin";

  await supabase.from("team_events").insert({
    team_id: teamId,
    event_type: "score",
    message: actionLabel,
  });

  return NextResponse.json(data);
}
