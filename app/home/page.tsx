"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../utils/api";
import { useUser } from "../components/UserProvider";
import HomeFrame from "../components/HomeFrame";
import HomeDashboard from "../components/HomeDashboard";

export default function HomePage() {
  const router = useRouter();
  const { user, loading: userLoading, logout } = useUser();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ wins: 0, losses: 0, rank: 0, points: 0 });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [tRes, lRes] = await Promise.all([
        authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.BASE),
        authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.GLOBAL_LEADERBOARD),
      ]);

      if (tRes.ok) {
        const data = await safeJson(tRes);
        setTournaments(Array.isArray(data) ? data : []);
      }

      if (lRes.ok) {
        const data = await safeJson(lRes);
        setLeaderboard(Array.isArray(data) ? data : []);
      }

      const myId = user?.id || user?.sub;
      if (myId) {
        const sRes = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.USER_STATS(myId));
        if (sRes.ok) {
          const sData = await safeJson(sRes);
          setStats(sData);
        }
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    } else if (!userLoading) {
      setLoading(false);
    }
  }, [user, userLoading]);

  // Sign-out logic now lives in one place: UserProvider.logout.
  // This page previously had its own copy of the same steps.
  const handleLogout = logout;

  useEffect(() => {
    if (!userLoading && !user) {
      router.push("/auth");
    }
  }, [user, userLoading, router]);

  if (!user && !userLoading) {
    return null;
  }

  return (
    <HomeFrame className="py-12 md:py-20" showPattern={true}>
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        {loading ? (
          <div className="grid grid-cols-4 gap-6 animate-pulse">
            <div className="col-span-4 h-64 bg-background border-4 border-white/10" />
            <div className="col-span-2 h-48 bg-background border-4 border-white/10" />
            <div className="col-span-1 h-48 bg-background border-4 border-white/10" />
            <div className="col-span-1 h-48 bg-background border-4 border-white/10" />
          </div>
        ) : (
          <HomeDashboard 
            user={user}
            tournaments={tournaments}
            leaderboard={leaderboard}
            stats={stats}
            handleLogout={handleLogout}
          />
        )}
      </div>
    </HomeFrame>
  );
}
