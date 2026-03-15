import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/app/api/admin/_auth";

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (auth) return auth;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { email, redirectTo } = body;
  const trimmedEmail = typeof email === "string" ? email.trim() : "";

  if (!trimmedEmail) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const redirectPath = typeof redirectTo === "string" ? redirectTo : "/";
  const callbackUrl = `${origin}/auth/callback?redirect=${encodeURIComponent(redirectPath)}`;

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: trimmedEmail,
    options: { redirectTo: callbackUrl },
  });

  if (error || !data?.properties?.action_link) {
    return NextResponse.json(
      { error: error?.message ?? "Unable to generate magic link" },
      { status: 500 },
    );
  }

  return NextResponse.json({ link: data.properties.action_link });
}
