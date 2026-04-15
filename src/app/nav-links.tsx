"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.team) {
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
  const [isAuthed, setIsAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (isTestModeEnabled()) {
      setIsAuthed(true);
      setAuthChecked(true);
      return;
    }

    let active = true;
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (active) {
        setIsAuthed(Boolean(data.session));
        setAuthChecked(true);
      }
    });

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setIsAuthed(Boolean(session));
        setAuthChecked(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="nav-row top-nav-row">
      <NavLinkButton href="/" label="HOME" className="top-nav-link" />
      {authChecked && isAuthed && <NavLinkButton href="/team" label="TEAM" className="top-nav-link" />}
      {authChecked && isAuthed && <NavLinkButton href="/leaderboard" label="LEADERBOARD" className="top-nav-link" />}
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
