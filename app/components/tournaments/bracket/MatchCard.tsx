"use client";
import Image from "next/image";
import { Match, LeaderboardEntry } from "../../../tournaments/[id]/bracket/types";
import { displayNameOf, resolveImageUrl } from "../../../utils/api";

/**
 * One match on the bracket canvas.
 *
 * Narrow on purpose (agreed 2026-09-17, option 2A). Card width sets column
 * width, which sets how wide the whole tree is, which is why a double
 * elimination with a bracket reset could not fit on screen at a legible zoom.
 * At 212px a reset bracket fits where a 288px one did not.
 *
 * The status row went with the width: state is the coloured bar down the left
 * edge instead (green decided · red being played · nothing pending), which
 * survives being zoomed out where 8px type does not. The one exception is the
 * match that decided the tournament, which wears a Champion cap — there is no
 * pedestal node any more (option 5B).
 */

interface MatchCardProps {
  match: Match;
  onOpenScoring: () => void;
  isAdmin: boolean;
  isUpdating: boolean;
  leaderboard: LeaderboardEntry[];
  trackedUserId?: string | null;
  currentUserId?: string | null;
  isFocused?: boolean;
  /** Entrant seeds by user id. Seeding is random by default, so most
   *  tournaments have none and the slot is simply not rendered. */
  seeds?: Record<string, number>;
  /** This match decided the tournament and has a winner. */
  isChampion?: boolean;
}

export default function MatchCard({
  match,
  onOpenScoring,
  isAdmin,
  isUpdating,
  leaderboard,
  trackedUserId,
  currentUserId,
  isFocused = false,
  seeds,
  isChampion = false,
}: MatchCardProps) {
  const isTracked = trackedUserId && (match.player1?.id === trackedUserId || match.player2?.id === trackedUserId);
  const isCurrentUserMatch = currentUserId && (match.player1?.id === currentUserId || match.player2?.id === currentUserId || match.player1Id === currentUserId || match.player2Id === currentUserId);
  const isCompleted = !!match.winnerId || match.status === 'COMPLETED';
  const canScore = isAdmin && !isCompleted;
  const isOngoing = match.status === 'ONGOING';

  // A draw is stored as COMPLETED with no winner. Without this branch the
  // W/L test below resolves to 'L' for BOTH players, so a drawn match was
  // displayed as if everyone had lost it.
  const isDraw = isCompleted && !match.winnerId && !match.isBye;

  // The same vocabulary the pairings view uses — it is the same match.
  const stateLabel = match.isBye
    ? 'Bye'
    : isDraw
      ? 'Draw'
      : isCompleted
        ? 'Full time'
        : isOngoing
          ? 'Being played'
          : 'Pending';

  // Score: show actual series game wins whenever they exist (both ongoing and completed)
  const hasSeriesScore = (match.player1Score ?? 0) > 0 || (match.player2Score ?? 0) > 0;

  const p1Score = hasSeriesScore
    ? String(match.player1Score ?? 0)
    : isDraw
      ? 'D'
      : isCompleted
        ? (match.winnerId === match.player1?.id ? 'W' : 'L')
        : '—';

  const p2Score = hasSeriesScore
    ? String(match.player2Score ?? 0)
    : isDraw
      ? 'D'
      : isCompleted
        ? (match.winnerId === match.player2?.id ? 'W' : 'L')
        : '—';

  // The bracket's own Match type carries no avatar, but the standings do and
  // are already passed in — so faces come from there, and a player the board
  // does not list simply keeps the lettered square.
  const avatarOf = (id?: string | null) =>
    (id ? leaderboard.find((e) => e.userId === id)?.avatarUrl : null) || null;

  const edge = isChampion
    ? 'bg-primary'
    : isDraw
      ? 'bg-white/25'
      : isCompleted
        ? 'bg-primary/70'
        : isOngoing
          ? 'bg-[#FF4D4D]'
          : 'bg-transparent';

  return (
    <div
      onClick={() => canScore && onOpenScoring()}
      className={`w-[212px] flex overflow-hidden relative group border ${
        isFocused
          ? 'border-[#a855f7] shadow-[0_0_25px_rgba(168,85,247,0.4)]'
          : isChampion
            ? 'border-primary shadow-[0_0_22px_rgba(82,185,70,0.22)]'
            : isTracked
              ? 'border-primary shadow-[0_0_12px_rgba(82,185,70,0.3)]'
              : isCurrentUserMatch
                ? 'border-primary/50 shadow-[0_0_15px_rgba(82,185,70,0.25)]'
                : 'border-white/10'
      } ${isUpdating ? 'opacity-50 pointer-events-none' : ''} ${canScore ? 'cursor-pointer hover:border-white/20' : ''} bg-black`}
    >
      {/* State, as an edge rather than a row of type: it is still readable at
          the zoom a whole bracket has to be viewed at. */}
      <span aria-hidden className={`w-[3px] shrink-0 ${edge}`} />
      <span className="sr-only">{stateLabel}</span>

      <div className="flex flex-col min-w-0 flex-1">
        {isChampion && (
          <div className="px-2.5 py-1.5 border-b border-primary/25 bg-primary/10">
            <span className="text-[9px] font-black tracking-[0.18em] uppercase text-primary">
              Champion
            </span>
          </div>
        )}

        <ParticipantRow
          username={displayNameOf(match.player1, "") || match.p1Name || undefined}
          avatarUrl={avatarOf(match.player1?.id ?? match.player1Id)}
          seed={seeds?.[match.player1?.id ?? match.player1Id ?? ""]}
          score={p1Score}
          isWinner={match.winnerId ? match.winnerId === match.player1?.id : false}
          isTracked={trackedUserId === match.player1?.id}
        />
        <div className="h-[1px] bg-white/5 w-full" />
        <ParticipantRow
          username={displayNameOf(match.player2, "") || match.p2Name || undefined}
          avatarUrl={avatarOf(match.player2?.id ?? match.player2Id)}
          seed={seeds?.[match.player2?.id ?? match.player2Id ?? ""]}
          score={p2Score}
          isWinner={match.winnerId ? match.winnerId === match.player2?.id : false}
          isBye={match.isBye}
          isTracked={trackedUserId === match.player2?.id}
        />
      </div>

      {canScore && (
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <div className="bg-primary text-black text-[9px] font-black uppercase px-3 py-1 tracking-widest shadow-xl">
            SCORE
          </div>
        </div>
      )}
    </div>
  );
}

function ParticipantRow({
  username,
  avatarUrl,
  seed,
  score,
  isWinner,
  isBye,
  isTracked
}: {
  username?: string;
  avatarUrl?: string | null;
  seed?: number;
  score: string;
  isWinner: boolean;
  isBye?: boolean;
  isTracked?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 h-9 px-2.5 transition-all ${isWinner ? 'bg-primary/5' : ''}`}>
      {seed !== undefined && (
        <span className="text-[9px] font-black tabular-nums text-white/35 w-3.5 text-right shrink-0">
          {seed}
        </span>
      )}

      <span className={`relative w-[22px] h-[22px] shrink-0 flex items-center justify-center border overflow-hidden text-[9px] font-bold ${
        username ? 'border-white/10 text-white/60 bg-white/5' : 'border-white/5 text-white/10'
      }`}>
        {avatarUrl ? (
          <Image src={resolveImageUrl(avatarUrl)} alt="" aria-hidden fill className="object-cover" unoptimized />
        ) : (
          username?.[0]?.toUpperCase() || '?'
        )}
      </span>

      <span className={`text-[12px] font-bold uppercase tracking-wide truncate flex-1 min-w-0 ${
        isWinner ? 'text-white' : username ? 'text-white/80' : 'text-white/20'
      }`}>
        {username || (isBye ? 'BYE' : 'TBD')}
      </span>

      {isTracked && <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_#52b946] shrink-0" />}

      <span className={`text-[12px] font-black tabular-nums shrink-0 ${isWinner ? 'text-primary' : 'text-white/40'}`}>
        {score}
      </span>
    </div>
  );
}
