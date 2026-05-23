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
    const [activePhase, setActivePhase] = React.useState<number>(0);

    return (
        <div className="h-full w-full overflow-hidden relative">
            {isElimination && viewMode === "BRACKET" ? (
                <div className="h-full w-full">
                    <EliminationLayout 
                        tournament={tournament}
                        leaderboard={leaderboard}
                        isAdmin={isAdmin}
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
