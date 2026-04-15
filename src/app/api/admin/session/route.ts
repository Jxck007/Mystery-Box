import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionCookieValue,
  hasConfiguredAdminPassword,
  hasValidAdminSessionCookie,
} from "@/app/api/admin/_auth";
import { createHash } from "node:crypto";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    unlocked: hasValidAdminSessionCookie(request),
    configured: hasConfiguredAdminPassword(),
  });
}

export async function POST(request: NextRequest) {
  if (!hasConfiguredAdminPassword()) {
    return NextResponse.json(
      { error: "Admin password is not configured" },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password.trim() : "";
  const expectedCookieValue = getAdminSessionCookieValue();

  if (!expectedCookieValue || !password) {
    return NextResponse.json({ error: "Invalid admin password" }, { status: 401 });
  }

  const postedCookieValue = getAdminSessionCookieValueFromInput(password);
  if (postedCookieValue !== expectedCookieValue) {
    return NextResponse.json({ error: "Invalid admin password" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: expectedCookieValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

function getAdminSessionCookieValueFromInput(password: string) {
  return createHash("sha256").update(password).digest("hex");
}