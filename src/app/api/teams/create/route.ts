import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 },
    );
  }
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { teamName, leaderName, maxMembers, memberNames } = body;
  const trimmedTeam = typeof teamName === "string" ? teamName.trim() : "";
  const trimmedLeader = typeof leaderName === "string" ? leaderName.trim() : "";
  const parsedMaxMembers = 4;
  const rawMembers = Array.isArray(memberNames) ? memberNames : [];
  const cleanedMembers = rawMembers
    .map((name) => (typeof name === "string" ? name.trim() : ""))
    .filter(Boolean);
  const teamRoster = Array.from(
    new Set([trimmedLeader, ...cleanedMembers].map((name) => name.trim())),
  ).filter(Boolean);

  if (teamRoster.length > parsedMaxMembers) {
    return NextResponse.json(
      { error: "Team can have up to 4 members" },
      { status: 400 },
    );
  }

  if (!trimmedTeam) {
    return NextResponse.json({ error: "Team name is required" }, { status: 400 });
  }

  if (!trimmedLeader) {
    return NextResponse.json({ error: "Leader name is required" }, { status: 400 });
  }

  if (Number.isNaN(parsedMaxMembers) || parsedMaxMembers !== 4) {
    return NextResponse.json(
      { error: "Max members must be 4" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data: existingPlayer, error: existingError } = await supabase
    .from("players")
    .select("id, team_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existingPlayer) {
    return NextResponse.json(
      { error: "This account is already on a team." },
      { status: 400 },
    );
  }

  const { data: team, error: insertError } = await supabase
    .from("teams")
    .insert({
      name: trimmedTeam,
      leader_name: trimmedLeader,
      score: 0,
      max_members: parsedMaxMembers,
      is_active: true,
    })
    .select()
    .maybeSingle();

  if (insertError || !team) {
    return NextResponse.json(
      { error: insertError?.message ?? "Unable to create team" },
      { status: 500 },
    );
  }

  const playerRows = teamRoster.map((name) => ({
    team_id: team.id,
    display_name: name,
    user_id: name === trimmedLeader ? auth.user.id : null,
  }));

  await supabase.from("players").insert(playerRows);

  return NextResponse.json(team);
}
