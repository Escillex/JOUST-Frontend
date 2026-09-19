"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../utils/api";
import { Tournament } from "../types";
import ManagerLayout from "../../components/manage/ManagerLayout";
import ManagerTournamentTable from "../../components/tournaments/manage/ManagerTournamentTable";
import { SkeletonPanel, SkeletonStatus } from "../../components/ui/Skeleton";

export default function ManageTournaments() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [message, setMessage] = useState("");
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // Filters. Applied client-side over the list already fetched — the manage list
  // is the caller's own tournaments (everything, for an admin), so there is
  // nothing to page through on the server and a round trip per keystroke would
  // be worse on a venue connection than filtering an array (Core Rule 8).
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [gameFilter, setGameFilter] = useState("ALL");
  const [organizerFilter, setOrganizerFilter] = useState("ALL");

  const refresh = async () => {
    // Only what this user can actually manage: an organizer has no rights over
    // tournaments they did not create, so listing those would be misleading.
    const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.MANAGEABLE);
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

  // The dashboard chrome — heading, refresh, "Create New" — renders immediately
  // and only the table region is skeletoned, so the page is navigable while the
  // tournament list is still in flight instead of being hidden behind a spinner.
  const isLoadingList = loading || isAuthorized === null;

  const gameOf = (t: Tournament) =>
    t.game?.name || (typeof t.format === "object" ? t.format?.gameName : null) || "Not set";
  // Anyone on the staff counts, owner or co-organizer: "show me what Ada is
  // involved in" is the question being asked, not "what did Ada create".
  const staffOf = (t: Tournament) => [
    t.createdBy?.username,
    ...(t.organizers ?? []).map((o) => o.user?.username),
  ].filter(Boolean) as string[];

  const games = useMemo(
    () => [...new Set(tournaments.map(gameOf))].sort((a, b) => a.localeCompare(b)),
    [tournaments],
  );
  const organizers = useMemo(
    () => [...new Set(tournaments.flatMap(staffOf))].sort((a, b) => a.localeCompare(b)),
    [tournaments],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tournaments.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (gameFilter !== "ALL" && gameOf(t) !== gameFilter) return false;
      if (organizerFilter !== "ALL" && !staffOf(t).includes(organizerFilter)) return false;
      if (!q) return true;
      // Id included so a tournament can be found by the id the table prints.
      return t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
    });
  }, [tournaments, query, statusFilter, gameFilter, organizerFilter]);

  // After every hook: returning earlier rendered fewer hooks than the previous
  // render once a player was bounced, and React threw ("Rendered fewer hooks
  // than expected") into the error boundary instead of redirecting quietly.
  if (isAuthorized === false) return null;

  const filtersActive =
    query.trim() !== "" || statusFilter !== "ALL" || gameFilter !== "ALL" || organizerFilter !== "ALL";
  const selectCls =
    "h-9 bg-background border border-white/20 text-white text-xs rounded px-2 focus:outline-none focus:border-primary transition-colors";

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
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Link href="/tournaments/manage/guests" className="border border-primary/40 px-4 py-2.5 text-xs font-semibold text-primary">Guest registration</Link>
            <button
              onClick={async () => {
                setLoading(true);
                await refresh();
                setLoading(false);
              }}
              className="px-4 py-2.5 bg-background border border-white/20 text-white font-semibold text-xs rounded hover:bg-white/10 transition-colors flex items-center justify-center group"
              title="Refresh Data"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <Link 
              href="/tournaments/create"
              className="flex-1 md:flex-none px-6 py-2.5 bg-primary text-black font-semibold text-xs rounded hover:brightness-90 transition-colors text-center flex items-center justify-center whitespace-nowrap"
            >
              Create New +
            </Link>
          </div>
        </div>

        {message && (
          <div className="p-3 bg-primary/10 border border-primary/20 rounded text-primary text-sm font-semibold">
            {message}
          </div>
        )}

        {isLoadingList ? (
          <>
            <SkeletonStatus label="Loading tournaments" />
            <SkeletonPanel rows={6} />
          </>
        ) : (
          <>
            {/* One filter row above the table it scopes. */}
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or ID"
                aria-label="Search tournaments"
                className="flex-1 h-9 bg-background border border-white/20 text-white text-xs rounded px-3 placeholder:text-white/30 focus:outline-none focus:border-primary transition-colors"
              />
              <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
                <option value="ALL">All statuses</option>
                {["UPCOMING", "OPEN", "ONGOING", "COMPLETED"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select aria-label="Filter by game" value={gameFilter} onChange={(e) => setGameFilter(e.target.value)} className={selectCls}>
                <option value="ALL">All games</option>
                {games.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <select aria-label="Filter by organizer" value={organizerFilter} onChange={(e) => setOrganizerFilter(e.target.value)} className={selectCls}>
                <option value="ALL">All organizers</option>
                {organizers.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              {filtersActive && (
                <button
                  onClick={() => { setQuery(""); setStatusFilter("ALL"); setGameFilter("ALL"); setOrganizerFilter("ALL"); }}
                  className="h-9 px-3 border border-white/20 text-white/60 hover:text-white text-xs rounded transition-colors whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>

            {filtersActive && (
              <p className="text-xs text-[#888888]">
                Showing {filtered.length} of {tournaments.length}
              </p>
            )}

            <ManagerTournamentTable
              tournaments={filtered}
            />
          </>
        )}
      </div>
    </ManagerLayout>
  );
}