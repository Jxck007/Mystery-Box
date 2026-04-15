import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  return NextResponse.json({ active: Boolean(auth.user) });
}

export async function POST() {
  return NextResponse.json({ error: "Password-based admin session is disabled" }, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json({ success: true });
}