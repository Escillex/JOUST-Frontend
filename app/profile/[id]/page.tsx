"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { authenticatedFetch, API_ENDPOINTS } from "../../utils/api";
import { useUser } from "../../components/UserProvider";
import HomeFrame from "../../components/HomeFrame";
import FadeIn, { StaggerContainer } from "../../components/FadeIn";
import ProfileHeader from "../../components/profile/ProfileHeader";
import StatsGrid from "../../components/profile/StatsGrid";
import MatchHistory from "../../components/profile/MatchHistory";

interface UserProfile {
  id: string;
  username: string;
  email?: string;
  roles?: string[];
  isGuest?: boolean;
  avatarUrl?: string | null;
  createdAt?: string;
}

interface LeaderboardStats {
  points: number;
  tournamentsPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  matchWinPct: number;
  omw: number;
  oomw: number;
}

function ProfileContent() {
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;
  
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<LeaderboardStats | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  // Sign-out logic now lives in one place: UserProvider.logout.
  // This page previously had its own copy of the same steps.
  const { logout: handleLogout } = useUser();

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const meRes = await authenticatedFetch(API_ENDPOINTS.AUTH.ME);
        let myData = null;
        if (meRes.ok) {
          myData = await meRes.json();
        }

        const targetId = profileId || (myData ? (myData.id || myData.sub) : null);
        
        if (!targetId) {
            router.push("/auth");
            return;
        }

        const isMe = myData && (myData.id === targetId || myData.sub === targetId);
        setIsOwnProfile(!!isMe);

        if (isMe) {
          setUser(myData);
        }

        // Ask the backend for this one user's stats directly.
        // The old code downloaded the ENTIRE global leaderboard and
        // searched it in the browser. That was wasteful, and worse:
        // any real user without a leaderboard entry (someone who has
        // not finished a tournament yet) was shown as "user not found".
        const statsRes = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.USER_STATS(targetId));
        // The endpoint returns null (not an error) when the user has
        // no leaderboard entry yet.
        const entry = statsRes.ok ? await statsRes.json() : null;

        if (entry) {
          setStats(entry);
          if (!isMe) {
            setUser({
              id: entry.userId,
              username: entry.username,
              avatarUrl: entry.avatarUrl,
            });
          }
        } else if (!isMe) {
          // No leaderboard entry. The user may still exist, so check
          // the basic stats endpoint: it returns 404 only when the
          // user account really does not exist.
          const basicRes = await authenticatedFetch(API_ENDPOINTS.AUTH.USER_BASIC_STATS(targetId));
          if (basicRes.ok) {
            const basic = await basicRes.json();
            setStats({
              points: 0,
              tournamentsPlayed: basic?.tournamentsPlayed ?? 0,
              wins: basic?.wins ?? 0,
              losses: basic?.losses ?? 0,
              draws: 0,
              matchWinPct: basic?.winRate ?? 0,
              omw: 0,
              oomw: 0,
            });
            // This endpoint does not include the username, so show a
            // neutral label instead of failing the whole page.
            setUser({ id: targetId, username: "Player" });
          } else {
            // The account truly does not exist.
            setUser(null);
          }
        }
      } catch {
        // Silently fail or handle error if needed
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfileData();
  }, [profileId, router]);

  if (loading && !user) {
    return (
      <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          {/* Reworded from "LOADING_PROFILE..." style codes to plain
              language (project language rule). */}
          <p className="text-primary font-black uppercase tracking-widest text-sm font-poppins">Loading profile...</p>
        </div>
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
