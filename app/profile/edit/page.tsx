"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "../../components/UserProvider";
import { useAccountSecurity } from "../../components/settings/account";
import { ALL_KEYS, type SectionContext, type SectionKey } from "./sections";
import DesktopView from "./device/DesktopView";
import MobileView from "./device/MobileView";

/**
 * Settings: the public profile and the account behind it. The page owns the
 * data (the user, and the account's security summary); the device views own
 * the layout — a rail beside the sections on desktop, a list that opens one
 * setting at a time on a phone.
 */
export default function SettingsPage() {
  const { user, loading, refreshUser, logout } = useUser();
  const signedIn = !!user && !user.isGuest;
  const { security, failed, reload } = useAccountSecurity(signedIn);
  // Null until measured, so neither layout flashes before the other.
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // A guest has no account to manage — only a picture.
  const keys = useMemo<SectionKey[]>(() => (user?.isGuest ? ["picture"] : ALL_KEYS), [user?.isGuest]);

  if (!user || isMobile === null) {
    return (
      <div className="min-h-screen w-full bg-background pt-6 lg:pt-10 pb-28 lg:pb-20">
        <p className="w-full max-w-7xl mx-auto px-4 lg:px-8 text-sm text-white/60" role="status">
          {loading || isMobile === null ? "Loading settings…" : "Sign in to change your settings."}
        </p>
      </div>
    );
  }

  const ctx: SectionContext = {
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      slug: user.slug,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      isGuest: user.isGuest,
      googleLinked: user.googleLinked,
    },
    refreshUser,
    security,
    securityFailed: failed,
    reloadSecurity: reload,
    // The server has already signed this browser out; logout() clears the
    // local token and leaves for the home page.
    onDeleted: logout,
  };

  return (
    <div className="min-h-screen w-full bg-background pt-6 lg:pt-10 pb-28 lg:pb-20">
      {isMobile ? <MobileView ctx={ctx} keys={keys} onSignOut={logout} /> : <DesktopView ctx={ctx} keys={keys} />}
    </div>
  );
}
