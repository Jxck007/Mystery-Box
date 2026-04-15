import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/supabase-server";

const ATTEMPTS_PER_LOCK_STAGE = 3;
const BASE_LOCKOUT_SECONDS = 10;
const LOCKOUT_STAGE_INCREMENT_SECONDS = 20;

/**
 * POST /api/round2/pair-submit
 * Handles submission in pair battle mode where first to solve wins
 * Body: { code: string, pairingId: string }
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { code, pairingId } = body;
  const trimmed = typeof code === "string" ? code.trim() : "";
  if (!/^\d{4}$/.test(trimmed)) {
    return NextResponse.json({ error: "Enter a 4-digit code" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get player and team
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("team_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (playerError || !player?.team_id) {
    return NextResponse.json({ error: "No team found" }, { status: 404 });
  }

  // Get pairing to verify structure
  const { data: pairing, error: pairingError } = await supabase
    .from("pair_pairings")
    .select("*")
    .eq("id", pairingId)
    .maybeSingle();

  if (pairingError || !pairing) {
    return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
  }

  // Verify team is in this pairing
  if (player.team_id !== pairing.team_a_id && player.team_id !== pairing.team_b_id) {
    return NextResponse.json(
      { error: "Your team is not in this pairing" },
      { status: 403 }
    );
  }

  // Check if pairing is still in progress
  if (pairing.status !== "in_progress") {
    return NextResponse.json(
      { error: pairing.status === "completed" ? "This pair has already completed" : "Pairing is not active" },
      { status: 400 }
    );
  }

  // Get team submission data
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, round2_code, round2_lock_until")
    .eq("id", player.team_id)
    .maybeSingle();

  if (teamError || !team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Check lockout
  if (team.round2_lock_until) {
    const lockUntil = new Date(team.round2_lock_until).getTime();
    if (Date.now() < lockUntil) {
      const remaining = Math.ceil((lockUntil - Date.now()) / 1000);
      return NextResponse.json(
        { error: `Locked. Try again in ${remaining}s.`, lockSeconds: remaining },
        { status: 400 }
      );
    }
  }

  // Check if code is correct
  if (trimmed !== team.round2_code) {
    // Count wrong attempts for this team in this pair only.
    const { count } = await supabase
      .from("pair_submissions")
      .select("id", { count: "exact", head: true })
      .eq("pair_id", pairingId)
      .eq("team_id", team.id)
      .eq("is_correct", false);

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

    // Record attempt
    const { error: attemptEventError } = await supabase.from("team_events").insert({
      team_id: team.id,
      event_type: "round",
      message: shouldLock
        ? `PAIR_ATTEMPT:${nextAttempt}:LOCK:${lockSeconds}`
        : `PAIR_ATTEMPT:${nextAttempt}:MISS`,
    });

    if (attemptEventError) {
      return NextResponse.json({ error: attemptEventError.message }, { status: 500 });
    }

    // Record submission attempt
    await supabase.from("pair_submissions").insert({
      pair_id: pairingId,
      team_id: player.team_id,
      code_attempt: trimmed,
      is_correct: false,
      submitted_at: new Date().toISOString(),
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
      { status: 400 }
    );
  }

  // CORRECT CODE: attempt to claim winner atomically.
  const solvedAtIso = new Date().toISOString();

  // Record pair submission
  await supabase.from("pair_submissions").insert({
    pair_id: pairingId,
    team_id: player.team_id,
    code_attempt: trimmed,
    is_correct: true,
    submitted_at: solvedAtIso,
  });

  // Get opponent team ID
  const opponentTeamId = player.team_id === pairing.team_a_id ? pairing.team_b_id : pairing.team_a_id;

  // Mark pairing as completed with winner, but only if still unresolved.
  const { data: claimedPairing, error: completePairingError } = await supabase
    .from("pair_pairings")
    .update({
      status: "completed",
      winner_id: player.team_id,
    })
    .eq("id", pairingId)
    .eq("status", "in_progress")
    .is("winner_id", null)
    .select("id, winner_id")
    .maybeSingle();

  if (completePairingError) {
    return NextResponse.json({ error: completePairingError.message }, { status: 500 });
  }

  if (!claimedPairing) {
    const { data: latestPairing } = await supabase
      .from("pair_pairings")
      .select("winner_id")
      .eq("id", pairingId)
      .maybeSingle();

    const existingWinnerId = latestPairing?.winner_id ?? null;
    const lostRace = existingWinnerId && existingWinnerId !== player.team_id;

    if (lostRace) {
      await supabase
        .from("teams")
        .update({
          round2_status: "eliminated",
          round2_solved_at: solvedAtIso,
          is_active: false,
          eliminated_at: solvedAtIso,
          eliminated_round: 2,
          eliminated_position: 999,
        })
        .eq("id", player.team_id);

      await supabase.from("team_events").insert({
        team_id: player.team_id,
        event_type: "pair_battle_loss",
        message: "Your archenemy cracked before you.",
      });
    }

    return NextResponse.json({
      success: true,
      result: "lost_race",
      qualified: !lostRace,
      winnerId: existingWinnerId,
      loserId: lostRace ? player.team_id : opponentTeamId,
      message: lostRace
        ? "Your archenemy cracked before you."
        : "This pair was already resolved.",
    });
  }

  // Mark winner team
  const { error: winnerError } = await supabase
    .from("teams")
    .update({
      round2_status: "qualified",
      round2_solved_at: solvedAtIso,
      is_active: true,
      eliminated_at: null,
      eliminated_round: null,
    })
    .eq("id", player.team_id);

  if (winnerError) {
    return NextResponse.json({ error: winnerError.message }, { status: 500 });
  }

  // Mark loser team as eliminated
  const { error: loserError } = await supabase
    .from("teams")
    .update({
      round2_status: "eliminated",
      round2_solved_at: solvedAtIso,
      is_active: false,
      eliminated_at: solvedAtIso,
      eliminated_round: 2,
      eliminated_position: 999, // Pair battle losers don't have ranking position
    })
    .eq("id", opponentTeamId);

  if (loserError) {
    return NextResponse.json({ error: loserError.message }, { status: 500 });
  }

  // Write success event for winner
  await supabase.from("team_events").insert({
    team_id: player.team_id,
    event_type: "pair_battle_win",
    message: "Pair battle victory! You advanced.",
  });

  // Write event for loser
  await supabase.from("team_events").insert({
    team_id: opponentTeamId,
    event_type: "pair_battle_loss",
    message: "Your opponent solved the code first. You are eliminated.",
  });

  return NextResponse.json({
    success: true,
    result: "win",
    message: "Correct! You won the pair battle.",
    pairingId,
    winnerId: player.team_id,
    loserId: opponentTeamId,
  });
}
