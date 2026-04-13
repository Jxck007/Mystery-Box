import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/supabase-server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  if (!teamId) {
    return NextResponse.json({ error: "Team id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, display_name, joined_at")
    .eq("team_id", teamId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

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
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";

  if (!teamId || !displayName) {
    return NextResponse.json({ error: "Team id and display name are required" }, { status: 400 });
  }

  if (displayName.length < 2) {
    return NextResponse.json({ error: "Display name is too short" }, { status: 400 });
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
    .select("leader_name, max_members")
    .eq("id", teamId)
    .maybeSingle();

  if (!team || team.leader_name !== leaderPlayer.display_name) {
    return NextResponse.json({ error: "Only leader can add members" }, { status: 403 });
  }

  const { data: existingMembers } = await supabase
    .from("players")
    .select("id, display_name")
    .eq("team_id", teamId);

  const roster = existingMembers ?? [];
  if (roster.length >= (team.max_members ?? 4)) {
    return NextResponse.json({ error: "Team is full" }, { status: 400 });
  }

  const duplicate = roster.some(
    (member) => member.display_name.toLowerCase() === displayName.toLowerCase(),
  );
  if (duplicate) {
    return NextResponse.json({ error: "Member name already exists" }, { status: 400 });
  }

  const { data: created, error: createError } = await supabase
    .from("players")
    .insert({
      team_id: teamId,
      display_name: displayName,
      user_id: null,
    })
    .select("id, display_name, joined_at")
    .maybeSingle();

  if (createError || !created) {
    return NextResponse.json(
      { error: createError?.message ?? "Unable to add member" },
      { status: 500 },
    );
  }

  return NextResponse.json(created);
}
