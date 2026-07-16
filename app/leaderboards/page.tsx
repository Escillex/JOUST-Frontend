"use client";

import React, { useState, useEffect } from "react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../utils/api";
import HomeFrame from "../components/HomeFrame";
import UserRankCard from "../components/leaderboard/UserRankCard";
import LeaderboardTable from "../components/leaderboard/LeaderboardTable";
import MobileLeaderboard from "../components/leaderboard/MobileLeaderboard";
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
  avatarUrl?: string | null;
}

export default function LeaderboardsPage() {
  const [leaderboard, setLeaderboard] = useState<GlobalLeaderboardEntry[]>([]);
  const [userStats, setUserStats] = useState<GlobalLeaderboardEntry | null>(null);
  const [games, setGames] = useState<string[]>([]);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchLeaderboard = async (game: string | null) => {
    try {
      setLoading(true);
      setError("");
      const url = game
        ? `${API_ENDPOINTS.TOURNAMENTS.GLOBAL_LEADERBOARD}?game=${encodeURIComponent(game)}`
        : API_ENDPOINTS.TOURNAMENTS.GLOBAL_LEADERBOARD;
      const res = await authenticatedFetch(url);

      if (res.ok) {
        const data = await safeJson(res);
        setLeaderboard(Array.isArray(data) ? data : []);
      } else {
        setError(`Error: Server returned status ${res.status}`);
      }
    } catch (err) {
      console.error("Leaderboard fetch crash:", err);
      setError("Connection error: Unable to reach server");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const fetchGamesAndUserStats = async () => {
    try {
      const gamesRes = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.LEADERBOARD_GAMES);
      if (gamesRes.ok) {
        const gamesData = await safeJson(gamesRes);
        setGames(Array.isArray(gamesData) ? gamesData : []);
      }

      const meRes = await authenticatedFetch(API_ENDPOINTS.AUTH.ME);
      const currentUser = meRes.ok ? await safeJson(meRes) : null;
      if (currentUser && (currentUser.sub || currentUser.id)) {
        const statsRes = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.USER_STATS(currentUser.sub || currentUser.id));
        if (statsRes.ok) {
          const statsData = await safeJson(statsRes);
          if (statsData) setUserStats(statsData);
        }
      }
    } catch (err) {
      console.error("Leaderboard metadata fetch crash:", err);
    }
  };

  useEffect(() => {
    fetchGamesAndUserStats();
  }, []);

  useEffect(() => {
    fetchLeaderboard(selectedGame);
  }, [selectedGame]);

  if (initialLoading) {
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
            {games.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" role="tablist" aria-label="Leaderboard game filter">
                {[null, ...games].map((game) => {
                  const active = selectedGame === game;
                  return (
                    <button
                      key={game ?? "__all__"}
                      onClick={() => setSelectedGame(game)}
                      className={`px-5 py-2.5 border text-[10px] font-black uppercase tracking-[0.25em] whitespace-nowrap shrink-0 font-poppins transition-colors ${
                        active
                          ? "bg-primary text-black border-primary"
                          : "bg-black text-white/40 border-white/10 hover:border-primary/40 hover:text-white"
                      }`}
                    >
                      {game ?? "ALL GAMES"}
                    </button>
                  );
                })}
              </div>
            )}

            {error ? (
              <div className="p-20 border-4 border-red-500 bg-[#1B1B1B] text-center font-poppins shadow-[16px_16px_0px_0px_#ef4444]">
                <p className="text-red-500 text-xl font-black uppercase tracking-[0.3em] mb-8">{error}</p>
                <button
                  onClick={() => fetchLeaderboard(selectedGame)}
                  className="px-12 py-6 bg-red-500 text-white text-xl font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-[8px_8px_0px_0px_white]"
                >
                  RETRY CONNECTION
                </button>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="p-24 border-4 border-white/10 bg-[#1B1B1B] text-center font-poppins italic">
                <p className="text-white/20 text-xl font-black uppercase tracking-[0.3em]">
                  {selectedGame ? `No leaderboard entries for ${selectedGame} yet` : "No leaderboard entries yet"}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile — compact card list */}
                <div className="md:hidden">
                  <MobileLeaderboard entries={leaderboard} loading={loading} gameLabel={selectedGame ?? undefined} />
                </div>
                {/* Desktop — full table */}
                <div className="hidden md:block">
                  <LeaderboardTable entries={leaderboard} gameLabel={selectedGame ?? undefined} />
                </div>
              </>
            )}
          </div>
        </FadeIn>
      </StaggerContainer>
    </HomeFrame>
  );
}
