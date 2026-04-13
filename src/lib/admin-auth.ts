import type { NextRequest } from "next/server";

export const ADMIN_SESSION_COOKIE = "admin_session";

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "";
}

export function getProvidedAdminCredential(request: NextRequest | Request): string {
  const headerValue = request.headers.get("x-admin-password") ?? "";
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieValue = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${ADMIN_SESSION_COOKIE}=`))
    ?.slice(ADMIN_SESSION_COOKIE.length + 1) ?? "";

  return headerValue || decodeURIComponent(cookieValue);
}

export function isValidAdminCredential(provided: string): boolean {
  const expected = getAdminPassword();
  return Boolean(expected) && Boolean(provided) && provided === expected;
}