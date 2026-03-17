import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/supabase-server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const auth = await requireUser(request);
  if (!auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 },
    );
  }

  const { teamId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || !teamId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { playerId } = body;
  if (!playerId) {
    return NextResponse.json({ error: "Player id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: leaderPlayer, error: leaderError } = await supabase
    .from("players")
    .select("id, display_name, team_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (leaderError || !leaderPlayer) {
    return NextResponse.json(
      { error: leaderError?.message ?? "Player not found" },
      { status: 404 },
    );
  }

  if (leaderPlayer.team_id !== teamId) {
    return NextResponse.json({ error: "Not on this team" }, { status: 403 });
  }

  const { data: team } = await supabase
    .from("teams")
    .select("leader_name")
    .eq("id", teamId)
    .maybeSingle();

  if (!team || team.leader_name !== leaderPlayer.display_name) {
    return NextResponse.json({ error: "Only leader can remove members" }, { status: 403 });
  }

  if (leaderPlayer.id === playerId) {
    return NextResponse.json({ error: "Leader cannot remove self" }, { status: 400 });
  }

  const { error: removeError } = await supabase
    .from("players")
    .delete()
    .eq("id", playerId)
    .eq("team_id", teamId);

  if (removeError) {
    return NextResponse.json({ error: removeError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
