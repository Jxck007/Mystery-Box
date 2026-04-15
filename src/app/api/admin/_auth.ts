import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase-server";
import { TEST_MODE_COOKIE } from "@/lib/test-mode";

export async function requireAdmin(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const isTestBypass =
    process.env.NODE_ENV !== "production" &&
    cookieHeader
      .split(";")
      .map((entry) => entry.trim())
      .some((entry) => entry === `${TEST_MODE_COOKIE}=true`);

  if (isTestBypass) {
    return null;
  }

  const auth = await requireUser(request);

  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
