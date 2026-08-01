'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MatchGameLog, GameTrackingMode, FormatConfig } from '../../../../tournaments/types';
import { Match } from '../../../../tournaments/[id]/bracket/types';
import { authenticatedFetch, safeJson, API_ENDPOINTS } from '../../../../utils/api';
import { usePolling } from '../../../../utils/usePolling';
import { useTournamentSocket, TrackerUpdatePayload } from '../../../../utils/useTournamentSocket';
import ConnectionPill from '../../../ui/ConnectionPill';
import LastUpdated from '../../../ui/LastUpdated';
import GameBar from './GameBar';
import GameSeriesScore from './GameSeriesScore';
import PlayerToolkit from './PlayerToolkit';
import { canOfferDraw } from '../../../../utils/formatConfig';

interface TrackerPanelProps {
  match: Match;
  formatConfig: FormatConfig;
  /** Tournament system. Required to decide whether a draw is safe here — a
   *  drawn result stalls or corrupts an elimination bracket. */
  system?: string;
  isAdmin: boolean;
  currentUserId?: string;
  // Needed to subscribe to this tournament's real-time updates so the HP/points
  // bars move live. When absent (older callers) the panel falls back to polling.
  tournamentId?: string;
  onMatchUpdated?: () => void;
}

type ConfirmState = { type: 'winner'; winnerId: string } | { type: 'draw' } | null;

export default function TrackerPanel({ match, formatConfig, system, isAdmin, currentUserId, tournamentId, onMatchUpdated }: TrackerPanelProps) {
  const [logs, setLogs] = useState<MatchGameLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // When the log list was last fetched. Live scoring is the screen where acting
  // on stale values does real damage, so the age has to be visible.
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [error, setError] = useState<string | null>(null);
  const prevCompletedCount = useRef<number>(-1);

  const bestOf = formatConfig?.bestOf ?? 1;
  const winsNeeded = Math.ceil(bestOf / 2);
  const trackingMode: GameTrackingMode = formatConfig?.startingHp ? 'HP' : 'POINTS';
  const defaultStartingValue = formatConfig?.startingHp 
    ? formatConfig.startingHp 
    : (formatConfig?.pointsThreshold ? formatConfig.pointsThreshold : winsNeeded);

  const hasPointsOrHp = !!(formatConfig?.startingHp || formatConfig?.pointsThreshold);

  const activeLog = logs.find(l => l.trackerActive) ?? null;
  const p1Wins = match.player1Score ?? 0;
  const p2Wins = match.player2Score ?? 0;
  const p1Name = match.player1?.username || match.p1Name || 'Player 1';
  const p2Name = match.player2?.username || match.p2Name || 'Player 2';

  const isPlayerInMatch = currentUserId === match.player1?.id || currentUserId === match.player2?.id || currentUserId === match.player1Id || currentUserId === match.player2Id;
  const canManipulate = isAdmin || isPlayerInMatch;
  const canAdjustP1 = isAdmin || (isPlayerInMatch && (currentUserId === match.player1?.id || currentUserId === match.player1Id));
  const canAdjustP2 = isAdmin || (isPlayerInMatch && (currentUserId === match.player2?.id || currentUserId === match.player2Id));

  // Derive dynamic adjustment steps based on starting value
  const getSteps = (val: number) => {
    if (val > 20000) return { large: 10000, small: 1000 };
    if (val > 2000) return { large: 1000, small: 100 };
    if (val > 200) return { large: 100, small: 10 };
    if (val > 20) return { large: 10, small: 1 };
    if (val > 5) return { large: 5, small: 1 };
    return { large: 2, small: 1 };
  };
  const steps = activeLog ? getSteps(activeLog.startingValue) : { large: 10, small: 1 };

  const fetchLogs = useCallback(async () => {
    try {
      // Uses the shared authenticatedFetch instead of a local copy of
      // the base-URL logic, so URL handling stays in one place.
      const res = await authenticatedFetch(API_ENDPOINTS.MATCHES.TRACKER_GET(match.id));
      if (res.ok) {
        const data = await res.json();
        const newLogs = Array.isArray(data) ? data : [];
        setLogs(newLogs);
        setLastUpdated(new Date());

        const completedCount = newLogs.filter((l: any) => l.completedAt).length;
        if (prevCompletedCount.current !== -1 && completedCount > prevCompletedCount.current) {
          onMatchUpdated?.();
        }
        prevCompletedCount.current = completedCount;
      }
    } catch { /* silent — poll will retry */ }
    finally { setIsLoading(false); }
  }, [match.id]);

  const seriesOver = !!match.winnerId;

  // Live tracker values arrive over the socket. Patch the active game log's
  // values directly so the HP/points bars move without a refetch. Only apply
  // updates for this match; other matches' updates are ignored here.
  const applyTrackerUpdate = useCallback((p: TrackerUpdatePayload) => {
    if (p.matchId !== match.id) return;
    setLogs(prev =>
      prev.map(l =>
        l.gameNumber === p.gameNumber
          ? { ...l, player1Value: p.player1Value, player2Value: p.player2Value }
          : l,
      ),
    );
  }, [match.id]);

  // A game opening or closing changes the log list (new game, series score),
  // which the payload does not carry, so refetch the logs on the coarse signal.
  const { connected } = useTournamentSocket(tournamentId, {
    onTournamentUpdate: fetchLogs,
    onTrackerUpdate: applyTrackerUpdate,
  });

  // temporary polling block - fallback behind the WebSocket connection
  // Uses the shared usePolling hook so this poll also pauses while the browser
  // tab is hidden. While the socket is connected it drops to a slow 60s
  // safety-net tick (the socket drives the live values); it returns to the fast
  // 4s rate when the socket drops. For a finished match (winner already set)
  // the logs cannot change anymore, so fetch them once instead of polling. Bye
  // matches have no tracker at all, so they never fetch.
  usePolling(fetchLogs, connected ? 60000 : 4000, !match.isBye && !seriesOver);
  useEffect(() => {
    if (!match.isBye && seriesOver) fetchLogs();
  }, [match.isBye, seriesOver, fetchLogs]);
  // end of temporary polling block

  // Bye matches: no tracker. This check used to sit above the hooks,
  // which breaks React's rule that hooks must run on every render in
  // the same order — so it was moved below them.
  if (match.isBye) return null;

  // ── Admin actions ─────────────────────────────────────────────────────────────

  const handleOpenTracker = async () => {
    if (!isAdmin) return;
    setIsUpdating(true); setError(null);
    const res = await authenticatedFetch(API_ENDPOINTS.MATCHES.TRACKER_OPEN(match.id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), // mode + startingValue are auto-derived from format config on the server
    });
    if (!res.ok) {
      const d = await safeJson(res);
      setError(d?.message ?? 'Failed to open tracker');
    }
    setIsUpdating(false);
    fetchLogs();
  };

  const handleUpdateValue = async (player: 1 | 2, delta: number) => {
    if (!activeLog || !canManipulate) return;
    if (!isAdmin) {
      if (player === 1 && !canAdjustP1) return;
      if (player === 2 && !canAdjustP2) return;
    }
    const key = player === 1 ? 'player1Value' : 'player2Value';
    const current = player === 1 ? activeLog.player1Value : activeLog.player2Value;
    const next = Math.max(0, current + delta);

    setIsUpdating(true);
    const res = await authenticatedFetch(API_ENDPOINTS.MATCHES.TRACKER_UPDATE(match.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: next }),
    });
    setIsUpdating(false);
    fetchLogs();

    if (res.ok) {
      if (isAdmin) {
        if (activeLog.mode === 'HP' && next === 0) {
          // HP hits 0 → other player wins
          const otherVal = player === 1 ? activeLog.player2Value : activeLog.player1Value;
          if (otherVal > 0) {
            const otherPlayerId = player === 1 ? match.player2?.id : match.player1?.id;
            if (otherPlayerId) setConfirmState({ type: 'winner', winnerId: otherPlayerId });
          }
        } else if (activeLog.mode === 'POINTS' && formatConfig?.pointsThreshold) {
          // Points reaches threshold → that player wins
          if (next >= formatConfig.pointsThreshold) {
            const winnerId = player === 1 ? match.player1?.id : match.player2?.id;
            if (winnerId) setConfirmState({ type: 'winner', winnerId });
          }
        }
      }
    }
  };

  const handleSetValue = async (player: 1 | 2, value: number) => {
    if (!activeLog || !canManipulate) return;
    if (!isAdmin) {
      if (player === 1 && !canAdjustP1) return;
      if (player === 2 && !canAdjustP2) return;
    }
    const key = player === 1 ? 'player1Value' : 'player2Value';
    const clamped = Math.max(0, value);
    setIsUpdating(true);
    const res = await authenticatedFetch(API_ENDPOINTS.MATCHES.TRACKER_UPDATE(match.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: clamped }),
    });
    setIsUpdating(false);
    fetchLogs();

    if (res.ok) {
      if (isAdmin) {
        if (activeLog.mode === 'HP' && clamped === 0) {
          // HP hits 0 → other player wins
          const otherVal = player === 1 ? activeLog.player2Value : activeLog.player1Value;
          if (otherVal > 0) {
            const otherPlayerId = player === 1 ? match.player2?.id : match.player1?.id;
            if (otherPlayerId) setConfirmState({ type: 'winner', winnerId: otherPlayerId });
          }
        } else if (activeLog.mode === 'POINTS' && formatConfig?.pointsThreshold) {
          // Points reaches threshold → that player wins
          if (clamped >= formatConfig.pointsThreshold) {
            const winnerId = player === 1 ? match.player1?.id : match.player2?.id;
            if (winnerId) setConfirmState({ type: 'winner', winnerId });
          }
        }
      }
    }
  };

  const handleConfirmSubmit = async () => {
    if (!confirmState) return;
    setIsUpdating(true); setError(null);
    const body = confirmState.type === 'winner'
      ? { winnerId: confirmState.winnerId }
      : {};
    const res = await authenticatedFetch(API_ENDPOINTS.MATCHES.TRACKER_SUBMIT(match.id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await safeJson(res);
      setError(d?.message ?? 'Submit failed');
    }
    setConfirmState(null);
    setIsUpdating(false);
    fetchLogs();
    onMatchUpdated?.();
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const winsNeededForSeries = Math.ceil(bestOf / 2);

  if (!canManipulate) {
    return (
      <div className="flex flex-col gap-8 py-2 font-poppins select-none text-white">
        {/* Pulsing indicator */}
        <div className="flex items-center justify-between border-b border-primary/10 pb-3">
          <span className="text-[9px] font-black text-primary uppercase tracking-[0.4em] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#52b946]" />
            JOUST SPECTATOR FEED • STREAM ACTIVE
          </span>
          {/* This previously read a hardcoded "CONNECTION STABLE", which claimed
              a healthy connection even while the socket was down. It now reports
              the real state. */}
          <span className="flex items-center gap-3">
            <LastUpdated lastUpdated={lastUpdated} />
            <ConnectionPill connected={connected} />
          </span>
        </div>

        {/* Series Scoreboard (TV style) */}
        <div className="flex items-center justify-between gap-6 py-4">
          {/* Player 1 details */}
          <div className="flex-1 text-right flex flex-col gap-1.5 min-w-0">
            <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white truncate italic">
              {p1Name}
            </h3>
            <div className="flex justify-end gap-1">
              {Array.from({ length: winsNeededForSeries }).map((_, i) => (
                <div
                  key={i}
                  className="w-3.5 h-3.5 border border-white/20 transition-all duration-300"
                  style={{
                    backgroundColor: i < p1Wins ? '#52B946' : 'transparent',
                    borderColor: i < p1Wins ? '#52B946' : 'rgba(255,255,255,0.2)',
                    boxShadow: i < p1Wins ? '0 0 8px rgba(82,185,70,0.5)' : 'none',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Scores & BO Info */}
          <div className="flex items-center gap-4 px-4 border-x border-white/10 py-1">
            <span className="text-4xl md:text-5xl font-black leading-none tabular-nums text-white">
              {p1Wins}
            </span>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">VS</span>
              <span className="text-[8px] font-black text-primary uppercase tracking-widest bg-primary/5 px-1.5 py-0.5 border border-primary/15">
                BO{bestOf}
              </span>
            </div>
            <span className="text-4xl md:text-5xl font-black leading-none tabular-nums text-white">
              {p2Wins}
            </span>
          </div>

          {/* Player 2 details */}
          <div className="flex-1 text-left flex flex-col gap-1.5 min-w-0">
            <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white truncate italic">
              {p2Name}
            </h3>
            <div className="flex justify-start gap-1">
              {Array.from({ length: winsNeededForSeries }).map((_, i) => (
                <div
                  key={i}
                  className="w-3.5 h-3.5 border border-white/20 transition-all duration-300"
                  style={{
                    backgroundColor: i < p2Wins ? '#52B946' : 'transparent',
                    borderColor: i < p2Wins ? '#52B946' : 'rgba(255,255,255,0.2)',
                    boxShadow: i < p2Wins ? '0 0 8px rgba(82,185,70,0.5)' : 'none',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Active game tracker */}
        {activeLog ? (
          <div className="w-full bg-white/3 border border-primary/20 p-5 rounded-sm shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-primary animate-pulse">
                ● GAME {activeLog.gameNumber} — LIVE STATUS
              </span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">
                MODE: {activeLog.mode}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Player 1 hp/pts bar */}
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest truncate max-w-[120px]">{p1Name}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl md:text-3xl font-black text-white tabular-nums">{activeLog.player1Value}</span>
                  </div>
                </div>
                <div className="w-full h-5 bg-white/5 border border-white/10 relative overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500 shadow-[0_0_10px_rgba(82,185,70,0.4)]"
                    style={{ 
                      width: `${Math.min(activeLog.player1Value / activeLog.startingValue, 1) * 100}%`,
                      backgroundColor: activeLog.mode === 'HP' && (activeLog.player1Value / activeLog.startingValue) < 0.25 ? '#ef4444' : '#52B946'
                    }}
                  />
                </div>
              </div>

              {/* Player 2 hp/pts bar */}
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between flex-row-reverse">
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest truncate max-w-[120px]">{p2Name}</span>
                  <div className="flex items-baseline gap-1 flex-row-reverse">
                    <span className="text-2xl md:text-3xl font-black text-white tabular-nums">{activeLog.player2Value}</span>
                  </div>
                </div>
                <div className="w-full h-5 bg-white/5 border border-white/10 relative overflow-hidden" style={{ direction: 'rtl' }}>
                  <div 
                    className="h-full bg-primary transition-all duration-500 shadow-[0_0_10px_rgba(82,185,70,0.4)]"
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
          <div className="w-full py-8 border border-dashed border-white/10 flex flex-col items-center justify-center gap-1 bg-white/5">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 animate-pulse">
              {logs.length > 0 ? `GAME ${logs.length + 1} — AWAITING START` : 'NOT STARTED'}
            </span>
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/10">
              ORGANIZER HAS NOT YET STARTED ACTIVE TRACKER
            </span>
          </div>
        )}

        {/* History Pills */}
        {logs.filter(l => !l.trackerActive && l.completedAt).length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">SERIES LOGS:</span>
            <div className="flex flex-wrap gap-2">
              {logs.filter(l => !l.trackerActive && l.completedAt).map(log => {
                const p1Won = log.winnerId === match.player1?.id;
                const p2Won = log.winnerId === match.player2?.id;
                return (
                  <div 
                    key={log.id}
                    className={`border px-3 py-1 text-[9px] font-black uppercase tracking-wider transition-all ${
                      p1Won ? 'border-primary text-primary bg-primary/5' : p2Won ? 'border-white/20 text-white/40' : 'border-white/10 text-white/20'
                    }`}
                  >
                    G{log.gameNumber} {p1Won ? p1Name.slice(0, 3) : p2Won ? p2Name.slice(0, 3) : 'DRAW'} ({log.player1Value}—{log.player2Value})
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Connection state for the person actually entering scores. Without it a
          dropped socket is invisible here, and the organizer can be typing into
          a view that stopped updating minutes ago. */}
      <div className="flex items-center justify-end gap-3">
        <LastUpdated lastUpdated={lastUpdated} />
        <ConnectionPill connected={connected} />
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-red-500/10 border border-red-500/30 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-red-400"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game series scoreboard */}
      <GameSeriesScore
        player1Wins={p1Wins}
        player2Wins={p2Wins}
        winsNeeded={winsNeeded}
        player1Name={p1Name}
        player2Name={p2Name}
      />

      {/* Past games recap */}
      {logs.filter(l => !l.trackerActive && l.completedAt).length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-1">
            Game History
          </span>
          {logs.filter(l => !l.trackerActive && l.completedAt).map(log => (
            <div key={log.id} className="flex items-center justify-between bg-white/3 border border-white/5 px-3 py-2">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-wider">Game {log.gameNumber}</span>
              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-wider">
                <span className={log.winnerId === match.player1?.id ? 'text-primary' : 'text-white/20'}>
                  {log.player1Value}
                </span>
                <span className="text-white/10">—</span>
                <span className={log.winnerId === match.player2?.id ? 'text-primary' : 'text-white/20'}>
                  {log.player2Value}
                </span>
                {!log.winnerId && <span className="text-white/30">DRAW</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4">
        {/* Match Utilities Toolkit - always accessible */}
        <PlayerToolkit />
      </div>

      {/* Active game tracker */}
      {activeLog ? (
        <div className="flex flex-col gap-4 border border-primary/20 p-4 bg-primary/3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-primary">
              ● Game {activeLog.gameNumber} — Live
            </span>
            {hasPointsOrHp && (
              <span className="text-[9px] font-black uppercase tracking-wider text-white/20">
                {activeLog.mode}
              </span>
            )}
          </div>


          {/* Player point trackers - rendered side-by-side on PC and stacked on mobile */}
          {hasPointsOrHp && (
            <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-stretch">
            {/* Player 1 details */}
            <div className="flex-1 flex flex-col gap-2">
              <GameBar
                mode={activeLog.mode}
                currentValue={activeLog.player1Value}
                maxValue={activeLog.startingValue}
                label={p1Name}
                side="left"
                isUpdating={isUpdating}
              />
              {canAdjustP1 && (
                <div className="flex items-center gap-2">
                  <AdjustButton label={`−${steps.large}`} onClick={() => handleUpdateValue(1, -steps.large)} />
                  <AdjustButton label={`−${steps.small}`} onClick={() => handleUpdateValue(1, -steps.small)} />
                  <AdjustButton label={`+${steps.small}`} onClick={() => handleUpdateValue(1, steps.small)} />
                  <AdjustButton label={`+${steps.large}`} onClick={() => handleUpdateValue(1, steps.large)} />
                  <ManualInput value={activeLog.player1Value} onSet={(v) => handleSetValue(1, v)} />
                </div>
              )}
            </div>

            {/* Dividers */}
            <div className="h-px bg-white/5 w-full md:hidden" />
            <div className="w-px bg-white/5 self-stretch hidden md:block" />

            {/* Player 2 details */}
            <div className="flex-1 flex flex-col gap-2">
              <GameBar
                mode={activeLog.mode}
                currentValue={activeLog.player2Value}
                maxValue={activeLog.startingValue}
                label={p2Name}
                side="right"
                isUpdating={isUpdating}
              />
              {canAdjustP2 && (
                <div className="flex items-center gap-2 justify-end">
                  <ManualInput value={activeLog.player2Value} onSet={(v) => handleSetValue(2, v)} />
                  <AdjustButton label={`−${steps.large}`} onClick={() => handleUpdateValue(2, -steps.large)} />
                  <AdjustButton label={`−${steps.small}`} onClick={() => handleUpdateValue(2, -steps.small)} />
                  <AdjustButton label={`+${steps.small}`} onClick={() => handleUpdateValue(2, steps.small)} />
                  <AdjustButton label={`+${steps.large}`} onClick={() => handleUpdateValue(2, steps.large)} />
                </div>
              )}
            </div>
          </div>
          )}

          {/* Submit game result (admin only) */}
          {isAdmin && (
            <div className="flex flex-col gap-2 pt-2 border-t border-white/5 mt-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Submit Game Result</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmState({ type: 'winner', winnerId: match.player1?.id ?? '' })}
                  disabled={!match.player1 || isUpdating}
                  className="flex-1 py-3 bg-white/5 border border-white/10 hover:border-primary text-[10px] font-black uppercase tracking-widest text-white hover:text-primary transition-all disabled:opacity-30"
                >
                  {p1Name} Wins
                </button>
                <button
                  onClick={() => setConfirmState({ type: 'winner', winnerId: match.player2?.id ?? '' })}
                  disabled={!match.player2 || isUpdating}
                  className="flex-1 py-3 bg-white/5 border border-white/10 hover:border-primary text-[10px] font-black uppercase tracking-widest text-white hover:text-primary transition-all disabled:opacity-30"
                >
                  {p2Name} Wins
                </button>
                {/* The system check is the point: on an elimination bracket a
                    drawn result stalls (SE) or silently drops player 1 into the
                    losers bracket (DE), so the control must not exist there even
                    when allowDraw is set. See canOfferDraw. */}
                {canOfferDraw({ system, config: formatConfig, phase: match.phase }) && (
                  <button
                    onClick={() => setConfirmState({ type: 'draw' })}
                    disabled={isUpdating}
                    className="px-4 py-3 bg-white/5 border border-white/10 hover:border-white/30 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white/60 transition-all"
                  >
                    Draw
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Player notice banner */}
          {!isAdmin && isPlayerInMatch && hasPointsOrHp && (
            <div className="mt-2 p-3 bg-white/5 border border-white/10 text-center flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-primary animate-pulse">
                Live Match Editor
              </span>
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/40">
                You may adjust your values. Organizer has final submission rights.
              </span>
              {((activeLog.mode === 'HP' && (activeLog.player1Value === 0 || activeLog.player2Value === 0)) || 
                (activeLog.mode === 'POINTS' && formatConfig?.pointsThreshold && (activeLog.player1Value >= formatConfig.pointsThreshold || activeLog.player2Value >= formatConfig.pointsThreshold))) && (
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 mt-2">
                  Threshold Met — Awaiting Organizer Verification
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        /* No active log — either all games done, or tracker not yet opened */
        <div className="flex flex-col items-center gap-4 py-6 border border-dashed border-white/10">
          {(() => {
            const seriesDecided = p1Wins >= winsNeededForSeries || p2Wins >= winsNeededForSeries;
            if (match.winnerId || seriesDecided) {
              return (
                <span className="text-[10px] font-black uppercase tracking-widest text-white/30">
                  {seriesDecided
                    ? `${p1Wins >= winsNeededForSeries ? p1Name : p2Name} has won the series`
                    : 'Match Complete'}
                </span>
              );
            }
            if (isAdmin && match.status === 'ONGOING') {
              return (
                <>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/30">
                    Game {logs.length + 1} — Not started
                  </span>
                  <button
                    onClick={handleOpenTracker}
                    disabled={isUpdating}
                    className="px-6 py-3 bg-primary text-black text-[10px] font-black uppercase tracking-[0.3em] hover:bg-primary/80 transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(82,185,70,0.2)]"
                  >
                    {isUpdating ? 'Starting…' : `▶ Start Game ${logs.length + 1}`}
                  </button>
                </>
              );
            }
            return (
              <span className="text-[10px] font-black uppercase tracking-widest text-white/20">
                Waiting for organizer to start game
              </span>
            );
          })()}
        </div>
      )}

      {/* Confirmation modal */}
      <AnimatePresence>
        {confirmState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-black border border-white/10 p-8 max-w-sm w-full mx-4 flex flex-col gap-6"
            >
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-primary block mb-2">Confirm Result</span>
                <p className="text-white font-black uppercase text-sm tracking-wider">
                  {confirmState.type === 'draw'
                    ? 'Mark this game as a draw?'
                    : `Mark ${confirmState.winnerId === match.player1?.id ? p1Name : p2Name
                    } as the winner of Game ${activeLog?.gameNumber}?`
                  }
                </p>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mt-2">This action cannot be undone.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmState(null)}
                  className="flex-1 py-3 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:border-white/30 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSubmit}
                  disabled={isUpdating}
                  className="flex-1 py-3 bg-primary text-black text-[10px] font-black uppercase tracking-[0.3em] hover:bg-primary/80 transition-all disabled:opacity-50"
                >
                  {isUpdating ? 'Submitting…' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function AdjustButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2 min-w-[2.5rem] h-8 bg-white/5 border border-white/10 hover:border-primary hover:text-primary text-white/60 text-[10px] font-black uppercase tracking-wider transition-all"
    >
      {label}
    </button>
  );
}

function ManualInput({ value, onSet }: { value: number; onSet: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => setLocal(String(value)), [value]);
  return (
    <input
      type="number"
      value={local}
      min={0}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => {
        const parsed = parseInt(local, 10);
        if (!isNaN(parsed)) onSet(parsed);
        else setLocal(String(value));
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          const parsed = parseInt(local, 10);
          if (!isNaN(parsed)) onSet(parsed);
        }
      }}
      className="w-16 h-8 bg-black border border-white/10 focus:border-primary text-white text-xs font-black text-center outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}
