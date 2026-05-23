"use client";

import React, { useState, useMemo } from "react";
import { Match, Round, LeaderboardEntry } from "../../types";
import MatchCard from "../../../../../components/tournaments/bracket/MatchCard";
import { motion } from "motion/react";

interface DesktopEliminationProps {
    tournament: any;
    leaderboard: LeaderboardEntry[];
    isAdmin: boolean;
    updating: string | null;
    onOpenScoring: (match: Match, pos?: { x: number, y: number }) => void;
    addLog: (action: string, details?: string) => void;
}

export default function DesktopElimination({
    tournament,
    leaderboard,
    isAdmin,
    updating,
    onOpenScoring,
    addLog
}: DesktopEliminationProps) {
    const isDoubleElim = tournament?.format?.system === "DOUBLE_ELIMINATION";
    const [trackedUserId, setTrackedUserId] = useState<string | null>(null);

    const winnersRounds = useMemo(() => tournament?.rounds?.filter((r: Round) => r.roundNumber < 100).sort((a: Round, b: Round) => a.roundNumber - b.roundNumber) || [], [tournament]);
    const losersRounds = useMemo(() => tournament?.rounds?.filter((r: Round) => r.roundNumber >= 100 && r.roundNumber < 200).sort((a: Round, b: Round) => a.roundNumber - b.roundNumber) || [], [tournament]);
    const grandFinals = useMemo(() => tournament?.rounds?.filter((r: Round) => r.roundNumber >= 200).sort((a: Round, b: Round) => a.roundNumber - b.roundNumber) || [], [tournament]);

    const getRoundLabel = (round: Round) => {
        const num = round.roundNumber;
        if (num >= 200) return "Grand Finals";
        if (num >= 100) return `Round ${num - 100}`;
        if (num === 1) return "Round 1";
        if (num === 2) return "Quarter-Finals";
        if (num === 3) return "Semi-Finals";
        return `Round ${num}`;
    };

    const isCompleted = tournament?.status === "COMPLETED";
    const champion = tournament?.winner || (isCompleted && leaderboard.length > 0 ? leaderboard[0] : null);

    return (
        <div className="h-full flex flex-col bg-[#1B1B1B]/20 rounded-[3rem] border border-white/5 overflow-hidden">
            {/* Header / Tracker Controls */}
            <div className="px-12 py-6 bg-[#1B1B1B]/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <h2 className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Tournament Bracket</h2>
                    <div className="h-4 w-px bg-white/10" />
                    <select
                        value={trackedUserId || ""}
                        onChange={(e) => {
                            const id = e.target.value || null;
                            setTrackedUserId(id);
                             if (id) {
                                const u = leaderboard.find(user => user.userId === id);
                                addLog("SYSTEM", `TRACKING USER: ${u?.username?.toUpperCase()}`);
                            }
                        }}
                        className="bg-transparent text-white/40 hover:text-primary text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer transition-all"
                    >
                        <option value="">Track Participant</option>
                        {leaderboard.map(u => (
                            <option key={u.userId} value={u.userId} className="bg-[#1B1B1B]">{u.username}</option>
                        ))}
                    </select>
                </div>

                {isDoubleElim && (
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Winners Bracket</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Losers Bracket</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Bracket Tree Container */}
            <div className="flex-1 overflow-x-auto overflow-y-auto no-scrollbar p-12">
                <div className="flex gap-24 items-start min-w-max pb-24">
                    {/* Winners Rounds */}
                    {winnersRounds.map((round: Round) => (
                        <div key={round.id} className="flex flex-col gap-12 w-72 shrink-0">
                            <div className="flex flex-col items-center gap-3">
                                <span className="text-[9px] font-black text-primary uppercase tracking-[0.4em]">{getRoundLabel(round)}</span>
                                <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                            </div>
                            <div className="flex flex-col gap-8">
                                {[...round.matches].sort((a, b) => a.id.localeCompare(b.id)).map((match: Match) => (
                                    <motion.div
                                        key={match.id}
                                        whileHover={{ scale: 1.02 }}
                                        onClick={(e) => onOpenScoring(match, { x: e.clientX, y: e.clientY })}
                                    >
                                        <MatchCard
                                            match={match}
                                            onOpenScoring={() => {}}
                                            isAdmin={isAdmin}
                                            isUpdating={updating === match.id}
                                            leaderboard={leaderboard}
                                            trackedUserId={trackedUserId}
                                        />
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Losers Rounds (If Double Elim) */}
                    {losersRounds.map((round: Round) => (
                        <div key={round.id} className="flex flex-col gap-12 w-72 shrink-0 opacity-80">
                            <div className="flex flex-col items-center gap-3">
                                <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.4em]">{getRoundLabel(round)}</span>
                                <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
                            </div>
                            <div className="flex flex-col gap-8">
                                {[...round.matches].sort((a, b) => a.id.localeCompare(b.id)).map((match: Match) => (
                                    <motion.div
                                        key={match.id}
                                        whileHover={{ scale: 1.02 }}
                                        onClick={(e) => onOpenScoring(match, { x: e.clientX, y: e.clientY })}
                                    >
                                        <MatchCard
                                            match={match}
                                            onOpenScoring={() => {}}
                                            isAdmin={isAdmin}
                                            isUpdating={updating === match.id}
                                            leaderboard={leaderboard}
                                            trackedUserId={trackedUserId}
                                        />
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Grand Finals */}
                    {grandFinals.map((round: Round) => (
                        <div key={round.id} className="flex flex-col gap-12 w-72 shrink-0">
                            <div className="flex flex-col items-center gap-3">
                                <span className="text-[9px] font-black text-white uppercase tracking-[0.4em]">{getRoundLabel(round)}</span>
                                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                            </div>
                            <div className="flex flex-col gap-8">
                                {[...round.matches].sort((a, b) => a.id.localeCompare(b.id)).map((match: Match) => (
                                    <motion.div
                                        key={match.id}
                                        whileHover={{ scale: 1.02 }}
                                        onClick={(e) => onOpenScoring(match, { x: e.clientX, y: e.clientY })}
                                    >
                                        <MatchCard
                                            match={match}
                                            onOpenScoring={() => {}}
                                            isAdmin={isAdmin}
                                            isUpdating={updating === match.id}
                                            leaderboard={leaderboard}
                                            trackedUserId={trackedUserId}
                                        />
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Champion Pedestal */}
                    <div className="w-96 flex flex-col gap-12 shrink-0 items-center">
                        <div className="flex flex-col items-center gap-3 w-full">
                            <span className="text-[9px] font-black text-primary uppercase tracking-[0.4em]">Champion</span>
                            <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                        </div>
                        <div className={`w-full aspect-[4/3] rounded-[2rem] border transition-all duration-1000 flex flex-col items-center justify-center gap-6 p-8 overflow-hidden relative group ${
                            isCompleted ? 'bg-primary/10 border-primary shadow-[0_0_50px_rgba(82,185,70,0.2)]' : 'bg-white/[0.02] border-white/5'
                        }`}>
                            {/* Animated Background Overlay */}
                            <div className={`absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent opacity-0 transition-opacity duration-1000 ${isCompleted ? 'opacity-100' : ''}`} />
                            
                            <div className={`w-20 h-20 rounded-full border-2 flex items-center justify-center transition-transform duration-700 ${
                                isCompleted ? 'border-primary text-primary scale-110' : 'border-white/5 text-white/5'
                            }`}>
                                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z" /></svg>
                            </div>

                            <div className="text-center relative z-10">
                                <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-2 transition-colors ${isCompleted ? 'text-primary' : 'text-white/10'}`}>
                                    Tournament Winner
                                </p>
                                <p className={`text-4xl font-black uppercase tracking-tighter transition-all duration-700 ${
                                    isCompleted ? 'text-white' : 'text-white/5 blur-[2px]'
                                }`}>
                                    {champion?.username || champion?.guestName || "In Progress"}
                                </p>
                            </div>


                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
