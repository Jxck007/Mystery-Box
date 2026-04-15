import { requireAdmin } from "@/app/api/admin/_auth";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

const VALID_STATUSES = ["pending", "approved", "rejected"];

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const supabase = createAdminClient();

  let builder = supabase
    .from("box_opens")
    .select("*")
    .order("opened_at", { ascending: false });

  if (status && VALID_STATUSES.includes(status)) {
    builder = builder.eq("status", status);
  }

  const { data: opens, error: opensError } = await builder;
  if (opensError) {
    return NextResponse.json({ error: opensError.message }, { status: 500 });
  }

  const teamIds = Array.from(new Set(opens?.map((open) => open.team_id).filter(Boolean)));
  const boxIds = Array.from(new Set(opens?.map((open) => open.box_id).filter(Boolean)));

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, code")
    .in("id", teamIds);

  const { data: boxes } = await supabase
    .from("mystery_boxes")
    .select("id, box_number, game_title")
    .in("id", boxIds);

  const teamMap = Object.fromEntries(teams?.map((team) => [team.id, team]) ?? []);
  const boxMap = Object.fromEntries(boxes?.map((box) => [box.id, box]) ?? []);

  const enriched = (opens ?? []).map((open) => ({
    ...open,
    team: teamMap[open.team_id ?? ""] ?? null,
    box: boxMap[open.box_id ?? ""] ?? null,
  }));

  return NextResponse.json(enriched);
}
