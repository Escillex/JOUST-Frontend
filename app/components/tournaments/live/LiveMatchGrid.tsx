'use client';
import { MatchGameLog } from '../../../tournaments/types';
import { Match, Round } from '../../../tournaments/[id]/bracket/types';
import LiveMatchTile from './LiveMatchTile';

interface LiveMatchGridProps {
  rounds: Round[];
  logs: Record<string, MatchGameLog[]>; // matchId → logs
  winsNeeded: number;
  tvMode?: boolean;
  focusMatchId?: string | null;
}

export default function LiveMatchGrid({ rounds, logs, winsNeeded, tvMode = false, focusMatchId }: LiveMatchGridProps) {
  // Flatten all ongoing matches across all rounds, preserving round context
  const ongoingMatches: { match: Match; roundNumber: number; matchIndex: number }[] = [];
  for (const round of rounds) {
    const matchesToFilter = focusMatchId 
      ? round.matches.filter(m => m.id === focusMatchId)
      : round.matches.filter(m => m.status === 'ONGOING' && !m.isBye);

    matchesToFilter.forEach((match, i) => {
      ongoingMatches.push({ match, roundNumber: round.roundNumber, matchIndex: i + 1 });
    });
  }

  if (ongoingMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 border border-white/10 flex items-center justify-center">
          <span className="text-white/10 text-2xl">◇</span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">
          No Active Matches
        </span>
        <span className="text-[9px] font-black uppercase tracking-widest text-white/10">
          Matches will appear here when the tournament starts
        </span>
      </div>
    );
  }

  if (ongoingMatches.length === 1 && focusMatchId) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-full max-w-2xl">
          {ongoingMatches.map(({ match, roundNumber, matchIndex }) => (
            <LiveMatchTile
              key={match.id}
              match={match}
              roundNumber={roundNumber}
              matchIndex={matchIndex}
              logs={logs[match.id] ?? []}
              winsNeeded={winsNeeded}
              tvMode={true}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`grid gap-4 ${tvMode ? 'gap-6' : 'gap-4'}`}
      style={{
        gridTemplateColumns: tvMode
          ? 'repeat(auto-fill, minmax(340px, 1fr))'
          : 'repeat(auto-fill, minmax(300px, 1fr))',
      }}
    >
      {ongoingMatches.map(({ match, roundNumber, matchIndex }) => (
        <LiveMatchTile
          key={match.id}
          match={match}
          roundNumber={roundNumber}
          matchIndex={matchIndex}
          logs={logs[match.id] ?? []}
          winsNeeded={winsNeeded}
          tvMode={tvMode}
        />
      ))}
    </div>
  );
}
