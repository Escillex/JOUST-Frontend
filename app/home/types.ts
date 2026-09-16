import type { GamePlayed } from "../tournaments/types";

/**
 * The shape of `GET /dashboard` (server/src/dashboard/dashboard.service.ts).
 *
 * Both device views read this and nothing else, so the desktop lanes and the
 * phone hub can never disagree about your state — the drift hazard a device
 * split otherwise invites.
 */

export type MatchState = "PENDING" | "ONGOING" | "COMPLETED";

export interface DashboardOpponent {
  id: string;
  username: string | null;
  displayName: string | null;
  slug: string | null;
  avatarUrl: string | null;
  isGuest: boolean;
}

export interface DashboardEntry {
  id: string;
  name: string;
  status: "UPCOMING" | "OPEN" | "ONGOING" | "COMPLETED";
  date: string | null;
  game: GamePlayed | null;
  seed: number | null;
  placement: number | null;
  fieldSize: number;
  maxPlayers: number;
  round: { number: number; label: string } | null;
  myMatch: {
    id: string;
    status: MatchState;
    isBye: boolean;
    opponent: DashboardOpponent | null;
    myScore: number;
    opponentScore: number;
  } | null;
  standing: {
    position: number | null;
    wins: number;
    losses: number;
    draws: number;
    points: number;
  } | null;
}

export interface DashboardOpening {
  id: string;
  name: string;
  date: string | null;
  status: "UPCOMING" | "OPEN";
  game: GamePlayed | null;
  maxPlayers: number;
  participantCount: number;
  seatsLeft: number;
}

export interface DashboardBoard {
  game: GamePlayed;
  myRank: number | null;
  myPoints: number | null;
  leader: { name: string; points: number } | null;
}

export interface DashboardData {
  entries: DashboardEntry[];
  openToJoin: DashboardOpening[];
  record: {
    rank: number;
    points: number;
    wins: number;
    losses: number;
    draws: number;
    matchWinPct: number;
  } | null;
  boards: DashboardBoard[];
  collection: { medals: number; plaques: number; photos: number; builds: number };
  community: {
    champion: { name: string; slug: string | null; tournament: string; at: string | null } | null;
    newMembers: number;
  };
  store: {
    items: number;
    featured: { name: string; price: string | number; imageUrl: string | null; link: string | null } | null;
  };
}

export const EMPTY_DASHBOARD: DashboardData = {
  entries: [],
  openToJoin: [],
  record: null,
  boards: [],
  collection: { medals: 0, plaques: 0, photos: 0, builds: 0 },
  community: { champion: null, newMembers: 0 },
  store: { items: 0, featured: null },
};

/** "vs Owen Blake", "Bye", "Opponent to be decided". */
export function opponentName(o: DashboardOpponent | null, isBye = false): string {
  if (isBye) return "Bye";
  if (!o) return "Opponent to be decided";
  return o.displayName || o.username || "Unknown player";
}

/**
 * What this entry is actually asking of you. The lanes and the phone's "right
 * now" card both read this, so they always agree about what matters most.
 */
export function entryAction(e: DashboardEntry): {
  tone: "live" | "ready" | "waiting" | "done";
  label: string;
} {
  const m = e.myMatch;
  if (m && m.status === "ONGOING") return { tone: "live", label: "Your match is live" };
  if (m && m.status === "PENDING")
    return { tone: "ready", label: m.isBye ? "You have a bye this round" : "Your match is up next" };
  if (m && m.status === "COMPLETED") {
    const won = m.myScore > m.opponentScore;
    const drew = m.myScore === m.opponentScore;
    return {
      tone: "done",
      label: drew ? "Round drawn — waiting on the next" : won ? "Round won — waiting on the next" : "Round lost — waiting on the next",
    };
  }
  if (e.status === "ONGOING") return { tone: "waiting", label: "Waiting for your pairing" };
  if (e.status === "OPEN") return { tone: "waiting", label: "Entered — not started yet" };
  return { tone: "waiting", label: "Starts soon" };
}

/** The one entry that deserves the top of the phone screen, if any. */
export function mostUrgent(entries: DashboardEntry[]): DashboardEntry | null {
  const rank = (e: DashboardEntry) => {
    const t = entryAction(e).tone;
    return t === "live" ? 0 : t === "ready" ? 1 : t === "done" ? 2 : 3;
  };
  const sorted = [...entries].sort((a, b) => rank(a) - rank(b));
  return sorted[0] ?? null;
}
