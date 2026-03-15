import { NextResponse } from "next/server";

export function requireAdmin(request: Request) {
  const expected = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
  const provided = request.headers.get("x-admin-password");

  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
