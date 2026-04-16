import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";
import {
  DEFAULT_BATTLE_COLOR_CODES,
  encodeRound2ColorEvent,
  getBattleColor,
  randomBattleCode,
  sanitizeBattleCode,
} from "@/lib/pair-battle";

type ColorCodePayload = {
  color: string;
  code: string;
};

const parseColorCode = (raw: string | null | undefined): ColorCodePayload | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ColorCodePayload>;
    if (!parsed || typeof parsed.color !== "string" || typeof parsed.code !== "string") return null;
    const color = getBattleColor(parsed.color);
    const code = sanitizeBattleCode(parsed.code);
    if (!color || code.length !== 4) return null;
    return { color: color.name, code };
  } catch {
    return null;
  }
};

const loadColorCodeMap = async (supabase: ReturnType<typeof createAdminClient>) => {
  const { data: codeEvents } = await supabase
    .from("team_events")
    .select("message, created_at")
    .eq("event_type", "round2_color_code")
    .order("created_at", { ascending: false })
    .limit(200);

  const map = new Map<string, string>();
  (codeEvents ?? []).forEach((event) => {
    const parsed = parseColorCode(event.message);
    if (!parsed || map.has(parsed.color)) return;
    map.set(parsed.color, parsed.code);
  });

  Object.entries(DEFAULT_BATTLE_COLOR_CODES).forEach(([color, code]) => {
    if (!map.has(color)) {
      map.set(color, code);
    }
  });

  return map;
};

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const mode = typeof body.mode === "string" ? body.mode : "legacy_pair_code";

  const supabase = createAdminClient();

  if (mode === "save_color_codes") {
    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (entries.length === 0) {
      return NextResponse.json({ error: "entries are required" }, { status: 400 });
    }

    const normalized: Array<{ color: string; code: string }> = [];
    for (const entry of entries) {
      const color = typeof entry?.color === "string" ? getBattleColor(entry.color) : null;
      const code = typeof entry?.code === "string" ? sanitizeBattleCode(entry.code) : "";
      if (!color || code.length !== 4) {
        return NextResponse.json({ error: "Each color entry must include valid color and 4-digit code" }, { status: 400 });
      }
      normalized.push({ color: color.name, code });
    }

    const { data: seedTeam } = await supabase
      .from("teams")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!seedTeam?.id) {
      return NextResponse.json({ error: "At least one team is required before saving color codes" }, { status: 400 });
    }

    const { error: eventError } = await supabase.from("team_events").insert(
      normalized.map((entry) => ({
        team_id: seedTeam.id,
        event_type: "round2_color_code",
        message: JSON.stringify(entry),
      })),
    );

    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, saved: normalized.length });
  }

  if (mode === "assign_pair_colors") {
    if (typeof body.pairingId !== "string") {
      return NextResponse.json({ error: "pairingId is required" }, { status: 400 });
    }

    const teamAColor = typeof body.teamAColor === "string" ? getBattleColor(body.teamAColor) : null;
    const teamBColor = typeof body.teamBColor === "string" ? getBattleColor(body.teamBColor) : null;
    const allowRepeat = body.allowRepeat === true;
    if (!teamAColor || !teamBColor) {
      return NextResponse.json({ error: "teamAColor and teamBColor must be valid colors" }, { status: 400 });
    }
    if (!allowRepeat && teamAColor.name === teamBColor.name) {
      return NextResponse.json({ error: "Duplicate colors in one pair are blocked unless repeat mode is enabled" }, { status: 400 });
    }

    const { data: pairing, error: pairingError } = await supabase
      .from("pair_pairings")
      .select("id, team_a_id, team_b_id")
      .eq("id", body.pairingId)
      .maybeSingle();

    if (pairingError || !pairing || !pairing.team_a_id || !pairing.team_b_id) {
      return NextResponse.json({ error: "Pairing with two assigned teams is required" }, { status: 400 });
    }

    const colorMap = await loadColorCodeMap(supabase);
    const codeA = colorMap.get(teamAColor.name) ?? randomBattleCode();
    const codeB = colorMap.get(teamBColor.name) ?? randomBattleCode();

    const { error: updateError } = await supabase
      .from("teams")
      .update({ round2_lock_until: null })
      .in("id", [pairing.team_a_id, pairing.team_b_id]);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { error: codeAError } = await supabase
      .from("teams")
      .update({ round2_code: codeA })
      .eq("id", pairing.team_a_id);
    if (codeAError) {
      return NextResponse.json({ error: codeAError.message }, { status: 500 });
    }

    const { error: codeBError } = await supabase
      .from("teams")
      .update({ round2_code: codeB })
      .eq("id", pairing.team_b_id);
    if (codeBError) {
      return NextResponse.json({ error: codeBError.message }, { status: 500 });
    }

    const { error: eventError } = await supabase.from("team_events").insert([
      {
        team_id: pairing.team_a_id,
        event_type: "round2_color",
        message: encodeRound2ColorEvent({ teamId: pairing.team_a_id, color: teamAColor.name, code: codeA }),
      },
      {
        team_id: pairing.team_b_id,
        event_type: "round2_color",
        message: encodeRound2ColorEvent({ teamId: pairing.team_b_id, color: teamBColor.name, code: codeB }),
      },
    ]);

    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      pairingId: pairing.id,
      teamA: { teamId: pairing.team_a_id, color: teamAColor.name, code: codeA },
      teamB: { teamId: pairing.team_b_id, color: teamBColor.name, code: codeB },
    });
  }

  if (typeof body.pairingId !== "string" || typeof body.code !== "string") {
    return NextResponse.json({ error: "pairingId and code are required" }, { status: 400 });
  }

  const code = body.code.trim();
  if (!/^\d{4}$/.test(code)) {
    return NextResponse.json({ error: "Code must be 4 digits" }, { status: 400 });
  }

  const { data: pairing, error: pairingError } = await supabase
    .from("pair_pairings")
    .select("id, team_a_id, team_b_id")
    .eq("id", body.pairingId)
    .maybeSingle();

  if (pairingError || !pairing) {
    return NextResponse.json({ error: "Pairing not found" }, { status: 404 });
  }

  if (!pairing.team_a_id || !pairing.team_b_id) {
    return NextResponse.json({ error: "Both teams must be assigned before setting pair code" }, { status: 400 });
  }

  const teamIds = [pairing.team_a_id, pairing.team_b_id];

  const { error: updateError } = await supabase
    .from("teams")
    .update({ round2_code: code, round2_lock_until: null })
    .in("id", teamIds);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await supabase.from("team_events").insert([
    {
      team_id: pairing.team_a_id,
      event_type: "round",
      message: `Pair code assigned.`,
    },
    {
      team_id: pairing.team_b_id,
      event_type: "round",
      message: `Pair code assigned.`,
    },
  ]);

  return NextResponse.json({ success: true, code });
}
