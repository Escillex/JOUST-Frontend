"use client";

import React from "react";
import { Match, LeaderboardEntry } from "../types";
import MobileMatchFeed from "./mobile/MobileMatchFeed";
import EliminationLayout from "../Formats/EliminationLayout";

interface MobileViewProps {
    tournament: any;
    leaderboard: LeaderboardEntry[];
    isAdmin: boolean;
    updating: string | null;
    onOpenScoring: (match: Match) => void;
    addLog: (action: string, details?: string) => void;
    viewMode: "CARD" | "BRACKET";
    currentUserId?: string | null;
}

export default function MobileView({
    tournament,
    leaderboard,
    isAdmin,
    updating,
    onOpenScoring,
    addLog,
    viewMode,
    currentUserId
}: MobileViewProps) {
    const fs = tournament?.format?.system;
    const isElimination = fs === "SINGLE_ELIMINATION" || fs === "DOUBLE_ELIMINATION" || fs === "HYBRID";
    // Open on the live round, not round 1 — and follow it as rounds finish,
    // unless the viewer has moved to another round (same rule as the desktop
    // card view). Indices are into the rounds sorted by number, as
    // MobileMatchFeed reads them.
    const sorted: { roundNumber: number; matches: { status?: string }[] }[] =
        [...(tournament?.rounds || [])].sort((a, b) => a.roundNumber - b.roundNumber);
    const firstOpen = sorted.findIndex((r) => r.matches.some((m) => m.status !== "COMPLETED"));
    const livePhase = firstOpen >= 0 ? firstOpen : Math.max(0, sorted.length - 1);
    const [activePhase, setActivePhase] = React.useState<number>(livePhase);
    const [followedPhase, setFollowedPhase] = React.useState<number>(livePhase);
    if (livePhase !== followedPhase) {
        setFollowedPhase(livePhase);
        if (activePhase === followedPhase) setActivePhase(livePhase);
    }

    return (
        <div className="h-full w-full overflow-hidden relative">
            {isElimination && viewMode === "BRACKET" ? (
                <div className="h-full w-full">
                    <EliminationLayout
                        tournament={tournament}
                        leaderboard={leaderboard}
                        // Scoring is a card-view-only feature (decided
                        // 2026-07-15). The bracket tree is for viewing,
                        // so it never shows SCORE buttons, even for
                        // admins.
                        isAdmin={false}
                        updating={updating}
                        onOpenScoring={onOpenScoring}
                        addLog={addLog}
                        currentUserId={currentUserId}
                    />
                </div>
            ) : (
                <MobileMatchFeed 
                    tournament={tournament}
                    leaderboard={leaderboard}
                    isAdmin={isAdmin}
                    updating={updating}
                    onOpenScoring={onOpenScoring}
                    addLog={addLog}
                    activePhase={activePhase}
                    setActivePhase={setActivePhase}
                    currentUserId={currentUserId}
                />
            )}
        </div>
    );
}
