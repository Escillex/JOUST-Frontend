"use client";
import { GlobalLeaderboardEntry } from "../tournaments/types";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../utils/api";
import HomeFrame from "../components/HomeFrame";
import UserRankCard from "../components/leaderboard/UserRankCard";
import LeaderboardTable from "../components/leaderboard/LeaderboardTable";
import MobileLeaderboard from "../components/leaderboard/MobileLeaderboard";
import FadeIn, { StaggerContainer } from "../components/FadeIn";
import { useUser } from "../components/UserProvider";

// Below this many entries a search box is more clutter than help.
const SEARCH_THRESHOLD = 6;
// Width of the scroll-edge fade on the game tab strip.
const EDGE_FADE_PX = 24;

function edgeMask(canScrollLeft: boolean, canScrollRight: boolean): string {
  const start = canScrollLeft ? `transparent 0px, black ${EDGE_FADE_PX}px` : "black 0px";
  const end = canScrollRight ? `black calc(100% - ${EDGE_FADE_PX}px), transparent 100%` : "black 100%";
  return `linear-gradient(to right, ${start}, ${end})`;
}

export default function LeaderboardsPage() {
  const [leaderboard, setLeaderboard] = useState<GlobalLeaderboardEntry[]>([]);
  const [games, setGames] = useState<string[]>([]);
  // Per-game boards lead, and one of them is the default view — the combined
  // board ranks players who may never have played the same game, so it is an
  // administrator's overview rather than the standing anyone competes in. The
  // server enforces the same rule (403 CROSS_GAME_BOARD_ADMIN_ONLY); this only
  // keeps a non-admin from being shown a tab that would fail.
  const { user, loading: userLoading } = useUser();
  const isAdmin = !!user?.roles?.includes("ADMIN");
  const currentUserId = user?.sub || user?.id || null;
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  // Distinguishes "you're not allowed to see this board" from an actual
  // network failure — the two need different copy and different actions.
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState("");

  // Ignore a response that resolves after a newer tab switch already
  // superseded it — otherwise a slow "Chess" response can land after a
  // fast "Pool" one and silently overwrite it.
  const requestIdRef = useRef(0);

  const fetchLeaderboard = async (game: string | null) => {
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setError("");
      setForbidden(false);
      const url = game
        ? `${API_ENDPOINTS.TOURNAMENTS.GLOBAL_LEADERBOARD}?game=${encodeURIComponent(game)}`
        : API_ENDPOINTS.TOURNAMENTS.GLOBAL_LEADERBOARD;
      const res = await authenticatedFetch(url);
      if (requestId !== requestIdRef.current) return;

      if (res.ok) {
        const data = await safeJson(res);
        setLeaderboard(Array.isArray(data) ? data : []);
      } else if (res.status === 403) {
        setForbidden(true);
        setError("The combined all-games board is available to administrators. Choose a game.");
      } else {
        setError(`Error: Server returned status ${res.status}`);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error("Leaderboard fetch crash:", err);
      setError("Connection error: Unable to reach server");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
      setInitialLoading(false);
    }
  };

  const fetchGamesCatalog = async () => {
    try {
      const gamesRes = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.LEADERBOARD_GAMES);
      if (gamesRes.ok) {
        const gamesData = await safeJson(gamesRes);
        const list = Array.isArray(gamesData) ? gamesData : [];
        setGames(list);
        // Land on a real game rather than on the combined board — and prefer
        // one the viewer actually plays over whichever sorts first.
        setSelectedGame((current) => {
          if (current) return current;
          const played = new Set((user?.games ?? []).map((g) => g.name));
          return list.find((g) => played.has(g)) ?? list[0] ?? null;
        });
      }
    } catch (err) {
      console.error("Leaderboard games fetch crash:", err);
    }
  };

  useEffect(() => {
    // Wait for the signed-in user to resolve first: the personalized default
    // game above reads `user.games`, which isn't there yet mid-fetch.
    if (userLoading) return;
    fetchGamesCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading]);

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

  // The viewer's rank on whichever board is actually on screen — never a
  // separate all-games figure. The card always shows once signed in, even
  // with no rank on the highlighted tab: it just says "Unranked" instead of
  // silently disappearing or showing a number for a different board.
  const perGameUserStats = useMemo(
    () => (currentUserId ? leaderboard.find((e) => e.userId === currentUserId) ?? null : null),
    [leaderboard, currentUserId],
  );
  const rankCard = user
    ? {
        identity: { username: user.username, displayName: user.displayName },
        rank: perGameUserStats?.rank ?? null,
        scopeLabel: selectedGame ? `${selectedGame} board` : "All games · admin board",
      }
    : null;

  // Scrolls the table down to the viewer's own row and flashes it, so
  // clicking the standing card gives more context instead of just repeating
  // a number they already have. Clears any active search first, since a
  // filter could be hiding the row the id lookup needs.
  const jumpToRow = useCallback((userId: string) => {
    setSearch("");
    window.setTimeout(() => {
      const candidates = [
        document.getElementById(`lb-row-desktop-${userId}`),
        document.getElementById(`lb-row-mobile-${userId}`),
      ];
      const target = candidates.find((el): el is HTMLElement => !!el && el.offsetParent !== null);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      const prevBg = target.style.backgroundColor;
      target.style.transition = "background-color 0.4s ease";
      target.style.backgroundColor = "rgba(82,185,70,0.25)";
      window.setTimeout(() => {
        target.style.backgroundColor = prevBg;
      }, 900);
    }, 60);
  }, []);

  const filteredLeaderboard = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leaderboard;
    return leaderboard.filter(
      (e) => e.username?.toLowerCase().includes(q) || e.displayName?.toLowerCase().includes(q),
    );
  }, [leaderboard, search]);

  // Edge-fade on the game tab strip: hints there are more tabs to scroll to
  // instead of the row just cutting off with no visual cue.
  const tabStripRef = useRef<HTMLDivElement>(null);
  const [tabFade, setTabFade] = useState({ left: false, right: false });
  const updateTabFade = useCallback(() => {
    const el = tabStripRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setTabFade({
      left: scrollLeft > 4,
      right: scrollLeft + clientWidth < scrollWidth - 4,
    });
  }, []);
  useEffect(() => {
    updateTabFade();
    window.addEventListener("resize", updateTabFade);
    return () => window.removeEventListener("resize", updateTabFade);
  }, [games, isAdmin, updateTabFade]);

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

        {rankCard && (
          <FadeIn>
            <UserRankCard
              identity={rankCard.identity}
              rank={rankCard.rank}
              scopeLabel={rankCard.scopeLabel}
              loading={loading}
              onJump={currentUserId ? () => jumpToRow(currentUserId) : undefined}
            />
          </FadeIn>
        )}

        <FadeIn>
          <div className="space-y-12">
            {games.length > 0 && (
              <div
                ref={tabStripRef}
                onScroll={updateTabFade}
                className="flex gap-2 overflow-x-auto no-scrollbar pb-1"
                style={{ WebkitMaskImage: edgeMask(tabFade.left, tabFade.right), maskImage: edgeMask(tabFade.left, tabFade.right) }}
                role="tablist"
                aria-label="Leaderboard game filter"
              >
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

            {error && !forbidden ? (
              <div className="p-20 border-4 border-red-500 bg-background text-center font-poppins shadow-[16px_16px_0px_0px_#ef4444]">
                <p className="text-red-500 text-xl font-black uppercase tracking-[0.3em] mb-8">{error}</p>
                <button
                  onClick={() => fetchLeaderboard(selectedGame)}
                  className="px-12 py-6 bg-red-500 text-white text-xl font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-[8px_8px_0px_0px_white]"
                >
                  RETRY CONNECTION
                </button>
              </div>
            ) : forbidden ? (
              <div className="p-20 border-4 border-white/10 bg-background text-center font-poppins">
                <p className="text-white/60 text-lg font-black uppercase tracking-[0.2em] mb-8">
                  This board is admin-only. Pick a game to see its standings.
                </p>
                {games[0] && (
                  <button
                    onClick={() => setSelectedGame(games[0])}
                    className="px-12 py-6 bg-primary text-black text-xl font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-[8px_8px_0px_0px_white]"
                  >
                    → {games[0]}
                  </button>
                )}
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="p-24 border-4 border-white/10 bg-background text-center font-poppins italic">
                <p className="text-white/20 text-xl font-black uppercase tracking-[0.3em]">
                  {selectedGame ? `No leaderboard entries for ${selectedGame} yet` : "No leaderboard entries yet"}
                </p>
              </div>
            ) : (
              <>
                {leaderboard.length > SEARCH_THRESHOLD && (
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="SEARCH PLAYERS..."
                    aria-label="Search players on this leaderboard"
                    className="w-full md:w-80 bg-black border border-white/10 text-white placeholder-white/20 text-[10px] font-black uppercase tracking-[0.25em] font-poppins px-5 py-3 focus:outline-none focus:border-primary/60 transition-colors"
                  />
                )}

                {filteredLeaderboard.length === 0 ? (
                  <div className="p-16 border-4 border-white/10 bg-background text-center font-poppins italic">
                    <p className="text-white/20 text-lg font-black uppercase tracking-[0.25em] mb-4">
                      No players match &ldquo;{search}&rdquo;
                    </p>
                    <button
                      onClick={() => setSearch("")}
                      className="text-primary text-[10px] font-black uppercase tracking-[0.25em] hover:underline"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Mobile — compact card list */}
                    <div className="md:hidden">
                      <MobileLeaderboard entries={filteredLeaderboard} loading={loading} gameLabel={selectedGame ?? undefined} />
                    </div>
                    {/* Desktop — full table */}
                    <div className="hidden md:block">
                      <LeaderboardTable entries={filteredLeaderboard} loading={loading} gameLabel={selectedGame ?? undefined} />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </FadeIn>
      </StaggerContainer>
    </HomeFrame>
  );
}
