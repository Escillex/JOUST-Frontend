"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  authenticatedFetch,
  API_ENDPOINTS,
  safeJson,
  resolveImageUrl,
  profileHref,
  displayNameOf,
} from "../utils/api";
import HomeFrame from "../components/HomeFrame";

interface UserResult {
  id: string;
  username: string | null;
  displayName?: string | null;
  slug: string | null;
  avatarUrl: string | null;
  tournamentsPlayed: number;
  tournamentsWon: number;
  globalPoints: number;
}
interface TournamentResult {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  date: string | null;
  game: string | null;
  format: string | null;
}
interface Champion {
  tournamentId: string;
  tournamentName: string;
  tournamentSlug: string | null;
  date: string;
  game: string | null;
  winner: { id: string; username: string | null; displayName?: string | null; slug: string | null; avatarUrl: string | null } | null;
}
interface TopPlayer {
  userId: string;
  username: string;
  displayName?: string | null;
  slug?: string | null;
  avatarUrl?: string | null;
  points: number;
  tournamentsPlayed: number;
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary font-poppins mb-5">
    {children}
  </h2>
);

function Avatar({ url, name, size = "w-11 h-11" }: { url?: string | null; name?: string | null; size?: string }) {
  return (
    <div className={`${size} shrink-0 rounded-full overflow-hidden border-2 border-component-border bg-component-background flex items-center justify-center relative`}>
      {url ? (
        <Image src={resolveImageUrl(url)} alt={name || "User"} fill className="object-cover" unoptimized />
      ) : (
        <span className="text-xs font-black text-white/60 font-poppins">{name?.[0]?.toUpperCase() || "U"}</span>
      )}
    </div>
  );
}

export default function CommunityPage() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserResult[]>([]);
  const [tournaments, setTournaments] = useState<TournamentResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [champions, setChampions] = useState<Champion[]>([]);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [topGame, setTopGame] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Discovery feed (recent champions + top players) — composed from existing
  // reads so the landing state shows "what the community is up to" before any
  // search.
  useEffect(() => {
    const loadFeed = async () => {
      try {
        // Top players come from a single game's board. The combined ranking this
        // used to read is admin-only (2026-09-10) and would 403 here, and it was
        // never the right list anyway — it ranked players across games they have
        // never both played. The first game in the list is used, and named, so
        // the panel says which board the five belong to.
        const [spotRes, gamesRes] = await Promise.all([
          authenticatedFetch(API_ENDPOINTS.SEARCH.SPOTLIGHT),
          authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.LEADERBOARD_GAMES),
        ]);
        if (spotRes.ok) {
          const data = await safeJson(spotRes);
          setChampions(Array.isArray(data?.recentChampions) ? data.recentChampions : []);
        }
        if (gamesRes.ok) {
          const games = await safeJson(gamesRes);
          const first = Array.isArray(games) ? games[0] : null;
          if (first) {
            setTopGame(first);
            const lbRes = await authenticatedFetch(
              `${API_ENDPOINTS.TOURNAMENTS.GLOBAL_LEADERBOARD}?game=${encodeURIComponent(first)}`,
            );
            if (lbRes.ok) {
              const board = await safeJson(lbRes);
              setTopPlayers(Array.isArray(board) ? board.slice(0, 5) : []);
            }
          }
        }
      } finally {
        setFeedLoading(false);
      }
    };
    loadFeed();
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setUsers([]);
      setTournaments([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const res = await authenticatedFetch(API_ENDPOINTS.SEARCH.QUERY(trimmed));
    if (res.ok) {
      const data = await safeJson(res);
      setUsers(Array.isArray(data?.users) ? data.users : []);
      setTournaments(Array.isArray(data?.tournaments) ? data.tournaments : []);
    }
    setSearching(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const hasQuery = query.trim().length > 0;
  const noResults = hasQuery && !searching && users.length === 0 && tournaments.length === 0;

  return (
    <div className="min-h-screen w-full bg-background flex flex-col overflow-x-hidden">
      <HomeFrame className="pt-32 pb-20" showPattern={false}>
        <div className="w-full max-w-5xl mx-auto px-6 md:px-8 space-y-12">
          {/* Heading + search */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-foreground font-poppins italic">
                Community
              </h1>
              <p className="text-foreground/40 text-sm font-bold uppercase tracking-widest mt-2 font-questrial">
                Find players and events — look someone up on JOUST
              </p>
            </div>

            <div className="relative">
              <svg className="w-5 h-5 text-white/30 absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth={2} />
                <path strokeWidth={2} strokeLinecap="round" d="m21 21-4.3-4.3" />
              </svg>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search players and tournaments…"
                className="w-full bg-component-background border-2 border-component-border focus:border-primary rounded-xl pl-14 pr-5 py-4 text-white font-bold tracking-wide outline-none transition-colors placeholder:text-white/20"
              />
            </div>
          </div>

          {/* Results */}
          {hasQuery ? (
            <div className="space-y-12 animate-in fade-in duration-200">
              {noResults && (
                <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 font-poppins">
                    Nothing found for &ldquo;{query.trim()}&rdquo;
                  </p>
                </div>
              )}

              {users.length > 0 && (
                <section>
                  <SectionLabel>People</SectionLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {users.map((u) => (
                      <Link
                        key={u.id}
                        href={profileHref(u)}
                        className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-primary/40 hover:bg-white/[0.04] transition-all group"
                      >
                        <Avatar url={u.avatarUrl} name={displayNameOf(u, "")} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black uppercase tracking-tight text-white truncate font-poppins group-hover:text-primary transition-colors">
                            {displayNameOf(u, "Player")}
                          </p>
                          <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mt-0.5">
                            {u.tournamentsWon} won · {u.tournamentsPlayed} played · {u.globalPoints} pts
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {tournaments.length > 0 && (
                <section>
                  <SectionLabel>Tournaments</SectionLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {tournaments.map((t) => (
                      <Link
                        key={t.id}
                        href={`/tournaments/${t.id}`}
                        className="flex items-center justify-between gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-primary/40 hover:bg-white/[0.04] transition-all group"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-black uppercase tracking-tight text-white truncate font-poppins group-hover:text-primary transition-colors">
                            {t.name}
                          </p>
                          <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mt-0.5 truncate">
                            {[t.game, t.format?.replace(/_/g, " ")].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-primary/70 border border-primary/20 rounded px-2 py-1 shrink-0">
                          {t.status}
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            /* Discovery feed */
            <div className="space-y-12">
              <section>
                <SectionLabel>Recent Champions</SectionLabel>
                {feedLoading ? (
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Loading…</p>
                ) : champions.length === 0 ? (
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/20">No completed tournaments yet</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {champions.map((c) => (
                      <div
                        key={c.tournamentId}
                        className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl"
                      >
                        <span className="text-2xl shrink-0" title="Champion">🥇</span>
                        {c.winner ? (
                          // Two sibling links (avatar+name -> profile, "won X" ->
                          // tournament). They must NOT nest: an <a> inside an <a>
                          // is invalid HTML and triggers a hydration error.
                          <>
                            <Link href={profileHref(c.winner)} className="shrink-0" aria-label={displayNameOf(c.winner, "Player")}>
                              <Avatar url={c.winner.avatarUrl} name={displayNameOf(c.winner, "")} size="w-9 h-9" />
                            </Link>
                            <div className="min-w-0 flex-1">
                              <Link href={profileHref(c.winner)} className="block text-sm font-black uppercase tracking-tight text-white truncate font-poppins hover:text-primary transition-colors">
                                {displayNameOf(c.winner, "Player")}
                              </Link>
                              <Link href={`/tournaments/${c.tournamentId}`} className="block text-[9px] font-black text-white/30 uppercase tracking-widest hover:text-primary transition-colors truncate">
                                won {c.tournamentName}
                              </Link>
                            </div>
                          </>
                        ) : (
                          <span className="text-sm font-black text-white/40">—</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <SectionLabel>{topGame ? `Top Players · ${topGame}` : "Top Players"}</SectionLabel>
                {feedLoading ? (
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Loading…</p>
                ) : topPlayers.length === 0 ? (
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/20">No ranked players yet</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {topPlayers.map((p, i) => (
                      <Link
                        key={p.userId}
                        href={profileHref({ slug: p.slug, userId: p.userId })}
                        className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:border-primary/40 hover:bg-white/[0.04] transition-all group"
                      >
                        <span className="w-6 text-center text-sm font-black text-primary font-poppins shrink-0">{i + 1}</span>
                        <Avatar url={p.avatarUrl} name={displayNameOf(p, "")} size="w-9 h-9" />
                        <p className="text-sm font-black uppercase tracking-tight text-white truncate font-poppins flex-1 group-hover:text-primary transition-colors">
                          {displayNameOf(p)}
                        </p>
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest shrink-0">{p.points} pts</span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </HomeFrame>
    </div>
  );
}
