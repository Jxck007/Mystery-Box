import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 },
    );
  }

  const supabase = createAdminClient();
  const { data: player, error } = await supabase
    .from("players")
    .select("id, display_name, team:team_id(id, name, leader_name)")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!player || !player.team) {
    return NextResponse.json({ error: "No team found" }, { status: 404 });
  }

  return NextResponse.json(player);
}
