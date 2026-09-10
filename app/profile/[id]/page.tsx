"use client";
import { LeaderboardStats, UserProfile, ProfileTournamentResult } from "../../tournaments/types";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { authenticatedFetch, API_ENDPOINTS } from "../../utils/api";
import { useUser } from "../../components/UserProvider";
import HomeFrame from "../../components/HomeFrame";
import FadeIn, { StaggerContainer } from "../../components/FadeIn";
import ProfileHeader from "../../components/profile/ProfileHeader";
import StatsGrid from "../../components/profile/StatsGrid";
import MatchHistory from "../../components/profile/MatchHistory";
import TournamentHistory from "../../components/profile/TournamentHistory";
import { Skeleton, SkeletonPanel, SkeletonStatus } from "../../components/ui/Skeleton";



function ProfileContent() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;
  
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<LeaderboardStats | null>(null);
  const [tournaments, setTournaments] = useState<ProfileTournamentResult[]>([]);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  // Sign-out logic now lives in one place: UserProvider.logout.
  // This page previously had its own copy of the same steps.
  const { logout: handleLogout } = useUser();

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const meRes = await authenticatedFetch(API_ENDPOINTS.AUTH.ME);
        const myData = meRes.ok ? await meRes.json() : null;

        // The URL segment is now a username handle (slug), but old UUID links
        // still work — the backend resolves either. Falls back to the signed-in
        // user's own handle when the route has none.
        const handle =
          profileId || (myData ? myData.slug || myData.id || myData.sub : null);
        if (!handle) {
          router.push("/auth");
          return;
        }

        // One call now returns identity, lifetime stats, and recent tournament
        // results (with placement) — resolved by slug or id. This replaces the
        // old leaderboard-entry + basic-stats dance.
        const profRes = await authenticatedFetch(
          API_ENDPOINTS.AUTH.USER_PROFILE(handle),
        );
        if (!profRes.ok) {
          setUser(null);
          return;
        }
        const bundle = await profRes.json();

        const isMe = !!(
          myData &&
          (myData.id === bundle.id || myData.sub === bundle.id)
        );
        setIsOwnProfile(isMe);

        setUser(
          isMe
            ? { ...myData, ...bundle, id: bundle.id }
            : {
                id: bundle.id,
                username: bundle.username,
                displayName: bundle.displayName,
                slug: bundle.slug,
                avatarUrl: bundle.avatarUrl,
                isGuest: bundle.isGuest,
                roles: bundle.roles,
                createdAt: bundle.memberSince,
              },
        );

        const s = bundle.stats;
        setStats({
          points: s?.globalPoints ?? 0,
          tournamentsPlayed: s?.tournamentsPlayed ?? 0,
          wins: s?.wins ?? 0,
          losses: s?.losses ?? 0,
          draws: s?.draws ?? 0,
          matchWinPct: s?.winRate ?? 0,
        });
        setTournaments(
          Array.isArray(bundle.recentTournaments) ? bundle.recentTournaments : [],
        );
      } catch {
        // Silently fail or handle error if needed
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [profileId, router]);

  // Placeholders shaped like the profile itself — header block, then the two
  // column panels — rather than a centred spinner, so the layout the user is
  // about to see is already on screen while the request is in flight.
  if (loading && !user) {
    return (
      <div className="min-h-screen w-full bg-background flex flex-col overflow-x-hidden">
        <HomeFrame className="pt-32 pb-20" showPattern={false}>
          <div className="w-full max-w-7xl mx-auto px-6 md:px-8 space-y-10">
            <SkeletonStatus label="Loading profile" />
            <div className="flex items-center gap-6">
              <Skeleton className="w-24 h-24 rounded-full" />
              <div className="space-y-3 flex-1">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <SkeletonPanel rows={5} />
              <SkeletonPanel rows={5} />
            </div>
          </div>
        </HomeFrame>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen w-full bg-background flex flex-col overflow-x-hidden">
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter text-foreground mb-4 font-poppins">User not found</h2>
            <p className="text-foreground/40 font-bold uppercase tracking-widest font-questrial">
              This user may not exist, or they haven&apos;t established a competitive record yet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background flex flex-col overflow-x-hidden">
      <HomeFrame className="pt-32 pb-20" showPattern={false}>
        <div className="w-full max-w-7xl mx-auto px-6 md:px-8">
          <StaggerContainer className="space-y-10">
            <FadeIn>
              <ProfileHeader 
                user={user} 
                isOwnProfile={isOwnProfile} 
                onLogout={handleLogout} 
              />
            </FadeIn>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <FadeIn>
                <MatchHistory userId={user.id} />
              </FadeIn>

              <FadeIn>
                <div className="flex flex-col h-full">
                   <div className="flex items-center justify-between mb-8">
                      <h3 className="text-xl font-black uppercase tracking-widest text-foreground font-poppins flex items-center gap-3">
                        <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2 2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        Performance Stats
                      </h3>
                    </div>
                  <StatsGrid stats={stats} />
                </div>
              </FadeIn>
            </div>

            <FadeIn>
              <TournamentHistory results={tournaments} />
            </FadeIn>
          </StaggerContainer>
        </div>
      </HomeFrame>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full bg-background flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-primary font-black uppercase tracking-widest text-sm font-poppins">Loading...</p>
        </div>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
