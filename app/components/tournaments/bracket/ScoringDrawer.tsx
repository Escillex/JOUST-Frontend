"use client";
import { SkeletonPanel } from "../../ui/Skeleton";
import dynamic from "next/dynamic";
import { useState, useEffect } from 'react';
import { Match } from '../../../tournaments/[id]/bracket/types';
import { FormatConfig } from '../../../tournaments/types';
// Lazy-loaded: TrackerPanel is the largest component in the bracket tree and
// is only reachable once an organizer opens the scoring drawer, so it does not
// belong in the initial bundle.
const TrackerPanel = dynamic(() => import('./tracker/TrackerPanel'), {
  ssr: false,
  loading: () => <SkeletonPanel rows={4} />,
});
import GameSeriesScore from './tracker/GameSeriesScore';
import { authenticatedFetch, safeJson, API_ENDPOINTS } from '../../../utils/api';
import { canOfferDraw } from '../../../utils/formatConfig';

interface Props {
  match: Match | null;
  formatConfig?: FormatConfig;
  onClose: () => void;
  onScore: (winnerId: string | null) => void;
  isAdmin?: boolean;
  /** Real-ADMIN-only debug mode: shows a one-tap insta-win that force-completes
   *  the match (skipping start + tracker). The parent only ever passes this true
   *  for a platform admin with debug mode on, so this component need not re-check
   *  the role. */
  debugMode?: boolean;
  currentUserId?: string;
  onMatchUpdated?: () => void;
  tournamentId?: string;
  tournamentStatus?: string;
  /** Tournament system. Required to decide whether a draw is safe to offer at
   *  all — see canOfferDraw. */
  system?: string;
}

type DrawerMode = 'quick' | 'tracker';

export default function ScoringDrawer({
  match,
  formatConfig,
  onClose,
  onScore,
  isAdmin = false,
  debugMode = false,
  currentUserId,
  onMatchUpdated,
  tournamentId,
  tournamentStatus,
  system
}: Props) {
  const hasTrackerCapability = !!(match && !match.isBye);
  const [mode, setMode] = useState<DrawerMode>(hasTrackerCapability ? 'tracker' : 'quick');
  const [isSubmittingGame, setIsSubmittingGame] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const [isStartingMatch, setIsStartingMatch] = useState(false);

  // A match is PENDING until the organizer starts it (nothing auto-activates any
  // more). The tracker can only open on an ONGOING match, so a PENDING one must be
  // started first — this is the call that does it and notifies both players.
  const handleStartMatch = async () => {
    if (!match || isStartingMatch) return;
    setIsStartingMatch(true);
    setGameError(null);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.MATCHES.START(match.id), { method: 'POST' });
      if (res.ok) { onMatchUpdated?.(); }
      else { const d = await safeJson(res); setGameError(d?.message || 'Failed to start match'); }
    } finally {
      setIsStartingMatch(false);
    }
  };

  useEffect(() => {
    if (hasTrackerCapability && mode !== 'tracker') {
      setMode('tracker');
    }
  }, [hasTrackerCapability]);

  if (!match) return null;

  const p1Name = match.player1?.username || match.p1Name || 'TBD';
  const p2Name = match.player2?.username || match.p2Name || 'TBD';
  const bestOf = formatConfig?.bestOf ?? 1;
  const winsNeeded = Math.ceil(bestOf / 2);
  const p1Score = match.player1Score ?? 0;
  const p2Score = match.player2Score ?? 0;
  const seriesComplete = (p1Score >= winsNeeded || p2Score >= winsNeeded || !!match.winnerId || match.status === 'COMPLETED');
  // A draw is COMPLETED with no winner. Checked before any winner lookup below,
  // because the final `winnerId === player1` comparison is false for a draw and
  // would otherwise announce player 2 as the winner of a match nobody won.
  const isDraw = match.status === 'COMPLETED' && !match.winnerId && !match.isBye;
  const seriesWinnerName = seriesComplete && !isDraw
    ? (p1Score >= winsNeeded ? p1Name : p2Score >= winsNeeded ? p2Name : (match.winnerId === match.player1?.id ? p1Name : p2Name))
    : null;

  const handleRecordGameWin = async (playerId: string) => {
    if (isSubmittingGame || seriesComplete) return;
    setIsSubmittingGame(true);
    setGameError(null);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.MATCHES.GAME_RESULT(match.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameWinnerId: playerId }),
      });
      const data = await safeJson(res);
      if (res.ok) {
        onMatchUpdated?.();
      } else {
        setGameError(data?.message || 'Failed to record game win');
      }
    } catch (err) {
      setGameError('Network error recording game win');
    } finally {
      setIsSubmittingGame(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-300 pointer-events-auto">
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />
      <div className="w-full max-w-3xl bg-black border border-primary/20 shadow-[0_0_50px_rgba(82,185,70,0.15)] relative flex flex-col pointer-events-auto animate-in zoom-in-95 duration-200 rounded-sm overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className="px-8 pt-8 pb-0 flex-shrink-0">
          <button onClick={onClose} className="absolute top-6 right-6 text-white/20 hover:text-white transition-all font-black text-xl">✕</button>
          <span className="text-[9px] font-black text-primary uppercase tracking-[0.5em] block mb-1">Score This Match</span>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Match Result</h2>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1">
            {p1Name} <span className="text-white/15">vs</span> {p2Name}
          </p>

          {tournamentId && (tournamentStatus === 'ONGOING' || tournamentStatus === 'COMPLETED') && (
            <div className="mt-3">
              <a
                href={`/tournaments/${tournamentId}/live?tv=true&matchId=${match.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 border border-primary/20 bg-primary/5 hover:bg-primary/15 text-primary text-[9px] font-black uppercase tracking-widest transition-all rounded-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#52b946]" />
                Live Spectator Feed (TV)
              </a>
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-8 py-6">

          {/* ── START GATE ─────────────────────────────────────────────────── */}
          {isAdmin && match.status === 'PENDING' && !match.isBye &&
            (match.player1Id || match.player1?.id) && (match.player2Id || match.player2?.id) && (
            <div className="mb-6 p-4 bg-primary/5 border border-primary/30 rounded-sm flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Match not started</p>
                <p className="text-[11px] text-white/40 mt-1">Start the match to make it live and notify both players before scoring.</p>
              </div>
              <button
                onClick={handleStartMatch}
                disabled={isStartingMatch}
                className="px-5 py-2.5 bg-primary text-black text-[10px] font-black uppercase tracking-widest rounded-sm hover:brightness-90 transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {isStartingMatch ? 'Starting…' : 'Start Match'}
              </button>
            </div>
          )}

          {/* Debug insta-win — real-ADMIN-only (parent gates the prop). Placed
              above the mode branches so it shows whether the drawer is in tracker
              or quick mode. Skips match-start and the tracker entirely: a direct
              winnerId force-completes the match on the backend regardless of
              best-of or PENDING/ONGOING status. Amber-marked so it is never
              mistaken for a real, played result. */}
          {debugMode && !match.winnerId && (match.player1 || match.player2) && (
            <div className="mb-6 bg-amber-500/5 border border-amber-500/30 p-4 space-y-3">
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-[0.2em] block">Debug · Insta-Win (skips start &amp; tracker)</span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onScore(match.player1?.id || null)}
                  disabled={!match.player1}
                  className="py-3 bg-amber-500/10 border border-amber-500/40 hover:bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase tracking-widest rounded-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Win: {p1Name}
                </button>
                <button
                  onClick={() => onScore(match.player2?.id || null)}
                  disabled={!match.player2}
                  className="py-3 bg-amber-500/10 border border-amber-500/40 hover:bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase tracking-widest rounded-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Win: {p2Name}
                </button>
              </div>
            </div>
          )}

          {/* ── TRACKER MODE ───────────────────────────────────────────────── */}
          {mode === 'tracker' && hasTrackerCapability ? (
            <div className="flex flex-col gap-4">
              {/* Match won banner — replaces auto-close */}
              {match.winnerId && (
                <div className="bg-primary/10 border border-primary/30 p-6 flex flex-col items-center gap-4 text-center animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-primary uppercase tracking-[0.4em] block">Match Complete</span>
                    <p className="text-xl font-black text-white uppercase tracking-tight">
                      {match.winnerId === match.player1?.id ? p1Name : p2Name} Wins
                    </p>
                    <p className="text-[9px] text-white/30 uppercase tracking-widest">
                      Series: {p1Score} — {p2Score}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="mt-2 px-8 py-3 bg-white/5 border border-white/10 hover:border-primary hover:bg-primary/10 hover:text-primary text-white/60 text-[10px] font-black uppercase tracking-[0.3em] transition-all rounded-sm"
                  >
                    Close Window
                  </button>
                </div>
              )}
              <TrackerPanel
                match={match}
                formatConfig={formatConfig ?? {}}
                system={system}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                tournamentId={tournamentId}
                onMatchUpdated={() => onMatchUpdated?.()}
              />
            </div>
          ) : (

            /* ── QUICK SCORE MODE / SPECTATOR FALLBACK ──────────────────────── */
            <div className="space-y-4">
              {mode === 'tracker' && !hasTrackerCapability && (
                <div className="mb-4 p-3 bg-white/3 border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/30 text-center">
                  {match.winnerId ? 'Match already completed' : `${formatConfig?.startingHp ? 'HP Editor' : 'Points Editor'} unavailable for this match`}
                </div>
              )}

              {bestOf > 1 && (
                <div className="mb-6">
                  <GameSeriesScore
                    player1Wins={p1Score}
                    player2Wins={p2Score}
                    winsNeeded={winsNeeded}
                    player1Name={p1Name}
                    player2Name={p2Name}
                  />
                </div>
              )}

              {/* Series complete banner — shown to all roles */}
              {seriesComplete && (
                <div className="mb-4 bg-primary/10 border border-primary/30 p-6 flex flex-col items-center gap-3 text-center animate-in fade-in duration-300">
                  <span className="text-[9px] font-black text-primary uppercase tracking-[0.3em]">Series Complete</span>
                  <p className="text-lg font-black text-white uppercase tracking-tight">
                    {isDraw ? 'Drawn' : `${seriesWinnerName} Wins`}
                  </p>
                  <p className="text-[9px] text-white/30 uppercase tracking-widest">{p1Score} — {p2Score}</p>
                </div>
              )}

              {isAdmin ? (
                <>
                  {bestOf > 1 ? (
                    <div className="space-y-6">
                      {!seriesComplete && (
                        <>
                          <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 border-b border-white/5 pb-2">Series Controls</div>
                          <div className="grid grid-cols-2 gap-4">
                            <button
                              onClick={() => handleRecordGameWin(match.player1?.id || '')}
                              disabled={!match.player1 || isSubmittingGame}
                              className="py-4 bg-primary/10 border border-primary/30 hover:border-primary text-primary transition-all text-[11px] font-black uppercase tracking-widest rounded-sm flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <span>{isSubmittingGame ? '...' : 'Record Game Win'}</span>
                              <span className="text-[8px] text-white/45 font-bold">{p1Name}</span>
                            </button>

                            <button
                              onClick={() => handleRecordGameWin(match.player2?.id || '')}
                              disabled={!match.player2 || isSubmittingGame}
                              className="py-4 bg-primary/10 border border-primary/30 hover:border-primary text-primary transition-all text-[11px] font-black uppercase tracking-widest rounded-sm flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <span>{isSubmittingGame ? '...' : 'Record Game Win'}</span>
                              <span className="text-[8px] text-white/45 font-bold">{p2Name}</span>
                            </button>
                          </div>

                          {gameError && (
                            <div className="text-[9px] font-black text-red-500 uppercase tracking-widest text-center pt-2">
                              {gameError}
                            </div>
                          )}
                        </>
                      )}

                      <div className="pt-6 border-t border-white/5 space-y-4">
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] block">Organizer Override</span>
                        <div className="grid grid-cols-2 gap-4">
                          <button
                            onClick={() => onScore(match.player1?.id || null)}
                            disabled={!match.player1}
                            className="py-3 bg-white/3 border border-white/5 hover:border-red-500/50 hover:bg-red-500/5 text-white/60 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest rounded-sm cursor-pointer"
                          >
                            Force Match Win: {p1Name}
                          </button>
                          <button
                            onClick={() => onScore(match.player2?.id || null)}
                            disabled={!match.player2}
                            className="py-3 bg-white/3 border border-white/5 hover:border-red-500/50 hover:bg-red-500/5 text-white/60 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest rounded-sm cursor-pointer"
                          >
                            Force Match Win: {p2Name}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    !seriesComplete ? (
                      <>
                        <button
                          onClick={() => onScore(match.player1?.id || null)}
                          disabled={!match.player1}
                          className={`w-full py-6 bg-white/3 border border-white/5 hover:border-primary text-white transition-all group px-8 flex justify-between items-center cursor-pointer ${!match.player1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                        >
                          <span className="font-black uppercase tracking-widest text-xs">{p1Name}</span>
                          <span className="text-[9px] font-black text-primary opacity-0 group-hover:opacity-100 uppercase tracking-widest transition-all">WINNER ▸</span>
                        </button>

                        <div className="flex items-center gap-4 py-1">
                          <div className="h-px flex-1 bg-white/5" />
                          <span className="text-[8px] font-black text-white/10 uppercase tracking-widest">VS</span>
                          <div className="h-px flex-1 bg-white/5" />
                        </div>

                        <button
                          onClick={() => onScore(match.player2?.id || null)}
                          disabled={!match.player2}
                          className={`w-full py-6 bg-white/3 border border-white/5 hover:border-primary text-white transition-all group px-8 flex justify-between items-center cursor-pointer ${!match.player2 ? 'opacity-30 cursor-not-allowed' : ''}`}
                        >
                          <span className="font-black uppercase tracking-widest text-xs">{p2Name}</span>
                          <span className="text-[9px] font-black text-primary opacity-0 group-hover:opacity-100 uppercase tracking-widest transition-all">WINNER ▸</span>
                        </button>
                      </>
                    ) : null
                  )}

                  {/* canOfferDraw folds in the two limits the backend enforces on a
                      winnerless submit (no series, no threshold scoring) AND the
                      system check that used to be missing here: on an elimination
                      bracket a draw stalls or corrupts the bracket, so the button
                      must not be reachable even if allowDraw was set. */}
                  {!seriesComplete && canOfferDraw({ system, config: formatConfig, phase: match.phase }) && (
                    <div className="pt-4 border-t border-white/5">
                      <button
                        onClick={() => onScore(null)}
                        className="w-full py-4 bg-transparent border border-dashed border-white/5 hover:border-white/20 text-white/20 hover:text-white/40 transition-all font-black uppercase text-[10px] tracking-widest cursor-pointer"
                      >
                        Draw
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-6 py-2">
                  {match.winnerId ? (
                    <div className="bg-primary/5 border border-primary/20 p-8 flex flex-col items-center justify-center gap-4 text-center">
                      <div className="w-10 h-10 rounded-full border border-primary/30 flex items-center justify-center text-primary bg-primary/5 shadow-[0_0_15px_rgba(82,185,70,0.2)] text-[10px] font-black uppercase tracking-widest">
                        WIN
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-primary uppercase tracking-[0.3em]">Match Complete</span>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tight italic">
                          {match.winnerId === match.player1?.id ? p1Name : p2Name} Wins
                        </h3>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest">
                          Series Score: {match.player1Score ?? 0} — {match.player2Score ?? 0}
                        </p>
                      </div>
                    </div>
                  ) : isDraw ? (
                    /* Without this branch a drawn match fell through to the
                       "not started yet" state below, telling the organizer a
                       finished match was still waiting to begin. */
                    <div className="bg-white/5 border border-white/20 p-8 flex flex-col items-center justify-center gap-4 text-center">
                      <div className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center text-white/70 bg-white/5 text-[10px] font-black uppercase tracking-widest">
                        D
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.3em]">Match Complete</span>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tight italic">
                          Drawn
                        </h3>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest">
                          Series Score: {match.player1Score ?? 0} — {match.player2Score ?? 0}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 border border-dashed border-white/10 flex flex-col items-center justify-center text-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/30 animate-pulse">Not Started</span>
                      <span className="text-[9px] font-black uppercase tracking-wider text-white/15">This match has not been started yet</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
