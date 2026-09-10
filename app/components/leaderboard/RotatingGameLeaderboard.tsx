"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../utils/api";
import { GlobalLeaderboardEntry } from "../../tournaments/types";
import LeaderboardTable from "./LeaderboardTable";

const ROTATE_MS = 60_000;

/**
 * The home bento leaderboard. Cycles through one game board at a time rather
 * than showing a combined ranking — that board is admin-only now, and pooling
 * every game into one list ranks players who have never played the same thing.
 *
 * Cycles in a fixed order rather than picking at random: a random pick repeats
 * and skips, so a player waiting to see their own game may never get it. The
 * dots let them jump straight to one, which also stops the rotation — someone
 * who has chosen a board should not have it taken away a few seconds later.
 */
export default function RotatingGameLeaderboard({ limit = 10 }: { limit?: number }) {
  const [games, setGames] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [entries, setEntries] = useState<GlobalLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinned, setPinned] = useState(false);
  // Kept in a ref so the rotation timer never has to be torn down and rebuilt
  // when the board changes — restarting it would reset every viewer's cadence.
  const gamesRef = useRef<string[]>([]);
  gamesRef.current = games;
  // Wheel-over-the-dots navigation. The listener reads the current slot through
  // a ref so it never has to be torn down and re-attached on every change.
  const stripRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  indexRef.current = index;
  const wheelAccum = useRef(0);
  const wheelUntil = useRef(0);

  useEffect(() => {
    let active = true;
    authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.LEADERBOARD_GAMES)
      .then(safeJson)
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        setGames(list);
        if (list.length === 0) setLoading(false);
      })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const game = games[index] ?? null;

  const load = useCallback(async (name: string, silent: boolean) => {
    if (!silent) setLoading(true);
    try {
      const res = await authenticatedFetch(
        `${API_ENDPOINTS.TOURNAMENTS.GLOBAL_LEADERBOARD}?game=${encodeURIComponent(name)}`,
      );
      if (res.ok) {
        const data = await safeJson(res);
        setEntries(Array.isArray(data) ? data : []);
      }
      // A failed rotation keeps the board that is already on screen. Going blank
      // because one request lost the network is worse than showing the previous
      // game for another minute (Core Rule 8).
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!game) return;
    void load(game, entries.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, load]);

  useEffect(() => {
    if (pinned || games.length < 2) return;
    const tick = () => {
      // Nothing rotates in a background tab: it would burn a request a minute on
      // a page nobody is looking at, and the viewer would return mid-cycle.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      setIndex((i) => (i + 1) % Math.max(gamesRef.current.length, 1));
    };
    const id = setInterval(tick, ROTATE_MS);
    return () => clearInterval(id);
  }, [pinned, games.length]);

  /**
   * The dot strip takes the scroll wheel as well as clicks — it is the control
   * for which board is showing, so the obvious gesture over it should work.
   *
   * Attached natively because React registers wheel listeners as passive, where
   * preventDefault does nothing. It **clamps** rather than wrapping, and at
   * either end the gesture is left alone so the page scrolls on instead of the
   * strip swallowing the wheel. Like a click, it pins: someone steering the
   * boards by hand should not have one yanked away by the timer.
   */
  useEffect(() => {
    const el = stripRef.current;
    if (!el || games.length < 2) return;

    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      const dir = delta > 0 ? 1 : -1;
      const atEnd =
        (dir > 0 && indexRef.current >= games.length - 1) ||
        (dir < 0 && indexRef.current <= 0);
      if (atEnd) {
        wheelAccum.current = 0;
        return;
      }
      e.preventDefault();

      const now = Date.now();
      if (now < wheelUntil.current) return;
      wheelAccum.current += delta;
      if (Math.abs(wheelAccum.current) < 20) return;
      wheelAccum.current = 0;
      wheelUntil.current = now + 260;
      setPinned(true);
      setIndex((i) => Math.min(Math.max(i + dir, 0), games.length - 1));
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [games.length]);

  if (!loading && games.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-surface border border-white/5 p-10 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">
          No game leaderboards yet
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <LeaderboardTable entries={entries} loading={loading} variant="bento" limit={limit} gameLabel={game ?? undefined} />
      </div>

      {games.length > 1 && (
        <div
          ref={stripRef}
          title="Scroll or click to change board"
          className="flex items-center justify-between gap-3 px-6 py-3 bg-surface border-x border-b border-white/5"
        >
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Game leaderboard">
            {games.map((g, i) => (
              <button
                key={g}
                role="tab"
                aria-selected={i === index}
                aria-label={`Show the ${g} leaderboard`}
                onClick={() => { setIndex(i); setPinned(true); }}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-primary" : "w-1.5 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>
          <span className="text-[8px] font-black uppercase tracking-widest text-white/25">
            {pinned ? "Paused" : "Rotating"}
          </span>
        </div>
      )}
    </div>
  );
}
