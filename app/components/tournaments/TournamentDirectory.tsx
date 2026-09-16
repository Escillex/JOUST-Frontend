"use client";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { GamePlayed, Tournament } from "../../tournaments/types";
import TournamentCard from "./TournamentCard";
import FinishedRow from "./FinishedRow";
import {
  STATUS_GROUPS,
  isEntered,
  isLive,
  sortFinished,
  sortForViewer,
} from "../../utils/tournamentStatus";

/**
 * The browse list.
 *
 * The version this replaces put a search box, three sort buttons and five status
 * chips in a sidebar before the first card, and then sorted every status
 * together by date — so last month's finished events sat between this week's
 * open ones. Two controls replace all of that: the order carries the meaning
 * (games you play, then what you can do about them) and each card's own chip
 * says which state it is in, so the filters were labelling something the list
 * already showed.
 */

// Rows, not cards — a page of history can be much larger than a page of live
// events without burying the grid above it.
const FINISHED_PAGE = 10;

interface Props {
  tournaments: Tournament[];
  /** Null when signed out. */
  userId?: string | null;
  /** The viewer's declared games — these tournaments sort first. */
  myGames?: GamePlayed[];
  failed?: boolean;
  onRetry?: () => void;
}

export default function TournamentDirectory({
  tournaments,
  userId,
  myGames = [],
  failed = false,
  onRetry,
}: Props) {
  const [search, setSearch] = useState("");
  const [gameId, setGameId] = useState<string>("ALL");
  // "Active" is the joinable half of live — open now, or opening. The enum is
  // not the vocabulary here: UPCOMING and OPEN are one thing to a player
  // (registration), and ONGOING is another (a tournament being played).
  const [statusFilter, setStatusFilterState] = useState<"ALL" | "ACTIVE" | "ONGOING" | "FINISHED">("ALL");
  // Finished is collapsed by default and re-collapses whenever the viewer leaves
  // the Finished filter, so expanding it there never leaks into "Any status".
  const setStatusFilter = (next: typeof statusFilter) => {
    setStatusFilterState(next);
    if (next !== "FINISHED") setFinishedShown(0);
  };
  const [finishedShown, setFinishedShown] = useState(0);
  const reduceMotion = useReducedMotion();

  const myGameIds = useMemo(() => myGames.map((g) => g.id), [myGames]);

  // The select only earns its place when there is something to choose between.
  const games = useMemo(() => {
    const seen = new Map<string, string>();
    tournaments.forEach((t) => {
      if (t.game?.id) seen.set(t.game.id, t.game.name);
    });
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tournaments]);

  const matching = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tournaments.filter((t) => {
      // Searching the game name too: "lorcana" is what people type, and it used
      // to match nothing.
      const hit =
        !term ||
        t.name.toLowerCase().includes(term) ||
        (t.game?.name ?? "").toLowerCase().includes(term);
      if (!hit) return false;
      if (statusFilter === "ACTIVE" && t.status !== "OPEN" && t.status !== "UPCOMING") return false;
      if (statusFilter === "ONGOING" && t.status !== "ONGOING") return false;
      if (statusFilter === "FINISHED" && t.status !== "COMPLETED") return false;
      if (gameId === "ALL") return true;
      if (gameId === "MINE") return !!t.gameId && myGameIds.includes(t.gameId);
      return t.gameId === gameId;
    });
  }, [tournaments, search, gameId, statusFilter, myGameIds]);

  const live = useMemo(
    () => sortForViewer(matching.filter(isLive), { userId, gameIds: myGameIds }),
    [matching, userId, myGameIds],
  );
  const finished = useMemo(
    () => sortFinished(matching.filter((t) => !isLive(t))),
    [matching],
  );

  const filtering = search.trim() !== "" || gameId !== "ALL" || statusFilter !== "ALL";

  // Asking for finished tournaments should show them, not a collapsed line with
  // an empty grid above it.
  const finishedOnly = statusFilter === "FINISHED";
  const shownFinished = finishedOnly ? Math.max(finishedShown, FINISHED_PAGE) : finishedShown;

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none">
          Tournaments
        </h1>

        <div className="flex flex-wrap gap-2">
          <label className="relative flex-1 basis-full md:basis-auto md:w-72">
            <span className="sr-only">Search tournaments</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tournaments"
              className="w-full h-11 bg-component-background border-2 border-component-border px-4 text-sm text-white placeholder:text-white/40 focus:border-primary outline-none transition-colors"
            />
          </label>

          <label className="flex-1 md:flex-none">
            <span className="sr-only">Filter by status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="w-full h-11 bg-component-background border-2 border-component-border px-3 text-sm text-white focus:border-primary outline-none transition-colors"
            >
              <option value="ALL">Any status</option>
              <option value="ACTIVE">Active</option>
              <option value="ONGOING">Ongoing</option>
              <option value="FINISHED">Finished</option>
            </select>
          </label>

          {games.length > 1 && (
            <label className="flex-1 md:flex-none">
              <span className="sr-only">Filter by game</span>
              <select
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                className="w-full h-11 bg-component-background border-2 border-component-border px-3 text-sm text-white focus:border-primary outline-none transition-colors"
              >
                <option value="ALL">Any game</option>
                {myGameIds.length > 0 && <option value="MINE">Games I play</option>}
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {failed ? (
        // An outage used to render as "0 tournaments found" — the same screen as
        // an empty database, with no way to try again (Core Rule 8).
        <div className="flex flex-col items-center gap-5 border-2 border-dashed border-white/10 py-20 px-6 text-center">
          <p className="text-sm text-white/70">
            Couldn&apos;t load tournaments. Check your connection and try again.
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-6 py-3 border-2 border-primary text-primary text-[11px] font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      ) : live.length === 0 && finished.length === 0 ? (
        <div className="flex flex-col items-center gap-5 border-2 border-dashed border-white/10 py-20 px-6 text-center">
          <p className="text-sm text-white/70">
            {filtering ? "No tournaments match that." : "No tournaments have been created yet."}
          </p>
          {filtering && (
            <button
              onClick={() => {
                setSearch("");
                setGameId("ALL");
                setStatusFilter("ALL");
              }}
              className="px-6 py-3 border-2 border-white/20 text-white text-[11px] font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {live.length > 0 ? (
            // Grouped by status rather than one flat list: the order alone left
            // the viewer to infer where "joinable" stopped and "being played"
            // began, which is exactly what the headings now say.
            <div className="flex flex-col gap-10">
              {STATUS_GROUPS.map((group) => {
                const inGroup = live.filter(group.match);
                if (inGroup.length === 0) return null;
                return (
                  <div key={group.key} className="flex flex-col gap-4">
                    <h2 className="text-[11px] font-black uppercase tracking-widest text-white/50">
                      {group.label} · {inGroup.length}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {inGroup.map((t, idx) => (
                        <motion.div
                          key={t.id}
                          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          // Capped: an uncapped idx * 0.05 meant the 40th card
                          // appeared two seconds after the data had arrived.
                          transition={{ delay: Math.min(idx, 8) * 0.04 }}
                        >
                          <TournamentCard tournament={t} isJoined={isEntered(t, userId)} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : finishedOnly ? null : (
            <p className="text-sm text-white/50 py-6">
              Nothing is open right now.
              {finished.length > 0 && " Finished tournaments are below."}
            </p>
          )}

          {finished.length > 0 && (
            <div className={`flex flex-col gap-6 ${finishedOnly ? "" : "border-t border-component-border pt-6"}`}>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-white/50">
                  Finished · {finished.length}
                </span>
                {/* No collapse when Finished IS the filter — hiding what was
                    just asked for would leave the page blank. */}
                {!finishedOnly && (
                  <button
                    onClick={() =>
                      setFinishedShown((n) => (n === 0 ? FINISHED_PAGE : 0))
                    }
                    className="text-[11px] font-black uppercase tracking-widest text-primary hover:text-primary-light transition-colors"
                  >
                    {finishedShown === 0 ? "Show" : "Hide"}
                  </button>
                )}
              </div>

              {shownFinished > 0 && (
                <>
                  <div className="flex flex-col border-t border-component-border">
                    {finished.slice(0, shownFinished).map((t) => (
                      <FinishedRow key={t.id} tournament={t} userId={userId} />
                    ))}
                  </div>
                  {shownFinished < finished.length && (
                    <button
                      onClick={() => setFinishedShown(shownFinished + FINISHED_PAGE)}
                      className="self-center px-6 py-3 border-2 border-white/20 text-white text-[11px] font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-colors"
                    >
                      Show {Math.min(FINISHED_PAGE, finished.length - shownFinished)} more
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
