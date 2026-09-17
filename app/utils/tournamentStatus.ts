import { Tournament } from "../tournaments/types";
import { displayNameOf } from "./api";

/**
 * How a tournament's state is said out loud, and the order the browse list puts
 * them in.
 *
 * Both pages derive their chips and their ordering from here, so a card and the
 * page it opens can never disagree about whether something is joinable. The
 * status enum alone is not enough for either job: "UPCOMING" is not a sentence,
 * and a raw date sort interleaves last month's finished events with this
 * week's open ones.
 */

/** `now` is a tournament being played RIGHT NOW — deliberately red, not the
 *  brand green, so "happening" is distinguishable at a glance from "joinable".
 *  Green was doing both jobs and neither stood out. */
export type StatusTone = "open" | "now" | "quiet";

export interface StatusChip {
  label: string;
  tone: StatusTone;
}

/** "Sat 27 Sep · 14:00" — short, weekday-led, no year unless it is not this one. */
export function formatWhen(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const day = d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time}`;
}

/** "27 Sep" — for "Registration opens 27 Sep", where the time is noise. */
export function formatDay(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** The round a tournament has reached, from the last round the listing carries. */
/** "Round 2", "Losers round 1", "Grand final" — the vocabulary the server uses
 *  in `roundText()`, so a round is named the same everywhere. */
export function roundLabel(n: number): string {
  if (n === 201) return "Grand final reset";
  if (n >= 200) return "Grand final";
  if (n > 100) return `Losers round ${n - 100}`;
  return `Round ${n}`;
}

export function currentRound(t: Tournament): { round: number; total?: number } | null {
  // The lowest-numbered round that still has something to play — NOT the
  // highest that exists, and not `rounds[0]`.
  //
  //  - `rounds[0]` was wrong because the two endpoints order rounds differently:
  //    the browse listing takes the latest first, `GET /tournaments/:id` ascends.
  //  - the highest was wrong because an elimination bracket creates every round
  //    up front, so a tournament that had not played a single match announced
  //    itself as being in the final.
  const rounds = (t.rounds ?? []).filter((r) => typeof r.roundNumber === "number");
  if (rounds.length === 0) return null;
  const unfinished = rounds.filter((r) =>
    (r.matches ?? []).some((m) => m.status !== "COMPLETED"),
  );
  const pool = unfinished.length > 0 ? unfinished : rounds;
  const round = Math.min(...pool.map((r) => r.roundNumber));
  const cfg = (t.config ?? {}) as { swissRounds?: number };
  return { round, total: cfg.swissRounds };
}

/**
 * The derived state line that replaced the LIVE badge (agreed 2026-09-16).
 *
 * A badge was a flag, and flags go stale: a completed tournament still read
 * LIVE on the bracket page. Every part of this is computed from the rounds and
 * the results, so it cannot disagree with them.
 */
export function stateLine(t: Tournament): string {
  const players = t.participants?.length ?? 0;
  const field = `${players} ${players === 1 ? "player" : "players"}`;

  if (t.status === "COMPLETED") {
    const who = t.winner ? displayNameOf(t.winner) : null;
    return [who ? `Won by ${who}` : "Finished", field].join(" · ");
  }

  if (t.status === "ONGOING") {
    const at = currentRound(t);
    const rounds = t.rounds ?? [];
    const here = at ? rounds.find((r) => r.roundNumber === at.round) : undefined;
    const matches = here?.matches ?? [];
    const reported = matches.filter((m) => m.status === "COMPLETED").length;

    const parts: string[] = [];
    if (at) {
      parts.push(
        at.total && at.round <= 100
          ? `Round ${at.round} of ${at.total}`
          : roundLabel(at.round),
      );
    }
    if (matches.length > 0) parts.push(`${reported} of ${matches.length} results in`);
    parts.push(field);
    return parts.join(" · ");
  }

  if (t.status === "OPEN") {
    const left = seatsLeft(t);
    return [
      left === 0 ? "Full" : `${left} ${left === 1 ? "seat" : "seats"} left`,
      `${players} of ${t.maxPlayers} entered`,
    ].join(" · ");
  }

  const day = formatDay(t.date);
  return [day ? `Opens ${day}` : "Opening soon", `${players} of ${t.maxPlayers} entered`].join(" · ");
}

/**
 * The one-line status a card or a page header shows. Deliberately says what a
 * player can do rather than naming the enum: "Opens 27 Sep" beats "UPCOMING",
 * which reads as a category and not as an answer.
 */
export function describeStatus(t: Tournament, isJoined = false): StatusChip {
  // Your own live tournament still reads as live when it is being played.
  if (isJoined && t.status !== "COMPLETED") {
    return { label: "You're in", tone: t.status === "ONGOING" ? "now" : "open" };
  }
  switch (t.status) {
    case "OPEN":
      return { label: "Open", tone: "open" };
    case "UPCOMING": {
      const day = formatDay(t.date);
      return { label: day ? `Opens ${day}` : "Opening soon", tone: "quiet" };
    }
    case "ONGOING": {
      const at = currentRound(t);
      if (!at) return { label: "Live", tone: "now" };
      return {
        label: at.total ? `Live · Round ${at.round} of ${at.total}` : `Live · Round ${at.round}`,
        tone: "now",
      };
    }
    case "COMPLETED": {
      const who = t.winner ? displayNameOf(t.winner) : null;
      return { label: who ? `Winner: ${who}` : "Finished", tone: "quiet" };
    }
    default:
      return { label: t.status, tone: "quiet" };
  }
}

export function isEntered(t: Tournament, userId?: string | null): boolean {
  if (!userId) return false;
  return t.participants?.some((p) => p.userId === userId) ?? false;
}

export function seatsLeft(t: Tournament): number {
  return Math.max(0, t.maxPlayers - (t.participants?.length ?? 0));
}

/** Everything that is not finished — what the browse grid shows by default. */
export function isLive(t: Tournament): boolean {
  return t.status !== "COMPLETED";
}

const LIVE_RANK: Record<string, number> = {
  OPEN: 0,
  ONGOING: 1,
  UPCOMING: 2,
};

/** The live grid, split into labelled sections. One flat list made the viewer
 *  infer the boundaries from the chips; the headings say them. */
export const STATUS_GROUPS: { key: string; label: string; match: (t: Tournament) => boolean }[] = [
  { key: "OPEN", label: "Open for registration", match: (t) => t.status === "OPEN" },
  { key: "ONGOING", label: "Happening now", match: (t) => t.status === "ONGOING" },
  { key: "UPCOMING", label: "Opening soon", match: (t) => t.status === "UPCOMING" },
];

/**
 * The browse order: the games you play first, then the ones you have entered,
 * then by what you can do about them — join now, join later, watch.
 *
 * Dated events come before undated ones inside each bucket. Sorting purely by
 * date put an undated tournament (epoch 0) either first or last depending on
 * the direction, which is never what anybody meant.
 */
export function sortForViewer(
  tournaments: Tournament[],
  opts: { userId?: string | null; gameIds?: string[] } = {},
): Tournament[] {
  const mine = new Set(opts.gameIds ?? []);

  return [...tournaments].sort((a, b) => {
    // 1. A game you say you play.
    const aGame = a.gameId && mine.has(a.gameId) ? 0 : 1;
    const bGame = b.gameId && mine.has(b.gameId) ? 0 : 1;
    if (aGame !== bGame) return aGame - bGame;

    // 2. One you are already in.
    const aIn = isEntered(a, opts.userId) ? 0 : 1;
    const bIn = isEntered(b, opts.userId) ? 0 : 1;
    if (aIn !== bIn) return aIn - bIn;

    // 3. What you can do: join now, join later, watch.
    const aRank = LIVE_RANK[a.status] ?? 3;
    const bRank = LIVE_RANK[b.status] ?? 3;
    if (aRank !== bRank) return aRank - bRank;

    // 4. Soonest first, undated last.
    const aTime = a.date ? new Date(a.date).getTime() : null;
    const bTime = b.date ? new Date(b.date).getTime() : null;
    if (aTime !== null && bTime !== null && aTime !== bTime) return aTime - bTime;
    if (aTime === null && bTime !== null) return 1;
    if (bTime === null && aTime !== null) return -1;

    return a.name.localeCompare(b.name);
  });
}

/** Finished tournaments, most recently ENDED first — `completedAt`, not the day
 *  it was scheduled to start, which can be long before the final match. */
export function sortFinished(tournaments: Tournament[]): Tournament[] {
  const ended = (t: Tournament) =>
    new Date(t.completedAt ?? t.date ?? t.createdAt).getTime();
  return [...tournaments].sort((a, b) => ended(b) - ended(a));
}
