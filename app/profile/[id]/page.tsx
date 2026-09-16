"use client";
import {
  UserProfile,
  ProfileTournamentResult,
  ProfileStats,
  ProfileMatch,
  UserAward,
  GalleryImage,
} from "../../tournaments/types";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../utils/api";
import GrantAwardModal from "../../components/awards/GrantAwardModal";
import { Skeleton, SkeletonPanel, SkeletonStatus } from "../../components/ui/Skeleton";
import DesktopView from "./device/DesktopView";
import MobileView from "./device/MobileView";

/**
 * A person's public profile. The page owns the data; the device views own the
 * layout — an identity sidebar beside the record on desktop, a single column
 * with tabs on a phone (docs/profile-ux-report.md).
 */
function ProfileContent() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [tournaments, setTournaments] = useState<ProfileTournamentResult[]>([]);
  // The history arrives after the profile, so a slow link shows the person
  // first rather than waiting on both requests. Kept with the id it belongs
  // to, so following a name link never shows the last person's matches.
  const [matchState, setMatchState] = useState<{ userId: string; list: ProfileMatch[] } | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [awards, setAwards] = useState<UserAward[]>([]);
  // Admins may give awards from here; guests cannot hold them (the cleanup
  // job would delete the award with the account), so the button is withheld.
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  // Undefined when signed out: reporting needs an account.
  const [viewerRoles, setViewerRoles] = useState<string[] | undefined>(undefined);
  const [granting, setGranting] = useState(false);
  // Bumped after a give/revoke so the effect below re-reads the profile.
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  // Null until measured, so neither layout flashes before the other.
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const fetchProfileData = async () => {
      let resolvedId: string | null = null;
      try {
        const meRes = await authenticatedFetch(API_ENDPOINTS.AUTH.ME);
        const myData = meRes.ok ? await meRes.json() : null;

        // The URL segment is a username handle (slug), but old UUID links
        // still work — the backend resolves either. Falls back to the signed-in
        // user's own handle when the route has none.
        const handle =
          profileId || (myData ? myData.slug || myData.id || myData.sub : null);
        if (!handle) {
          router.push("/auth");
          return;
        }

        // One call returns identity, lifetime stats, recent tournament results
        // (with placement), awards and the gallery — resolved by slug or id.
        const profRes = await authenticatedFetch(
          API_ENDPOINTS.AUTH.USER_PROFILE(handle),
        );
        if (!profRes.ok) {
          setUser(null);
          return;
        }
        const bundle = await profRes.json();
        resolvedId = bundle.id;

        const isMe = !!(
          myData &&
          (myData.id === bundle.id || myData.sub === bundle.id)
        );
        setIsOwnProfile(isMe);
        setViewerIsAdmin(!!myData?.roles?.includes("ADMIN"));
        setAwards(Array.isArray(bundle.awards) ? bundle.awards : []);
        setGallery(Array.isArray(bundle.gallery) ? bundle.gallery : []);
        setViewerRoles(myData ? (myData.roles ?? []) : undefined);

        setUser(
          isMe
            ? { ...myData, ...bundle, id: bundle.id, createdAt: bundle.memberSince ?? myData.createdAt }
            : {
                id: bundle.id,
                username: bundle.username,
                displayName: bundle.displayName,
                bio: bundle.bio,
                slug: bundle.slug,
                avatarUrl: bundle.avatarUrl,
                isGuest: bundle.isGuest,
                roles: bundle.roles,
                createdAt: bundle.memberSince,
                games: bundle.games,
              },
        );

        const s = bundle.stats;
        setStats({
          points: s?.globalPoints ?? 0,
          winRate: s?.winRate ?? 0,
          wins: s?.wins ?? 0,
          losses: s?.losses ?? 0,
          draws: s?.draws ?? 0,
          tournamentsPlayed: s?.tournamentsPlayed ?? 0,
          tournamentsWon: s?.tournamentsWon ?? 0,
        });
        setTournaments(
          Array.isArray(bundle.recentTournaments) ? bundle.recentTournaments : [],
        );

        setLoading(false);

        // The match history needs the resolved id, so it follows the profile.
        const mRes = await authenticatedFetch(API_ENDPOINTS.AUTH.USER_MATCHES(bundle.id));
        const mData = mRes.ok ? await safeJson(mRes) : null;
        setMatchState({ userId: bundle.id, list: Array.isArray(mData) ? mData : [] });
      } catch (err) {
        console.error("Failed to fetch profile data:", err);
        if (resolvedId) setMatchState({ userId: resolvedId, list: [] });
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [profileId, router, reloadKey]);

  // Placeholders shaped like the layout about to appear, rather than a
  // centred spinner.
  if ((loading && !user) || isMobile === null) {
    return (
      <div className="min-h-screen w-full bg-background pt-6 lg:pt-10 pb-20">
        <SkeletonStatus label="Loading profile" />
        {isMobile ? (
          <div className="px-4 space-y-5">
            <div className="flex items-center gap-4">
              <Skeleton className="w-16 h-16" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-28 w-full" />
            <SkeletonPanel rows={4} />
          </div>
        ) : (
          <div className="w-full max-w-7xl mx-auto px-8 grid grid-cols-[280px_minmax(0,1fr)] min-[1180px]:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] gap-8">
            <Skeleton className="h-[560px] w-full" />
            <div className="space-y-10">
              <Skeleton className="h-24 w-full" />
              <SkeletonPanel rows={5} />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!user || !stats) {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center text-center p-8">
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-3xl font-black uppercase tracking-tighter text-foreground font-poppins">User not found</h2>
          <p className="text-white/70">No profile at this address.</p>
          <div className="flex gap-3">
            <Link href="/community" className="h-11 px-5 flex items-center border border-component-border text-[11px] font-bold uppercase tracking-[0.12em] text-white/85 hover:border-primary/60 font-poppins">
              Search people
            </Link>
            <Link href="/leaderboards" className="h-11 px-5 flex items-center border border-component-border text-[11px] font-bold uppercase tracking-[0.12em] text-white/85 hover:border-primary/60 font-poppins">
              Leaderboards
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const matches = matchState && matchState.userId === user.id ? matchState.list : null;

  const viewProps = {
    user,
    stats,
    matches,
    tournaments,
    awards,
    gallery,
    viewerRoles,
    isOwnProfile,
    onAward: viewerIsAdmin && !user.isGuest ? () => setGranting(true) : undefined,
    onGalleryRemoved: () => setReloadKey((k) => k + 1),
  };

  return (
    // overflow-x-clip, not -hidden: "hidden" makes this a scroll container,
    // which would stop the desktop sidebar from sticking.
    <div className="min-h-screen w-full bg-background overflow-x-clip pt-6 lg:pt-10 pb-28 lg:pb-20">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        {isMobile ? <MobileView {...viewProps} /> : <DesktopView {...viewProps} />}
      </motion.div>

      {viewerIsAdmin && granting && (
        <GrantAwardModal
          userId={user.id}
          userName={user.displayName || user.username}
          isOpen={granting}
          onClose={() => setGranting(false)}
          onChanged={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-background" />}>
      <ProfileContent />
    </Suspense>
  );
}
