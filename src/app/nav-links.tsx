"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { isTestModeEnabled } from "@/lib/test-mode";

type NavLinkButtonProps = {
  href: string;
  label: string;
  className?: string;
};

async function canAccessProtectedRoute(target: string) {
  if (isTestModeEnabled()) {
    return { allowed: true as const };
  }

  const { data } = await supabaseBrowser.auth.getSession();
  if (!data.session) {
    return { allowed: false as const, redirect: `/auth?redirect=${encodeURIComponent(target)}` };
  }

  return { allowed: true as const, token: data.session.access_token };
}

function NavLinkButton({ href, label, className }: NavLinkButtonProps) {
  const router = useRouter();

  const handleClick = async () => {
    if (href === "/team" || href === "/leaderboard") {
      const access = await canAccessProtectedRoute(href);
      if (!access.allowed) {
        router.push(access.redirect);
        return;
      }

      if (href === "/team" && access.token) {
        const response = await fetch("/api/players/me", {
          headers: { Authorization: `Bearer ${access.token}` },
        });
        if (!response.ok) {
          router.push("/create-team");
          return;
        }
      }
    }

    router.push(href);
  };

  return (
    <button type="button" className={className} onClick={handleClick}>
      {label}
    </button>
  );
}

export function HeaderNavLinks() {
  return (
    <div className="nav-row">
      <NavLinkButton href="/" label="HOME" className="button-muted text-xs" />
      <NavLinkButton href="/team" label="TEAM" className="button-muted text-xs" />
      <NavLinkButton href="/leaderboard" label="RANK" className="button-muted text-xs" />
    </div>
  );
}

export function MobileNavLinks() {
  return (
    <>
      <NavLinkButton href="/" label="HOME" className="mobile-nav-link" />
      <NavLinkButton href="/team" label="TEAM" className="mobile-nav-link" />
      <NavLinkButton href="/leaderboard" label="RANK" className="mobile-nav-link" />
    </>
  );
}
