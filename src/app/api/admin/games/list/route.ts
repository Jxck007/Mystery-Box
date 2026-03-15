import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

export async function GET(request: Request) {
  const auth = requireAdmin(request);
  if (auth) return auth;
  const url = new URL(request.url);
  const roundNumber = Number(url.searchParams.get("roundNumber"));

  if (!roundNumber || Number.isNaN(roundNumber)) {
    return NextResponse.json({ error: "Round number is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("mystery_boxes")
    .select("*")
    .eq("round_number", roundNumber)
    .order("game_title", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
