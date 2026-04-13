import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isValidAdminCredential } from "@/lib/admin-auth";
import { TEST_MODE_COOKIE } from "@/lib/test-mode";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const credential = request.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? "";
  const isTestBypass =
    process.env.NODE_ENV !== "production" &&
    request.cookies.get(TEST_MODE_COOKIE)?.value === "true";
  const isAdmin = isTestBypass || isValidAdminCredential(decodeURIComponent(credential));

  if (pathname.startsWith("/admin")) {
    if (!isAdmin) {
      const redirectUrl = new URL("/admin-entry", request.url);
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin") && pathname !== "/api/admin/session") {
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};