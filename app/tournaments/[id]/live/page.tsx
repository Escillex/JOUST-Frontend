'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Tournament } from '../../../tournaments/types';
import { MatchGameLog } from '../../../tournaments/types';
import { Round } from '../../../tournaments/[id]/bracket/types';
import { authenticatedFetch, API_ENDPOINTS, safeJson } from '../../../utils/api';
import { usePolling } from '../../../utils/usePolling';
import { useTournamentSocket, TrackerUpdatePayload } from '../../../utils/useTournamentSocket';
import { getTournamentConfig } from '../../../utils/formatConfig';
import LiveMatchGrid from '../../../components/tournaments/live/LiveMatchGrid';
import TVOverlay from '../../../components/tournaments/live/TVOverlay';
import Link from 'next/link';
import ConnectionPill from '../../../components/ui/ConnectionPill';

const POLL_INTERVAL = 4000;

function getWinsNeeded(tournament: Tournament): number {
  const config = getTournamentConfig(tournament);
  const bestOf = config?.bestOf ?? 1;
  return Math.ceil(bestOf / 2);
}

export default function LivePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tournamentId = params.id as string;
  const tvMode = searchParams.get('tv') === 'true';
  const focusMatchId = searchParams.get('matchId');

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [logs, setLogs] = useState<Record<string, MatchGameLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      // 1. Fetch tournament
      // This page used its own copy of the base-URL logic. It now uses
      // the shared authenticatedFetch, which builds the URL the same way
      // for the whole app (these endpoints also work while signed out).
      const tRes = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.GET_ONE(tournamentId));
      if (!tRes.ok) return;
      const t: Tournament = await tRes.json();
      setTournament(t);

      // 2. Fetch rounds
      const rRes = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.ROUNDS(tournamentId));
      const roundData: Round[] = rRes.ok ? await rRes.json() : [];
      setRounds(roundData);

      // 3. For each ongoing match, fetch tracker logs
      const ongoingMatches = roundData
        .flatMap(r => r.matches)
        .filter(m => m.status === 'ONGOING' && !m.isBye);

      const logEntries = await Promise.all(
        ongoingMatches.map(async m => {
          try {
            const lRes = await authenticatedFetch(API_ENDPOINTS.MATCHES.TRACKER_GET(m.id));
            const logData: MatchGameLog[] = lRes.ok ? await lRes.json() : [];
            return [m.id, Array.isArray(logData) ? logData : []] as const;
          } catch {
            return [m.id, []] as const;
          }
        })
      );

      setLogs(Object.fromEntries(logEntries));
      setLastUpdated(new Date());
    } catch {
      // silent — next poll will retry
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  // Live tracker values arrive over the socket. Patch just the affected game
  // log in place so the HP/points bars move without refetching every match.
  const applyTrackerUpdate = useCallback((p: TrackerUpdatePayload) => {
    setLogs(prev => {
      const existing = prev[p.matchId];
      // If this match is not currently on screen, ignore it; the coarse
      // tournament:updated signal (and the fallback poll) will pick it up.
      if (!existing) return prev;
      return {
        ...prev,
        [p.matchId]: existing.map(l =>
          l.gameNumber === p.gameNumber
            ? { ...l, player1Value: p.player1Value, player2Value: p.player2Value }
            : l,
        ),
      };
    });
    setLastUpdated(new Date());
  }, []);

  // Real-time updates. onTournamentUpdate triggers a full refetch; tracker
  // values are applied directly above.
  const { connected } = useTournamentSocket(tournamentId, {
    onTournamentUpdate: fetchAll,
    onTrackerUpdate: applyTrackerUpdate,
  });

  // temporary polling block
  // Polling is now a fallback behind the WebSocket connection: while the socket
  // is connected it drops to a slow 60s safety-net tick, and it returns to the
  // fast 4s rate the moment the socket disconnects — so a dropped socket
  // degrades to the old polling behaviour instead of a stale screen. The hook
  // also pauses while the tab is hidden, and the "enabled" flag stops polling
  // once the tournament is COMPLETED.
  usePolling(fetchAll, connected ? 60000 : POLL_INTERVAL, tournament?.status !== 'COMPLETED');
  // end of temporary polling block

  useEffect(() => {
    if (tournament?.name) {
      document.title = `Joust | ${tournament.name}`;
    }
  }, [tournament?.name]);

  // TV mode: hide nav chrome via body class
  useEffect(() => {
    if (tvMode) {
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [tvMode]);

  if (loading) {
    return (
      <div className={`min-h-screen bg-black flex items-center justify-center ${tvMode ? 'fixed inset-0 z-50' : ''}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60 animate-pulse">
            Loading Live View
          </span>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Tournament not found</span>
      </div>
    );
  }

  const winsNeeded = getWinsNeeded(tournament);
  const tName = tournament.name;

  // Flatten and search for focused match if requested
  const allMatches = rounds.flatMap(r => r.matches);
  const focusedMatch = allMatches.find(m => m.id === focusMatchId) ?? null;
  const matchLogs = focusMatchId ? logs[focusMatchId] ?? [] : [];
  const activeLog = matchLogs.find(l => l.trackerActive) ?? null;
  const completedLogs = matchLogs.filter(l => !l.trackerActive && l.completedAt);

  const p1Name = focusedMatch?.player1?.username || focusedMatch?.p1Name || 'TBD';
  const p2Name = focusedMatch?.player2?.username || focusedMatch?.p2Name || 'TBD';
  const p1Wins = focusedMatch?.player1Score ?? 0;
  const p2Wins = focusedMatch?.player2Score ?? 0;

  if (tvMode && focusMatchId && focusedMatch) {
    return (
      <div className="fixed inset-0 bg-black text-white z-50 flex flex-col justify-between p-8 md:p-12 overflow-hidden select-none font-poppins">
        {/* TV Overlay controls (exit TV, indicator) */}
        <TVOverlay
          tvMode={tvMode}
          onExitTV={() => router.push(`/tournaments/${tournamentId}/live?matchId=${focusMatchId}`)}
        />

        {/* 1. Header Banner */}
        <div className="w-full flex justify-between items-start border-b border-primary/20 pb-4">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-primary uppercase tracking-[0.4em] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#52b946]" />
              JOUST SPECS LIVE • FEED ACTIVE
            </span>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-wider text-white">
              {tName}
            </h1>
          </div>
          <div className="text-right flex flex-col gap-1">
            <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">
              ROUND {rounds.find(r => r.matches.some(m => m.id === focusMatchId))?.roundNumber || 1}
            </span>
            <span className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-sm">
              TV BROADCAST MODE
            </span>
            <ConnectionPill connected={connected} />
          </div>
        </div>

        {/* 2. Main Match Zone (centered content) */}
        <div className="flex-1 flex flex-col justify-center items-center gap-8 md:gap-12 my-6">
          {/* Scoreboard block */}
          <div className="w-full max-w-5xl flex items-center justify-between gap-8 md:gap-16">
            
            {/* Player 1 Details */}
            <div className="flex-1 text-right flex flex-col gap-2">
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white truncate italic">
                {p1Name}
              </h2>
              <div className="flex justify-end gap-1.5 mt-1">
                {Array.from({ length: winsNeeded }).map((_, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 border-2 border-white/20 transition-all duration-300"
                    style={{
                      backgroundColor: i < p1Wins ? '#52B946' : 'transparent',
                      borderColor: i < p1Wins ? '#52B946' : 'rgba(255,255,255,0.2)',
                      boxShadow: i < p1Wins ? '0 0 10px rgba(82,185,70,0.6)' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Scores Display */}
            <div className="flex items-center gap-6 md:gap-10 px-6 border-x border-white/10 py-2">
              <span className="text-8xl md:text-[11rem] font-black leading-none tabular-nums text-white">
                {p1Wins}
              </span>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-sm font-black text-white/20 uppercase tracking-[0.4em]">VS</span>
                <span className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/5 px-2 py-0.5 border border-primary/10">
                  BO{winsNeeded * 2 - 1}
                </span>
              </div>
              <span className="text-8xl md:text-[11rem] font-black leading-none tabular-nums text-white">
                {p2Wins}
              </span>
            </div>

            {/* Player 2 Details */}
            <div className="flex-1 text-left flex flex-col gap-2">
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white truncate italic">
                {p2Name}
              </h2>
              <div className="flex justify-start gap-1.5 mt-1">
                {Array.from({ length: winsNeeded }).map((_, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 border-2 border-white/20 transition-all duration-300"
                    style={{
                      backgroundColor: i < p2Wins ? '#52B946' : 'transparent',
                      borderColor: i < p2Wins ? '#52B946' : 'rgba(255,255,255,0.2)',
                      boxShadow: i < p2Wins ? '0 0 10px rgba(82,185,70,0.6)' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

          </div>

          {/* Active game tracking bar (massively scaled HP/Points) */}
          {activeLog ? (
            <div className="w-full max-w-5xl bg-white/3 border border-white/5 p-6 md:p-8 rounded-sm shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col gap-6 md:gap-8">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary animate-pulse">
                  ● GAME {activeLog.gameNumber} — LIVE STATUS
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                  TRACKING MODE: {activeLog.mode}
                </span>
              </div>

              {/* Progress bars containers */}
              <div className="grid grid-cols-2 gap-8 md:gap-16">
                
                {/* Player 1 hp/pts bar */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-black text-white/40 uppercase tracking-widest">{p1Name}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl md:text-5xl font-black text-white tabular-nums">{activeLog.player1Value}</span>
                      <span className="text-xs font-black text-white/20">/ {activeLog.startingValue}</span>
                    </div>
                  </div>
                  <div className="w-full h-7 bg-white/5 border border-white/10 relative overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500 shadow-[0_0_15px_rgba(82,185,70,0.4)]"
                      style={{ 
                        width: `${Math.min(activeLog.player1Value / activeLog.startingValue, 1) * 100}%`,
                        backgroundColor: activeLog.mode === 'HP' && (activeLog.player1Value / activeLog.startingValue) < 0.25 ? '#ef4444' : '#52B946'
                      }}
                    />
                  </div>
                </div>

                {/* Player 2 hp/pts bar */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between flex-row-reverse">
                    <span className="text-xs font-black text-white/40 uppercase tracking-widest">{p2Name}</span>
                    <div className="flex items-baseline gap-1 flex-row-reverse">
                      <span className="text-4xl md:text-5xl font-black text-white tabular-nums">{activeLog.player2Value}</span>
                      <span className="text-xs font-black text-white/20">/ {activeLog.startingValue}</span>
                    </div>
                  </div>
                  <div className="w-full h-7 bg-white/5 border border-white/10 relative overflow-hidden" style={{ direction: 'rtl' }}>
                    <div 
                      className="h-full bg-primary transition-all duration-500 shadow-[0_0_15px_rgba(82,185,70,0.4)]"
                      style={{ 
                        width: `${Math.min(activeLog.player2Value / activeLog.startingValue, 1) * 100}%`,
                        backgroundColor: activeLog.mode === 'HP' && (activeLog.player2Value / activeLog.startingValue) < 0.25 ? '#ef4444' : '#52B946'
                      }}
                    />
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="w-full max-w-5xl py-12 border border-dashed border-white/10 flex flex-col items-center justify-center gap-2">
              <span className="text-xs font-black uppercase tracking-[0.4em] text-white/30 animate-pulse">
                {matchLogs.length > 0 ? `GAME ${matchLogs.length + 1} — AWAITING START` : 'STANDBY MODE'}
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/15">
                The organizer has not started live tracking for this match yet
              </span>
            </div>
          )}
        </div>

        {/* 3. Footer Bar */}
        <div className="w-full flex flex-col md:flex-row justify-between items-center border-t border-white/5 pt-4 gap-4">
          
          {/* Game history pills */}
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">SERIES LOGS:</span>
            {completedLogs.length > 0 ? (
              <div className="flex gap-2">
                {completedLogs.map(log => {
                  const p1Won = log.winnerId === focusedMatch.player1?.id;
                  const p2Won = log.winnerId === focusedMatch.player2?.id;
                  return (
                    <div 
                      key={log.id}
                      className={`border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                        p1Won ? 'border-primary text-primary bg-primary/5' : p2Won ? 'border-white/20 text-white/40' : 'border-white/10 text-white/20'
                      }`}
                    >
                      G{log.gameNumber} {p1Won ? p1Name.slice(0, 3) : p2Won ? p2Name.slice(0, 3) : 'DRAW'} ({log.player1Value}—{log.player2Value})
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-[10px] font-black text-white/10 uppercase tracking-widest">NO COMPLETED GAMES RECORDED</span>
            )}
          </div>

          {/* Clock or Technical data */}
          <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] flex items-center gap-2">
            <span>CONNECTION ACTIVE</span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>{lastUpdated?.toLocaleTimeString()}</span>
          </div>

        </div>

      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-black text-white ${tvMode ? 'fixed inset-0 overflow-auto z-50' : ''}`}>

      {/* TV overlay (controls fade, fullscreen) */}
      <TVOverlay
        tvMode={tvMode}
        onExitTV={() => router.push(`/tournaments/${tournamentId}/live${focusMatchId ? `?matchId=${focusMatchId}` : ''}`)}
      />

      {/* Page header */}
      {!tvMode && (
        <div className="sticky top-0 z-10 bg-black/95 border-b border-white/5 px-6 py-4 flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <Link
              href={`/tournaments/${tournamentId}/bracket`}
              className="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-white transition-all"
            >
              ← Bracket
            </Link>
            <div className="w-px h-4 bg-white/10" />
            <div>
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-primary/70 block">Live View</span>
              <span className="text-sm font-black uppercase tracking-wider text-white">{tName}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="text-[8px] font-black uppercase tracking-widest text-white/20">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Link
              href={`/tournaments/${tournamentId}/live?tv=true${focusMatchId ? `&matchId=${focusMatchId}` : ''}`}
              className="px-3 py-2 border border-white/10 hover:border-primary text-[9px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-primary transition-all"
            >
              ⊞ TV Mode
            </Link>
          </div>
        </div>
      )}

      {/* TV header (minimal) */}
      {tvMode && (
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#52b946]" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary/80">{tName} — Live</span>
          </div>
        </div>
      )}

      {/* Match grid */}
      <div className={`${tvMode ? 'px-8 pb-8' : 'px-6 py-8'}`}>
        <LiveMatchGrid
          rounds={rounds}
          logs={logs}
          winsNeeded={winsNeeded}
          tvMode={tvMode}
          focusMatchId={focusMatchId}
        />
      </div>
    </div>
  );
}
