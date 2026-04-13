import { NextResponse } from "next/server";
import { getProvidedAdminCredential, isValidAdminCredential } from "@/lib/admin-auth";
import { TEST_MODE_COOKIE } from "@/lib/test-mode";

export function requireAdmin(request: Request) {
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

  const provided = getProvidedAdminCredential(request);

  if (!isValidAdminCredential(provided)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
