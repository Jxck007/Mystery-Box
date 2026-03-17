import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/supabase-server";

const LOCKOUT_SECONDS = 30;
const QUALIFY_LIMIT = 4;

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

  const { code } = body;
  const trimmed = typeof code === "string" ? code.trim() : "";
  if (!/^\d{4}$/.test(trimmed)) {
    return NextResponse.json({ error: "Enter a 4-digit code" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("team_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (playerError || !player?.team_id) {
    return NextResponse.json({ error: "No team found" }, { status: 404 });
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, round2_code, round2_lock_until, round2_solved_at")
    .eq("id", player.team_id)
    .maybeSingle();

  if (teamError || !team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (!team.round2_code) {
    return NextResponse.json({ error: "Awaiting admin code" }, { status: 400 });
  }

  if (team.round2_solved_at) {
    return NextResponse.json({ error: "Already solved" }, { status: 400 });
  }

  if (team.round2_lock_until) {
    const lockUntil = new Date(team.round2_lock_until).getTime();
    if (Date.now() < lockUntil) {
      const remaining = Math.ceil((lockUntil - Date.now()) / 1000);
      return NextResponse.json(
        { error: `Locked. Try again in ${remaining}s.` },
        { status: 400 },
      );
    }
  }

  if (trimmed !== team.round2_code) {
    const lockUntil = new Date(Date.now() + LOCKOUT_SECONDS * 1000).toISOString();
    await supabase
      .from("teams")
      .update({ round2_lock_until: lockUntil })
      .eq("id", team.id);
    return NextResponse.json({ error: "Wrong code. Locked for 30s." }, { status: 400 });
  }

  const { data: solvedTeams } = await supabase
    .from("teams")
    .select("id")
    .not("round2_solved_at", "is", null)
    .order("round2_solved_at", { ascending: true });

  const position = (solvedTeams?.length ?? 0) + 1;
  const isQualified = position <= QUALIFY_LIMIT;

  await supabase
    .from("teams")
    .update({
      round2_solved_at: new Date().toISOString(),
      round2_status: isQualified ? "qualified" : "eliminated",
      is_active: isQualified,
      eliminated_at: isQualified ? null : new Date().toISOString(),
      eliminated_round: isQualified ? null : 2,
      eliminated_position: position,
    })
    .eq("id", team.id);

  await supabase.from("team_events").insert({
    team_id: team.id,
    event_type: "round",
    message: isQualified
      ? `Round 2 solved! You are in the top ${QUALIFY_LIMIT}.`
      : "Round 2 solved, but slots are full. You are eliminated.",
  });

  return NextResponse.json({ success: true, qualified: isQualified, position });
}
