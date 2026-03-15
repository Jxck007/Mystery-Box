import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { answerModes, randomTeamCode } from "@/lib/utils";
import { requireUser } from "@/lib/supabase-server";

const MAX_CODE_ATTEMPTS = 6;

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

  const { teamName, leaderName, maxMembers, answerMode } = body;
  const trimmedTeam = typeof teamName === "string" ? teamName.trim() : "";
  const trimmedLeader = typeof leaderName === "string" ? leaderName.trim() : "";
  const parsedMaxMembers =
    maxMembers !== undefined ? Number(maxMembers) : 5;
  const normalizedMode = answerModes.includes(answerMode)
    ? answerMode
    : "leader_only";

  if (!trimmedTeam) {
    return NextResponse.json({ error: "Team name is required" }, { status: 400 });
  }

  if (!trimmedLeader) {
    return NextResponse.json({ error: "Leader name is required" }, { status: 400 });
  }

  if (
    Number.isNaN(parsedMaxMembers) ||
    parsedMaxMembers < 2 ||
    parsedMaxMembers > 12
  ) {
    return NextResponse.json(
      { error: "Max members must be between 2 and 12" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  let teamCode = randomTeamCode();
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const { data: matches, error } = await supabase
      .from("teams")
      .select("id")
      .eq("code", teamCode)
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!matches) {
      break;
    }

    teamCode = randomTeamCode();
  }

  const { data: team, error: insertError } = await supabase
    .from("teams")
    .insert({
      name: trimmedTeam,
      code: teamCode,
      leader_name: trimmedLeader,
      score: 0,
      max_members: parsedMaxMembers,
      answer_mode: normalizedMode,
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

  await supabase.from("players").insert({
    team_id: team.id,
    display_name: trimmedLeader,
  });

  return NextResponse.json(team);
}
