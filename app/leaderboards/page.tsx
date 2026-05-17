"use client";

import React, { useState, useEffect } from "react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../utils/api";
import HomeFrame from "../components/HomeFrame";
import UserRankCard from "../components/leaderboard/UserRankCard";
import LeaderboardTable from "../components/leaderboard/LeaderboardTable";
import FadeIn, { StaggerContainer } from "../components/FadeIn";

interface GlobalLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  points: number;
  tournamentsPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  matchWinPct: number;
  omw: number;
  oomw: number;
}

export default function LeaderboardsPage() {
  const [leaderboard, setLeaderboard] = useState<GlobalLeaderboardEntry[]>([]);
  const [userStats, setUserStats] = useState<GlobalLeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState("");

  const fetchGlobalLeaderboard = async () => {
    try {
      setLoading(true);
      const meRes = await authenticatedFetch(API_ENDPOINTS.AUTH.ME);
      let currentUser = null;
      if (meRes.ok) {
        currentUser = await safeJson(meRes);
      }

      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.GLOBAL_LEADERBOARD);
      
      if (res.ok) {
        const data = await safeJson(res);
        setLeaderboard(Array.isArray(data) ? data : []);
      } else {
        setError(`Error: Server returned status ${res.status}`);
      }

      if (currentUser && (currentUser.sub || currentUser.id)) {
        const statsRes = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.USER_STATS(currentUser.sub || currentUser.id));
        if (statsRes.ok) {
          const statsData = await safeJson(statsRes);
          if (statsData) setUserStats(statsData);
        }
      }
    } catch (err) {
      console.error("Leaderboard fetch crash:", err);
      setError("Connection error: Unable to reach server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalLeaderboard();
  }, []);

  if (loading && leaderboard.length === 0) {
    return (
      <HomeFrame className="h-screen w-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-8 border-white/5 border-t-primary animate-spin" />
              <p className="text-xl font-black uppercase tracking-[0.3em] text-primary animate-pulse font-poppins italic">LOADING LEADERBOARD</p>
          </div>
      </HomeFrame>
    );
  }

  return (
    <HomeFrame className="py-24 md:py-32" showPattern={true}>
      <StaggerContainer className="max-w-7xl mx-auto px-6 md:px-8 space-y-24">
        
        {userStats && (
          <FadeIn>
            <UserRankCard stats={userStats} />
          </FadeIn>
        )}

        <FadeIn>
          <div className="space-y-12">
            {error ? (
              <div className="p-20 border-4 border-red-500 bg-[#1B1B1B] text-center font-poppins shadow-[16px_16px_0px_0px_#ef4444]">
                <p className="text-red-500 text-xl font-black uppercase tracking-[0.3em] mb-8">{error}</p>
                <button 
                  onClick={fetchGlobalLeaderboard}
                  className="px-12 py-6 bg-red-500 text-white text-xl font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-[8px_8px_0px_0px_white]"
                >
                  RETRY CONNECTION
                </button>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="p-24 border-4 border-white/10 bg-[#1B1B1B] text-center font-poppins italic">
                <p className="text-white/20 text-xl font-black uppercase tracking-[0.3em]">NO RANKINGS FOUND</p>
              </div>
            ) : (
              <LeaderboardTable entries={leaderboard} />
            )}
          </div>
        </FadeIn>
      </StaggerContainer>
    </HomeFrame>
  );
}
