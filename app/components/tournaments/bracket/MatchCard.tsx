import { Match, LeaderboardEntry } from "../../../tournaments/[id]/bracket/types";

interface MatchCardProps {
  match: Match;
  onOpenScoring: () => void;
  isAdmin: boolean;
  isUpdating: boolean;
  leaderboard: LeaderboardEntry[];
  showPoints?: boolean;
  trackedUserId?: string | null;
  currentUserId?: string | null;
  hasActiveTracker?: boolean;
  isFocused?: boolean;
}

export default function MatchCard({ 
  match, 
  onOpenScoring, 
  isAdmin, 
  isUpdating,
  leaderboard,
  showPoints,
  trackedUserId,
  currentUserId,
  hasActiveTracker = false,
  isFocused = false,
}: MatchCardProps) {
  const isTracked = trackedUserId && (match.player1?.id === trackedUserId || match.player2?.id === trackedUserId);
  const isCurrentUserMatch = currentUserId && (match.player1?.id === currentUserId || match.player2?.id === currentUserId || match.player1Id === currentUserId || match.player2Id === currentUserId);
  const isCompleted = !!match.winnerId || match.status === 'COMPLETED';
  const canScore = isAdmin && !isCompleted;
  const isOngoing = match.status === 'ONGOING';

  // Status label
  const statusLabel = isCompleted
    ? 'FULL TIME'
    : isOngoing
      ? 'IN PROGRESS'
      : 'PENDING';

  // Score: show actual series game wins whenever they exist (both ongoing and completed)
  const hasSeriesScore = (match.player1Score ?? 0) > 0 || (match.player2Score ?? 0) > 0;

  const p1Score = hasSeriesScore
    ? String(match.player1Score ?? 0)
    : isCompleted
      ? (match.winnerId === match.player1?.id ? 'W' : 'L')
      : '—';

  const p2Score = hasSeriesScore
    ? String(match.player2Score ?? 0)
    : isCompleted
      ? (match.winnerId === match.player2?.id ? 'W' : 'L')
      : '—';

  return (
    <div
      onClick={() => canScore && onOpenScoring()}
      className={`w-72 flex flex-col overflow-hidden relative group border ${
        isFocused
          ? 'border-[#a855f7] shadow-[0_0_25px_rgba(168,85,247,0.4)]'
          : isTracked 
            ? 'border-primary shadow-[0_0_12px_rgba(82,185,70,0.3)]' 
            : isCurrentUserMatch
              ? 'border-primary/50 shadow-[0_0_15px_rgba(82,185,70,0.25)]'
              : 'border-white/10'
      } ${isUpdating ? 'opacity-50 pointer-events-none' : ''} ${canScore ? 'cursor-pointer hover:border-white/20' : ''} bg-black`}
    >
      {/* Match header */}
      <div className="px-4 py-2 border-b border-white/5 bg-zinc-900/50 flex justify-between items-center">
        <span className={`text-[10px] font-black tracking-wider uppercase ${isOngoing ? 'text-primary/70' : 'text-white/40'}`}>
          {statusLabel}
        </span>
        <div className="flex items-center gap-1.5">
          {hasActiveTracker && isOngoing && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_6px_#52b946]" />
              <span className="text-[8px] font-black uppercase tracking-widest text-primary">LIVE</span>
            </span>
          )}
          {match.winnerId && (
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          )}
        </div>
      </div>

      <div className="flex flex-col">
        <ParticipantRow
          username={match.player1?.username || match.p1Name || undefined}
          score={p1Score}
          isWinner={match.winnerId ? match.winnerId === match.player1?.id : false}
          isTracked={trackedUserId === match.player1?.id}
        />
        <div className="h-[1px] bg-white/5 w-full" />
        <ParticipantRow
          username={match.player2?.username || match.p2Name || undefined}
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
  score,
  isWinner, 
  isBye,
  isTracked
}: { 
  username?: string; 
  score: string;
  isWinner: boolean; 
  isBye?: boolean;
  isTracked?: boolean;
}) {
  return (
    <div className={`flex items-center h-12 transition-all ${isWinner ? 'bg-primary/5' : ''}`}>
      <div className="w-1 bg-primary scale-y-0 transition-transform origin-top group-hover:scale-y-100" />
      
      <div className="flex-1 flex justify-between items-center px-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-6 h-6 flex items-center justify-center border text-[10px] font-bold ${username ? 'border-white/10 text-white/60 bg-white/5' : 'border-white/5 text-white/10'}`}>
            {username?.[0]?.toUpperCase() || '?'}
          </div>
          <span className={`text-[12px] font-bold uppercase tracking-wide truncate ${isWinner ? 'text-white' : username ? 'text-white/80' : 'text-white/20'}`}>
            {username || (isBye ? 'BYE' : 'TBD')}
          </span>
          {isTracked && <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_#52b946]" />}
        </div>

        <div className={`w-8 h-8 flex items-center justify-center text-xs font-black border-l border-white/5 ${isWinner ? 'text-primary' : 'text-white/40'}`}>
          {score}
        </div>
      </div>
    </div>
  );
}
