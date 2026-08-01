"use client";
import { isWinnersRound, isLosersRound, isGrandFinal, losersRoundIndex } from "../../roundNumbers";

import React, { useState, useRef } from "react";
import { Match, Round, LeaderboardEntry } from "../../types";
import MatchCard from "../../../../../components/tournaments/bracket/MatchCard";

interface DesktopRoundTableProps {
    tournament: any;
    leaderboard: LeaderboardEntry[];
    isAdmin: boolean;
    updating: string | null;
    onOpenScoring: (match: Match, pos?: {x: number, y: number}) => void;
    addLog: (action: string, details?: string) => void;
    currentUserId?: string | null;
}

export default function DesktopRoundTable({
    tournament,
    leaderboard,
    isAdmin,
    updating,
    onOpenScoring,
    addLog,
    currentUserId
}: DesktopRoundTableProps) {
    const rounds: Round[] = tournament?.rounds || [];
    const sortedRounds: Round[] = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
    
    // Default to the latest ongoing round or the last round
    const initialRound = sortedRounds.find(r => r.matches.some((m: Match) => m.status !== 'COMPLETED'))?.roundNumber 
                       || sortedRounds[sortedRounds.length - 1]?.roundNumber 
                       || 1;
    
    const [activeRound, setActiveRound] = useState<number>(initialRound);
    const [searchQuery, setSearchQuery] = useState("");
    const [showOnlyMyMatches, setShowOnlyMyMatches] = useState(false);
    
    const isDoubleElim = tournament?.format?.system === "DOUBLE_ELIMINATION";
    const [bracketView, setBracketView] = useState<"WINNERS" | "LOSERS">("WINNERS");

    const displayedRounds = React.useMemo(() => {
        if (!isDoubleElim) return sortedRounds;
        if (bracketView === "WINNERS") return sortedRounds.filter(r => isWinnersRound(r.roundNumber) || isGrandFinal(r.roundNumber));
        return sortedRounds.filter(r => isLosersRound(r.roundNumber));
    }, [sortedRounds, isDoubleElim, bracketView]);

    const currentRound: Round | undefined = sortedRounds.find(r => r.roundNumber === activeRound);

    const isUserInTournament = React.useMemo(() => {
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

    const filteredMatches = React.useMemo(() => {
        if (!currentRound) return [];
        return [...currentRound.matches]
            .sort((a, b) => a.id.localeCompare(b.id))
            .filter((match) => {
                if (showOnlyMyMatches && currentUserId) {
                    const isMe = match.player1Id === currentUserId || 
                                 match.player2Id === currentUserId ||
                                 match.player1?.id === currentUserId ||
                                 match.player2?.id === currentUserId;
                    if (!isMe) return false;
                }
                if (searchQuery.trim()) {
                    const query = searchQuery.toLowerCase().trim();
                    const p1Name = (match.player1?.username || match.p1Name || "").toLowerCase();
                    const p2Name = (match.player2?.username || match.p2Name || "").toLowerCase();
                    if (!p1Name.includes(query) && !p2Name.includes(query)) return false;
                }
                return true;
            });
    }, [currentRound, searchQuery, showOnlyMyMatches, currentUserId]);

    return (
        <div className="h-full flex flex-col bg-neutral-950/20">
            {/* Phase Tabs - Floating at top */}
            <div className="flex gap-px overflow-x-auto no-scrollbar bg-white/5 border-b border-white/5">
                {isDoubleElim && (
                    <div className="flex items-center px-4 border-r border-white/5 bg-black/20 shrink-0">
                        <div className="flex items-center border border-white/10 rounded-lg p-0.5">
                            <button
                                onClick={() => {
                                    setBracketView("WINNERS");
                                    const first = sortedRounds.find(r => isWinnersRound(r.roundNumber) || isGrandFinal(r.roundNumber));
                                    if (first && bracketView !== "WINNERS") setActiveRound(first.roundNumber);
                                }}
                                className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${bracketView === 'WINNERS' ? 'bg-white/20 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                                WINNERS
                            </button>
                            <button
                                onClick={() => {
                                    setBracketView("LOSERS");
                                    const first = sortedRounds.find(r => isLosersRound(r.roundNumber));
                                    if (first && bracketView !== "LOSERS") setActiveRound(first.roundNumber);
                                }}
                                className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${bracketView === 'LOSERS' ? 'bg-white/20 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                                LOSERS
                            </button>
                        </div>
                    </div>
                )}
                {displayedRounds.map((round) => (
                    <button
                        key={round.id}
                        onClick={() => {
                            setActiveRound(round.roundNumber);
                            setSearchQuery("");
                        }}
                        className={`px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all min-w-[140px] border-r border-white/5 relative group ${
                            activeRound === round.roundNumber
                            ? "bg-primary text-background"
                            : "bg-transparent text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                        }`}
                    >
                        {(() => {
                            const n = round.roundNumber;
                            const fs = tournament?.format?.system;
                            if (n >= 200) return "Grand Finals";
                            if (isLosersRound(n)) return `Losers Round ${losersRoundIndex(n)}`;
                            if (fs === "DOUBLE_ELIMINATION") return `Winners Round ${n}`;
                            return `Round ${n}`;
                        })()}
                        {activeRound === round.roundNumber && (
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-white/40" />
                        )}
                    </button>
                ))}
                <div className="flex-1 border-white/5" />
                <div className="px-6 flex items-center">
                    <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest italic">
                        {((typeof tournament?.format === 'object' ? tournament?.format?.system : null) === "HYBRID" ? "TOP CUT" : ((typeof tournament?.format === 'object' ? tournament?.format?.system : null)?.replace("_", " ") || "UNKNOWN"))} ANALYTICS
                    </span>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 px-8 py-3 bg-white/[0.02] border-b border-white/5">
                <div className="flex items-center gap-4">
                    {isAdmin && (
                        <input 
                            type="text"
                            placeholder="SEARCH PLAYER..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-black/40 text-white placeholder-white/20 border border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] outline-none focus:border-primary/50 w-64"
                        />
                    )}
                    {isUserInTournament && (
                        <button
                            onClick={() => setShowOnlyMyMatches(!showOnlyMyMatches)}
                            className={`px-4 py-2 border text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 rounded-xl ${
                                showOnlyMyMatches 
                                ? "bg-primary border-primary text-black" 
                                : "bg-transparent border-white/10 text-white/40 hover:text-white"
                            }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${showOnlyMyMatches ? 'bg-black animate-pulse' : 'bg-white/20'}`} />
                            {showOnlyMyMatches ? "VIEW ALL MATCHES" : "VIEW ONLY MY MATCHES"}
                        </button>
                    )}
                </div>
                <div className="text-[8px] font-black text-neutral-600 uppercase tracking-widest italic">
                    MATCH COUNT: {filteredMatches.length} / {currentRound?.matches.length || 0}
                </div>
            </div>

            {/* Active Round Matches */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-8 py-6">
                {currentRound ? (
                    filteredMatches.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8 py-4">
                            {filteredMatches.map((match: Match, i: number) => (
                                <div 
                                    key={match.id}
                                    className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                                    style={{ animationDelay: `${i * 50}ms` }}
                                >
                                    <div className="mb-3 flex justify-between items-center">
                                        <span className="text-[8px] font-black text-neutral-600 uppercase tracking-[0.3em]">
                                            Match {(i + 1).toString().padStart(2, '0')}
                                        </span>
                                        {match.isBye && (
                                            <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest italic">
                                                Auto-Advance
                                            </span>
                                        )}
                                    </div>
                                    <div 
                                        onClick={(e) => {
                                            onOpenScoring(match, {x: e.clientX, y: e.clientY});
                                            addLog("COMMAND", `SCORING MATCH IN ROUND ${activeRound}`);
                                        }}
                                        className="cursor-pointer [&>div]:w-full"
                                    >
                                        <MatchCard 
                                            match={match} 
                                            onOpenScoring={() => {}} 
                                            isAdmin={isAdmin}
                                            isUpdating={updating === match.id}
                                            leaderboard={leaderboard}
                                            showPoints={tournament?.format?.system === "SWISS"}
                                            currentUserId={currentUserId}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full py-20 flex items-center justify-center border border-dashed border-neutral-800 rounded-[2.5rem]">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600 italic">
                                No matches matching filters...
                            </p>
                        </div>
                    )
                ) : (
                    <div className="h-full flex items-center justify-center border border-dashed border-neutral-800 rounded-[2.5rem]">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-600 italic animate-pulse">
                            Awaiting round data...
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
