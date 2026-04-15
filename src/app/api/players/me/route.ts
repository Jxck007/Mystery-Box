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

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error) {
    console.error("[players/me] Admin client init failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Server database configuration error",
      },
      { status: 500 },
    );
  }

  const { data: player, error } = await supabase
    .from("players")
    .select("id, display_name, team:team_id(id, name, leader_name)")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    console.error("[players/me] Query failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!player || !player.team) {
    return NextResponse.json({ team: null, hasTeam: false });
  }

  return NextResponse.json({ ...player, hasTeam: true });
}
