"use client";
import { GlobalLeaderboardEntry } from "../tournaments/types";

import React, { useState, useEffect } from "react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../utils/api";
import HomeFrame from "../components/HomeFrame";
import UserRankCard from "../components/leaderboard/UserRankCard";
import LeaderboardTable from "../components/leaderboard/LeaderboardTable";
import MobileLeaderboard from "../components/leaderboard/MobileLeaderboard";
import FadeIn, { StaggerContainer } from "../components/FadeIn";
import { useUser } from "../components/UserProvider";


export default function LeaderboardsPage() {
  const [leaderboard, setLeaderboard] = useState<GlobalLeaderboardEntry[]>([]);
  const [userStats, setUserStats] = useState<GlobalLeaderboardEntry | null>(null);
  const [games, setGames] = useState<string[]>([]);
  // Per-game boards lead, and one of them is the default view — the combined
  // board ranks players who may never have played the same game, so it is an
  // administrator's overview rather than the standing anyone competes in. The
  // server enforces the same rule (403 CROSS_GAME_BOARD_ADMIN_ONLY); this only
  // keeps a non-admin from being shown a tab that would fail.
  const { user } = useUser();
  const isAdmin = !!user?.roles?.includes("ADMIN");
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
      } else if (res.status === 403) {
        setError("The combined all-games board is available to administrators. Choose a game.");
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
        const list = Array.isArray(gamesData) ? gamesData : [];
        setGames(list);
        // Land on a real game rather than on the combined board.
        setSelectedGame((current) => current ?? list[0] ?? null);
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
    // Wait for the games list before the first fetch: firing with `null` would
    // request the combined board, which a non-admin is refused.
    if (selectedGame === null && !isAdmin) {
      if (games.length > 0) return; // a game will be selected on the next tick
      setInitialLoading(false);
      return;
    }
    fetchLeaderboard(selectedGame);
  }, [selectedGame, isAdmin, games.length]);

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
                {[...games, ...(isAdmin ? [null] : [])].map((game) => {
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
                      {game ?? "ALL GAMES · ADMIN"}
                    </button>
                  );
                })}
              </div>
            )}

            {error ? (
              <div className="p-20 border-4 border-red-500 bg-background text-center font-poppins shadow-[16px_16px_0px_0px_#ef4444]">
                <p className="text-red-500 text-xl font-black uppercase tracking-[0.3em] mb-8">{error}</p>
                <button
                  onClick={() => fetchLeaderboard(selectedGame)}
                  className="px-12 py-6 bg-red-500 text-white text-xl font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-[8px_8px_0px_0px_white]"
                >
                  RETRY CONNECTION
                </button>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="p-24 border-4 border-white/10 bg-background text-center font-poppins italic">
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
