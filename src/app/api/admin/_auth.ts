import { NextResponse } from "next/server";
import { TEST_MODE_COOKIE } from "@/lib/test-mode";
import { createHash } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "mb_admin_session";

function getAdminPassword() {
  return (
    process.env.ADMIN_PASSWORD ??
    process.env.MYSTERY_BOX_ADMIN_PASSWORD ??
    process.env.ADMIN_PASSCODE ??
    ""
  ).trim();
}

function getAdminSessionToken(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

function readCookieValue(cookieHeader: string, key: string) {
  const entry = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${key}=`));
  if (!entry) return "";
  return decodeURIComponent(entry.slice(`${key}=`.length));
}

export function hasConfiguredAdminPassword() {
  return getAdminPassword().length > 0;
}

export function hasValidAdminSessionCookie(request: Request) {
  const password = getAdminPassword();
  if (!password) {
    return false;
  }
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieValue = readCookieValue(cookieHeader, ADMIN_SESSION_COOKIE);
  if (!cookieValue) {
    return false;
  }
  return cookieValue === getAdminSessionToken(password);
}

export function getAdminSessionCookieValue() {
  const password = getAdminPassword();
  return password ? getAdminSessionToken(password) : "";
}

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

  if (!hasConfiguredAdminPassword()) {
    return NextResponse.json(
      { error: "Admin password is not configured" },
      { status: 503 },
    );
  }

  if (!hasValidAdminSessionCookie(request)) {
    return NextResponse.json(
      { error: "Admin password required", code: "admin_password_required" },
      { status: 403 },
    );
  }

  return null;
}
