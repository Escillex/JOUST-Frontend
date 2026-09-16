"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../utils/api";
import { Tournament } from "./types";
import HomeFrame from "../components/HomeFrame";
import TournamentDirectory from "../components/tournaments/TournamentDirectory";
import { useUser } from "../components/UserProvider";
import { Skeleton, SkeletonStatus } from "../components/ui/Skeleton";

export default function TournamentPage() {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    // The signed-in user comes from the shared context rather than a second
    // /auth/me: this page used to fetch it, and the carousel it rendered fetched
    // it again whenever the first call came back empty (i.e. for every guest).
    const { user } = useUser();

    const fetchTournaments = useCallback(async () => {
        setLoading(true);
        setFailed(false);
        try {
            const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.BASE);
            if (!res.ok) {
                setFailed(true);
                return;
            }
            const data = await safeJson(res);
            setTournaments(Array.isArray(data) ? data : []);
        } catch (error) {
            // A failed list is NOT an empty list. Saying "no tournaments" to
            // somebody whose connection dropped is the worst of both (Rule 8).
            console.error("Failed to fetch tournaments:", error);
            setFailed(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTournaments();
    }, [fetchTournaments]);

    const canManage = user?.roles?.some((r: string) => r === "ADMIN" || r === "ORGANIZER");

    return (
        <HomeFrame className="py-10 md:py-16" showPattern={true}>
            <div className="max-w-7xl mx-auto px-5 md:px-8 flex flex-col gap-8">
                {canManage && (
                    <div className="flex justify-end">
                        <Link
                            href="/tournaments/manage"
                            className="px-5 py-2.5 border-2 border-white/20 text-white text-[11px] font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-colors"
                        >
                            Manage tournaments
                        </Link>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col gap-8">
                        <SkeletonStatus label="Loading tournaments" />
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <Skeleton className="h-12 w-64" />
                            <Skeleton className="h-11 w-full md:w-80" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {[0, 1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} className="h-72 w-full" />
                            ))}
                        </div>
                    </div>
                ) : (
                    <TournamentDirectory
                        tournaments={tournaments}
                        userId={user?.sub || user?.id}
                        myGames={user?.games}
                        failed={failed}
                        onRetry={fetchTournaments}
                    />
                )}
            </div>
        </HomeFrame>
    );
}
