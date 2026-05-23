"use client";
import React, { useState, useEffect } from "react";
import { Tournament } from "../../../tournaments/types";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../../utils/api";

interface Props {
  tournament: Tournament;
  fetchData: () => Promise<void>;
  setMessage: (msg: string) => void;
}

type ResolutionStrategy = "DRAW" | "RANDOM" | "PLAYER1" | "PLAYER2";

export default function RoundControlPanel({ tournament, fetchData, setMessage }: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const allowsDraw = tournament.formatConfig?.allowDraw ?? false;
  const [strategy, setStrategy] = useState<ResolutionStrategy>("RANDOM");

  useEffect(() => {
    setStrategy(allowsDraw ? "DRAW" : "RANDOM");
  }, [allowsDraw]);

  // Find the first round that has at least one incomplete match
  const activeRound = tournament.rounds
    ?.slice()
    .sort((a, b) => a.roundNumber - b.roundNumber)
    .find(r => r.matches.some(m => m.status !== "COMPLETED"));

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [tieDetected, setTieDetected] = useState(false);

  useEffect(() => {
    if (tournament.status === "ONGOING" && !activeRound) {
      authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.LEADERBOARD(tournament.id))
        .then(res => res.json())
        .then(data => {
          setLeaderboard(data);
          if (data && data.length > 1 && data[0].points > 0 && data[0].points === data[1].points) {
            setTieDetected(true);
          } else {
            setTieDetected(false);
          }
        });
    } else {
      setTieDetected(false);
    }
  }, [tournament.status, activeRound, tournament.id]);

  const handleResolveTie = async (action: 'EXTEND_ROUND' | 'APPLY_TIEBREAKERS') => {
    setIsProcessing(true);
    setMessage(action === 'EXTEND_ROUND' ? "Generating tiebreaker round..." : "Applying OMW% tiebreakers...");
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.RESOLVE_TIE(tournament.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setMessage(action === 'EXTEND_ROUND' ? "Tiebreaker match generated!" : "Tie broken and tournament completed.");
        await fetchData();
      } else {
        const data = await safeJson(res);
        setMessage(data?.message || "Failed to resolve tie.");
      }
    } catch (err) {
      setMessage("Error resolving tie.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!activeRound) {
    return (
      <div className="bg-[#000000] border border-white/20 p-4 md:p-6 rounded space-y-4">
        <h3 className="text-sm font-semibold text-white border-b border-white/10 pb-4">
          Round Control
        </h3>
        {tieDetected ? (
          <div className="space-y-4">
            <div className="p-4 bg-[#FFB800]/10 border border-[#FFB800]/30 rounded text-center">
              <h4 className="text-sm font-black text-[#FFB800] tracking-widest uppercase mb-1">
                ⚠️ TIE DETECTED FOR 1ST PLACE
              </h4>
              <p className="text-xs text-[#FFB800]/80">
                Multiple players are tied at {leaderboard[0]?.points} points. The tournament has paused completion to allow manual resolution.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => handleResolveTie('EXTEND_ROUND')}
                disabled={isProcessing}
                className="w-full h-12 bg-[#FFB800]/20 hover:bg-[#FFB800]/30 text-[#FFB800] border border-[#FFB800]/50 font-black text-xs tracking-wider rounded transition-colors disabled:opacity-50 uppercase"
              >
                Match Tied Players
              </button>
              <button
                onClick={() => handleResolveTie('APPLY_TIEBREAKERS')}
                disabled={isProcessing}
                className="w-full h-12 bg-[#1B1B1B] hover:bg-white/10 text-white border border-white/20 font-black text-xs tracking-wider rounded transition-colors disabled:opacity-50 uppercase"
              >
                Break Automatically (OMW%)
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-[#52B946]/10 border border-[#52B946]/20 rounded text-center">
            <p className="text-xs font-semibold text-[#52B946] uppercase">
              All Rounds Completed - Ready to Finalize
            </p>
          </div>
        )}
      </div>
    );
  }

  const incompleteMatches = activeRound.matches.filter(m => m.status !== "COMPLETED" && !m.isBye);
  const totalIncomplete = incompleteMatches.length;

  const handleForceResolveAll = async () => {
    if (totalIncomplete === 0) return;
    if (
      !confirm(
        `Are you sure you want to resolve all ${totalIncomplete} incomplete matches in Round ${activeRound.roundNumber} via "${strategy}" strategy?`
      )
    ) {
      return;
    }

    setIsProcessing(true);
    setMessage(`Resolving ${totalIncomplete} matches using ${strategy}...`);

    try {
      // Complete matches according to selected strategy
      for (const match of incompleteMatches) {
        let winnerId: string | null = null;
        const p1Id = match.player1Id || match.player1?.id;
        const p2Id = match.player2Id || match.player2?.id;

        if (strategy === "RANDOM") {
          const players = [p1Id, p2Id].filter(Boolean);
          if (players.length > 0) {
            winnerId = players[Math.floor(Math.random() * players.length)] as string;
          }
        } else if (strategy === "PLAYER1") {
          winnerId = p1Id || null;
        } else if (strategy === "PLAYER2") {
          winnerId = p2Id || null;
        } else {
          winnerId = null; // DRAW
        }

        await authenticatedFetch(`/matches/${match.id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winnerId }),
        });
      }
      setMessage(`Round ${activeRound.roundNumber} successfully resolved.`);
      await fetchData();
    } catch (err) {
      setMessage("Failed to resolve round matches.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResolveMatch = async (matchId: string, strat: ResolutionStrategy, p1Id: string | null, p2Id: string | null) => {
    setIsProcessing(true);
    setMessage(`Resolving match...`);

    let winnerId: string | null = null;
    if (strat === "RANDOM") {
      const players = [p1Id, p2Id].filter(Boolean);
      if (players.length > 0) {
        winnerId = players[Math.floor(Math.random() * players.length)] as string;
      }
    } else if (strat === "PLAYER1") {
      winnerId = p1Id || null;
    } else if (strat === "PLAYER2") {
      winnerId = p2Id || null;
    } else {
      winnerId = null; // DRAW
    }

    try {
      const res = await authenticatedFetch(`/matches/${matchId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerId }),
      });
      if (res.ok) {
        setMessage(`Match successfully resolved.`);
        await fetchData();
      } else {
        const data = await safeJson(res);
        setMessage(data?.message || "Failed to resolve match.");
      }
    } catch (err) {
      setMessage("Failed to resolve match.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getPlayerDisplayName = (player: any, placeholder: string) => {
    if (!player) return placeholder;
    return (player.isGuest ? player.guestName : player.username) || placeholder;
  };

  return (
    <div className="bg-[#000000] border border-white/20 p-4 md:p-6 rounded space-y-6">
      <div className="flex justify-between items-center border-b border-white/10 pb-4">
        <h3 className="text-sm font-semibold text-white">
          Round Control
        </h3>
        <span className="px-2 py-0.5 bg-[#52B946]/10 text-[#52B946] text-xs font-semibold rounded">
          Round {activeRound.roundNumber} Active
        </span>
      </div>

      {totalIncomplete > 0 ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#888888] block">
              Resolution Strategy
            </label>
            <select
              value={strategy}
              onChange={e => setStrategy(e.target.value as ResolutionStrategy)}
              className="w-full h-10 bg-[#1B1B1B] border border-white/20 rounded px-3 text-sm text-white focus:outline-none focus:border-[#52B946] transition-colors"
            >
              {allowsDraw && <option value="DRAW">Permit Draw (1 Pt each)</option>}
              <option value="RANDOM">Coin Toss (Random Winner)</option>
              <option value="PLAYER1">Home Win (Player 1)</option>
              <option value="PLAYER2">Away Win (Player 2)</option>
            </select>
          </div>

          <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
            <p className="text-xs font-semibold text-[#888888] block">
              Pending Matches ({totalIncomplete})
            </p>
            {incompleteMatches.map((match: any, index) => (
              <div
                key={match.id}
                className="p-3 bg-[#1B1B1B] border border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 rounded"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#888888] font-mono">
                    #{index + 1}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white">
                      {getPlayerDisplayName(match.player1, "TBD")}
                    </span>
                    <span className="text-[10px] text-[#888888] font-semibold my-0.5 uppercase">
                      VS
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {getPlayerDisplayName(match.player2, "TBD")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-stretch md:self-auto justify-between md:justify-end flex-wrap">
                  <div className="flex gap-1 flex-wrap">
                    <button
                      onClick={() => handleResolveMatch(match.id, "PLAYER1", match.player1Id || match.player1?.id, match.player2Id || match.player2?.id)}
                      disabled={isProcessing}
                      className="px-3 py-1 bg-[#1B1B1B] border border-white/20 hover:bg-white/10 text-white text-xs font-semibold rounded transition-colors disabled:opacity-50"
                      title="Award win to home player"
                    >
                      P1 Win
                    </button>
                    {allowsDraw && (
                      <button
                        onClick={() => handleResolveMatch(match.id, "DRAW", match.player1Id || match.player1?.id, match.player2Id || match.player2?.id)}
                        disabled={isProcessing}
                        className="px-3 py-1 bg-[#1B1B1B] border border-white/20 hover:bg-white/10 text-white text-xs font-semibold rounded transition-colors disabled:opacity-50"
                        title="Force a Draw result"
                      >
                        Draw
                      </button>
                    )}
                    <button
                      onClick={() => handleResolveMatch(match.id, "PLAYER2", match.player1Id || match.player1?.id, match.player2Id || match.player2?.id)}
                      disabled={isProcessing}
                      className="px-3 py-1 bg-[#1B1B1B] border border-white/20 hover:bg-white/10 text-white text-xs font-semibold rounded transition-colors disabled:opacity-50"
                      title="Award win to away player"
                    >
                      P2 Win
                    </button>
                    <button
                      onClick={() => handleResolveMatch(match.id, "RANDOM", match.player1Id || match.player1?.id, match.player2Id || match.player2?.id)}
                      disabled={isProcessing}
                      className="px-3 py-1 bg-[#1B1B1B] border border-[#FF4D4D]/50 hover:bg-[#FF4D4D]/10 text-[#FF4D4D] text-xs font-semibold rounded transition-colors disabled:opacity-50"
                      title="Coin toss (Random selection)"
                    >
                      Coin
                    </button>
                  </div>

                  <div className="text-[10px] font-semibold text-[#52B946] bg-[#52B946]/10 px-2 py-0.5 rounded border border-[#52B946]/20 uppercase">
                    {match.status}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <button
              onClick={handleForceResolveAll}
              disabled={isProcessing}
              className="w-full h-10 bg-[#FF4D4D]/10 hover:bg-[#FF4D4D]/20 text-[#FF4D4D] font-semibold text-sm rounded transition-colors border border-[#FF4D4D]/20 disabled:opacity-50 mb-2"
            >
              {isProcessing ? "PROCESSING..." : `Force Resolve Round (${strategy})`}
            </button>
            <p className="text-xs text-[#888888] text-center">
              Forces round progression by automatically resolving all currently active matches. Use with caution.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-[#52B946]/10 border border-[#52B946]/20 rounded text-center">
          <p className="text-xs font-semibold text-[#52B946] uppercase">
            All active matches completed. Proceeding...
          </p>
        </div>
      )}
    </div>
  );
}
