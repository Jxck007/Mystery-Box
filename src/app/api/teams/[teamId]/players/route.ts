import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET(
  request: Request,
  { params }: { params: { teamId: string } },
) {
  const { teamId } = params;
  if (!teamId) {
    return NextResponse.json({ error: "Team id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("players")
    .select("id, display_name, joined_at")
    .eq("team_id", teamId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
