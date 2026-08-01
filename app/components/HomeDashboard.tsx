"use client";
import React from "react";
import FadeIn from "./FadeIn";
import TournamentHero, { TournamentHeroContent } from "./tournaments/TournamentHero";
import ProfileHeader from "./profile/ProfileHeader";
import MatchHistory from "./profile/MatchHistory";
import LeaderboardTable from "./leaderboard/LeaderboardTable";

interface HomeDashboardProps {
    user: any;
    tournaments: any[];
    leaderboard: any[];
    stats: any;
    handleLogout: () => void;
}

export default function HomeDashboard({ user, tournaments, leaderboard, stats, handleLogout }: HomeDashboardProps) {
    const canManage = user?.roles?.some((r: string) => r === "ADMIN" || r === "ORGANIZER");

    return (
        <FadeIn>
            <div className="grid grid-cols-1 lg:grid-cols-[2.25fr_1.75fr] lg:grid-rows-[auto_auto_1fr] gap-6 md:gap-8 items-stretch">
                {/* HERO: TOP LEFT (Spans 2 rows) */}
                <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2 flex flex-col min-h-[400px]">
                    <TournamentHeroContent 
                        tournaments={tournaments} 
                        canManage={canManage} 
                        currentUserId={user?.id || user?.sub}
                    />
                </div>

                {/* PROFILE: TOP RIGHT (Row 1) */}
                <div className="lg:col-start-2 lg:row-start-1 flex flex-col">
                    <ProfileHeader 
                        user={user} 
                        variant="bento" 
                        isOwnProfile={true}
                        onLogout={handleLogout}
                    />
                </div>

                {/* TACTICAL STATS: MIDDLE RIGHT (Row 2) */}
                <div className="lg:col-start-2 lg:row-start-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Rank Card */}
                    <div className="bg-surface border border-white/5 p-6 flex flex-col justify-between group hover:border-primary/40 transition-all min-h-[120px]">
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">RANK</span>
                        <div className="text-4xl font-black text-white italic group-hover:text-primary transition-colors">#{stats?.rank || "--"}</div>
                    </div>
                    {/* Points Card */}
                    <div className="bg-surface border border-white/5 p-6 flex flex-col justify-between group hover:border-primary/40 transition-all min-h-[120px]">
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">POINTS</span>
                        <div className="text-4xl font-black text-primary italic transition-colors">{stats?.points || 0}</div>
                    </div>
                    {/* Performance Card */}
                    <div className="bg-surface border border-white/5 p-6 flex flex-col justify-between group hover:border-primary/40 transition-all min-h-[120px]">
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">W / L / D</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-primary">{stats?.wins || 0}</span>
                            <span className="text-xs text-white/20 font-black">/</span>
                            <span className="text-2xl font-black text-white/40">{stats?.losses || 0}</span>
                            <span className="text-xs text-white/20 font-black">/</span>
                            <span className="text-2xl font-black text-white/20">{stats?.draws || 0}</span>
                        </div>
                    </div>
                    {/* Was an "OMW // OOMW" card. It was removed for the same
                        reason the equivalent column and tiles were removed from
                        LeaderboardTable and UserRankCard: this data comes from
                        the GLOBAL leaderboard, where leaderboard.service.ts:312-313
                        fills both omw and oomw with the player's own winRate.
                        Verified live — winRate, omw and oomw come back byte
                        identical. Labelling one number as two opponent-strength
                        metrics states something false, and the tooltip defining
                        the acronyms made it look authoritative. Win rate is the
                        value that is actually real, so that is what is shown.
                        Real OMW/OOMW exist per-tournament; restoring them
                        globally is plan item 7.2. */}
                    <div className="bg-surface border border-white/5 p-6 flex flex-col justify-between group hover:border-primary/40 transition-all min-h-[120px]">
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">WIN RATE</span>
                        <div className="text-2xl font-black text-white tracking-tighter">
                            {((stats?.matchWinPct ?? 0) * 100).toFixed(1)}%
                        </div>
                    </div>
                </div>

                {/* RECENT ACTIVITY: BOTTOM LEFT (Row 3) */}
                <div className="lg:col-start-1 lg:row-start-3 flex flex-col min-h-[450px]">
                    <MatchHistory userId={user?.id || user?.sub} />
                </div>

                {/* LEADERBOARDS: BOTTOM RIGHT (Row 3) */}
                <div className="lg:col-start-2 lg:row-start-3 flex flex-col min-h-[450px] bg-surface border border-white/5 overflow-hidden">
                    <LeaderboardTable 
                        entries={leaderboard} 
                        variant="bento" 
                        limit={10} 
                    />
                </div>
            </div>
        </FadeIn>
    );
}
