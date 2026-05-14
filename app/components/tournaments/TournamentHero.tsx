"use client";
import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import FadeIn from "../FadeIn";
import { BentoGrid, BentoItem } from "../ui/Bento";
import TournamentList from "./TournamentList";
import Link from "next/link";
import { Tournament } from "../../tournaments/types";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../utils/api";

export interface TournamentHeroProps {
    tournaments: Tournament[];
    canManage?: boolean;
    currentUserId?: string;
}

export function TournamentHeroContent({ tournaments, canManage, currentUserId: initialUserId }: TournamentHeroProps) {
    const [userId, setUserId] = useState<string | undefined>(initialUserId);
    const [loadingUser, setLoadingUser] = useState(!initialUserId);

    useEffect(() => {
        if (!initialUserId) {
            const fetchMe = async () => {
                try {
                    const res = await authenticatedFetch(API_ENDPOINTS.AUTH.ME);
                    if (res.ok) {
                        const data = await safeJson(res);
                        setUserId(data?.sub || data?.id);
                    }
                } catch (e) {
                    console.error("Hero user fetch failed:", e);
                } finally {
                    setLoadingUser(false);
                }
            };
            fetchMe();
        }
    }, [initialUserId]);

    const prioritizedTournaments = useMemo(() => {
        if (loadingUser) return [];
        
        // 1. Tournaments user is in (excluding completed)
        const userTournaments = tournaments.filter(t => 
            t.status !== "COMPLETED" && 
            t.participants?.some(p => p.userId === userId)
        );

        // 2. Available tournaments (OPEN/UPCOMING) that user is NOT in
        const availableTournaments = tournaments.filter(t => 
            (t.status === "OPEN" || t.status === "UPCOMING") && 
            !t.participants?.some(p => p.userId === userId)
        );

        return [...userTournaments, ...availableTournaments];
    }, [tournaments, userId, loadingUser]);

    const hasActiveContent = prioritizedTournaments.length > 0;

    if (loadingUser) {
        return (
            <div className="h-full w-full bg-surface border-2 border-white/5 animate-pulse flex items-center justify-center">
                <div className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">Synchronizing...</div>
            </div>
        );
    }

    if (!hasActiveContent) {
        return (
            <div className="h-full w-full bg-surface border-2 border-white/5 flex flex-col items-center justify-center space-y-8 p-12 text-center group">
                <div className="space-y-4">
                    <div className="w-16 h-[2px] bg-primary/20 mx-auto group-hover:w-32 transition-all duration-700" />
                    <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none font-poppins italic">
                        COMING<br/>
                        <span className="text-primary">SOON</span>
                    </h2>
                    <div className="w-16 h-[2px] bg-primary/20 mx-auto group-hover:w-32 transition-all duration-700" />
                </div>
                <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.5em] max-w-xs leading-relaxed">
                    We're currently organizing the next set of events for you.<br/>
                    Stay tuned for more tournaments!
                </p>
                
                {canManage && (
                    <Link 
                        href="/tournaments/manage"
                        className="px-8 py-3 border-2 border-primary text-primary hover:bg-primary hover:text-black font-black text-[10px] uppercase tracking-[0.3em] transition-all"
                    >
                        Manage Tournaments
                    </Link>
                )}

                <div className="flex gap-4">
                    <div className="px-4 py-1 border border-white/10 text-[8px] font-bold text-white/20 uppercase tracking-widest">Status: Preparing</div>
                    <div className="px-4 py-1 border border-white/10 text-[8px] font-bold text-white/20 uppercase tracking-widest">Mode: Browse</div>
                </div>
            </div>
        );
    }

    return (
        <TournamentList 
            tournaments={prioritizedTournaments} 
            variant="bento" 
            canManage={canManage}
            currentUserId={userId}
        />
    );
}

export default function TournamentHero(props: TournamentHeroProps) {
    return (
        <section>
            <FadeIn>
                <BentoGrid>
                    <BentoItem colSpan={4} rowSpan={2} className="min-h-[500px]">
                        <TournamentHeroContent {...props} />
                    </BentoItem>
                </BentoGrid>
            </FadeIn>
        </section>
    );
}
