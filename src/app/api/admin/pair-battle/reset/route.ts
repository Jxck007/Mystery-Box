import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

/**
 * POST /api/admin/pair-battle/reset
 * Clears all pairings for a round and disables pair battle mode
 * Body: { roundId: string, pairingId?: string }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.roundId !== "string") {
    return NextResponse.json(
      { error: "roundId required in body" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const action = typeof body.action === "string" ? body.action : body.pairingId ? "reset_pair" : "reset_round";

  // Get all pairings for this round to find teams
  const { data: pairings } = await supabase
    .from("pair_pairings")
    .select("*")
    .eq("round_id", body.roundId);

  if (body.pairingId && typeof body.pairingId === "string") {
    const target = (pairings ?? []).find((pairing) => pairing.id === body.pairingId);
    if (!target) {
      return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
    }

    const pairTeamIds = [target.team_a_id, target.team_b_id].filter(Boolean) as string[];

    const markPairResult = async (winnerTeamId: string) => {
      if (!target.team_a_id || !target.team_b_id) {
        return NextResponse.json({ error: "Both teams must be assigned" }, { status: 400 });
      }
      const loserTeamId = winnerTeamId === target.team_a_id ? target.team_b_id : target.team_a_id;
      const solvedAtIso = new Date().toISOString();

      await supabase
        .from("pair_pairings")
        .update({ status: "completed", winner_id: winnerTeamId })
        .eq("id", target.id);

      await supabase
        .from("teams")
        .update({
          round2_status: "qualified",
          round2_solved_at: solvedAtIso,
          is_active: true,
          eliminated_at: null,
          eliminated_round: null,
          eliminated_position: null,
          round2_lock_until: null,
        })
        .eq("id", winnerTeamId);

      await supabase
        .from("teams")
        .update({
          round2_status: "eliminated",
          round2_solved_at: solvedAtIso,
          is_active: false,
          eliminated_at: solvedAtIso,
          eliminated_round: 2,
          eliminated_position: 999,
          round2_lock_until: null,
        })
        .eq("id", loserTeamId);

      await supabase.from("team_events").insert([
        {
          team_id: winnerTeamId,
          event_type: "pair_battle_win",
          message: "Pair battle victory! You advanced.",
        },
        {
          team_id: loserTeamId,
          event_type: "pair_battle_loss",
          message: "Your opponent solved the code first. You are eliminated.",
        },
      ]);

      return NextResponse.json({
        success: true,
        message: "Winner forced successfully.",
        pairingId: target.id,
        winnerTeamId,
        loserTeamId,
      });
    };

    if (action === "force_winner") {
      const winnerTeamId = typeof body.winnerTeamId === "string" ? body.winnerTeamId : null;
      if (!winnerTeamId) {
        return NextResponse.json({ error: "winnerTeamId is required" }, { status: 400 });
      }
      if (winnerTeamId !== target.team_a_id && winnerTeamId !== target.team_b_id) {
        return NextResponse.json({ error: "winnerTeamId must match a team in this pair" }, { status: 400 });
      }

      await supabase.from("pair_submissions").insert({
        pair_id: target.id,
        team_id: winnerTeamId,
        code_attempt: typeof body.codeAttempt === "string" ? body.codeAttempt : "FORCED",
        is_correct: true,
        submitted_at: new Date().toISOString(),
      });

      return markPairResult(winnerTeamId);
    }

    if (action === "simulate_attempt") {
      const teamId = typeof body.teamId === "string" ? body.teamId : null;
      const isCorrect = body.isCorrect === true;
      const codeAttempt = typeof body.codeAttempt === "string" ? body.codeAttempt : "0000";
      if (!teamId) {
        return NextResponse.json({ error: "teamId is required" }, { status: 400 });
      }
      if (teamId !== target.team_a_id && teamId !== target.team_b_id) {
        return NextResponse.json({ error: "teamId must match a team in this pair" }, { status: 400 });
      }

      if (target.status === "ready") {
        await supabase
          .from("pair_pairings")
          .update({ status: "in_progress", started_at: new Date().toISOString() })
          .eq("id", target.id);
      }

      await supabase.from("pair_submissions").insert({
        pair_id: target.id,
        team_id: teamId,
        code_attempt: codeAttempt,
        is_correct: isCorrect,
        submitted_at: new Date().toISOString(),
      });

      if (isCorrect) {
        return markPairResult(teamId);
      }

      return NextResponse.json({
        success: true,
        message: "Attempt simulated.",
        pairingId: target.id,
        teamId,
      });
    }

    await supabase
      .from("pair_submissions")
      .delete()
      .eq("pair_id", target.id);

    if (pairTeamIds.length > 0) {
      await supabase
        .from("teams")
        .update({
          round2_solved_at: null,
          round2_status: "pending",
          eliminated_at: null,
          eliminated_round: null,
          eliminated_position: null,
          is_active: true,
          round2_lock_until: null,
        })
        .in("id", pairTeamIds);
    }

    await supabase
      .from("pair_pairings")
      .update({
        status: action === "replay_pair" ? "in_progress" : "ready",
        winner_id: null,
        started_at: action === "replay_pair" ? new Date().toISOString() : null,
      })
      .eq("id", target.id);

    return NextResponse.json({
      success: true,
      message: action === "replay_pair" ? "Pair replay started." : "Pair reset and ready for replay.",
    });
  }

  // Disable pair battle on all teams
  if (pairings && pairings.length > 0) {
    const allTeamIds: string[] = [];
    pairings.forEach((p) => {
      if (p.team_a_id) allTeamIds.push(p.team_a_id);
      if (p.team_b_id) allTeamIds.push(p.team_b_id);
    });

    await supabase
      .from("teams")
      .update({ pair_battle_enabled: false })
      .in("id", allTeamIds);
  }

  // Delete all pairings and submissions for this round
  await supabase
    .from("pair_submissions")
    .delete()
    .in(
      "pair_id",
      pairings?.map((p) => p.id) || []
    );

  await supabase
    .from("pair_pairings")
    .delete()
    .eq("round_id", body.roundId);

  return NextResponse.json({
    success: true,
    message: "Pair pairings reset. Pair battle mode disabled.",
  });
}
