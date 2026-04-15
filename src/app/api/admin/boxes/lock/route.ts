import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { boxId, lock } = body;
  if (!boxId) {
    return NextResponse.json({ error: "Box id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("mystery_boxes")
    .update({
      is_locked: !!lock,
      assigned_by_admin: true,
    })
    .eq("id", boxId)
    .select()
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to update lock status" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}
