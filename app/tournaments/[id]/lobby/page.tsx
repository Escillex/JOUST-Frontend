"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { authenticatedFetch, API_ENDPOINTS, safeJson } from "../../../utils/api";
import { usePolling } from "../../../utils/usePolling";
import { useTournamentSocket } from "../../../utils/useTournamentSocket";
import { useToast } from "../../../components/ui/Toast";
import { Tournament } from "../../types";
import Link from "next/link";
import ConnectionPill from "../../../components/ui/ConnectionPill";
import LastUpdated from "../../../components/ui/LastUpdated";
import { Skeleton, SkeletonPanel, SkeletonStatus } from "../../../components/ui/Skeleton";
import { motion, AnimatePresence } from "motion/react";

function TournamentLobbyContent() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  // When the roster on screen was last refreshed. Players watch this page
  // waiting to be seeded, so a stalled poll must not look like "no news yet".
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tournamentId) fetchData();
  }, [tournamentId]);

  // Real-time lobby updates: when someone joins or the tournament changes
  // status (for example the organizer starting it), refresh immediately.
  const { connected } = useTournamentSocket(tournamentId, {
    onTournamentUpdate: () => fetchData(true),
  });

  // temporary polling block - fallback behind the WebSocket connection
  // Refresh through the shared usePolling hook: it pauses while the tab is
  // hidden and stops once the tournament is COMPLETED, because finished
  // tournaments no longer change. While the socket is connected it drops to a
  // 5-minute safety-net tick (the socket drives freshness); when the socket
  // drops it returns to the 2-minute rate.
  usePolling(
    () => fetchData(true),
    connected ? 300000 : 120000,
    !!tournamentId && tournament?.status !== "COMPLETED",
  );
  // end of temporary polling block

  useEffect(() => {
    if (tournament?.name) {
      document.title = `Joust | ${tournament.name}`;
    }
  }, [tournament?.name]);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [meRes, tRes] = await Promise.all([
        authenticatedFetch(API_ENDPOINTS.AUTH.ME),
        authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.GET_ONE_SUMMARY(tournamentId!))
      ]);
      
      if (meRes.ok) {
        const data = await safeJson(meRes);
        setUser(data);
      }
      if (tRes.ok) {
        const data = await safeJson(tRes);
        setTournament(data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error("Lobby fetch failed:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const [withdrawing, setWithdrawing] = useState(false);

  // No confirm() popup (project rule): the action runs directly and the
  // button shows a "withdrawing" state while the request is in flight.
  const handleLeave = async () => {
    if (!myId || withdrawing) return;

    setWithdrawing(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.TOURNAMENTS.LEAVE(tournamentId), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: myId })
      });
      
      if (res.ok) {
        router.push(`/tournaments/${tournamentId}`);
      } else {
        const error = await safeJson(res);
        toast(error?.message || "Failed to leave the tournament", "error");
      }
    } catch (err) {
      console.error("Leave failed:", err);
      toast("Could not reach the server", "error");
    } finally {
      setWithdrawing(false);
    }
  };

  // The lobby shell — background, container, section heading — renders straight
  // away and only the tournament-dependent blocks are placeholders, so the page
  // keeps its final layout instead of snapping from a centred message into a
  // full page once the fetch lands.
  if (loading || !tournament) {
    return (
      <div className="min-h-screen bg-background text-white font-poppins relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, #52B946 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <main className="max-w-7xl mx-auto px-6 py-12 md:py-20 relative z-10">
          <SkeletonStatus label="Loading tournament lobby" />
          <section className="mb-20">
            <div className="flex items-center gap-4 mb-8">
              <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary">TOURNAMENT LOBBY</span>
              <div className="h-[1px] flex-1 bg-white/5" />
            </div>
            <div className="flex flex-col gap-6">
              <Skeleton className="h-[clamp(2.5rem,12vw,7rem)] w-3/4" />
              <div className="flex flex-wrap items-center gap-6">
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-7 w-40" />
              </div>
            </div>
          </section>
          <SkeletonPanel rows={6} />
        </main>
      </div>
    );
  }

  const myId = user?.sub || user?.id;
  const myParticipant = tournament.participants.find(p => p.userId === myId);

  return (
    <div className="min-h-screen bg-background text-white font-poppins selection:bg-primary selection:text-black relative overflow-hidden">
      {/* Technical Background Layer */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'radial-gradient(circle, #52B946 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      
      <main className="max-w-7xl mx-auto px-6 py-12 md:py-20 relative z-10">
        
        {/* Massive Hero Section */}
        <section className="mb-20">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4 mb-8"
          >
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary">TOURNAMENT LOBBY</span>
            <div className="h-[1px] flex-1 bg-white/5" />
          </motion.div>

          <div className="flex flex-col gap-6">
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[clamp(2.5rem,12vw,7rem)] font-[900] uppercase tracking-tighter italic leading-[0.85] text-white"
            >
              {tournament.name}
            </motion.h1>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-wrap items-center gap-6"
            >
               <div className="px-4 py-1.5 border border-primary text-primary text-[10px] font-black uppercase tracking-widest bg-primary/5">
                 {tournament.status}
               </div>
               <ConnectionPill connected={connected} />
               <LastUpdated lastUpdated={lastUpdated} />
               <div className="px-4 py-1.5 border border-white/10 text-white/40 text-[10px] font-black uppercase tracking-widest">
                 {(typeof tournament.format === 'object' ? tournament.format?.system : "UNKNOWN")?.replace("_", " ") || "UNKNOWN"}
               </div>
               <div className="px-4 py-1.5 border border-white/10 text-white/40 text-[10px] font-black uppercase tracking-widest">
                 PARTICIPANTS: {tournament.participants.length} / {tournament.maxPlayers}
               </div>
            </motion.div>
          </div>
        </section>

        {/* Operational Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left: Identity & Actions */}
          <div className="lg:col-span-4 space-y-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="relative p-10 bg-background/40 border border-white/5 group"
            >
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary" />
              
              <div className="space-y-8">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-primary uppercase tracking-[0.4em]">YOUR STATUS</span>
                  <div className="text-4xl font-black uppercase italic tracking-tighter text-white truncate">
                    {user?.username || "Guest"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 border-t border-white/5 pt-8">
                   <div className="flex flex-col gap-1">
                     <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">SEEDING</span>
                     <span className="text-2xl font-black text-white italic">#{myParticipant?.seed || "--"}</span>
                   </div>
                   <div className="flex flex-col gap-1">
                     <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">STATE</span>
                     <span className="text-2xl font-black text-primary italic">JOINED</span>
                   </div>
                </div>
              </div>
            </motion.div>

            <div className="flex flex-col gap-4">
              {(tournament.status === "OPEN" || tournament.status === "ONGOING" || tournament.status === "COMPLETED") && (
                <Link 
                  href={`/tournaments/${tournamentId}/bracket`}
                  className="w-full py-6 bg-primary text-black hover:bg-white transition-colors text-[11px] font-black uppercase tracking-[0.3em] text-center"
                >
                  {tournament.status === "ONGOING" ? "ENTER TOURNAMENT" : "VIEW TOURNAMENT"}
                </Link>
              )}

              <Link
                href={`/tournaments/${tournamentId}`}
                className="w-full py-6 border border-white/20 text-white/50 hover:border-white hover:text-white transition-all text-[11px] font-black uppercase tracking-[0.3em] text-center"
              >
                VIEW DETAILS
              </Link>

              {/* Leaving is only offered to a current participant while the
                  tournament is still OPEN — the backend rejects leaving once it
                  has started. Runs directly (no confirm popup, per project
                  rule) and shows a "leaving" state while the request is sent. */}
              {myParticipant && tournament.status === "OPEN" && (
                <button
                  onClick={handleLeave}
                  disabled={withdrawing}
                  className="w-full py-6 border border-red-500/40 text-red-400/80 hover:border-red-500 hover:text-red-400 transition-all text-[11px] font-black uppercase tracking-[0.3em] text-center disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {withdrawing ? "LEAVING…" : "LEAVE TOURNAMENT"}
                </button>
              )}
            </div>
          </div>

          {/* Right: Participant List */}
          <div className="lg:col-span-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-background/20 border border-white/5 p-8"
            >
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                 <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40">PARTICIPANT ROSTER</h2>
                 <div className="flex gap-2">
                   {[...Array(3)].map((_, i) => (
                     <div key={i} className="w-1.5 h-1.5 bg-primary/20" />
                   ))}
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <AnimatePresence>
                   {tournament.participants.map((p, idx) => (
                     <motion.div 
                       key={p.id}
                       initial={{ opacity: 0, scale: 0.95 }}
                       animate={{ opacity: 1, scale: 1 }}
                       transition={{ delay: idx * 0.05 }}
                       className={`p-6 border flex items-center justify-between transition-all group ${
                         p.userId === myId
                           ? "border-primary/30 bg-primary/5"
                           : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                       }${p.status === "FORFEITED" ? " opacity-40" : ""}`}
                     >
                       <div className="flex items-center gap-5">
                          <span className={`text-[10px] font-black italic w-6 ${p.userId === myId ? "text-primary" : "text-white/10"}`}>
                            {(idx + 1).toString().padStart(2, '0')}
                          </span>
                          <div className="flex flex-col">
                            <span className={`text-sm font-black uppercase tracking-wider transition-colors ${p.userId === myId ? "text-primary" : "text-white"}`}>
                              {p.user.username}
                            </span>
                            <span className="text-[8px] font-black text-white/10 uppercase tracking-widest group-hover:text-primary/40 transition-colors">
                              {p.status === "FORFEITED" ? "FORFEITED" : "PARTICIPANT"}
                            </span>
                          </div>
                       </div>
                       {p.userId === myId && (
                          <div className="flex gap-1">
                            <motion.div 
                              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="w-1.5 h-1.5 bg-primary"
                            />
                            <div className="w-1.5 h-1.5 bg-primary/20" />
                          </div>
                       )}
                     </motion.div>
                   ))}
                   
                   {/* Empty Slots */}
                   {[...Array(Math.max(0, 4 - tournament.participants.length))].map((_, i) => (
                     <div key={`empty-${i}`} className="p-6 border border-dashed border-white/5 bg-transparent flex items-center justify-center opacity-20">
                       <span className="text-[9px] font-black uppercase tracking-widest italic">WAITING FOR PLAYER</span>
                     </div>
                   ))}
                 </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Atmospheric Accents */}
      <div className="fixed -bottom-20 -left-20 w-[600px] h-[600px] bg-primary/[0.02] rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="fixed top-0 right-0 w-[40vw] h-[100vh] border-l border-white/[0.02] pointer-events-none -z-10" />
    </div>
  );
}

export default function TournamentLobbyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/5 border-t-primary animate-spin" />
      </div>
    }>
      <TournamentLobbyContent />
    </Suspense>
  );
}
