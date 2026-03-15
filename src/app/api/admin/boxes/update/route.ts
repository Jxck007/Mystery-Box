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

  const { boxId, gameTitle, gameDescription, gameType, pointsValue } = body;

  if (!boxId) {
    return NextResponse.json({ error: "Box id is required" }, { status: 400 });
  }

  const safeTitle = typeof gameTitle === "string" ? gameTitle.trim() : "";
  const safeDescription =
    typeof gameDescription === "string" ? gameDescription.trim() : "";
  const safeType = typeof gameType === "string" && gameType ? gameType : "task";
  const safePoints = Number.isFinite(Number(pointsValue))
    ? Number(pointsValue)
    : 0;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("mystery_boxes")
    .update({
      game_title: safeTitle || null,
      game_description: safeDescription || null,
      game_type: safeType,
      points_value: safePoints,
    })
    .eq("id", boxId)
    .select()
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to update box" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}
