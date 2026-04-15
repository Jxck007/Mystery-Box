import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/supabase-server";

const ATTEMPTS_PER_LOCK_STAGE = 3;
const BASE_LOCKOUT_SECONDS = 10;
const LOCKOUT_STAGE_INCREMENT_SECONDS = 20;
const QUALIFY_LIMIT = 6;

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
        { error: `Locked. Try again in ${remaining}s.`, lockSeconds: remaining },
        { status: 400 },
      );
    }
  }

  if (trimmed !== team.round2_code) {
    const { data: latestReset } = await supabase
      .from("team_events")
      .select("created_at")
      .eq("team_id", team.id)
      .eq("event_type", "round2_reset")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let attemptsQuery = supabase
      .from("team_events")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team.id)
      .eq("event_type", "round")
      .ilike("message", "ROUND2_ATTEMPT:%");

    if (latestReset?.created_at) {
      attemptsQuery = attemptsQuery.gt("created_at", latestReset.created_at);
    }

    const { count } = await attemptsQuery;
    const nextAttempt = (count ?? 0) + 1;
    const shouldLock = nextAttempt % ATTEMPTS_PER_LOCK_STAGE === 0;
    const lockStage = Math.floor(nextAttempt / ATTEMPTS_PER_LOCK_STAGE);
    const lockSeconds = shouldLock
      ? BASE_LOCKOUT_SECONDS + (lockStage - 1) * LOCKOUT_STAGE_INCREMENT_SECONDS
      : 0;

    if (shouldLock) {
      const lockUntil = new Date(Date.now() + lockSeconds * 1000).toISOString();
      await supabase
        .from("teams")
        .update({ round2_lock_until: lockUntil })
        .eq("id", team.id);
    }

    await supabase.from("team_events").insert({
      team_id: team.id,
      event_type: "round",
      message: shouldLock
        ? `ROUND2_ATTEMPT:${nextAttempt}:LOCK:${lockSeconds}`
        : `ROUND2_ATTEMPT:${nextAttempt}:MISS`,
    });

    return NextResponse.json(
      shouldLock
        ? {
            error: `Wrong code. Locked for ${lockSeconds}s.`,
            attempt: nextAttempt,
            lockSeconds,
          }
        : {
            error: `Wrong code. ${ATTEMPTS_PER_LOCK_STAGE - (nextAttempt % ATTEMPTS_PER_LOCK_STAGE)} more wrong attempt(s) until lock.`,
            attempt: nextAttempt,
          },
      { status: 400 },
    );
  }

  const solvedAtIso = new Date().toISOString();

  const { error: markSolvedError } = await supabase
    .from("teams")
    .update({
      round2_solved_at: solvedAtIso,
    })
    .eq("id", team.id);

  if (markSolvedError) {
    return NextResponse.json({ error: markSolvedError.message }, { status: 500 });
  }

  const { data: solvedTeams, error: solvedTeamsError } = await supabase
    .from("teams")
    .select("id")
    .not("round2_solved_at", "is", null)
    .order("round2_solved_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (solvedTeamsError) {
    return NextResponse.json({ error: solvedTeamsError.message }, { status: 500 });
  }

  const position = (solvedTeams ?? []).findIndex((entry) => entry.id === team.id) + 1;
  const isQualified = position > 0 && position <= QUALIFY_LIMIT;

  const { error: finalizeStatusError } = await supabase
    .from("teams")
    .update({
      round2_status: isQualified ? "qualified" : "eliminated",
      is_active: isQualified,
      eliminated_at: isQualified ? null : solvedAtIso,
      eliminated_round: isQualified ? null : 2,
      eliminated_position: position || null,
    })
    .eq("id", team.id);

  if (finalizeStatusError) {
    return NextResponse.json({ error: finalizeStatusError.message }, { status: 500 });
  }

  await supabase.from("team_events").insert({
    team_id: team.id,
    event_type: "round",
    message: isQualified
      ? `Round 2 solved! You are in the top ${QUALIFY_LIMIT}.`
      : "Round 2 solved, but slots are full. You are eliminated.",
  });

  return NextResponse.json({ success: true, qualified: isQualified, position });
}
