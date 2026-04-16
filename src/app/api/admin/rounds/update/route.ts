import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";
import { ROUND1_SURVIVOR_LIMIT } from "@/lib/pair-battle";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { action, teamId, roundNumber } = body;
  if (!["start", "end", "pause_team", "resume_team"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (!roundNumber || Number.isNaN(Number(roundNumber))) {
    return NextResponse.json(
      { error: "Round number is required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const GLOBAL_START_ROUNDS = new Set([3]);

  const { data: roundFound, error: roundError } = await supabase
    .from("rounds")
    .select("*")
    .eq("round_number", Number(roundNumber))
    .maybeSingle();

  let round = roundFound;
  if (!round && action === "start" && Number(roundNumber) === 1) {
    const { data: created, error: createError } = await supabase
      .from("rounds")
      .insert({
        round_number: 1,
        title: "Round 1",
        status: "waiting",
        duration_seconds: 180,
        elapsed_seconds: 0,
      })
      .select()
      .single();
    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
    round = created;
  }

  if (roundError || !round) {
    return NextResponse.json(
      { error: roundError?.message ?? "Round not found" },
      { status: 404 },
    );
  }

  if (teamId) {
    if (action !== "start" && action !== "pause_team" && action !== "resume_team") {
      return NextResponse.json(
        { error: "Invalid team action" },
        { status: 400 },
      );
    }

    const { data: existingLink } = await supabase
      .from("team_rounds")
      .select("*")
      .eq("team_id", teamId)
      .eq("round_id", round.id)
      .maybeSingle();

    if (action === "start") {
      await supabase
        .from("box_opens")
        .delete()
        .eq("team_id", teamId)
        .eq("round_id", round.id);

      if (existingLink) {
        await supabase
          .from("team_rounds")
          .update({
            status: "active",
            started_at: existingLink.started_at ?? null,
            ended_at: null,
            elapsed_seconds: existingLink.elapsed_seconds ?? 0,
            paused_at: null,
          })
          .eq("id", existingLink.id);
        return NextResponse.json({ ...existingLink, status: "active" });
      }

      const { data: created, error: createError } = await supabase
        .from("team_rounds")
        .insert({
          team_id: teamId,
          round_id: round.id,
          boxes_opened: 0,
          score_this_round: 0,
          status: "active",
          started_at: null,
          elapsed_seconds: 0,
        })
        .select()
        .maybeSingle();

      if (createError || !created) {
        return NextResponse.json(
          { error: createError?.message ?? "Unable to start round" },
          { status: 500 },
        );
      }

      await supabase.from("team_events").insert({
        team_id: teamId,
        event_type: "round",
        message: `Round ${round.round_number} started for your team.`,
      });

      return NextResponse.json(created);
    }

    if (!existingLink) {
      return NextResponse.json(
        { error: "Team round not started" },
        { status: 400 },
      );
    }

    if (action === "pause_team") {
      if (existingLink.status !== "active" || !existingLink.started_at) {
        return NextResponse.json(
          { error: "Team round is not active" },
          { status: 400 },
        );
      }
      const startedAt = new Date(existingLink.started_at).getTime();
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const totalElapsed = (existingLink.elapsed_seconds ?? 0) + Math.max(0, elapsed);

      await supabase
        .from("team_rounds")
        .update({
          status: "paused",
          elapsed_seconds: totalElapsed,
          paused_at: new Date().toISOString(),
        })
        .eq("id", existingLink.id);

      await supabase.from("team_events").insert({
        team_id: teamId,
        event_type: "round",
        message: `Your round was paused with ${Math.max(0, round.duration_seconds - totalElapsed)}s remaining.`,
      });

      return NextResponse.json({ ...existingLink, status: "paused" });
    }

    if (action === "resume_team") {
      if (existingLink.status !== "paused") {
        return NextResponse.json(
          { error: "Team round is not paused" },
          { status: 400 },
        );
      }

      await supabase
        .from("team_rounds")
        .update({
          status: "active",
          started_at: new Date().toISOString(),
          paused_at: null,
        })
        .eq("id", existingLink.id);

      await supabase.from("team_events").insert({
        team_id: teamId,
        event_type: "round",
        message: "Your round was resumed.",
      });

      return NextResponse.json({ ...existingLink, status: "active" });
    }
  }

  if (action === "start") {
    await supabase
      .from("box_opens")
      .delete()
      .eq("round_id", round.id);

    await supabase
      .from("rounds")
      .update({ status: "ended" })
      .neq("id", round.id)
      .in("status", ["active", "paused"]);

    const payload: Record<string, unknown> = {
      status: "active",
      started_at: new Date().toISOString(),
      elapsed_seconds: 0,
      paused_at: null,
      ended_by: null,
    };

    const { data: updated, error: updateError } = await supabase
      .from("rounds")
      .update(payload)
      .eq("id", round.id)
      .select()
      .maybeSingle();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message ?? "Unable to start round" },
        { status: 500 },
      );
    }



    const { data: allTeams } = await supabase.from("teams").select("id").eq("is_active", true);
    if (allTeams && allTeams.length > 0) {
      // Bulk insert team_rounds for everyone to ensure they can all start immediately
      const teamRoundInserts = allTeams.map((team) => ({
        team_id: team.id,
        round_id: round.id,
        boxes_opened: 0,
        score_this_round: 0,
        status: "active",
        started_at: new Date().toISOString(),
        elapsed_seconds: 0,
      }));

      // Delete any existing stale records for this round/team combination first to be safe
      await supabase.from("team_rounds").delete().eq("round_id", round.id).in("team_id", allTeams.map(t => t.id));
      
      const { error: batchError } = await supabase.from("team_rounds").insert(teamRoundInserts);
      if (batchError) console.error("Batch team_rounds error:", batchError);

      await supabase.from("team_events").insert(
        allTeams.map((team) => ({
          team_id: team.id,
          event_type: "round",
          message: `Round ${round.round_number} started for all teams. Mission Clock: 180s.`,
        })),
      );
    }

    return NextResponse.json(updated);
  }

  if (action === "end") {
    const now = new Date().toISOString();
    const { data: updated, error: endError } = await supabase
      .from("rounds")
      .update({ status: "ended", ended_at: now, ended_by: "admin" })
      .eq("id", round.id)
      .select()
      .maybeSingle();

    if (endError || !updated) {
      return NextResponse.json(
        { error: endError?.message ?? "Unable to end round" },
        { status: 500 },
      );
    }

    // When Round 1 ends, eliminate teams outside the configured cutoff.
    if ((round.round_number ?? 0) === 1) {
      const { data: rankedTeams, error: rankedTeamsError } = await supabase
        .from("teams")
        .select("id, score, created_at")
        .eq("is_active", true)
        .order("score", { ascending: false })
        .order("created_at", { ascending: true });

      if (rankedTeamsError) {
        return NextResponse.json({ error: rankedTeamsError.message }, { status: 500 });
      }

      const totalTeams = rankedTeams?.length ?? 0;
      const round1Cutoff = Math.min(ROUND1_SURVIVOR_LIMIT, totalTeams);
      const eliminatedTeams = (rankedTeams ?? []).slice(round1Cutoff);
      const survivingTeams = (rankedTeams ?? []).slice(0, round1Cutoff);

      if (survivingTeams.length > 0) {
        await supabase
          .from("teams")
          .update({
            is_active: true,
            eliminated_at: null,
            eliminated_round: null,
            eliminated_position: null,
          }).in("id", survivingTeams.map((team) => team.id));
      }

      if (eliminatedTeams.length > 0) {
        const eliminatedIds = eliminatedTeams.map((team) => team.id);
        await supabase
          .from("teams")
          .update({
            is_active: false,
            eliminated_at: now,
            eliminated_round: 1,
          })
          .in("id", eliminatedIds);

        await Promise.all(
          eliminatedTeams.map((team, index) =>
            supabase
              .from("teams")
              .update({ eliminated_position: round1Cutoff + index + 1 })
              .eq("id", team.id),
          ),
        );

        await supabase.from("team_events").insert(
          eliminatedTeams.map((team, index) => ({
            team_id: team.id,
            event_type: "elimination",
            message: `Round 1 elimination. You finished at position ${round1Cutoff + index + 1}.`,
          })),
        );
      }
    }

    await supabase
      .from("team_rounds")
      .update({ status: "ended", ended_at: now })
      .eq("round_id", round.id)
      .in("status", ["active", "paused"]);

    const { data: affectedTeams } = await supabase
      .from("team_rounds")
      .select("team_id")
      .eq("round_id", round.id);

    if (affectedTeams && affectedTeams.length > 0) {
      await supabase.from("team_events").insert(
        affectedTeams.map((team) => ({
          team_id: team.team_id,
          event_type: "round",
          message: `Round ${round.round_number} ended for your team.`,
        })),
      );
    }

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
