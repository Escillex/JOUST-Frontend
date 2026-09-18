"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../utils/api";
import { useUser } from "../components/UserProvider";
import HomeFrame from "../components/HomeFrame";
import DesktopView from "./device/DesktopView";
import MobileView from "./device/MobileView";
import { DashboardData, EMPTY_DASHBOARD } from "./types";
import type { UserAward } from "../tournaments/types";

/**
 * The signed-in home page.
 *
 * Two device views over one payload: tournament lanes at desktop width, the hub
 * on a phone. Both read the same `GET /dashboard` response and the same
 * primitives, so the split is a difference in composition and not two separate
 * products — which is the failure mode a device split otherwise invites.
 */
export default function HomePage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD);
  // Set only from inside the async load, never synchronously in an effect.
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [awards, setAwards] = useState<UserAward[]>([]);
  // Null until measured, so neither layout flashes before the other.
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const uid = user?.id || user?.sub;

  useEffect(() => {
    if (!user) return;
    let alive = true;
    authenticatedFetch(API_ENDPOINTS.DASHBOARD)
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) {
          setFailed(true);
          return;
        }
        const body = await safeJson(res);
        if (!alive || !body) return;
        setData({ ...EMPTY_DASHBOARD, ...body });
        setFailed(false);
      })
      // A dropped connection keeps whatever is already on screen rather than
      // blanking the page (Core Rule 8).
      .catch(() => {
        if (alive) setFailed(true);
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  // The award showcase is decoration, so it stays off the critical path.
  useEffect(() => {
    if (!uid || user?.isGuest) return;
    let alive = true;
    authenticatedFetch(API_ENDPOINTS.AUTH.USER_PROFILE(uid))
      .then(safeJson)
      .then((b) => {
        if (alive && Array.isArray(b?.awards)) setAwards(b.awards);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [uid, user?.isGuest]);

  useEffect(() => {
    if (!userLoading && !user) router.push("/auth");
  }, [user, userLoading, router]);

  if (!user && !userLoading) return null;

  const ready = !!user && loaded && isMobile !== null;

  return (
    <HomeFrame className="pt-4 md:py-16" showPattern={true}>
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {failed && ready && (
          <p className="mb-6 border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/70">
            Some of this could not be loaded. It will fill in when the connection recovers.
          </p>
        )}

        {!ready ? (
          <Skeleton phone={isMobile === true} />
        ) : isMobile ? (
          <MobileView user={user} awards={awards} data={data} />
        ) : (
          <DesktopView user={user} awards={awards} data={data} />
        )}
      </div>
    </HomeFrame>
  );
}

/** Shaped like whichever view is about to land, so nothing jumps. */
function Skeleton({ phone }: { phone: boolean }) {
  if (phone) {
    return (
      <div className="grid grid-cols-3 grid-rows-4 gap-2.5 h-[calc(100dvh-160px)] animate-pulse" aria-busy="true">
        <div className="col-span-3 row-span-2 bg-surface border border-white/10" />
        <div className="col-span-2 row-span-1 bg-surface border border-white/10" />
        <div className="col-span-1 row-span-1 bg-surface border border-white/10" />
        <div className="col-span-2 row-span-1 bg-surface border border-white/10" />
        <div className="col-span-1 row-span-1 bg-surface border border-white/10" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-12 animate-pulse" aria-busy="true">
      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-6">
        <div className="h-40 bg-surface border border-white/10" />
        <div className="h-40 bg-surface border border-white/10" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="h-5 w-56 bg-white/10" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-40 bg-surface border border-white/10" />
        ))}
      </div>
    </div>
  );
}
