"use client";
import { useState, useEffect } from "react";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../utils/api";
import { Tournament } from "./types";
import HomeFrame from "../components/HomeFrame";
import TournamentHero from "../components/tournaments/TournamentHero";
import TournamentDirectory from "../components/tournaments/TournamentDirectory";

export default function TournamentPage() {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await Promise.all([fetchTournaments(), fetchUser()]);
            setLoading(false);
        };
        init();
    }, []);

    const fetchUser = async () => {
        try {
            const res = await authenticatedFetch(API_ENDPOINTS.AUTH.ME);
            if (res.ok) {
                const data = await safeJson(res);
                setUser(data);
            }
        } catch (error) {
            console.error("Failed to fetch user:", error);
        }
    };

    const fetchTournaments = async () => {
        try {
            const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.BASE);
            if (res.ok) {
                const data = await safeJson(res);
                setTournaments(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Failed to fetch tournaments:", error);
        }
    };

    if (loading) {
        return (
            <HomeFrame className="py-40">
                <div className="max-w-7xl mx-auto px-8 space-y-12 animate-pulse">
                    <div className="h-[600px] w-full bg-background border-4 border-white/10" />
                </div>
            </HomeFrame>
        );
    }

    return (
        <HomeFrame className="py-12 md:py-24" showPattern={true}>
            <div className="max-w-7xl mx-auto px-6 md:px-8 space-y-24">
                <TournamentHero 
                    tournaments={tournaments} 
                    canManage={user?.roles?.some((r: string) => r === "ADMIN" || r === "ORGANIZER")}
                    currentUserId={user?.sub || user?.id}
                />
                <TournamentDirectory tournaments={tournaments} />
            </div>
        </HomeFrame>
    );
}