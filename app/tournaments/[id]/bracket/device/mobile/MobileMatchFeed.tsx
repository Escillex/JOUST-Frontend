"use client";
import { isWinnersRound, isLosersRound, isGrandFinal, losersRoundIndex } from "../../roundNumbers";

import React, { useState, useMemo } from "react";
import { Match, Round, LeaderboardEntry } from "../../types";
import MatchCard from "../../../../../components/tournaments/bracket/MatchCard";

interface MobileMatchFeedProps {
    tournament: any;
    leaderboard: LeaderboardEntry[];
    isAdmin: boolean;
    updating: string | null;
    onOpenScoring: (match: Match) => void;
    addLog: (action: string, details?: string) => void;
    activePhase: number;
    setActivePhase: (idx: number) => void;
    currentUserId?: string | null;
}

export default function MobileMatchFeed({
    tournament,
    leaderboard,
    isAdmin,
    updating,
    onOpenScoring,
    addLog,
    activePhase,
    setActivePhase,
    currentUserId
}: MobileMatchFeedProps) {

    const rounds = tournament?.rounds || [];
    const sortedRounds = useMemo(() => {
        return [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
    }, [rounds]);

    const activeRound = sortedRounds[activePhase];

    const getRoundLabel = (round: Round) => {
        const num = round.roundNumber;
        const fs = tournament?.format?.system;
        if (num >= 200) return "Grand Finals";
        if (isLosersRound(num)) return `Round ${losersRoundIndex(num)}`;
        if (fs === "DOUBLE_ELIMINATION") return `Round ${num}`;
        return `Round ${num}`;
    };

    const isDoubleElim = tournament?.format?.system === "DOUBLE_ELIMINATION";
    const [bracketView, setBracketView] = useState<"WINNERS" | "LOSERS">("WINNERS");

    const displayedRounds = useMemo(() => {
        if (!isDoubleElim) return sortedRounds;
        if (bracketView === "WINNERS") return sortedRounds.filter(r => isWinnersRound(r.roundNumber) || isGrandFinal(r.roundNumber));
        return sortedRounds.filter(r => isLosersRound(r.roundNumber));
    }, [sortedRounds, isDoubleElim, bracketView]);

    const [searchQuery, setSearchQuery] = useState("");
    const [showOnlyMyMatches, setShowOnlyMyMatches] = useState(false);

    const isUserInTournament = useMemo(() => {
        if (!currentUserId || !tournament) return false;
        const inParticipants = tournament.participants?.some(
            (p: any) => p.userId === currentUserId || p.id === currentUserId
        );
        if (inParticipants) return true;

        return tournament.rounds?.some((r: any) => 
            r.matches?.some((m: any) => 
                m.player1Id === currentUserId || 
                m.player2Id === currentUserId ||
                m.player1?.id === currentUserId ||
                m.player2?.id === currentUserId
            )
        ) || false;
    }, [tournament, currentUserId]);

    const filteredMatches = useMemo(() => {
        if (!activeRound) return [];
        return [...activeRound.matches]
            .sort((a, b) => a.id.localeCompare(b.id))
            .filter((match) => {
                if (showOnlyMyMatches && currentUserId) {
                    const isMe = match.player1Id === currentUserId || 
                                 match.player2Id === currentUserId ||
                                 match.player1?.id === currentUserId ||
                                 match.player2?.id === currentUserId;
                    if (!isMe) return false;
                }
                if (searchQuery.trim() && isAdmin) {
                    const query = searchQuery.toLowerCase().trim();
                    const p1Name = (match.player1?.username || match.p1Name || "").toLowerCase();
                    const p2Name = (match.player2?.username || match.p2Name || "").toLowerCase();
                    if (!p1Name.includes(query) && !p2Name.includes(query)) return false;
                }
                return true;
            });
    }, [activeRound, searchQuery, showOnlyMyMatches, currentUserId, isAdmin]);

    const handlePhaseChange = (idx: number) => {
        setActivePhase(idx);
        const round = sortedRounds[idx];
        if (round) {
            addLog("ROUND CHANGED", `NAVIGATED TO ${getRoundLabel(round).toUpperCase()}`);
        }
        // Clear search when changing phases to avoid confusion
        setSearchQuery("");
    };

    const getChampionDisplay = () => {
        if (tournament?.winner) return tournament.winner.username;
        if (tournament?.winnerName) return tournament.winnerName;

        // Fallback to searching rounds if status is completed
        if (tournament?.status === "COMPLETED") {
            const allMatches = sortedRounds.flatMap(r => r.matches);
            const finalMatch = allMatches.find(m => !m.nextMatchId && m.status === 'COMPLETED');
            if (finalMatch) {
                return finalMatch.winner?.username || finalMatch.winnerName || "Unknown Champion";
            }
        }

        return leaderboard.length > 0 ? leaderboard[0]?.username : "AWAITING RESULTS";
    };

    return (
        <div className="h-full flex flex-col gap-6 overflow-hidden relative">
            {/* Mobile Bracket Header */}
            <div className="bg-background/95 backdrop-blur-md px-4 pt-4 pb-2 space-y-4 border-b border-white/5 shrink-0">
                {(isAdmin || isUserInTournament) && (
                    <div className="flex items-center gap-3">
                        {isAdmin && (
                            <input 
                                type="text"
                                placeholder="SEARCH PLAYER..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-foreground/5 text-foreground/60 border border-white/5 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-primary/50"
                            />
                        )}
                        {isUserInTournament && (
                            <button
                                onClick={() => setShowOnlyMyMatches(!showOnlyMyMatches)}
                                className={`px-4 py-3 border text-[10px] font-black uppercase tracking-widest transition-all rounded-xl flex items-center gap-2 ${
                                    showOnlyMyMatches 
                                    ? "bg-primary border-primary text-black shadow-lg shadow-primary/20" 
                                    : "bg-transparent border-white/10 text-white/60 hover:text-white"
                                }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${showOnlyMyMatches ? 'bg-black animate-pulse' : 'bg-white/20'}`} />
                                {showOnlyMyMatches ? "VIEW ALL MATCHES" : "VIEW ONLY MY MATCHES"}
                            </button>
                        )}
                    </div>
                )}

                {isDoubleElim && (
                    <div className="flex items-center bg-black/20 border border-white/5 rounded-xl p-1 shrink-0 mb-1">
                        <button
                            onClick={() => {
                                setBracketView("WINNERS");
                                const first = sortedRounds.find(r => isWinnersRound(r.roundNumber) || isGrandFinal(r.roundNumber));
                                if (first && bracketView !== "WINNERS") setActivePhase(sortedRounds.indexOf(first));
                            }}
                            className={`flex-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${bracketView === 'WINNERS' ? 'bg-white/20 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            Winners
                        </button>
                        <button
                            onClick={() => {
                                setBracketView("LOSERS");
                                const first = sortedRounds.find(r => isLosersRound(r.roundNumber));
                                if (first && bracketView !== "LOSERS") setActivePhase(sortedRounds.indexOf(first));
                            }}
                            className={`flex-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${bracketView === 'LOSERS' ? 'bg-white/20 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                        >
                            Losers
                        </button>
                    </div>
                )}

                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    {displayedRounds.map((round) => {
                        const originalIdx = sortedRounds.indexOf(round);
                        return (
                            <button
                                key={round.id}
                                onClick={() => handlePhaseChange(originalIdx)}
                                className={`shrink-0 px-6 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activePhase === originalIdx ? 'bg-primary text-white shadow-lg' : 'bg-foreground/5 text-foreground/20'}`}
                            >
                                {getRoundLabel(round)}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Match List - Horizontal Scroll */}
            <div className="flex-1 flex flex-col gap-4 px-4 overflow-y-auto overflow-x-hidden">
                <div className="flex items-center justify-between shrink-0">
                    <h2 className="text-[10px] font-black text-primary uppercase tracking-[0.4em] font-poppins">
                        {activeRound ? getRoundLabel(activeRound) : "No Data"}
                    </h2>
                    <span className="text-[8px] font-black text-foreground/20 uppercase tracking-widest">
                        {filteredMatches.length} / {activeRound?.matches.length || 0} Matchups
                    </span>
                </div>

                <div className="grid grid-flow-col grid-rows-2 gap-x-4 gap-y-6 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-8 pt-2 shrink-0 min-h-min">
                    {filteredMatches.map((match: Match, i: number) => (
                        <div key={match.id} id={`match-mobile-${match.id}`} className="shrink-0 w-[42vw] snap-start flex flex-col gap-2 [&>div]:w-full">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[7px] font-black text-foreground/20 uppercase tracking-widest">#{i+1}</span>
                            </div>
                            <MatchCard 
                                match={match}
                                onOpenScoring={() => onOpenScoring(match)}
                                isAdmin={isAdmin}
                                isUpdating={updating === match.id}
                                leaderboard={leaderboard}
                                currentUserId={currentUserId}
                                showPoints={tournament?.format === "SWISS"}
                            />
                        </div>
                    ))}
                    
                    {filteredMatches.length === 0 && (
                        <div className="row-span-2 col-span-full shrink-0 w-[80vw] flex flex-col items-center justify-center text-center opacity-30 border border-dashed border-white/10 rounded-2xl py-12">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white">No matches found</p>
                            <p className="text-[8px] uppercase tracking-widest mt-1">Try adjusting your filters</p>
                        </div>
                    )}
                    
                    {/* Champion Section at end of scroll - spanning both rows */}
                    {activePhase === sortedRounds.length - 1 && filteredMatches.length > 0 && (
                        <div className="row-span-2 shrink-0 w-[80vw] snap-center flex flex-col justify-center items-center gap-4 bg-primary/5 rounded-3xl border border-dashed border-primary/20 p-6">
                            <span className="text-[9px] font-black text-primary uppercase tracking-[0.4em]">Tournament Champion</span>
                            <div className={`w-full py-8 flex flex-col items-center justify-center gap-4 rounded-2xl ${tournament?.status === "COMPLETED" ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 border border-white/10'}`}>
                                <div className="w-12 h-12 rounded-full border border-current flex items-center justify-center">
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z"/></svg>
                                </div>
                                <span className="text-base font-black uppercase tracking-tighter">
                                    {getChampionDisplay()}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
