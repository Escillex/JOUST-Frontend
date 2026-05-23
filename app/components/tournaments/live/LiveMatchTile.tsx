'use client';
import { motion } from 'framer-motion';
import { Match } from '../../../tournaments/[id]/bracket/types';
import { MatchGameLog, GameTrackingMode } from '../../../tournaments/types';
import GameBar from '../bracket/tracker/GameBar';
import GameSeriesScore from '../bracket/tracker/GameSeriesScore';

interface LiveMatchTileProps {
  match: Match;
  roundNumber: number;
  matchIndex: number;
  logs: MatchGameLog[];
  winsNeeded: number;
  tvMode?: boolean;
}

export default function LiveMatchTile({ match, roundNumber, matchIndex, logs, winsNeeded, tvMode = false }: LiveMatchTileProps) {
  const activeLog = logs.find(l => l.trackerActive) ?? null;
  const completedLogs = logs.filter(l => !l.trackerActive && l.completedAt);
  const isTrackerActive = !!activeLog;

  const p1Name = match.player1?.username || match.p1Name || 'TBD';
  const p2Name = match.player2?.username || match.p2Name || 'TBD';
  const p1Wins = match.player1Score ?? 0;
  const p2Wins = match.player2Score ?? 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col bg-[#000] border overflow-hidden ${
        isTrackerActive
          ? 'border-primary/40 shadow-[0_0_30px_rgba(82,185,70,0.12)]'
          : 'border-white/10'
      }`}
    >
      {/* Tile header */}
      <div className={`px-4 py-2 flex justify-between items-center border-b ${isTrackerActive ? 'border-primary/20 bg-primary/3' : 'border-white/5 bg-white/2'}`}>
        <div className="flex items-center gap-2">
          {isTrackerActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_6px_#52b946]" />
          )}
          <span className={`font-black uppercase tracking-[0.3em] ${tvMode ? 'text-xs' : 'text-[9px]'} ${isTrackerActive ? 'text-primary' : 'text-white/30'}`}>
            {isTrackerActive ? 'Live' : 'In Progress'}
          </span>
        </div>
        <span className={`font-black uppercase tracking-widest text-white/20 ${tvMode ? 'text-[10px]' : 'text-[8px]'}`}>
          Round {roundNumber} · Match {matchIndex}
        </span>
      </div>

      {/* Series score */}
      <div className={`px-4 ${tvMode ? 'py-4' : 'py-3'}`}>
        <GameSeriesScore
          player1Wins={p1Wins}
          player2Wins={p2Wins}
          winsNeeded={winsNeeded}
          player1Name={p1Name}
          player2Name={p2Name}
        />
      </div>

      {/* Active game bars */}
      {activeLog ? (
        <div className={`px-4 flex flex-col gap-4 ${tvMode ? 'py-5' : 'py-3'} border-t border-white/5`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`font-black uppercase tracking-[0.4em] text-primary ${tvMode ? 'text-[10px]' : 'text-[8px]'}`}>
              Game {activeLog.gameNumber}
            </span>
            <span className={`font-black uppercase tracking-widest text-white/20 ${tvMode ? 'text-[9px]' : 'text-[8px]'}`}>
              {activeLog.mode}
            </span>
          </div>
          <GameBar
            mode={activeLog.mode}
            currentValue={activeLog.player1Value}
            maxValue={activeLog.startingValue}
            label={p1Name}
            side="left"
          />
          <GameBar
            mode={activeLog.mode}
            currentValue={activeLog.player2Value}
            maxValue={activeLog.startingValue}
            label={p2Name}
            side="right"
          />
        </div>
      ) : (
        <div className={`px-4 flex items-center justify-center border-t border-white/5 text-white/20 font-black uppercase tracking-widest ${tvMode ? 'py-5 text-[10px]' : 'py-4 text-[8px]'}`}>
          {logs.length > 0
            ? `Game ${logs.length + 1} — Awaiting Tracker`
            : 'Tracker Not Started'}
        </div>
      )}

      {/* Game history pills */}
      {completedLogs.length > 0 && (
        <div className={`px-4 border-t border-white/5 flex items-center gap-2 ${tvMode ? 'py-3' : 'py-2'}`}>
          <span className={`font-black uppercase tracking-widest text-white/20 ${tvMode ? 'text-[9px]' : 'text-[7px]'}`}>Games:</span>
          {completedLogs.map(log => {
            const p1Won = log.winnerId === match.player1?.id;
            const p2Won = log.winnerId === match.player2?.id;
            return (
              <div
                key={log.id}
                className={`border px-2 py-0.5 font-black uppercase tracking-wider ${tvMode ? 'text-[9px]' : 'text-[7px]'} ${
                  p1Won ? 'border-primary/40 text-primary' : p2Won ? 'border-white/20 text-white/40' : 'border-white/10 text-white/20'
                }`}
                title={`${log.player1Value} — ${log.player2Value}`}
              >
                G{log.gameNumber} {p1Won ? p1Name.slice(0, 3) : p2Won ? p2Name.slice(0, 3) : 'D'}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
