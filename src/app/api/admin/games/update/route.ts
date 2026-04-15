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

  const { gameId, roundNumber, gameTitle, gameDescription, gameType, pointsValue } = body;

  if (!gameId) {
    return NextResponse.json({ error: "Game id is required" }, { status: 400 });
  }

  const safeTitle = typeof gameTitle === "string" ? gameTitle.trim() : "";
  const safeDescription =
    typeof gameDescription === "string" ? gameDescription.trim() : "";
  const safeType = typeof gameType === "string" && gameType ? gameType : "task";
  const safePoints = Number.isFinite(Number(pointsValue))
    ? Number(pointsValue)
    : 0;
  const safeRound = Number.isFinite(Number(roundNumber))
    ? Number(roundNumber)
    : null;

  if (!safeTitle || !safeDescription) {
    return NextResponse.json(
      { error: "Title and description are required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("mystery_boxes")
    .update({
      game_title: safeTitle,
      game_description: safeDescription,
      game_type: safeType,
      points_value: safePoints,
      round_number: safeRound ?? undefined,
    })
    .eq("id", gameId)
    .select()
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to update game" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}
