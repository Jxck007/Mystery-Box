import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/admin/_auth";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  const supabase = createAdminClient();
  const { data: events, error } = await supabase
    .from("team_events")
    .select("id, team_id, event_type, message, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const teamIds = Array.from(new Set((events ?? []).map((event) => event.team_id).filter(Boolean)));
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", teamIds);

  const teamMap = Object.fromEntries((teams ?? []).map((team) => [team.id, team.name]));

  const payload = (events ?? []).map((event) => ({
    ...event,
    team_name: teamMap[event.team_id] ?? "Unknown team",
  }));

  return NextResponse.json(payload);
}
