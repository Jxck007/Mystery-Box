import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getProvidedAdminCredential,
  isValidAdminCredential,
} from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const provided = getProvidedAdminCredential(request);
  return NextResponse.json({ active: isValidAdminCredential(provided) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const provided = typeof body?.password === "string" ? body.password : "";

  if (!isValidAdminCredential(provided)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: encodeURIComponent(provided),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 6,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}