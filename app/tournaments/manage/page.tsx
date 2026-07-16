"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../utils/api";
import { Tournament } from "../types";
import ManagerLayout from "../../components/manage/ManagerLayout";
import ManagerTournamentTable from "../../components/tournaments/manage/ManagerTournamentTable";

export default function ManageTournaments() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [message, setMessage] = useState("");
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  const refresh = async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.BASE);
    const data = await safeJson(res);
    if (Array.isArray(data)) setTournaments(data);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const meRes = await authenticatedFetch(API_ENDPOINTS.AUTH.ME);
      if (!meRes.ok) { router.push("/auth"); return; }
      const me = await safeJson(meRes);
      const roles = me?.roles || [];
      if (!roles.includes("ADMIN") && !roles.includes("ORGANIZER")) {
        setIsAuthorized(false);
        router.push("/");
        return;
      }
      setIsAuthorized(true);
      await refresh();
      setLoading(false);
    };
    checkAuth();
  }, []);

  const [completingId, setCompletingId] = useState<string | null>(null);

  const handleComplete = async (id: string) => {
    if (completingId) return;
    setCompletingId(id);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.COMPLETE(id), { method: "PATCH" });
      if (res.ok) {
        setMessage("Tournament finalized");
      } else {
        const data = await safeJson(res);
        setMessage(data?.message || "Failed to finalize tournament");
      }
      await refresh();
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setCompletingId(null);
    }
  };

  if (isAuthorized === false) return null;

  if (loading || isAuthorized === null) {
    return (
      <div className="min-h-screen bg-[#1B1B1B] flex items-center justify-center font-sans">
        <div className="text-white/50 text-sm">Loading Organizer Dashboard...</div>
      </div>
    );
  }

  return (
    <ManagerLayout breadcrumbs={[{ label: "TOURNAMENTS" }]}>
      <div className="space-y-8 font-sans">
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-white">
              Tournament Management
            </h1>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={async () => {
                setLoading(true);
                await refresh();
                setLoading(false);
              }}
              className="px-4 py-2.5 bg-[#1B1B1B] border border-white/20 text-white font-semibold text-xs rounded hover:bg-white/10 transition-colors flex items-center justify-center group"
              title="Refresh Data"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <Link 
              href="/tournaments/create"
              className="flex-1 md:flex-none px-6 py-2.5 bg-[#52B946] text-black font-semibold text-xs rounded hover:brightness-90 transition-colors text-center flex items-center justify-center whitespace-nowrap"
            >
              Create New +
            </Link>
          </div>
        </div>

        {message && (
          <div className="p-3 bg-[#52B946]/10 border border-[#52B946]/20 rounded text-[#52B946] text-sm font-semibold">
            {message}
          </div>
        )}

        <ManagerTournamentTable
          tournaments={tournaments}
          onComplete={handleComplete}
          completingId={completingId}
        />
      </div>
    </ManagerLayout>
  );
}