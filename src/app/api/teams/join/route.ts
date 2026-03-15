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

  const { teamCode, displayName } = body;
  const trimmedDisplayName =
    typeof displayName === "string" ? displayName.trim() : "";

  if (!trimmedDisplayName) {
    return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  }

  if (!teamCode || typeof teamCode !== "string") {
    return NextResponse.json({ error: "Team code is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("*")
    .eq("code", teamCode.toUpperCase())
    .maybeSingle();

  if (teamError) {
    return NextResponse.json({ error: teamError.message }, { status: 500 });
  }

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (!team.is_active) {
    return NextResponse.json({ error: "Team is not accepting new members" }, { status: 400 });
  }

  const { data: existingName, error: nameError } = await supabase
    .from("players")
    .select("id")
    .eq("team_id", team.id)
    .eq("display_name", trimmedDisplayName)
    .limit(1)
    .maybeSingle();

  if (nameError) {
    return NextResponse.json({ error: nameError.message }, { status: 500 });
  }

  if (existingName) {
    return NextResponse.json(
      { error: "That display name is already taken on this team" },
      { status: 400 },
    );
  }

  const { data: members } = await supabase
    .from("players")
    .select("id")
    .eq("team_id", team.id);

  if (members && members.length >= (team.max_members ?? 5)) {
    return NextResponse.json(
      { error: "This team has reached its member limit" },
      { status: 400 },
    );
  }

  const { error: insertError } = await supabase.from("players").insert({
    team_id: team.id,
    display_name: trimmedDisplayName,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(team);
}
