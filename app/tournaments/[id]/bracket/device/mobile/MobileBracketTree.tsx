"use client";

import React, { useState, useMemo } from "react";
import { Match, Round, LeaderboardEntry } from "../../types";
import MatchCard from "../../../../../components/tournaments/bracket/MatchCard";
import { motion, AnimatePresence } from "motion/react";

interface MobileBracketTreeProps {
    tournament: any;
    leaderboard: LeaderboardEntry[];
    isAdmin: boolean;
    updating: string | null;
    onOpenScoring: (match: Match) => void;
    addLog: (action: string, details?: string) => void;
    trackedUserId: string | null;
    setTrackedUserId: (id: string | null) => void;
    currentUserId?: string | null;
}

export default function MobileBracketTree({
    tournament,
    leaderboard,
    isAdmin,
    updating,
    onOpenScoring,
    addLog,
    trackedUserId,
    setTrackedUserId,
    currentUserId
}: MobileBracketTreeProps) {
    const rounds = useMemo(() => {
        const r = tournament?.rounds || [];
        return [...r].sort((a: Round, b: Round) => a.roundNumber - b.roundNumber);
    }, [tournament]);

    const winnerRoundsCount = useMemo(() => {
        return rounds.filter(r => r.roundNumber < 100).length;
    }, [rounds]);

    const [activeRoundIdx, setActiveRoundIdx] = useState(0);

    const getRoundLabel = (round: Round) => {
        const num = round.roundNumber;
        if (num >= 200) return "Grand Finals";
        if (num >= 100) return `Round ${num - 100}`;
        
        // Dynamic labels for Winner's bracket
        if (num === winnerRoundsCount) return "Finals";
        if (num === winnerRoundsCount - 1) return "Semi-Finals";
        if (num === winnerRoundsCount - 2) return "Quarter-Finals";
        
        return `Round ${num}`;
    };

    const currentRound = rounds[activeRoundIdx];

    // Swipe Gesture State
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > 50;
        const isRightSwipe = distance < -50;
        
        if (isLeftSwipe && activeRoundIdx < rounds.length - 1) {
            setActiveRoundIdx(activeRoundIdx + 1);
        } else if (isRightSwipe && activeRoundIdx > 0) {
            setActiveRoundIdx(activeRoundIdx - 1);
        }
    };

    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setStartX(e.pageX - (scrollContainerRef.current?.offsetLeft || 0));
        setScrollLeft(scrollContainerRef.current?.scrollLeft || 0);
    };

    const handleMouseLeave = () => setIsDragging(false);
    const handleMouseUp = () => setIsDragging(false);
    
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX) * 1.5;
        scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    };

    const userInRound = (round: Round) => {
        if (!currentUserId) return false;
        return round.matches?.some((m: Match) => 
            m.player1Id === currentUserId || 
            m.player2Id === currentUserId || 
            m.player1?.id === currentUserId || 
            m.player2?.id === currentUserId
        );
    };

    return (
        <div className="h-full flex flex-col bg-[#1B1B1B] relative">
            {/* Round Navigation (UEFA Style) */}
            <div className="sticky top-0 z-50 bg-[#1B1B1B]/80 backdrop-blur-xl border-b border-white/5 px-4 pt-4 pb-2">
                <div 
                    ref={scrollContainerRef}
                    onMouseDown={handleMouseDown}
                    onMouseLeave={handleMouseLeave}
                    onMouseUp={handleMouseUp}
                    onMouseMove={handleMouseMove}
                    className={`flex gap-4 overflow-x-auto no-scrollbar pb-2 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} select-none`}
                >
                    {rounds.map((round: Round, idx: number) => {
                        const isUserHere = userInRound(round);
                        return (
                            <button
                                key={round.id}
                                onClick={() => {
                                    setActiveRoundIdx(idx);
                                    addLog("NAVIGATION", `VIEWING ${getRoundLabel(round).toUpperCase()}`);
                                }}
                                className="flex flex-col items-center gap-2 min-w-[100px] shrink-0 group pointer-events-auto"
                            >
                                <span className={`text-[8px] font-black uppercase tracking-[0.3em] transition-all ${
                                    activeRoundIdx === idx ? "text-primary drop-shadow-[0_0_5px_rgba(82,185,70,0.8)]" : (isUserHere ? "text-primary/70 drop-shadow-[0_0_5px_rgba(82,185,70,0.4)]" : "text-white/20 group-hover:text-white/40")
                                }`}>
                                    {getRoundLabel(round)}
                                </span>
                                <div className={`h-[2px] w-full rounded-full transition-all duration-500 ${
                                    activeRoundIdx === idx ? "bg-primary shadow-[0_0_10px_rgba(82,185,70,0.8)]" : (isUserHere ? "bg-primary/50 shadow-[0_0_8px_rgba(82,185,70,0.4)]" : "bg-white/5")
                                }`} />
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Matches Display */}
            <div 
                className="flex-1 overflow-y-auto custom-scrollbar px-6 py-8"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentRound?.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="space-y-12 relative"
                    >
                        {/* Round Header Backdrop */}
                        <div className="absolute inset-0 pointer-events-none opacity-[0.02] flex items-center justify-center overflow-hidden">
                             <span className="text-[120px] font-black uppercase tracking-tighter whitespace-nowrap">
                                {getRoundLabel(currentRound)}
                             </span>
                        </div>

                        {[...(currentRound?.matches || [])].sort((a, b) => a.id.localeCompare(b.id)).map((match: Match, idx: number) => (
                            <div key={match.id} className="relative">
                                {/* Connector Line (UEFA Style) */}
                                {idx < currentRound.matches.length - 1 && (
                                    <div className="absolute left-1/2 bottom-[-48px] w-[1px] h-12 bg-gradient-to-b from-white/10 to-transparent" />
                                )}
                                
                                <motion.div
                                    whileTap={isAdmin ? { scale: 0.98 } : undefined}
                                    onClick={() => isAdmin && onOpenScoring(match)}
                                >
                                    <MatchCard 
                                        match={match} 
                                        onOpenScoring={() => {}} 
                                        isAdmin={isAdmin}
                                        isUpdating={updating === match.id}
                                        leaderboard={leaderboard}
                                        trackedUserId={trackedUserId}
                                        currentUserId={currentUserId}
                                    />
                                </motion.div>
                            </div>
                        ))}

                        {currentRound?.matches.length === 0 && (
                            <div className="h-64 flex flex-col items-center justify-center text-center opacity-20">
                                <div className="text-[10px] font-black uppercase tracking-[0.4em]">Standby</div>
                                <div className="text-[8px] uppercase tracking-widest mt-2">No matchups generated for this phase</div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Tracking Overlay (Refined) */}
            {trackedUserId && (
                <div className="fixed bottom-24 left-6 right-6 z-[60] animate-in slide-in-from-bottom-8 duration-500">
                    <div className="bg-[#1B1B1B]/90 backdrop-blur-2xl border border-primary/20 p-4 rounded-2xl flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full border border-primary/30 flex items-center justify-center bg-primary/10">
                                <span className="text-primary font-black text-xs">
                                    {leaderboard.find(u => u.userId === trackedUserId)?.username?.[0].toUpperCase()}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[7px] font-black text-primary uppercase tracking-[0.3em] leading-none mb-1">Participant Tracked</span>
                                <span className="text-xs font-bold text-white tracking-tight">{leaderboard.find(u => u.userId === trackedUserId)?.username}</span>
                            </div>
                        </div>
                        <button 
                            onClick={() => setTrackedUserId(null)}
                            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/20 hover:text-white transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
