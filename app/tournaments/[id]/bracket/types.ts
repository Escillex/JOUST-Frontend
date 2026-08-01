import { Tournament } from "../../types";
import { MatchGameLog } from "../../types";

export interface Match {
  id: string;
  player1: { id: string; username: string; isGuest?: boolean } | null;
  player2: { id: string; username: string; isGuest?: boolean } | null;
  player1Id?: string | null;
  player2Id?: string | null;
  winnerId?: string | null;
  winner?: { id: string; username: string; isGuest?: boolean } | null;
  p1Name?: string | null;
  p2Name?: string | null;
  winnerName?: string | null;
  status: string;
  roundId: string;
  isBye: boolean;
  nextMatchId?: string | null;
  player1Score?: number;
  player2Score?: number;
  matchIndex?: number;
  /** Which phase of a HYBRID event this match belongs to: 1 = the Swiss stage,
   *  2 = the single-elimination top cut. Always 1 for non-hybrid systems.
   *  Needed to decide whether a draw is safe here — see `canOfferDraw`. */
  phase?: number;
  gameLogs?: MatchGameLog[];
}

export interface Round {
  id: string;
  roundNumber: number;
  matches: Match[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  isGuest?: boolean;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  matchWinPct: number;
  omw: number;
  oomw: number;
}

/** One line in the bracket page's Activity Log panel. Defined once here; it was
 *  previously declared identically in three separate files. */
export interface LogEntry {
  id: string;
  action: string;
  details?: string;
  timestamp: string;
}
