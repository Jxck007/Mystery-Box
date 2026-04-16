import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

const DEMO_TEAM_TARGET = 24;

const DEMO_TEAM_NAMES = [
  "Team Alpha",
  "Team Bravo",
  "Team Cobra",
  "Team Delta",
  "Team Echo",
  "Team Falcon",
  "Team Ghost",
  "Team Helix",
  "Team Ion",
  "Team Javelin",
  "Team Kilo",
  "Team Lancer",
  "Team Meteor",
  "Team Nova",
  "Team Orbit",
  "Team Phantom",
  "Team Quasar",
  "Team Rogue",
  "Team Spectre",
  "Team Titan",
  "Team Ultra",
  "Team Viper",
  "Team Wraith",
  "Team Zenith",
];

function makeCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
}

function pickUniqueTeamName(base: string, used: Set<string>) {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let counter = 2;
  while (used.has(`${base} ${counter}`)) {
    counter += 1;
  }
  const next = `${base} ${counter}`;
  used.add(next);
  return next;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  const supabase = createAdminClient();

  const { data: existingTeams } = await supabase
    .from("teams")
    .select("name");

  const usedNames = new Set((existingTeams ?? []).map((row) => row.name));

  const { count: activeCount } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  const existing = activeCount ?? 0;
  if (existing >= DEMO_TEAM_TARGET) {
    return NextResponse.json({
      success: true,
      added: 0,
      totalActive: existing,
      message: `Already have ${DEMO_TEAM_TARGET}+ active teams`,
    });
  }

  const needed = DEMO_TEAM_TARGET - existing;
  const rows = Array.from({ length: needed }, (_, i) => {
    const index = i + 1;
    return {
      name: pickUniqueTeamName(DEMO_TEAM_NAMES[(existing + i) % DEMO_TEAM_NAMES.length], usedNames),
      code: makeCode(),
      leader_name: `DEMO_LEAD_${String(index).padStart(2, "0")}`,
      score: Math.max(0, 120 - index),
      max_members: 4,
      is_active: true,
    };
  });

  const { data: createdTeams, error } = await supabase
    .from("teams")
    .insert(rows)
    .select("id, leader_name");
  if (error || !createdTeams) {
    return NextResponse.json({ error: error?.message ?? "Unable to seed demo teams" }, { status: 500 });
  }

  const playerRows = createdTeams.flatMap((team, index) => {
    const seed = String(index + 1).padStart(2, "0");
    return [
      { team_id: team.id, display_name: team.leader_name ?? `DEMO_LEAD_${seed}`, user_id: null },
      { team_id: team.id, display_name: `DEMO_${seed}_A`, user_id: null },
      { team_id: team.id, display_name: `DEMO_${seed}_B`, user_id: null },
      { team_id: team.id, display_name: `DEMO_${seed}_C`, user_id: null },
    ];
  });

  if (playerRows.length > 0) {
    const { error: playersError } = await supabase.from("players").insert(playerRows);
    if (playersError) {
      return NextResponse.json({ error: playersError.message }, { status: 500 });
    }
  }

  const { count: totalAfter } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  return NextResponse.json({
    success: true,
    added: needed,
    totalActive: totalAfter ?? existing + needed,
    message: `Added ${needed} demo teams (target ${DEMO_TEAM_TARGET})`,
  });
}
