import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

const DEMO_TEAM_TARGET = 16;

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
];

function makeCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  const supabase = createAdminClient();

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
      name: DEMO_TEAM_NAMES[(existing + i) % DEMO_TEAM_NAMES.length],
      code: makeCode(),
      leader_name: `DEMO_LEAD_${String(index).padStart(2, "0")}`,
      score: Math.max(0, 120 - index),
      max_members: 4,
      is_active: true,
    };
  });

  const { error } = await supabase.from("teams").insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
